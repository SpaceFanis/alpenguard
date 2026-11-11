// "Three apps, three languages": the report translates itself in the type, and the toll is drawn in snow.
import { useEffect, useRef, useState } from 'react';
import { AI, REPORTS, SAMPLE, BULLETIN, DEMO_NOW } from '../lib/data';
import { evaluate } from '../lib/rules';
import { AspectRose, fmt, km, gain } from './fragments';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

// The sentence that matters, from the sample French report, and the cached translation of it.
const FR_REPORT = REPORTS.find((r) => r.lang === 'fr')!;
const FR = FR_REPORT.conditions.split('. ')[1] + '.';
const EN = AI.reports[String(FR_REPORT.document_id)].translation.split('. ')[1] + '.';
const GLYPHS = 'abcdefghijklmnopqrstuvwxyzéèàçôûï';

/** Types out the French, holds, then resolves letter by letter into English. */
function Translating({ run }: { run: boolean }) {
  const [text, setText] = useState(() => (reducedMotion() ? EN : FR));
  const [done, setDone] = useState(() => reducedMotion());
  const [orig, setOrig] = useState(false);
  useEffect(() => {
    if (!run || reducedMotion()) return;
    let raf = 0, start = 0;
    const HOLD = 1100, DUR = 2200, len = Math.max(FR.length, EN.length);
    const tick = (t: number) => {
      if (!start) start = t;
      const k = Math.min(1, Math.max(0, (t - start - HOLD) / DUR));
      const front = Math.floor(k * (len + 8));
      let out = '';
      for (let i = 0; i < len; i++) {
        if (i < front - 8) out += EN[i] ?? '';
        else if (i < front) out += (FR[i] === ' ' || EN[i] === ' ') ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        else out += FR[i] ?? '';
      }
      setText(out.trimEnd());
      if (k < 1) raf = requestAnimationFrame(tick); else { setText(EN); setDone(true); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run]);
  return (
    <div className={`tr${done ? ' is-done' : ''}`}>
      <p className="tr-quote" aria-hidden="true" lang={done && !orig ? 'en' : 'fr'}>{done && orig ? FR : text}</p>
      <span className="sr-only"><span lang="fr">{FR}</span> Translated: {EN}</span>
      {done
        ? <p className="tr-cap">{orig ? 'Original in French.' : 'Translated from French by AlpenGuard.'} <button type="button" className="tr-toggle" onClick={() => setOrig(!orig)} aria-pressed={orig}>{orig ? 'Show translation' : 'Show original'}</button></p>
        : <p className="tr-cap" aria-hidden="true">Original in French. Translating…</p>}
    </div>
  );
}

const EV = evaluate(SAMPLE.cachedProfile, BULLETIN, REPORTS, AI.reports, DEMO_NOW);
const FLAG = EV.flags[0];
const PR = BULLETIN.avalancheProblems[0];
const OTHERS = REPORTS.filter((r) => r.lang !== 'fr');

/** The route profile as a pencil line on squared paper, a little uneven, the way it gets drawn by hand. */
function PencilProfile() {
  const p = SAMPLE.cachedProfile;
  const W = 300, H = 120, d = p.at(-1)!.d;
  const e0 = Math.min(...p.map((x) => x.elev)), e1 = Math.max(...p.map((x) => x.elev));
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
  const pts = p.filter((_, i) => i % 3 === 0).map((x) => [8 + (x.d / d) * (W - 16) + rnd() * 1.2, H - 10 - ((x.elev - e0) / (e1 - e0)) * (H - 26) + rnd() * 1.6]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const fx = 8 + (FLAG.from / d) * (W - 16), fx2 = 8 + (FLAG.to / d) * (W - 16);
  return (
    <svg className="pencil" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <path d={line} className="pencil-line" />
      <path d={line} className="pencil-line ghost" transform="translate(0.6 0.8)" />
      {(() => { const cx = (fx + fx2) / 2, cy = H - 10 - (((FLAG.elevMin + FLAG.elevMax) / 2 - e0) / (e1 - e0)) * (H - 26); return <ellipse cx={cx} cy={cy} rx="24" ry="15" className="pencil-ring" transform={`rotate(-12 ${cx} ${cy})`} />; })()}
    </svg>
  );
}

export function Problem() {
  const [ref, on] = useInView<HTMLElement>(0.25);
  const [tollRef, tollOn] = useInView<HTMLDivElement>(0.4);
  return (
    <section className={`night${on ? ' is-on' : ''}`} id="problem" ref={ref} aria-labelledby="problem-h">
      <div className="night-head">
        <h2 id="problem-h">Three apps, three languages. One map.</h2>
        <p>The night before a tour, you join the dots yourself: the bulletin in one app, the route in another, and the report that matters in a language you may not read.</p>
      </div>

      <div className="desk" aria-label="What you check the night before: a printed bulletin, your notes, and other climbers' reports">
        <article className="obj obj-bulletin" style={{ ['--i' as string]: 0 }}>
          <p className="b-title">Bulletin d’estimation du risque d’avalanche</p>
          <p className="b-sub">{BULLETIN.regions[0].name}, samedi 21 février</p>
          <div className="b-risk">
            <span className="b-level" aria-label={`Danger level ${FLAG.bulletin.danger}`}>{FLAG.bulletin.danger}</span>
            <span className="b-name">Risque marqué</span>
            <AspectRose aspects={PR.aspects ?? []} size={74} />
          </div>
          <p className="b-text" lang="fr">Plaques à vent récentes sous les crêtes, sur les pentes nord-ouest, nord et nord-est au-dessus de {fmt(FLAG.bulletin.above ?? 0)} m. Un seul skieur peut les déclencher.</p>
          <p className="b-foot">Émis le vendredi 20 février à 16 h. Données d’exemple.</p>
        </article>

        <article className="obj obj-notes" style={{ ['--i' as string]: 1 }} aria-label="Handwritten plan: Saturday, 8:00 start, back by 2 pm, with Nikos in a red jacket. 4.9 km, 1,270 m of climb. The steep stretch near the top is circled.">
          <p className="n-line n-head" aria-hidden="true">Sat. Beaufortain tour</p>
          <PencilProfile />
          <p className="n-line" aria-hidden="true">{km(SAMPLE.cachedProfile.at(-1)!.d).replace('.', ',')} km, +{Math.round(gain(SAMPLE.cachedProfile))} m</p>
          <p className="n-line" aria-hidden="true">leave 8:00, back by 2</p>
          <p className="n-line" aria-hidden="true">w/ Nikos (red jacket)</p>
          <p className="n-line n-ask" aria-hidden="true">steep bit at the top: 30°+ ?</p>
        </article>

        <article className="obj obj-post" style={{ ['--i' as string]: 2 }}>
          <div className="post-behind" aria-hidden="true">
            {OTHERS.map((r) => <p key={r.document_id} lang={r.lang}>{r.title}</p>)}
          </div>
          <div className="post">
            <div className="post-who">
              <span className="post-avatar" aria-hidden="true">CM</span>
              <p><b>Claire M.</b> <span>il y a 18 h</span></p>
            </div>
            <p className="post-title" lang="fr">{FR_REPORT.title}</p>
            <p className="post-cond" lang="fr">Conditions : mauvaises. Altitude max : {fmt(FR_REPORT.elevation_max)} m</p>
            <Translating run={on} />
          </div>
        </article>
      </div>

      <div className={`toll${tollOn ? ' is-on' : ''}`} ref={tollRef}>
        <h3 className="sr-only">28 avalanche deaths in France by 24 February 2026</h3>
        <SnowNumber value="28" run={tollOn} />
        <div className="toll-text">
          <p className="toll-line">people had died in avalanches in France alone by 24 February 2026.</p>
          <p className="toll-note">Slab avalanches usually start on slopes steeper than 30°. Those are the slopes AlpenGuard lights up on your route and holds against the bulletin.</p>
          <p className="toll-src">Source: UIAA / Petzl Foundation</p>
        </div>
      </div>
    </section>
  );
}

/** The numeral built from settling snow, in the same stipple as the mountain at the top of the page. */
function SnowNumber({ value, run }: { value: string; run: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = cv.current, b = box.current; if (!c || !b) return;
    const ctx = c.getContext('2d')!;
    const reduce = reducedMotion();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0, alive = true, visible = true;
    type P = { tx: number; ty: number; x0: number; y0: number; r: number; d: number; a: number; teal: boolean };
    let pts: P[] = [], drift: { x: number; y: number; v: number; r: number }[] = [];
    let W = 0, H = 0, t0 = 0;

    const build = async () => {
      await document.fonts.load('300 200px Newsreader').catch(() => {});
      if (!alive) return;
      W = b.clientWidth; H = Math.round(Math.min(W * 0.62, 460));
      c.width = W * dpr; c.height = H * dpr; c.style.height = `${H}px`;
      // Rasterise the numeral, then trim it to its real ink box so its left edge sits on the grid line.
      const o = document.createElement('canvas');
      const fs = H * 1.22;
      o.width = Math.ceil(fs * value.length * 0.62); o.height = Math.ceil(fs * 1.1);
      const ox = o.getContext('2d', { willReadFrequently: true })!;
      ox.fillStyle = '#000'; ox.font = `300 ${fs}px Newsreader, Georgia, serif`; ox.textBaseline = 'alphabetic';
      ox.fillText(value, fs * 0.05, fs * 0.95);
      const img = ox.getImageData(0, 0, o.width, o.height).data;
      let minX = o.width, minY = o.height, maxX = 0, maxY = 0;
      for (let y = 0; y < o.height; y++) for (let x = 0; x < o.width; x++) if (img[(y * o.width + x) * 4 + 3] > 128) {
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      const gw = maxX - minX, gh = maxY - minY;
      const scale = Math.min((H - 8) / gh, (W - 4) / gw);
      const step = Math.max(2, Math.round(3.4 / scale));
      pts = [];
      for (let y = minY; y <= maxY; y += step) for (let x = minX; x <= maxX; x += step) {
        if (img[(y * o.width + x) * 4 + 3] < 128) continue;
        const tx = (x - minX + (Math.random() - 0.5) * step * 0.8) * scale;
        const ty = H - 4 - (maxY - y + (Math.random() - 0.5) * step * 0.8) * scale;
        pts.push({ tx, ty, x0: tx + (Math.random() - 0.5) * 120, y0: -20 - Math.random() * H * 0.9, r: 0.9 + Math.random() * 1.4,
          d: (1 - ty / H) * 0.9 + Math.random() * 0.5, a: 0.55 + Math.random() * 0.45, teal: Math.random() < 0.12 });
      }
      drift = Array.from({ length: 46 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 8 + Math.random() * 16, r: 0.8 + Math.random() * 1.4 }));
      b.style.setProperty('--glyph-w', `${Math.round(gw * scale)}px`);
    };

    const ease = (k: number) => 1 - Math.pow(1 - k, 3);
    let last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible || !pts.length) return;
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0; last = t;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const el = reduce ? 99 : run ? (t0 ||= t, (t - t0) / 1000) : -1;
      for (const p of pts) {
        let k = el < 0 ? 0 : Math.min(1, Math.max(0, (el - p.d) / 1.4));
        k = ease(k);
        if (k <= 0) continue;
        const x = p.x0 + (p.tx - p.x0) * k + (1 - k) * Math.sin(el * 2 + p.d * 9) * 6;
        const y = p.y0 + (p.ty - p.y0) * k;
        ctx.globalAlpha = p.a * Math.min(1, k * 3);
        ctx.fillStyle = p.teal ? '#7cc3dc' : '#eef2f5';
        ctx.beginPath(); ctx.arc(x, y, p.r, 0, 6.283); ctx.fill();
      }
      if (!reduce) {
        ctx.fillStyle = '#c9d6e1';
        for (const f of drift) {
          f.y += f.v * dt; f.x += Math.sin((t / 1000) * 0.7 + f.v) * 0.15;
          if (f.y > H) { f.y = -4; f.x = Math.random() * W; }
          ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
        }
      }
    };
    void build().then(() => { raf = requestAnimationFrame(draw); });
    const ro = new ResizeObserver(() => { void build(); }); ro.observe(b);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(b);
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, [value, run]);
  return <div className="snow-num" ref={box}><canvas ref={cv} aria-hidden="true" /></div>;
}
