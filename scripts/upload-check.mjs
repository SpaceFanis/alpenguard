// Dev check: uploads GPX files through the real file input and runs the full analysis in headless Chromium.
// usage: node scripts/upload-check.mjs <out-dir> <file.gpx> [...]
import { Browser, sleep } from '../../.claude/skills/design-taste-frontend/scripts/lib/cdp.mjs';
const [out, ...files] = process.argv.slice(2);
const b = await Browser.launch({ extraArgs: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
try {
  const p = await b.newPage({ width: 1440, height: 900 });
  const errs = [];
  await p.send('Runtime.enable'); await p.send('DOM.enable');
  b.on(p.sessionId, 'Runtime.exceptionThrown', (e) => errs.push(e.exceptionDetails.exception?.description?.slice(0, 200) ?? e.exceptionDetails.text));
  b.on(p.sessionId, 'Runtime.consoleAPICalled', (e) => { if (e.type === 'error') errs.push(e.args.map((a) => a.value ?? a.description).join(' ').slice(0, 200)); });
  await p.goto('http://localhost:5174/?nosnap', { settleMs: 500 });
  await sleep(3000);
  await p.eval(`document.querySelector('#demo').scrollIntoView()`);
  await sleep(2500);
  for (const f of files) {
    const name = f.split('/').pop();
    const { root } = await p.send('DOM.getDocument', { depth: -1, pierce: true });
    const { nodeId } = await p.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#demo input[type=file]' });
    await p.send('DOM.setFileInputFiles', { nodeId, files: [f] });
    await sleep(800);
    const parsed = await p.eval(`({ err: document.querySelector('#demo .error')?.innerText ?? null, route: document.querySelector('.step-value')?.innerText, notes: [...document.querySelectorAll('.step .hint')].map(n => n.innerText).filter(t => /joined|jump/.test(t)) })`);
    if (parsed.err) { console.log(`\n# ${name}\n  rejected: ${parsed.err}`); continue; }
    await sleep(4000); console.log(`\n# ${name} before checking: ` + JSON.stringify(await p.eval(`[...document.querySelectorAll('.demo .mk-point .mk-label')].map(n => n.innerText)`)));
    await p.eval(`[...document.querySelectorAll('#demo button')].find(b => /^Check/.test(b.textContent.trim())).click()`);
    const t0 = Date.now(); let res = null;
    while (Date.now() - t0 < 120000) {
      await sleep(1000);
      res = await p.eval(`(() => { const r = document.querySelector('#demo-results'); const e = document.querySelector('#demo .step .error'); if (!r && !e) return null; return {
        error: e?.innerText ?? null, sum: r?.querySelector('.find-lead')?.innerText, slope: r?.querySelector('.ledger dd')?.innerText.split('\\n')[0],
        also: [...(r?.querySelectorAll('.find-also') ?? [])].map(n => n.innerText.slice(0, 90)), route: document.querySelector('.step-value')?.innerText,
        markers: [...document.querySelectorAll('.demo .mk-point .mk-label')].map(n => n.innerText), profile: !!document.querySelector('.demo-map .profile svg') }; })()`);
      if (res) break;
    }
    console.log(`\n# ${name}  (${Math.round((Date.now() - t0) / 1000)} s)\n  route: ${parsed.route}${parsed.notes.length ? '\n  notes: ' + parsed.notes.join(' | ') : ''}\n  ${JSON.stringify(res)}`);
    await sleep(4000);
    await p.screenshot({ path: `${out}/${name}.jpg`, quality: 70 });
  }
  console.log('\nerrors:', errs.length ? errs.join('\n') : 'none');
} finally { await b.close(); }
