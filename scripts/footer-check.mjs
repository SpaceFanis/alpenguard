// Dev check: taps footer links on a phone (or clicks on desktop) and reports where the target ends up.
// Each run starts from a fresh page; a run like "#demo,#rules" taps the links in order on the same page.
// usage: node scripts/footer-check.mjs 390x844 [url] [wait-ms]
import { Browser, sleep } from '../../.claude/skills/design-taste-frontend/scripts/lib/cdp.mjs';
const [W, H] = (process.argv[2] ?? '390x844').split('x').map(Number), mobile = W < 700;
const url = process.argv[3] ?? 'http://localhost:5174/', wait = +(process.argv[4] ?? 3500);
const runs = (process.argv[5] ?? '#top,#demo,#rules,#limits,#demo+#rules,#demo+#limits').split(',').map((r) => r.replace('+', ','));
const b = await Browser.launch({ extraArgs: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
try {
  for (const run of runs) {
    const p = await b.newPage({ width: W, height: H });
    await p.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile });
    if (mobile) await p.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await p.goto(url, { settleMs: 500 }); await sleep(3000);
    const out = [];
    for (const href of run.split(',')) {
      await p.eval(`scrollTo(0, document.documentElement.scrollHeight); 0`); await sleep(1500);
      const c = await p.eval(`(() => { const a = document.querySelector('.footer nav a[href="${href}"]'); const r = a.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
      if (mobile) { await p.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c[0], y: c[1] }] }); await p.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
      else for (const type of ['mousePressed', 'mouseReleased']) await p.send('Input.dispatchMouseEvent', { type, x: c[0], y: c[1], button: 'left', clickCount: 1 });
      await sleep(wait);
      const t = await p.eval(`String(Math.round(document.querySelector('${href}').getBoundingClientRect().top))`);
      out.push(`${href} ${Math.abs(+t) <= 2 ? 'ok' : 'MISSED (' + t + ' px)'}`);
    }
    console.log(run.padEnd(15), out.join('  →  '));
    await p.close?.();
  }
} finally { await b.close(); }
