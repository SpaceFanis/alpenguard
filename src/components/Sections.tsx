import { useEffect, useRef, useState } from 'react';
import { fmt, km, gain } from './fragments';
import { SAMPLE } from '../lib/data';
import { RULES } from '../lib/rules';
import credits from '../data/credits.json';

const LEN = SAMPLE.cachedProfile.at(-1)!.d;
const TOP = Math.max(...SAMPLE.cachedProfile.map((p) => p.elev));
const GAIN = gain(SAMPLE.cachedProfile);
const photo = (name: string) => `/photos/${name}.jpg`;

function useInView<T extends Element>(threshold = 0.4) {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, on] as const;
}
/* On the mountain: one photograph, the timer laid over it. */
export function Waits() {
  const ref = useRef<HTMLElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.45 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <section className={`waits${on ? ' is-on' : ''}`} id="waits" ref={ref} aria-labelledby="waits-h">
      <img src={photo('cormet-de-roselend-depuis-bisanne-en-hiver')} alt="Snow-covered peaks above the Cormet de Roselend in the Beaufortain, under a clear winter sky" loading="lazy" width={1920} height={1440} />
      <div className="waits-inner">
        <h2 id="waits-h">On the mountain, it waits</h2>
        <p>No tracking. A plain timer on the server, set to your return time. It doesn't need your phone, your battery or a signal.</p>
        <ol className="timeline" aria-label="The overdue timer">
          <li><b>08:00</b><span>You leave the car</span></li>
          <li><b>14:00</b><span>You said you'd be back</span></li>
          <li className="is-alert"><b>14:15</b><span>Not checked in: the dossier goes to your people</span></li>
        </ol>
      </div>
    </section>
  );
}

function LocalTime() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 30000); return () => clearInterval(id); }, []);
  return <>{t.toLocaleTimeString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })}</>;
}

/** Three conditions drifting together; where all three hold, the flag lights. */
/** The rule drawn over the terrain: three conditions on an engraved 1913 ski-route map, lit where all three hold. */
function RuleMap() {
  const [ref, on] = useInView<HTMLElement>(0.35);
  return (
    <figure className={`rulemap${on ? ' is-on' : ''}`} ref={ref}>
      <div className="rulemap-plate">
        <img src={photo('ski-runs-in-the-high-alps-1913')} alt="" loading="lazy" width={1920} height={1540} />
        <svg viewBox="0 0 600 480" role="img" aria-label={`Three overlapping circles over the map: slope of ${RULES.slopeMin} degrees or more, an aspect named in the bulletin, and an elevation inside it. Where all three overlap, the stretch is flagged.`}>
          <g className="ring r1"><circle cx="240" cy="196" r="128" /><text x="96" y="58">Slope ≥ {RULES.slopeMin}°</text></g>
          <g className="ring r2"><circle cx="360" cy="196" r="128" /><text x="504" y="58" textAnchor="end">Aspect in bulletin</text></g>
          <g className="ring r3"><circle cx="300" cy="300" r="128" /><text x="300" y="460" textAnchor="middle">Inside its elevations</text></g>
          <g className="core"><circle cx="300" cy="232" r="24" /><text x="300" y="237" textAnchor="middle">flag</text></g>
        </svg>
      </div>
      <figcaption>Route map from <i>Ski-runs in the High Alps</i>, 1913. The terrain hasn’t changed; the reading of it has.</figcaption>
    </figure>
  );
}

/* The rule, written out and drawn. */
export function Rules() {
  return (
    <section className="rules" id="rules" aria-labelledby="rules-h">
      <div className="rules-text">
        <h2 id="rules-h">The AI reads. The rules decide.</h2>
        <p className="lead">A language model reads the French report and your spoken plan. It never decides about a slope: plain rules make every call.</p>
        <p className="rules-note">A stretch is flagged only when all three hold. Reports within {RULES.reportRadius} m and under {RULES.reportMaxAge} h are attached to it; older or farther ones are listed with the reason they were set aside.</p>
        <ul className="facts" aria-label="The sample tour in numbers">
          <li><b>{fmt(TOP)} m</b><span>summit of the sample tour, Beaufortain</span></li>
          <li><b>{km(LEN)} km · ↑ {fmt(GAIN)} m</b><span>of route and climb</span></li>
          <li><b><LocalTime /></b><span>now, in the Alps</span></li>
        </ul>
      </div>
      <RuleMap />
    </section>
  );
}

/* Others do one part each. */
type Cov = 'yes' | 'part' | 'no';
const COLS = ['Avalanche bulletin', 'Critical points on the route', 'Reports, in any language', 'Overdue alert'];
const SHORT = ['Bulletin', 'Critical points', 'Reports', 'Alert'];
const TOOLS: [string, Cov[], string][] = [
  ['White Risk', ['yes', 'yes', 'part', 'no'], 'Slope analysis automatic in Switzerland; field reports in part'],
  ['Skitourenguru', ['yes', 'yes', 'no', 'no'], 'Risk per route segment'],
  ['Strata', ['part', 'yes', 'no', 'no'], 'AI route planning'],
  ['Cairn', ['no', 'no', 'no', 'yes'], 'Overdue alert'],
  ['AllTrails Lifeline', ['no', 'no', 'no', 'yes'], 'Overdue alert'],
  ['AlpenGuard', ['yes', 'yes', 'yes', 'yes'], 'Reports translated and pinned to the route; alert with a rescue dossier'],
];
const COV_LABEL: Record<Cov, string> = { yes: 'Yes', part: 'In part', no: 'Not found' };
function Mark({ v }: { v: Cov }) {
  return (
    <span className={`mark mark-${v}`} title={COV_LABEL[v]}>
      <svg viewBox="0 0 24 24" aria-hidden="true">{v === 'yes' ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : v === 'part' ? <path d="M6 12h12" /> : <circle cx="12" cy="12" r="2.5" />}</svg>
      <span className="sr-only">{COV_LABEL[v]}</span>
    </span>
  );
}

export function Compare() {
  const [ref, on] = useInView<HTMLTableElement>(0.3);
  return (
    <section className="compare" id="compare" aria-labelledby="compare-h">
      <h2 id="compare-h">Good tools, each one part</h2>
      <p className="compare-lead reveal">Many are free and excellent. AlpenGuard doesn't replace them; it joins the parts into one flow.</p>
      <table className={`matrix${on ? ' is-on' : ''}`} ref={ref}>
        <caption className="sr-only">What each tool covers, from the AlpenGuard project document</caption>
        <thead><tr><th scope="col"><span className="sr-only">Tool</span></th>{COLS.map((c) => <th scope="col" key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {TOOLS.map(([n, cov, note], r) => (
            <tr key={n} className={n === 'AlpenGuard' ? 'is-us' : ''} style={{ ['--r' as string]: r }}>
              <th scope="row"><b>{n}</b><span>{note}</span></th>
              {cov.map((v, c) => <td key={c} data-label={SHORT[c]} style={{ ['--c' as string]: c }}><Mark v={v} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const QA = [
  ['Will it tell me a slope is safe?', 'No. It only flags places where terrain, bulletin and reports agree on a risk. A stretch without a flag is one the rules had nothing to say about.'],
  ['Who decides what gets flagged?', `Rules, not the AI: ${RULES.slopeMin}° or steeper, on an aspect and at an elevation the bulletin names. Reports within ${RULES.reportRadius} m and ${RULES.reportMaxAge} h strengthen a flag.`],
  ['Where does each flag come from?', 'Every flag shows its sources: which bulletin and when it was issued, which report, in which language, and how many hours old.'],
  ['Who gets the alert?', 'The people you choose, not rescue services. They know you, they can try to reach you, and they decide whether to call 112.'],
  ['What if my phone dies on the mountain?', 'The timer runs on the server. A flat battery in the cold or no signal does not stop the dossier.'],
  ['What happens to my route and position?', 'They are kept only while the tour is open and deleted when you check in.'],
  ['Is this demo using real data?', 'The terrain is real: slopes come from public elevation tiles. The bulletin, the reports and the AI answers are test data, and nothing is sent.'],
];

export function Limits() {
  return (
    <section className="limits" id="limits" aria-labelledby="limits-h">
      <figure className="limits-photo">
        <img src={photo('a-mountaineer-skis-down-mt-francais-during')} alt="A ski mountaineer descending a steep, wind-rippled snow face above a sea of cloud" loading="lazy" width={1600} height={1067} />
      </figure>
      <div className="limits-text">
        <h2 id="limits-h">Limits, plainly</h2>
        <p className="lead">It helps the decision. It never takes it.</p>
        <div className="faq-list">
          {QA.map(([q, a], i) => (
            <details key={q} open={i === 0}>
              <summary>{q}<i aria-hidden="true" /></summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <p className="footer-sign">Go well. Come back.</p>
        <a className="btn" href="#demo">Run the sample tour</a>
      </div>
      <div className="footer-cols">
        <div><p className="footer-k">AlpenGuard</p><p>A student prototype. Test data except the terrain. Not for use on a real tour.</p></div>
        <div><p className="footer-k">Made by</p><p>Fanis Papaspyrou<br />Anastasis Skourtis<br />Ioannis Manis<br />Christos Gkotzamanis</p></div>
        <nav aria-label="Footer"><p className="footer-k">On this page</p><a href="#top">The mountain</a><a href="#demo">Sample tour</a><a href="#rules">Rules</a><a href="#limits">Limits</a></nav>
      </div>
      <p className="footer-credits">
        Photographs: {credits.map((c, i) => <span key={c.ref}>{i ? ' · ' : ''}<a href={c.page} target="_blank" rel="noreferrer">{c.creator}</a> ({c.license})</span>)}. Elevation: Mapzen Terrain Tiles on AWS. Map: MapLibre.
      </p>
    </footer>
  );
}
