// Dev check: sends real wheel gestures and reports where the page lands after each one.
import { Browser, sleep } from '../../.claude/skills/design-taste-frontend/scripts/lib/cdp.mjs';
const b = await Browser.launch({ extraArgs: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
try {
  const p = await b.newPage({ width: 1440, height: 900 });
  await p.goto('http://localhost:5174/', { settleMs: 500 });
  await sleep(4000);
  const wheel = async (dy, n, gap) => { for (let i = 0; i < n; i++) { await p.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 450, deltaX: 0, deltaY: dy }); await sleep(gap); } };
  const where = () => p.eval(`(() => { const s = document.querySelector('.pm'); const h = (s.offsetHeight - innerHeight) / 5; const beat = (scrollY - s.offsetTop) / h;
    const sec = ['#problem','.toll','#waits','#demo','#rules','#compare','#limits','.footer'].map(q => [q, document.querySelector(q).getBoundingClientRect()]).filter(([,r]) => r.top < innerHeight*0.5 && r.bottom > innerHeight*0.5).map(([q]) => q)[0];
    return { y: Math.round(scrollY), beat: +beat.toFixed(2), caption: document.querySelector('.pm-beats li.is-on h2')?.innerText ?? null, section: scrollY > s.offsetTop + s.offsetHeight - innerHeight + 4 ? sec : 'scene' }; })()`);
  console.log('start', JSON.stringify(await where()));
  const gestures = [['flick', 120, 3, 16], ['trackpad with inertia', 40, 45, 16], ['flick', 120, 3, 16], ['flick', 120, 3, 16], ['flick', 120, 3, 16], ['flick (leave scene)', 120, 3, 16], ['flick up (back in)', -120, 3, 16], ['flick up', -120, 3, 16]];
  for (const [name, dy, n, gap] of gestures) { await wheel(dy, n, gap); await sleep(2100); console.log(name.padEnd(24), JSON.stringify(await where())); }
} finally { await b.close(); }
