// Dev helper: screenshots the opening scene at each beat. usage: node scripts/beats.mjs <url> <out-prefix> <width>
import { Browser, sleep } from '../../.claude/skills/design-taste-frontend/scripts/lib/cdp.mjs';
const [url, out, w = '1440'] = process.argv.slice(2);
const b = await Browser.launch({ extraArgs: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await b.newPage({ width: +w, height: +w < 700 ? 844 : 900, mobile: +w < 700 });
  const errs = [];
  await p.send('Runtime.enable');
  b.on(p.sessionId, 'Runtime.exceptionThrown', (e) => errs.push(e.exceptionDetails.exception?.description ?? e.exceptionDetails.text));
  b.on(p.sessionId, 'Runtime.consoleAPICalled', (e) => { if (e.type === 'error') errs.push(e.args.map((a) => a.value ?? a.description).join(' ')); });
  await p.goto(url, { settleMs: 500 });
  await sleep(6000);
  for (const [i, f] of [0, 0.2, 0.4, 0.6, 0.8, 1].entries()) {
    await p.eval(`(() => { const s = document.querySelector('.pm'); scrollTo(0, s.offsetTop + ${f} * (s.offsetHeight - innerHeight)); return 1; })()`);
    await sleep(i === 0 ? 1500 : 4200);
    await p.screenshot({ path: `${out}-${w}-b${i}.jpg`, quality: 75 });
  }
  console.log('errors:', errs.slice(0, 5).join('\n') || 'none');
} finally { await b.close(); }
