// Small, real pieces of the product's interface, reused across the page.
import { useState } from 'react';
import { ASPECTS, toAspect8, type ProfilePoint } from '../lib/terrain-math';
import { DANGER_NAME, RULES, type Flag, type Noted, type ReportMatch } from '../lib/rules';

export const km = (m: number) => (m / 1000).toFixed(2);
export const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');
export const hrs = (h: number) => (h < 1 ? 'under an hour' : `${Math.round(h)} h`);
const LANG: Record<string, string> = { fr: 'French', de: 'German', it: 'Italian', en: 'English' };
export const langName = (l: string) => LANG[l] ?? l.toUpperCase();
const PROBLEM: Record<string, string> = { wind_slab: 'Wind slab', persistent_weak_layers: 'Persistent weak layer', new_snow: 'New snow', wet_snow: 'Wet snow', gliding_snow: 'Gliding snow' };
export const problemName = (p: string) => PROBLEM[p] ?? p.replace(/_/g, ' ');

/** EAWS danger level chip: number, name and the scale's own colour. Never colour alone. */
export function Danger({ level }: { level: number }) {
  return <span className={`danger danger-${level}`}><b>{level}</b> {DANGER_NAME[level - 1]}</span>;
}

/** The bulletin's aspect rose: the eight slope directions, with the named ones filled. */
export function AspectRose({ aspects, size = 88, highlight }: { aspects: string[]; size?: number; highlight?: string }) {
  const r = size / 2, ir = r * 0.34;
  return (
    <svg className="rose" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Aspects named in the bulletin: ${aspects.join(', ')}`}>
      {ASPECTS.map((a, i) => {
        const a0 = ((i * 45 - 22.5 - 90) * Math.PI) / 180, a1 = ((i * 45 + 22.5 - 90) * Math.PI) / 180;
        const p = (ang: number, rad: number) => `${r + rad * Math.cos(ang)},${r + rad * Math.sin(ang)}`;
        const on = aspects.includes(a);
        return (
          <path key={a} d={`M${p(a0, ir)} L${p(a0, r - 1)} A${r - 1},${r - 1} 0 0 1 ${p(a1, r - 1)} L${p(a1, ir)} A${ir},${ir} 0 0 0 ${p(a0, ir)}Z`}
            className={`rose-seg${on ? ' on' : ''}${highlight === a ? ' hi' : ''}`} />
        );
      })}
      <text x={r} y={r + 4} textAnchor="middle" className="rose-n">N</text>
    </svg>
  );
}

export function ReportQuote({ m, compact }: { m: ReportMatch; compact?: boolean }) {
  const [orig, setOrig] = useState(false);
  return (
    <div className="quote">
      <p className="quote-meta">{langName(m.lang)} report · {hrs(m.ageHours)} old · {fmt(m.distance)} m from the stretch</p>
      <p className="quote-text" lang={orig ? m.lang : 'en'}>“{orig ? m.original : m.translation}”</p>
      {!compact && (
        <button type="button" className="linkish" onClick={() => setOrig(!orig)} aria-pressed={orig}>
          {orig ? 'Show translation' : `Show the ${langName(m.lang)} original`}
        </button>
      )}
      {m.signals.length > 0 && <p className="signals">{m.signals.map((s) => <span key={s}>{s}</span>)}</p>}
    </div>
  );
}

/** The flag card: one flagged stretch with the three signals that agree, each with its source and age. */
export function FlagCard({ flag, compact }: { flag: Flag; compact?: boolean }) {
  return (
    <article className="flag-card" data-ui aria-label={`Flagged stretch km ${km(flag.from)} to ${km(flag.to)}`}>
      <header>
        <p className="fc-title">Flagged · km {km(flag.from)}–{km(flag.to)}</p>
        <p className="fc-agree">{flag.agree === 3 ? 'Slope, bulletin and a report agree' : 'Slope and bulletin agree'}</p>
      </header>
      <dl>
        <div>
          <dt>Slope</dt>
          <dd><b>Up to {Math.round(flag.maxSlope)}°</b>, facing {flag.aspect}, {fmt(flag.elevMin)}–{fmt(flag.elevMax)} m
            <small>Computed from the elevation model, every 25 m</small></dd>
        </div>
        <div>
          <dt>Bulletin</dt>
          <dd className="fc-bulletin">
            <AspectRose aspects={flag.bulletin.aspects} size={52} highlight={flag.aspect} />
            <span><Danger level={flag.bulletin.danger} /> {problemName(flag.bulletin.problem)}, {flag.bulletin.aspects.join(' · ')} above {fmt(flag.bulletin.above ?? 0)} m
              <small>{flag.bulletin.region} bulletin · issued {hrs(flag.bulletin.ageHours)} ago</small></span>
          </dd>
        </div>
        <div>
          <dt>Reports</dt>
          <dd>{flag.reports.length ? flag.reports.map((m) => <ReportQuote key={m.id} m={m} compact={compact} />)
            : <span className="muted">No report within {RULES.reportRadius} m in the last {RULES.reportMaxAge} hours.</span>}</dd>
        </div>
      </dl>
      <footer>No flag does not mean safe. It means the rules found nothing to say.</footer>
    </article>
  );
}

export function NotedRow({ n }: { n: Noted }) {
  return (
    <p className="noted"><b>Steep, not flagged · km {km(n.from)}–{km(n.to)}</b> Up to {Math.round(n.maxSlope)}°, facing {n.aspect}, {fmt(n.elevMin)}–{fmt(n.elevMax)} m. It lies outside the aspects or elevations the bulletin names, so the rules don't flag it. It is still steep.</p>
  );
}

const BAND = (s: number) => (s >= 45 ? '#8c1418' : s >= 40 ? '#e5322d' : s >= 35 ? '#ff8a1f' : s >= 30 ? '#f2d43a' : 'transparent');

/** Elevation profile, slope bands under the line, flagged stretches marked. */
export function Profile({ profile, flags = [], height = 150 }: { profile: ProfilePoint[]; flags?: Flag[]; height?: number }) {
  const W = 1000, H = height, pad = 22;
  const dMax = profile.at(-1)!.d, eMin = Math.min(...profile.map((p) => p.elev)), eMax = Math.max(...profile.map((p) => p.elev));
  const x = (d: number) => (d / dMax) * W, y = (e: number) => pad + (1 - (e - eMin) / (eMax - eMin)) * (H - pad * 2);
  const path = profile.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(p.elev).toFixed(1)}`).join('');
  const step = profile[1] ? profile[1].d - profile[0].d : 25;
  return (
    <figure className="profile" data-ui>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Elevation profile, ${fmt(eMin)} to ${fmt(eMax)} m over ${km(dMax)} km`}>
        <path d={`${path}L${W},${H}L0,${H}Z`} className="pf-area" />
        {flags.map((f) => <rect key={f.id} x={x(f.from)} y={0} width={Math.max(4, x(f.to) - x(f.from))} height={H} className="pf-flag" />)}
        {profile.map((p) => BAND(p.slope) !== 'transparent' && <rect key={p.d} x={x(p.d)} y={y(p.elev)} width={x(step) + 0.5} height={H - y(p.elev)} fill={BAND(p.slope)} opacity={0.85} />)}
        <path d={path} className="pf-line" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption><span>{fmt(eMin)} m</span><span>{km(dMax)} km · {fmt(eMax)} m</span></figcaption>
    </figure>
  );
}

export const aspectOf = (p: ProfilePoint) => toAspect8(p.aspect);

/** Total climb along a profile (sum of rises). */
export function gain(p: ProfilePoint[]) { let g = 0; for (let i = 1; i < p.length; i++) g += Math.max(0, p[i].elev - p[i - 1].elev); return g; }

/** The one SMS the dossier sends. Used by the demo and by every preview on the page. */
export function smsText({ who, ret, route, party, clothing, flag }: { who: string; ret: string; route: string; party: string[]; clothing: string; flag?: Flag }) {
  const with_ = party.length ? `, with ${party.join(', ')}` : '';
  const wear = clothing ? `, wearing a ${clothing}` : '';
  const f = flag ? ` Flagged stretch at km ${km(flag.from)}, ${fmt(flag.elevMin)} m, facing ${flag.aspect}.` : '';
  return `AlpenGuard: ${who} hasn't checked in from a ski tour. Planned return ${ret}. ${route}${with_}${wear}.${f} Full dossier by email. You decide whether to call 112.`;
}
