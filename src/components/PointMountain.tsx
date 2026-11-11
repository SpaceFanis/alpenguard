// The opening scene: the real Beaufortain terrain as a field of stippled points.
// Scroll drives five beats: the route draws, steep slopes light up, the bulletin's sector stays lit,
// the camera settles on the flagged stretch, then pulls back for the overdue alert.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import grid from '../data/terrain.json';
import { SAMPLE, BULLETIN, REPORTS, AI, DEMO_NOW } from '../lib/data';
import { evaluate } from '../lib/rules';
import { resample } from '../lib/terrain-math';
import { fmt, km } from './fragments';

const EV = evaluate(SAMPLE.cachedProfile, BULLETIN, REPORTS, AI.reports, DEMO_NOW);
const FLAG = EV.flags[0];
const FR = FLAG.reports[0];
const LEN = SAMPLE.cachedProfile.at(-1)!.d;
const TOP = Math.max(...SAMPLE.cachedProfile.map((p) => p.elev));
const START = SAMPLE.cachedProfile[0].elev;
const PR = BULLETIN.avalancheProblems[0];
const ABOVE = +(PR.elevation?.lowerBound ?? 0);

// World space: kilometres, x east, z south, y up (elevation exaggerated a little for legibility).
const LAT_C = grid.lat1 - ((grid.rows - 1) * grid.step) / 2;
const LON_C = grid.lon0 + ((grid.cols - 1) * grid.step) / 2;
const KM_LAT = 111.32, KM_LON = 111.32 * Math.cos((LAT_C * Math.PI) / 180);
const EXAG = 1.35, BASE = 1500;
const wx = (lon: number) => (lon - LON_C) * KM_LON;
const wz = (lat: number) => -(lat - LAT_C) * KM_LAT;
const wy = (e: number) => ((e - BASE) / 1000) * EXAG;

const BEATS = [
  { h: '', p: '' },
  { h: 'Your route, on the real mountain', p: `${km(LEN)} km from the car park at ${fmt(START)} m to the summit at ${fmt(TOP)} m. Every point here is real elevation data.` },
  { h: 'Every slope over 30°, lit', p: 'Slope and aspect are computed every 25 m. Over 30° is where slab avalanches usually start.' },
  { h: 'Where the bulletin warns', p: `Considerable danger: wind slab on ${PR.aspects?.join(', ')} slopes above ${fmt(ABOVE)} m. The rest of the mountain steps back.` },
  { h: `Where it all agrees: km ${km(FLAG.from)}`, p: `“${FR.translation.split('. ').slice(1, 2).join('')}.” A French report, ${Math.round(FR.ageHours)} hours old, translated. And a way round, by the other side.` },
  { h: 'If you’re not back', p: 'Not back by 14:15? Your people get the route, the critical point, who you are with and what you wear. They decide whether to call 112.' },
];

const VERT = /* glsl */ `
  attribute float aSlope; attribute float aAspect; attribute float aElev; attribute float aRand; attribute float aShade; attribute float aFlag;
  uniform float uTime, uRise, uSteep, uBulletin, uFocus, uSize, uPR, uAbove;
  varying vec4 vColor;
  vec3 band(float s) {
    if (s >= 45.0) return vec3(0.52, 0.12, 0.14);
    if (s >= 40.0) return vec3(0.82, 0.27, 0.22);
    if (s >= 35.0) return vec3(0.93, 0.55, 0.22);
    return vec3(0.88, 0.74, 0.30);
  }
  void main() {
    vec3 p = position;
    float rise = smoothstep(0.0, 1.0, clamp(uRise * 1.6 - aRand * 0.6, 0.0, 1.0));
    p.y *= rise;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float steep = step(30.0, aSlope);
    float a = aAspect;
    float inAspect = step(292.5, a) + step(a, 67.5);
    float inSector = clamp(inAspect, 0.0, 1.0) * step(uAbove, aElev);
    // Ink stipple, denser in shadow, like an engraved relief map.
    vec3 ink = vec3(0.043, 0.09, 0.133);
    float alpha = 0.10 + 0.55 * aShade;
    vec3 col = ink;
    // Steep slopes light up.
    float lit = steep * uSteep;
    col = mix(col, band(aSlope), lit);
    alpha = mix(alpha, 0.62, lit);
    // The bulletin: its sector stays, the rest recedes.
    float outside = uBulletin * (1.0 - inSector);
    col = mix(col, ink, outside * 0.85);
    alpha *= mix(1.0, 0.16, outside);
    col = mix(col, vec3(0.12, 0.44, 0.55), uBulletin * inSector * (1.0 - steep) * 0.7);
    alpha = mix(alpha, max(alpha, 0.85), uBulletin * inSector * steep);
    // The flagged stretch.
    float f = aFlag * uFocus;
    col = mix(col, vec3(1.0, 0.6, 0.0), f);
    alpha = mix(alpha, 1.0, f);
    vColor = vec4(col, alpha * rise);
    float size = uSize * (1.0 + 0.45 * lit + 0.9 * f);
    gl_PointSize = min(size * uPR * (14.0 / -mv.z), uSize * uPR * 3.2);
  }`;
const FRAG = /* glsl */ `
  varying vec4 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor.rgb, vColor.a * smoothstep(0.5, 0.32, d));
  }`;

const ROUTE_VERT = /* glsl */ `
  attribute float aT; attribute float aFlag; attribute float aAlt;
  uniform float uDraw, uFocus, uAlt, uSize, uPR, uTime;
  varying vec4 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position + vec3(0.0, 0.012, 0.0), 1.0);
    gl_Position = projectionMatrix * mv;
    float shown = mix(step(aT, uDraw), step(aT, uAlt), aAlt);
    vec3 ink = vec3(0.043, 0.09, 0.133);
    vec3 teal = vec3(0.12, 0.44, 0.55);
    vec3 col = mix(ink, teal, aAlt);
    float pulse = 0.5 + 0.5 * sin(uTime * 2.4 - aT * 40.0);
    col = mix(col, vec3(1.0, 0.55, 0.0), aFlag * uFocus);
    float head = smoothstep(0.03, 0.0, abs(aT - uDraw)) * (1.0 - aAlt) * step(uDraw, 0.999);
    vColor = vec4(col, shown * (aAlt > 0.5 ? 0.9 : 1.0));
    float size = uSize * (1.0 + 0.9 * aFlag * uFocus * (0.7 + 0.3 * pulse) + 1.6 * head - 0.35 * aAlt);
    gl_PointSize = min(size * uPR * (14.0 / -mv.z), uSize * uPR * 4.0);
  }`;

const SNOW_VERT = /* glsl */ `
  attribute float aRand;
  uniform float uTime, uPR, uMotion;
  varying float vA;
  void main() {
    vec3 p = position;
    float h = 4.2;
    p.y = mod(p.y - uTime * uMotion * (0.06 + aRand * 0.05), h) - 0.4;
    p.x += sin(uTime * uMotion * 0.4 + aRand * 40.0) * 0.08;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vA = 0.25 + aRand * 0.35;
    gl_PointSize = min((1.4 + aRand * 2.2) * uPR * (14.0 / -mv.z), 6.0 * uPR);
  }`;
const SNOW_FRAG = /* glsl */ `
  varying float vA;
  void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(0.56, 0.65, 0.73, vA * smoothstep(0.5, 0.1, d)); }`;

async function loadTerrain(stride: number) {
  const buf = await (await fetch('/terrain.bin')).arrayBuffer();
  const E = new Int16Array(buf);
  const { cols, rows, step, lon0, lat1 } = grid;
  const at = (c: number, r: number) => E[Math.min(rows - 1, Math.max(0, r)) * cols + Math.min(cols - 1, Math.max(0, c))];
  const dx = step * KM_LON * 1000, dy = step * KM_LAT * 1000;
  const flagLL = FLAG.coords;
  const pos: number[] = [], slope: number[] = [], aspect: number[] = [], elev: number[] = [], rand: number[] = [], shade: number[] = [], flag: number[] = [];
  const L = new THREE.Vector3(-0.6, 0.7, -0.4).normalize(); // light from the north-west, as on printed relief maps
  for (let r = 1; r < rows - 1; r += stride) for (let c = 1; c < cols - 1; c += stride) {
    const z = at(c, r);
    const dzdx = ((at(c + 1, r - 1) + 2 * at(c + 1, r) + at(c + 1, r + 1)) - (at(c - 1, r - 1) + 2 * at(c - 1, r) + at(c - 1, r + 1))) / (8 * dx);
    const dzdy = ((at(c - 1, r - 1) + 2 * at(c, r - 1) + at(c + 1, r - 1)) - (at(c - 1, r + 1) + 2 * at(c, r + 1) + at(c + 1, r + 1))) / (8 * dy);
    const s = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
    let a = (Math.atan2(-dzdx, -dzdy) * 180) / Math.PI; if (a < 0) a += 360;
    const n = new THREE.Vector3(-dzdx * EXAG, 1, dzdy * EXAG).normalize();
    const lon = lon0 + c * step, lat = lat1 - r * step;
    // jitter breaks the grid so it reads as stipple, not as a lattice
    const jx = (Math.random() - 0.5) * step * 0.8, jy = (Math.random() - 0.5) * step * 0.8;
    pos.push(wx(lon + jx), wy(z), wz(lat + jy));
    slope.push(s); aspect.push(a); elev.push(z); rand.push(Math.random());
    shade.push(Math.min(1, Math.max(0, 1 - (n.dot(L) * 0.5 + 0.5)) * 1.6));
    let nearFlag = 0;
    for (const [fl, fa] of flagLL) if (Math.abs(fl - lon) < 0.0006 && Math.abs(fa - lat) < 0.00045) { nearFlag = 1; break; }
    flag.push(nearFlag * (s >= 28 ? 1 : 0));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSlope', new THREE.Float32BufferAttribute(slope, 1));
  g.setAttribute('aAspect', new THREE.Float32BufferAttribute(aspect, 1));
  g.setAttribute('aElev', new THREE.Float32BufferAttribute(elev, 1));
  g.setAttribute('aRand', new THREE.Float32BufferAttribute(rand, 1));
  g.setAttribute('aShade', new THREE.Float32BufferAttribute(shade, 1));
  g.setAttribute('aFlag', new THREE.Float32BufferAttribute(flag, 1));
  return { g, at };
}

function routeGeometry(at: (c: number, r: number) => number) {
  const { step, lon0, lat1 } = grid;
  const height = (lon: number, lat: number) => at(Math.round((lon - lon0) / step), Math.round((lat1 - lat) / step));
  const pos: number[] = [], t: number[] = [], fl: number[] = [], alt: number[] = [];
  const push = (coords: number[][], isAlt: number) => {
    const pts = resample(coords, 12);
    const total = pts.at(-1)!.d;
    for (const p of pts) {
      pos.push(wx(p.lon), wy(height(p.lon, p.lat)), wz(p.lat));
      t.push(p.d / total);
      fl.push(!isAlt && p.d >= FLAG.from && p.d <= FLAG.to ? 1 : 0);
      alt.push(isAlt);
    }
  };
  push(SAMPLE.coords, 0);
  push(SAMPLE.alternative, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(t, 1));
  g.setAttribute('aFlag', new THREE.Float32BufferAttribute(fl, 1));
  g.setAttribute('aAlt', new THREE.Float32BufferAttribute(alt, 1));
  return { g, height };
}

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const ss = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function PointMountain() {
  const wrap = useRef<HTMLElement>(null);
  const canvasBox = useRef<HTMLDivElement>(null);
  const labels = useRef<Record<string, HTMLDivElement | null>>({});
  const [beat, setBeat] = useState(0);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const box = canvasBox.current, section = wrap.current;
    if (!box || !section) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const narrow = window.innerWidth < 700;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); }
    catch { setFailed(true); return; }
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pr);
    renderer.setClearColor(0x000000, 0);
    box.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(narrow ? 46 : 36, 1, 0.05, 60);
    let disposed = false, raf = 0, visible = true;

    const uniforms = {
      uTime: { value: 0 }, uRise: { value: reduce ? 1 : 0 }, uSteep: { value: 0 }, uBulletin: { value: 0 }, uFocus: { value: 0 },
      uSize: { value: narrow ? 2.6 : 2.1 }, uPR: { value: pr }, uAbove: { value: ABOVE },
      uDraw: { value: 0 }, uAlt: { value: 0 }, uMotion: { value: reduce ? 0 : 1 },
    };
    const mat = (vertexShader: string, fragmentShader: string) => new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false });

    // Camera beats: [position, target]. North is -z, west is -x.
    let flagW = new THREE.Vector3();
    let keys: [THREE.Vector3, THREE.Vector3][] = [];
    const camPos = new THREE.Vector3(7.5, 6.2, 8.5), camLook = new THREE.Vector3(0, 0.6, 0);
    const tgtPos = camPos.clone(), tgtLook = camLook.clone();

    let progress = reduce ? 1 : 0;
    const readScroll = () => {
      if (reduce) return; // the reduced page shows the finished scene and every caption, unpinned
      const r = section.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      progress = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
      const s = progress * (BEATS.length - 1);
      setBeat(Math.min(BEATS.length - 1, Math.round(s - 0.15)));
    };

    (async () => {
      const { g, at } = await loadTerrain(narrow ? 2 : 1);
      if (disposed) return;
      scene.add(new THREE.Points(g, mat(VERT, FRAG)));
      const { g: rg, height } = routeGeometry(at);
      scene.add(new THREE.Points(rg, mat(ROUTE_VERT, FRAG)));
      const snowN = narrow ? 500 : 1400;
      const sp = new Float32Array(snowN * 3), sr = new Float32Array(snowN);
      for (let i = 0; i < snowN; i++) { sp[i * 3] = (Math.random() - 0.5) * 9; sp[i * 3 + 1] = Math.random() * 4.2; sp[i * 3 + 2] = (Math.random() - 0.5) * 9; sr[i] = Math.random(); }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      sg.setAttribute('aRand', new THREE.BufferAttribute(sr, 1));
      scene.add(new THREE.Points(sg, mat(SNOW_VERT, SNOW_FRAG)));

      const [fLon, fLat] = FLAG.center;
      flagW = new THREE.Vector3(wx(fLon), wy(height(fLon, fLat)), wz(fLat));
      const hi = SAMPLE.cachedProfile.reduce((x, y) => (y.elev > x.elev ? y : x)); // the real high point, not the file's last point
      const [sLon, sLat] = SAMPLE.coords[0], [tLon, tLat] = [hi.lon, hi.lat];
      const startW = new THREE.Vector3(wx(sLon), wy(height(sLon, sLat)), wz(sLat));
      const topW = new THREE.Vector3(wx(tLon), wy(height(tLon, tLat)), wz(tLat));
      const mid = startW.clone().lerp(topW, 0.5);
      const far = narrow ? 1.35 : 1;
      keys = [
        [new THREE.Vector3(6.8, 5.6, 7.6).multiplyScalar(far), new THREE.Vector3(0, 0.55, 0)],
        [new THREE.Vector3(mid.x - 1.6, 4.0, mid.z + 6.4).multiplyScalar(far), mid.clone().setY(0.6)],
        [new THREE.Vector3(6.2, 6.6, 5.2).multiplyScalar(far), new THREE.Vector3(mid.x + 0.4, 0.6, mid.z)],
        [new THREE.Vector3(flagW.x - 5.4 * far, 4.4 * far, flagW.z - 5.0 * far), flagW.clone().setY(0.8)],
        [new THREE.Vector3(flagW.x - 2.3 * far, flagW.y + 1.5 * far, flagW.z - 2.1 * far), flagW.clone()],
        [new THREE.Vector3(1.2, 8.2 * far, 6.6 * far), new THREE.Vector3(0, 0.3, -0.2)],
      ];
      Object.assign(labels.current, {});
      (labels as unknown as { pts: Record<string, THREE.Vector3> }).pts = { start: startW, top: topW, flag: flagW };
      setReady(true);
    })().catch(() => setFailed(true));

    const resize = () => {
      const w = box.clientWidth, h = box.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(box);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '200px' });
    io.observe(section);
    window.addEventListener('scroll', readScroll, { passive: true });
    readScroll();

    const clock = new THREE.Clock();
    const v = new THREE.Vector3();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible || !keys.length) return;
      const dt = Math.min(0.05, clock.getDelta());
      const t = (uniforms.uTime.value += dt);
      if (!reduce) uniforms.uRise.value = Math.min(1, uniforms.uRise.value + dt / 2.6);
      const s = progress * (BEATS.length - 1);
      uniforms.uDraw.value = ss(0.35, 1.45, s);
      uniforms.uSteep.value = ss(1.45, 2.2, s);
      uniforms.uBulletin.value = ss(2.45, 3.2, s);
      uniforms.uFocus.value = ss(3.3, 3.95, s);
      uniforms.uAlt.value = ss(3.6, 4.5, s);
      // Camera: ease between beats, then glide toward the target for a calm, filmic follow.
      const i = Math.min(keys.length - 2, Math.floor(s)), f = ease(Math.min(1, Math.max(0, s - i)));
      tgtPos.copy(keys[i][0]).lerp(keys[i + 1][0], f);
      tgtLook.copy(keys[i][1]).lerp(keys[i + 1][1], f);
      if (!reduce && s < 0.6) { // a slow drift around the mountain while you take it in
        const ang = Math.sin(t * 0.08) * 0.32;
        tgtPos.set(tgtPos.x * Math.cos(ang) - tgtPos.z * Math.sin(ang), tgtPos.y, tgtPos.x * Math.sin(ang) + tgtPos.z * Math.cos(ang));
      }
      const k = reduce ? 1 : 1 - Math.pow(0.0025, dt);
      camPos.lerp(tgtPos, k); camLook.lerp(tgtLook, k);
      camera.position.copy(camPos); camera.lookAt(camLook);
      renderer.render(scene, camera);
      // Labels follow their points on screen.
      const pts = (labels as unknown as { pts?: Record<string, THREE.Vector3> }).pts;
      if (pts) for (const [name, p] of Object.entries(pts)) {
        const el = labels.current[name]; if (!el) continue;
        v.copy(p); v.y *= uniforms.uRise.value; v.project(camera);
        const x = (v.x * 0.5 + 0.5) * box.clientWidth, y = (-v.y * 0.5 + 0.5) * box.clientHeight;
        const show = reduce ? 1 : name === 'flag' ? uniforms.uFocus.value : uniforms.uDraw.value > (name === 'top' ? 0.98 : 0.02) ? 1 : 0;
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        const vis = v.z < 1 ? show : 0;
        el.style.opacity = String(vis);
        el.style.visibility = vis > 0.02 ? 'visible' : 'hidden';
      }
    };
    tick();
    return () => {
      disposed = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      window.removeEventListener('scroll', readScroll);
      scene.traverse((o) => { const p = o as THREE.Points; p.geometry?.dispose(); (p.material as THREE.Material | undefined)?.dispose(); });
      renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  return (
    <section className="pm" id="top" ref={wrap} aria-labelledby="hero-h">
      {BEATS.map((_, k) => <i key={k} className="pm-mark" aria-hidden="true" style={{ top: `calc(${k} * (100% - 100svh) / ${BEATS.length - 1})` }} />)}
      <div className="pm-stage">
        <div className="pm-canvas" ref={canvasBox} aria-hidden="true" />
        {failed && <img className="pm-fallback" src="/photos/cormet-de-roselend-depuis-bisanne-en-hiver.jpg" alt="Winter peaks of the Beaufortain" />}
        <div className="pm-label pm-label-dot" ref={(el) => { labels.current.start = el; }}>Car park · {fmt(START)} m</div>
        <div className="pm-label" ref={(el) => { labels.current.top = el; }}>Summit · {fmt(TOP)} m</div>
        <div className="pm-label pm-label-flag" ref={(el) => { labels.current.flag = el; }}>km {km(FLAG.from)} · {Math.round(FLAG.maxSlope)}° · {FLAG.aspect}</div>

        <header className="pm-bar">
          <a className="wordmark" href="#top">AlpenGuard</a>
          <nav aria-label="Sections">
            <a href="#problem">Why</a>
            <a href="#demo">Try it</a>
            <a href="#rules">Rules</a>
            <a href="#limits">Limits</a>
          </nav>
          <a className="btn btn-small" href="#demo">Try the sample tour</a>
        </header>

        <div className={`pm-title${beat > 0 ? ' is-away' : ''}`}>
          <h1 id="hero-h" className="pm-name"><span className="masked"><span>AlpenGuard</span></span></h1>
          <div className="pm-sub">
            <p>An avalanche safety assistant for ski touring. The bulletin, the angle of every slope and other climbers' reports on one map, and someone who knows when you're late.</p>
            <p className="pm-hint" aria-hidden="true"><span />Scroll to read the mountain</p>
          </div>
        </div>

        <ol className="pm-beats" aria-label="What AlpenGuard reads, step by step">
          {BEATS.slice(1).map((b, i) => (
            <li key={b.h} className={beat === i + 1 ? 'is-on' : ''} aria-current={beat === i + 1 ? 'step' : undefined}>
              <h2>{b.h}</h2>
              <p>{b.p}</p>
            </li>
          ))}
        </ol>
        <div className="pm-progress" aria-hidden="true">
          {BEATS.slice(1).map((_, i) => <i key={i} className={beat >= i + 1 ? 'is-on' : ''} />)}
        </div>
        {!ready && !failed && <p className="pm-loading" aria-hidden="true">Reading the terrain…</p>}
      </div>
    </section>
  );
}
