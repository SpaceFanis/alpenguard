// Dev check: flicks down through the whole page and back up, and reports each stop.
// Inside the sample tour, small wheel moves should scroll freely (no stepping).
import { Browser, sleep } from '../../.claude/skills/design-taste-frontend/scripts/lib/cdp.mjs';
const [W, H] = (process.argv[2] ?? '1440x900').split('x').map(Number);
const b = await Browser.launch({ extraArgs: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
try {
  const p = await b.newPage({ width: W, height: H });
  await p.goto('http://localhost:5174/', { settleMs: 500 });
  await sleep(4000);
  const wheel = async (dy, n, gap = 16) => { for (let i = 0; i < n; i++) { await p.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 24, y: H / 2, deltaX: 0, deltaY: dy }); await sleep(gap); } };
  const where = () => p.eval(`(() => { const secs = ['.pm','#problem','.toll','#waits','#demo','#rules','#compare','#limits','.footer'];
    const hit = secs.map(q => [q, document.querySelector(q).getBoundingClientRect()]).filter(([,r]) => r.top < innerHeight*0.5 && r.bottom > innerHeight*0.5).map(([q,r]) => q + ' top ' + Math.round(r.top))[0];
    return Math.round(scrollY) + '  ' + hit; })()`);
  const max = await p.eval('document.documentElement.scrollHeight - innerHeight');
  console.log('max', max, '| start', await where());
  let last = -1, i = 0;
  while (i++ < 60) {
    await wheel(240, 1); await sleep(1300);
    const w = await where(); const y = +w.split(' ')[0];
    const inDemo = w.includes('#demo');
    console.log(('down ' + i).padEnd(8), w);
    if (w.includes('#demo top 0')) { // the map takes the wheel: the page must not move
      const before = await p.eval('Math.round(scrollY)');
      const m = await p.eval('(() => { const r = document.querySelector(".demo .maplibregl-map")?.getBoundingClientRect(); return r ? [r.left + r.width/2, r.top + r.height/2, Math.round(r.top), Math.round(r.bottom)] : null; })()');
      if (m && m[1] > 0 && m[1] < H) { for (const dy of [-240, 240, -240]) { await p.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: m[0], y: m[1], deltaX: 0, deltaY: dy }); await sleep(700); } }
      console.log('  map wheel', m ? 'over map' : 'no map', 'page moved', (await p.eval('Math.round(scrollY)')) - before);
    }
    if (y >= max - 2 && y === last) break;
    last = y;
  }
  console.log('— up —'); last = -1; i = 0;
  while (i++ < 60) {
    await wheel(-240, 1); await sleep(1300);
    const w = await where(); const y = +w.split(' ')[0]; console.log(('up ' + i).padEnd(8), w);
    if (y === last && y === 0) break; last = y;
  }
} finally { await b.close(); }
