// Dev check: scroll near a chapter with the wheel, stop, and measure where the page settles.
import { Browser, sleep } from '../../.claude/skills/design-taste-frontend/scripts/lib/cdp.mjs';
const b = await Browser.launch({ extraArgs: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
try {
  const p = await b.newPage({ width: 1440, height: 900 });
  await p.goto('http://localhost:5174/', { settleMs: 500 });
  await sleep(4000);
  const wheel = async (dy, n) => { for (let i = 0; i < n; i++) { await p.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 450, deltaX: 0, deltaY: dy }); await sleep(30); } };
  const cases = [
    ['the 28 (should show its bottom and the desk above, not the photo)', `(() => { const t = document.querySelector('.toll'); return t.getBoundingClientRect().bottom + scrollY + 48 - innerHeight; })()`,
     `(() => { const t = document.querySelector('.toll').getBoundingClientRect(), w = document.querySelector('#waits').getBoundingClientRect(); return { tollBottomInView: Math.round(innerHeight - t.bottom), photoVisiblePx: Math.max(0, Math.round(innerHeight - w.top)) }; })()`],
    ['good tools (AlpenGuard row fully in view)', `(() => { const s = document.querySelector('#compare'), m = s.querySelector('.matrix'); const top = s.getBoundingClientRect().top + scrollY - 24, bot = m.getBoundingClientRect().bottom + scrollY + 24; return bot - top <= innerHeight ? top : bot - innerHeight; })()`,
     `(() => { const r = [...document.querySelectorAll('.matrix tr')].at(-1).getBoundingClientRect(); return { usRowTop: Math.round(r.top), usRowBottom: Math.round(r.bottom), viewport: innerHeight, fullyVisible: r.top >= 0 && r.bottom <= innerHeight }; })()`],
    ['limits (heading not cut)', `(() => document.querySelector('#limits').getBoundingClientRect().top + scrollY - 96)()`,
     `(() => { const h = document.querySelector('#limits h2').getBoundingClientRect(); return { headingTop: Math.round(h.top), cut: h.top < 0 }; })()`],
  ];
  for (const [name, targetJs, checkJs] of cases) {
    const target = await p.eval(targetJs);
    await p.eval(`window.scrollTo(0, ${Math.round(target)} - 150)`); await sleep(400);
    await wheel(25, 3); await sleep(2200);
    console.log(name, '\n  ', JSON.stringify(await p.eval(checkJs)), ' landed', Math.round(await p.eval('scrollY')), 'target', Math.round(target));
  }
} finally { await b.close(); }
