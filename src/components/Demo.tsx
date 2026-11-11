// The working demo: route → plan → analysis → tour → check-in or dossier.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { haversine } from '../lib/terrain-math';
import { routePoints } from '../lib/route-points';
import { useVoice } from '../lib/voice';
import { RiskMap, type RiskMapHandle } from './RiskMap';
import { Profile, fmt, km, hrs, langName, gain, smsText, problemName } from './fragments';
import { SAMPLE, BULLETIN, REPORTS, AI, DEMO_NOW, TOUR_DAY, type Plan } from '../lib/data';
import { parseGpx } from '../lib/gpx';
import { evaluate, alertTime, GRACE_MINUTES, RULES, DANGER_NAME, type Evaluation, type Flag } from '../lib/rules';
import { computeProfile } from '../lib/analyse';
import { interpretPlan, type PlanResult } from '../lib/interpret';
import type { ProfilePoint } from '../lib/terrain-math';

interface RouteIn { name: string; coords: number[][]; sample: boolean; eles?: (number | null)[] }
type TourState = 'idle' | 'active' | 'sent' | 'closed';
const CONTACTS = [{ name: 'Eleni', relation: 'sister' }, { name: 'Kostas', relation: 'club friend' }];
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;


function buildGpx(route: RouteIn, ev: Evaluation) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const wpt = [
    ...ev.flags.map((f) => `  <wpt lat="${f.center[1]}" lon="${f.center[0]}"><name>FLAG km ${km(f.from)}</name><desc>${esc(`Up to ${Math.round(f.maxSlope)} deg, ${f.aspect}. Bulletin danger ${f.bulletin.danger}, ${f.bulletin.problem}. ${f.agree}/3 signals.`)}</desc></wpt>`),
    ...ev.noted.map((n) => `  <wpt lat="${n.coords[0][1]}" lon="${n.coords[0][0]}"><name>STEEP km ${km(n.from)}</name><desc>Up to ${Math.round(n.maxSlope)} deg, ${n.aspect}. Not named in the bulletin.</desc></wpt>`),
  ].join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="AlpenGuard demo" xmlns="http://www.topografix.com/GPX/1/1">\n${wpt}\n  <trk><name>${esc(route.name)}</name><trkseg>\n${route.coords.map((c) => `    <trkpt lat="${c[1]}" lon="${c[0]}"/>`).join('\n')}\n  </trkseg></trk>\n</gpx>\n`;
}

const DIRS: Record<string, string> = { N: 'north', NE: 'north-east', E: 'east', SE: 'south-east', S: 'south', SW: 'south-west', W: 'west', NW: 'north-west' };
const dirName = (a: string) => DIRS[a] ?? a;
const listOf = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

/** Why a stretch is flagged, as three plain lines: what the terrain says, what the bulletin says, what climbers said. */
function Findings({ flag }: { flag: Flag }) {
  const [orig, setOrig] = useState(false);
  const r = flag.reports[0];
  return (
    <>
    <dl className="ledger">
      <div>
        <dt>Slope</dt>
        <dd>Up to {Math.round(flag.maxSlope)}°, facing {dirName(flag.aspect)}, between {fmt(flag.elevMin)} and {fmt(flag.elevMax)} m.<small>Measured from elevation data every 25 m.</small></dd>
      </div>
      <div>
        <dt>Bulletin</dt>
        <dd><span className="eaws" aria-hidden="true">{flag.bulletin.danger}</span>{DANGER_NAME[flag.bulletin.danger - 1]} ({flag.bulletin.danger}). {problemName(flag.bulletin.problem)} on {listOf(flag.bulletin.aspects.map(dirName))} slopes above {fmt(flag.bulletin.above ?? 0)} m.<small>{flag.bulletin.region} bulletin, issued {hrs(flag.bulletin.ageHours)} before.</small></dd>
      </div>
      <div>
        <dt>Report</dt>
        {r ? (
          <dd>
            <q lang={orig ? r.lang : 'en'}>{orig ? r.original : r.translation}</q>
            <small>{r.author}, in {langName(r.lang)}, {hrs(r.ageHours)} ago, {fmt(r.distance)} m from the stretch. <button type="button" className="linkish" onClick={() => setOrig(!orig)} aria-pressed={orig}>{orig ? 'Show translation' : 'Show original'}</button></small>
            {r.signals.length > 0 && <small>Warning signs: {listOf(r.signals)}.</small>}
          </dd>
        ) : <dd>No report within {RULES.reportRadius} m in the last {RULES.reportMaxAge} hours.</dd>}
      </div>
    </dl>
    <p className="ledger-note">No flag doesn’t mean safe. It means the rules found nothing to say.</p>
    </>
  );
}

/** The demo's climber reports are all in the Beaufortain; for routes elsewhere none apply. */
function reportsNear(coords: number[][]) {
  return REPORTS.filter((r) => coords.some((c, i) => i % 5 === 0 && haversine(c, r.point) < 10_000));
}

export function Demo() {
  const [route, setRoute] = useState<RouteIn>({ name: SAMPLE.name, coords: SAMPLE.coords, sample: true });
  const [routeError, setRouteError] = useState('');
  const [routeNotes, setRouteNotes] = useState<string[]>([]);
  const [who, setWho] = useState('Giorgos');
  const [planText, setPlanText] = useState(AI.plan.input);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [analysis, setAnalysis] = useState<{ profile: ProfilePoint[]; ev: Evaluation; source: 'live' | 'cached'; alt?: Evaluation } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAlt, setShowAlt] = useState(true);
  const [imagery, setImagery] = useState(false);
  const [tour, setTour] = useState<TourState>('idle');
  const [clock, setClock] = useState(0);
  const [running, setRunning] = useState(false);
  const [closedAt, setClosedAt] = useState('');
  const [wasLate, setWasLate] = useState(false);
  const mapRef = useRef<RiskMapHandle>(null);
  const selectFlag = useCallback((id: string) => { setSelected(id); mapRef.current?.focusFlag(id); }, []);
  const fileRef = useRef<HTMLInputElement>(null);
  const mapBoxRef = useRef<HTMLDivElement>(null);

  const effPlan: Plan = plan?.plan ?? { depart: '08:00', return: '14:00', party: [], clothing: '', date: 'tomorrow' };
  const depart = effPlan.depart || '08:00', ret = effPlan.return || '14:00';
  const alertAt = alertTime(ret);
  const voice = useVoice(useCallback((t: string) => { setPlanText(t); setPlan(null); }, []));

  // The simulated clock. 10 simulated minutes per second; the alert itself is a plain comparison.
  useEffect(() => {
    if (tour !== 'active' || !running) return;
    const id = setInterval(() => setClock((c) => c + 1), 100);
    return () => clearInterval(id);
  }, [tour, running]);
  useEffect(() => {
    if (tour === 'active' && clock >= toMin(alertAt)) { setTour('sent'); setRunning(false); }
  }, [clock, tour, alertAt]);

  // As soon as a file is uploaded, read its heights from the terrain in the background, so the map can mark
  // the real high point before you press Check. Check then reuses them instead of reading the terrain twice.
  const [pre, setPre] = useState<{ coords: number[][]; profile: ProfilePoint[] } | null>(null);
  useEffect(() => {
    if (route.sample) return;
    let live = true;
    computeProfile(route.coords, () => {}).then(({ profile }) => { if (live) setPre({ coords: route.coords, profile }); }).catch(() => {});
    return () => { live = false; };
  }, [route]);
  const preProfile = pre && pre.coords === route.coords ? pre.profile : null;

  const resetAnalysis = () => { setAnalysis(null); setStatus('idle'); setSelected(null); setTour('idle'); setProgress(0); };

  async function onFile(f: File | undefined) {
    if (fileRef.current) fileRef.current.value = ''; // so choosing the same file again still triggers
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) { setRouteError('This file is over 25 MB. Simplify the track in your app and try again.'); return; }
    let text = '';
    try { text = await f.text(); } catch { setRouteError('The file couldn’t be opened. Try exporting it again.'); return; }
    const r = parseGpx(text);
    if (!r.ok) { setRouteError(r.reason); return; }
    setRouteError('');
    setRouteNotes(r.notes);
    setRoute({ name: r.name || f.name.replace(/\.gpx$/i, ''), coords: r.coords, eles: r.eles, sample: false });
    resetAnalysis();
  }

  async function readPlan() {
    setPlanBusy(true);
    const r = await interpretPlan(planText);
    setPlan(r); setPlanBusy(false);
    return r;
  }

  async function analyse() {
    setStatus('running'); setProgress(0); setSelected(null); setTour('idle');
    if (!plan && planText.trim()) await readPlan();
    try {
      const { profile, source } = preProfile ? { profile: preProfile, source: 'live' as const } : await computeProfile(route.coords, setProgress, route.sample ? SAMPLE.cachedProfile : undefined);
      const ev = evaluate(profile, BULLETIN, reportsNear(route.coords), AI.reports, DEMO_NOW);
      const alt = route.sample ? evaluate(SAMPLE.cachedAlternative, BULLETIN, REPORTS, AI.reports, DEMO_NOW) : undefined;
      setAnalysis({ profile, ev, source, alt });
      setStatus('done');
      if (ev.flags[0]) {
        setSelected(ev.flags[0].id);
        const narrow = window.matchMedia('(max-width: 1080px)').matches;
        if (narrow) mapBoxRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        setTimeout(() => mapRef.current?.focusFlag(ev.flags[0].id), narrow ? 700 : 300);
      }
    } catch { setStatus('error'); }
  }

  function startTour() { setClock(toMin(depart) - 5); setTour('active'); setRunning(true); setClosedAt(''); }
  function checkIn() { setWasLate(tour === 'sent'); setClosedAt(hhmm(clock)); setTour('closed'); setRunning(false); }
  function download() {
    if (!analysis) return;
    const url = URL.createObjectURL(new Blob([buildGpx(route, analysis.ev)], { type: 'application/gpx+xml' }));
    const a = document.createElement('a'); a.href = url; a.download = `${route.name.replace(/\W+/g, '-').toLowerCase()}-alpenguard.gpx`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const ev = analysis?.ev;
  const nearReports = useMemo(() => reportsNear(route.coords), [route.coords]);
  // Markers: the start, the real high point of the profile (not the file's last point), and a finish if it differs.
  const points = useMemo(() => routePoints(route.coords, analysis?.profile ?? preProfile ?? (route.sample ? SAMPLE.cachedProfile : null), { sample: route.sample, eles: route.eles }), [route, analysis, preProfile]);
  const flag = ev?.flags.find((f) => f.id === selected) ?? ev?.flags[0];
  const len = analysis ? analysis.profile.at(-1)!.d : null;
  const party = effPlan.party.length ? effPlan.party.join(', ') : 'nobody named';
  const altLen = SAMPLE.cachedAlternative.at(-1)!.d;

  return (
    <section className="demo" id="demo" aria-labelledby="demo-h">
      <div className="demo-head">
        <h2 id="demo-h">Run the sample tour</h2>
        <p>A real route on real terrain in the Beaufortain, French Alps. The bulletin, the climber reports and the AI's answers are test data, and nothing is sent anywhere.</p>
      </div>

      <div className="demo-grid">
        <div className="demo-steps">
          <div className="step" data-ui>
            <h3>Your route</h3>
            <p className="step-value"><b>{route.name}</b>{len ? <span>{km(len)} km, climbing {fmt(gain(analysis!.profile))} m</span> : <span>{route.sample ? 'Loaded and ready to check' : 'Uploaded, ready to check'}</span>}</p>
            <div className="row">
              <button type="button" className="btn-ghost" onClick={() => { setRoute({ name: SAMPLE.name, coords: SAMPLE.coords, sample: true }); resetAnalysis(); }} disabled={route.sample}>{route.sample ? 'Sample tour loaded' : 'Use the sample tour'}</button>
              <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>Upload a GPX</button>
              <input ref={fileRef} type="file" accept=".gpx,application/gpx+xml" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            </div>
            {routeError && <p className="error" role="alert">{routeError}</p>}
            {!route.sample && routeNotes.map((n) => <p className="hint" key={n}>{n}</p>)}
            {!route.sample && <p className="hint">The demo bulletin and reports cover the Beaufortain only. On your own route the slopes are computed for real; the bulletin comparison is illustrative.</p>}
          </div>

          <div className="step" data-ui>
            <h3>Your plan, in your own words</h3>
            <label className="field">
              <span>Your name</span>
              <input value={who} onChange={(e) => setWho(e.target.value)} />
            </label>
            <label className="field">
              <span>Say or type when you leave, who with, what you wear, when you'll be back</span>
              <textarea rows={3} value={planText} onChange={(e) => { setPlanText(e.target.value); setPlan(null); }} />
            </label>
            <div className="row">
              <button type="button" className="btn-ghost" onClick={readPlan} disabled={planBusy || !planText.trim()}>{planBusy ? 'Reading…' : 'Read the plan'}</button>
              {voice.supported && (() => {
                const st = voice.state;
                const busy = st.kind === 'loading' || st.kind === 'transcribing';
                const live = st.kind === 'listening' || st.kind === 'recording';
                const label = st.kind === 'listening' ? 'Listening… tap to stop' : st.kind === 'recording' ? `Recording ${st.seconds}s · tap to stop` : st.kind === 'loading' ? `Preparing speech model ${st.progress}%` : st.kind === 'transcribing' ? 'Writing it down…' : 'Speak it';
                return <button type="button" className={`btn-ghost${live ? ' is-live' : ''}`} onClick={live ? voice.stop : voice.start} disabled={busy} aria-live="polite">{label}</button>;
              })()}
            </div>
            {voice.state.kind === 'error' && <p className="error" role="alert">{voice.state.message}</p>}
            {(voice.state.kind === 'recording' || voice.state.kind === 'loading') && <p className="hint">Your voice is turned into text on this device; the audio is never uploaded. The first time, a speech model (about 80 MB) downloads once and is cached.</p>}
            {!plan && !planBusy && <p className="hint">It's read automatically when you check the route.</p>}
            {plan && (
              <div className="parsed" aria-live="polite">
                <dl>
                  <div><dt>Leaves</dt><dd>{effPlan.depart || '—'}</dd></div>
                  <div><dt>Back by</dt><dd>{effPlan.return || '—'}</dd></div>
                  <div><dt>With</dt><dd>{party}</dd></div>
                  <div><dt>Wearing</dt><dd>{effPlan.clothing || '—'}</dd></div>
                </dl>
                <p className="hint">{plan.source === 'cached-ai' ? 'Read by the language model (cached answer in this demo).' : 'Read by the offline fallback parser, because the live model is not connected in this demo.'}
                  {plan.missing.length > 0 && ` Missing: ${plan.missing.join(', ')}. The demo uses 08:00 and 14:00 where a time is missing.`}</p>
              </div>
            )}
          </div>

          <div className="step" data-ui>
            <h3>Check the route</h3>
            <p className="hint">It reads the slope and aspect every 25 m from elevation data, then holds them against the {BULLETIN.regions[0].name} bulletin{nearReports.length ? ` and ${nearReports.length} recent reports nearby` : ''}.</p>
            <button type="button" className="btn" onClick={analyse} disabled={status === 'running'}>{status === 'running' ? `Reading the terrain… ${Math.round(progress * 100)}%` : status === 'done' ? 'Check again' : 'Check the route'}</button>
            {status === 'running' && <div className="bar" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ transform: `scaleX(${progress})` }} /></div>}
            {status === 'error' && <p className="error" role="alert">The elevation tiles did not load, so the slopes could not be computed. Check your connection and try again.</p>}
          </div>

          {ev && (
            <div className="step results" id="demo-results" aria-live="polite">
              <h3>What it found</h3>
              <p className="find-lead">
                {ev.flags.length === 0
                  ? 'Nothing is flagged. No stretch of 30° or more lies on an aspect and at an elevation the bulletin names.'
                  : ev.flags.length === 1
                    ? `One stretch is flagged, from km ${km(ev.flags[0].from)} to ${km(ev.flags[0].to)}. ${ev.flags[0].agree === 3 ? 'The slope, the bulletin and a climber’s report agree there.' : 'The slope and the bulletin agree there.'}`
                    : `${ev.flags.length} stretches are flagged. Pick one to read why.`}
              </p>
              {ev.flags.length > 1 && (
                <p className="find-pick" role="tablist" aria-label="Flagged stretches">
                  {ev.flags.map((f) => <button key={f.id} type="button" role="tab" aria-selected={f.id === flag?.id} className="linkish" onClick={() => selectFlag(f.id)}>km {km(f.from)}</button>)}
                </p>
              )}
              {flag && <Findings flag={flag} />}
              {!route.sample && <p className="hint">Held against the demo bulletin for the Beaufortain, for illustration. On a real tour AlpenGuard uses the bulletin for your region.</p>}
              {analysis!.source === 'cached' && <p className="hint">The elevation tiles were unreachable, so this uses the profile computed in advance.</p>}
              {ev.noted.length > 0 && (
                <p className="find-also">
                  Also steep, but not flagged: {ev.noted.slice(0, 2).map((n, i) => <span key={n.from}>{i ? '; ' : ''}km {km(n.from)}, up to {Math.round(n.maxSlope)}° facing {dirName(n.aspect)}</span>)}.
                  {' '}The bulletin doesn’t name {ev.noted.length > 1 ? 'those slopes' : 'that slope'}, so the rules stay quiet. {ev.noted.length > 1 ? 'They are' : 'It is'} still steep.
                </p>
              )}
              {ev.noted.length > 2 && (
                <details className="excluded">
                  <summary>{ev.noted.length - 2} more steep stretches</summary>
                  <ul>{ev.noted.slice(2).map((n) => <li key={n.from}>km {km(n.from)} to {km(n.to)}: up to {Math.round(n.maxSlope)}°, facing {dirName(n.aspect)}, {fmt(n.elevMin)} to {fmt(n.elevMax)} m</li>)}</ul>
                </details>
              )}
              {analysis!.alt && (
                <p className="find-also">A way round: {km(altLen)} km by the other side, leaving the route at km 0.27. {analysis!.alt.flags.length === 0 ? 'Nothing on it is flagged.' : `${analysis!.alt.flags.length} stretches on it are flagged.`}</p>
              )}
              <details className="excluded">
                <summary>{ev.excludedReports.length} reports set aside, and why</summary>
                <ul>{ev.excludedReports.map((r) => <li key={r.id}>{langName(r.lang)}, {hrs(r.ageHours)} old: “{r.translation}” <span className="muted">{r.reason}</span></li>)}</ul>
              </details>
              <div className="row">
                <button type="button" className="btn-ghost" onClick={download}>Download GPX with waypoints</button>
              </div>
            </div>
          )}

          {ev && (
            <div className={`step tour tour-${tour}`} data-ui>
              <h3>On the mountain</h3>
              {tour === 'idle' && <>
                <p className="hint">{TOUR_DAY}. Leaves {depart}, back by {ret}{plan?.plan.return ? ', from your plan' : ' (default: no return time in your plan)'}. If {who || 'you'} {who ? "hasn't" : "haven't"} checked in by {alertAt}, the dossier goes to {CONTACTS.map((c) => c.name).join(' and ')}.</p>
                <button type="button" className="btn" onClick={startTour}>Start the tour</button>
              </>}
              {tour !== 'idle' && (
                <div className="clock">
                  <p className="clock-time" aria-live="off">{hhmm(clock)}</p>
                  <p className="clock-state">{tour === 'active' ? (clock < toMin(ret) ? `Waiting. Alert at ${alertAt}.` : `Past ${ret}. Alert in ${toMin(alertAt) - clock} min.`) : tour === 'sent' ? `Dossier sent to ${CONTACTS.map((c) => c.name).join(' and ')}` : `Checked in at ${closedAt}`}</p>
                  <div className="bar"><i style={{ transform: `scaleX(${Math.min(1, Math.max(0, (clock - toMin(depart)) / (toMin(alertAt) - toMin(depart))))})` }} /></div>
                </div>
              )}
              {tour === 'active' && (
                <div className="row">
                  <button type="button" className="btn" onClick={checkIn}>I'm back</button>
                  <button type="button" className="btn-ghost" onClick={() => setRunning(!running)}>{running ? 'Pause clock' : 'Run clock'}</button>
                  <button type="button" className="btn-ghost" onClick={() => setClock(toMin(ret) - 2)}>Skip to {ret}</button>
                </div>
              )}
              {tour === 'closed' && <>
                <p className="hint">Tour closed. The route, the plan and the contacts' copy were deleted.{wasLate ? ' Your contacts get a second message: you are back.' : ' Nothing was sent.'}</p>
                <div className="row"><button type="button" className="btn-ghost" onClick={startTour}>Run the tour again</button></div>
              </>}
              {tour === 'sent' && (
                <div className="dossier" aria-live="assertive">
                  <div className="sms">
                    <p className="sms-to">SMS to {CONTACTS[0].name} ({CONTACTS[0].relation}) · {alertAt}</p>
                    <p>{smsText({ who, ret, route: route.name, party: effPlan.party, clothing: effPlan.clothing, flag })}</p>
                  </div>
                  <div className="email">
                    <p className="email-subj">Email · {who} is overdue from a ski tour</p>
                    <dl>
                      <div><dt>Plan</dt><dd>{TOUR_DAY}, left {depart}, back by {ret}</dd></div>
                      <div><dt>Route</dt><dd>{route.name}, {len ? `${km(len)} km` : ''} (GPX attached)</dd></div>
                      <div><dt>Critical points</dt><dd>{ev.flags.length ? ev.flags.map((f) => `km ${km(f.from)}–${km(f.to)}, ${fmt(f.elevMin)}–${fmt(f.elevMax)} m, ${f.aspect}`).join('; ') : 'None flagged'}</dd></div>
                      <div><dt>Party</dt><dd>{who}, {party}</dd></div>
                      <div><dt>Clothing</dt><dd>{effPlan.clothing || 'not given'}</dd></div>
                      <div><dt>What to do</dt><dd>Try to call {who}. If you can't reach them, call 112 and read them this email.</dd></div>
                    </dl>
                  </div>
                  <div className="row"><button type="button" className="btn" onClick={checkIn}>I'm back (late)</button></div>
                  <p className="hint">Simulated. In AlpenGuard this runs on the server, so a dead phone or a lost signal doesn't stop it. Only the {GRACE_MINUTES}-minute rule decides; no AI is involved.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="demo-map">
          <div className="demo-map-sticky" ref={mapBoxRef}>
            <RiskMap ref={mapRef} mode="demo" route={route.coords} points={points} alternative={route.sample && showAlt && ev ? SAMPLE.alternative : null}
              evaluation={ev} reports={nearReports} selected={selected} onSelectFlag={selectFlag} imagery={imagery} label="Demo risk map" />
            <div className="map-tools" data-ui>
              <label><input type="checkbox" checked={imagery} onChange={(e) => setImagery(e.target.checked)} /> Satellite</label>
              {route.sample && ev && <label><input type="checkbox" checked={showAlt} onChange={(e) => setShowAlt(e.target.checked)} /> Alternative</label>}
              <button type="button" className="linkish" onClick={() => mapRef.current?.overview()}>Whole route</button>
            </div>
            {analysis && <Profile profile={analysis.profile} flags={ev!.flags} />}
            {analysis && <a className="textlink demo-jump" href="#demo-results">Read the result</a>}
          </div>
        </div>
      </div>
    </section>
  );
}

