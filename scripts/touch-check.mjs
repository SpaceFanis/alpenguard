// Dev check: real touch swipes on a phone-sized page (CPU slowed), one per step; reports each landing
// and how many frames ran slower than 50 ms during the step.
import { Browser, sleep } from '../../.claude/skills/design-taste-frontend/scripts/lib/cdp.mjs';
const W = 390, H = 844, slow = +(process.argv[2] ?? 4);
const b = await Browser.launch({ extraArgs: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
try {
  const p = await b.newPage({ width: W, height: H });
  await p.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 3, mobile: true });
  await p.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await p.goto('http://localhost:5174/', { settleMs: 500 }); await sleep(4000);
  if (slow > 1) await p.send('Emulation.setCPUThrottlingRate', { rate: slow });
  const swipe = async (dy) => {
    const y0 = dy > 0 ? 620 : 260;
    await p.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: y0 }] });
    for (let k = 1; k <= 6; k++) { await p.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: y0 - (dy * k) / 6 }] }); await sleep(16); }
    await p.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  const where = () => p.eval(`(() => { const secs = ['.pm','#problem','#waits','#demo','#rules','#compare','#limits','.footer'];
    const hit = secs.map(q => [q, document.querySelector(q).getBoundingClientRect()]).filter(([,r]) => r.top < innerHeight*0.5 && r.bottom > innerHeight*0.5).map(([q,r]) => q + ' top ' + Math.round(r.top))[0];
    return Math.round(scrollY) + '  ' + hit; })()`);
  const frames = `window.__long = 0; window.__n = 0; (() => { let last = performance.now(); const f = (t) => { if (t - last > 50) __long++; __n++; last = t; if (__n < 400) requestAnimationFrame(f); }; requestAnimationFrame(f); })(); 0`;
  for (const [dir, n] of [[1, 11], [-1, 3]]) for (let i = 0; i < n; i++) {
    await p.eval(frames); await swipe(dir * 220); await sleep(1500);
    console.log((dir > 0 ? 'down ' : 'up ') + (i + 1), (await where()).padEnd(26), 'slow frames', await p.eval('__long'), '/', await p.eval('__n'));
  }
} finally { await b.close(); }
