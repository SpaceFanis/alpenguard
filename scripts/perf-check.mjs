// Dev check: at each chapter, how much main-thread work a second of idle costs (scripting, layout, paint).
// Usage: node scripts/perf-check.mjs 1470x830@2 [cpuSlowdown]
import { Browser, sleep } from '../../.claude/skills/design-taste-frontend/scripts/lib/cdp.mjs';
const [size, dprS] = (process.argv[2] ?? '1470x830@2').split('@');
const [W, H] = size.split('x').map(Number), dpr = +(dprS ?? 1), slow = +(process.argv[3] ?? 1);
const b = await Browser.launch({ extraArgs: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
try {
  const p = await b.newPage({ width: W, height: H });
  await p.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: dpr, mobile: W < 700 });
  if (W < 700) await p.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  if (slow > 1) await p.send('Emulation.setCPUThrottlingRate', { rate: slow });
  await p.send('Performance.enable');
  await p.goto('http://localhost:5174/?nosnap', { settleMs: 500 }); await sleep(5000);
  const m = async () => Object.fromEntries((await p.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
  for (const sel of ['.pm', '.pm .pm-mark:nth-of-type(3)', '#problem', '.toll', '#waits', '#demo', '#rules', '#compare', '#limits']) {
    await p.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); scrollTo(0, el.getBoundingClientRect().top + scrollY); })()`);
    await sleep(1500);
    const a = await m(); await p.eval(`window.__f = 0; (function f(){ __f++; requestAnimationFrame(f); })(); 0`); await sleep(2000); const z = await m();
    const per = (k) => ((z[k] - a[k]) * 1000 / 2).toFixed(0);
    console.log(sel.padEnd(28), 'fps', String(await p.eval('__f') / 2).padEnd(5), 'script ms/s', per('ScriptDuration').padStart(4), ' layout', per('LayoutDuration').padStart(3), ' style', per('RecalcStyleDuration').padStart(3), ' task', per('TaskDuration').padStart(4));
  }
} finally { await b.close(); }
