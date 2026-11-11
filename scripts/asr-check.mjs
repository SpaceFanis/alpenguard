// Dev check: runs the on-device speech worker on public/__voice-test.wav in headless Chromium.
import { Browser, sleep } from '../../.claude/skills/design-taste-frontend/scripts/lib/cdp.mjs';
const b = await Browser.launch();
try {
  const p = await b.newPage({ width: 800, height: 600 });
  await p.goto(process.argv[2] ?? 'http://localhost:5174/', { settleMs: 300 });
  await p.eval(`(() => { window.__asr = { state: 'start' }; (async () => {
    const t0 = performance.now();
    const ctx = new AudioContext({ sampleRate: 16000 });
    const audio = (await ctx.decodeAudioData(await (await fetch('/__voice-test.wav')).arrayBuffer())).getChannelData(0);
    const w = new Worker('/src/lib/asr.worker.ts?worker_file&type=module', { type: 'module' });
    w.onmessage = (e) => { if (e.data.type === 'progress') window.__asr = { state: 'loading', progress: Math.round(e.data.progress) }; else window.__asr = { ...e.data, seconds: Math.round((performance.now() - t0) / 1000), brave: !!navigator.brave }; };
    w.postMessage({ type: 'run', audio }, [audio.buffer]);
  })().catch((e) => { window.__asr = { error: String(e) }; }); return 1; })()`);
  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    const r = await p.eval('window.__asr');
    if (r.type || r.error) { console.log(JSON.stringify(r)); break; }
    if (i % 5 === 0) console.log('…', JSON.stringify(r));
  }
} finally { await b.close(); }
