// Dev helper: viewport screenshots of a page in headless Chromium (the taste skill's CDP driver).
// usage: node scripts/shoot.mjs <url> <out-prefix> <widths> <waitMs> "<sel1>|<sel2>|..." ["js before shots"]
import { Browser, sleep } from '../../.claude/skills/design-taste-frontend/scripts/lib/cdp.mjs';
const [url, out, widths = '1440,390', wait = '8000', sels = 'body', pre] = process.argv.slice(2);
const b = await Browser.launch({ extraArgs: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
try {
  for (const w of widths.split(',').map(Number)) {
    const p = await b.newPage({ width: w, height: w < 600 ? 844 : 900, mobile: w < 600 });
    const logs = [];
    await p.send('Runtime.enable');
    b.on(p.sessionId, 'Runtime.consoleAPICalled', (e) => { if (['error', 'warning'].includes(e.type)) logs.push(e.type + ': ' + e.args.map((a) => a.value ?? a.description).join(' ').slice(0, 200)); });
    b.on(p.sessionId, 'Runtime.exceptionThrown', (e) => logs.push('exception: ' + (e.exceptionDetails.exception?.description ?? e.exceptionDetails.text).slice(0, 300)));
    await p.goto(url, { settleMs: 500 });
    await sleep(+wait);
    if (pre) { console.log('pre:', JSON.stringify(await p.eval(pre))); await sleep(4000); }
    let i = 0;
    for (const sel of sels.split('|')) {
      if (sel !== 'body') { await p.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (el) window.scrollTo(0, el.getBoundingClientRect().top + scrollY - ${sel.startsWith('#') ? 56 : 0}); return !!el; })()`); await sleep(4600); }
      const f = `${out}-${w}-${i++}.jpg`;
      await p.screenshot({ path: f, quality: 72 });
      console.log(f);
    }
    if (logs.length) console.log(logs.slice(0, 10).join('\n'));
    await p.close();
  }
} finally { await b.close(); }
