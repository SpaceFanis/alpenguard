// Dev check: trackpad-like swipes. One swipe with a long inertia tail must move one stop; a second swipe
// started during that tail must move one more.
import { Browser, sleep } from '../../.claude/skills/design-taste-frontend/scripts/lib/cdp.mjs';
const b = await Browser.launch({ extraArgs: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
try {
  const p = await b.newPage({ width: 1470, height: 830 });
  await p.goto('http://localhost:5174/', { settleMs: 500 }); await sleep(4000);
  // Real trackpads: a quick rise, then ~1.2 s of decaying inertia (deltas from a MacBook trace, rounded).
  const swipe = () => [6, 18, 42, 70, 84, 80, 72, 64, 57, 50, 44, 39, 34, 30, 26, 23, 20, 17, 15, 13, 11, 10, 8, 7, 6, 5, 4, 4, 3, 3, 2, 2, 2, 1, 1, 1];
  const send = (dy) => p.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 30, y: 400, deltaX: 0, deltaY: dy });
  const ys = () => p.eval('Math.round(scrollY)');
  for (const dy of swipe()) { await send(dy); await sleep(16); }
  await sleep(1200); console.log('one swipe + full inertia:', await ys(), '(expect 664)');
  const a = swipe(), bb = swipe(); // second swipe begins 22 events (~350 ms) into the first one's tail
  const seq = a.slice(0, 22).concat(bb.map((v, i) => v + (a[22 + i] ?? 0)));
  for (const dy of seq) { await send(dy); await sleep(16); }
  await sleep(1500); console.log('two swipes, second in the tail:', await ys(), '(expect 1992)');
} finally { await b.close(); }
