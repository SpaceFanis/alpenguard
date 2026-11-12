// The motion layer: masked headline on load, staggered entrances per section, smooth scrolling.
// Everything is skipped under prefers-reduced-motion, and content is visible if this never runs.
import { useEffect } from 'react';
import gsap from 'gsap';
import Lenis from 'lenis';
import Snap from 'lenis/snap';

/** Read by heavy work (the demo map) so it never starts in the middle of a scroll step. */
export const scrollState = { stepping: false };

export function useMotion() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const ease = 'expo.out';

    // Signature: each headline line rises from behind its own baseline.
    // Signature: the name rises from behind the bottom edge while the photograph settles.
    gsap.fromTo('.masked > span', { yPercent: 105 }, { yPercent: 0, duration: 1.2, ease, delay: 0.15 });
    gsap.fromTo(['.pm-sub', '.pm-bar'], { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.9, ease, delay: 0.9, stagger: 0.1, clearProps: 'transform,opacity' });

    // Entrances: within each section, heading → text → pictures, 70 ms apart.
    const sections = gsap.utils.toArray<HTMLElement>('main section:not(.pm):not(.waits)');
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        const parts = e.target.querySelectorAll<HTMLElement>('h2, .reveal, .demo-head p, .step, .limits-photo, .limits-text .lead, .faq-list');
        gsap.fromTo(parts, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, ease, stagger: 0.07, clearProps: 'transform,opacity' });
      }
    }, { rootMargin: '0px 0px -12% 0px' });
    sections.forEach((s) => io.observe(s));

    const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const snapOn = !new URLSearchParams(location.search).has('nosnap'); // ?nosnap: for automated page checks

    // ── One gesture, one chapter, down to the sample tour ──
    // Above the sample tour, each gesture (a wheel flick, a trackpad swipe, a finger swipe) eases to the next
    // stop: the mountain's beats, then each chapter. Nothing in between: one gesture, one change. The rest of
    // a gesture (trackpad inertia keeps firing for a second) is swallowed, but a fresh swipe during that tail
    // is recognised by its rising speed, so quick successive swipes are never ignored. From the sample tour
    // down, the page scrolls freely and settles softly on chapters, so you can type, read and use the map.
    const top = (el: Element) => el.getBoundingClientRect().top + window.scrollY;
    const bottom = (el: Element) => el.getBoundingClientRect().bottom + window.scrollY;
    const demoTop = () => { const d = document.querySelector('#demo'); return d ? Math.round(top(d)) : Infinity; };
    type Landing = [selector: string, room: number, mode: 'start' | 'end' | 'fit', endSelector?: string];
    const ABOVE: Landing[] = [['#problem', 0, 'start'], ['.toll', 48, 'end'], ['#waits', 0, 'start'], ['#demo', 0, 'start']];
    const BELOW: Landing[] = [['#rules', 24, 'fit'], ['#compare', 24, 'fit', '.matrix'], ['#limits', 96, 'start'], ['.footer', 0, 'start']];
    const landing = ([sel, room, mode, endSel]: Landing, vh: number) => {
      const el = document.querySelector<HTMLElement>(sel); if (!el) return null;
      const startY = top(el) - room, endY = bottom((endSel && el.querySelector(endSel)) || el) + room - vh;
      return mode === 'start' ? startY : mode === 'end' ? endY : (endY + vh - startY <= vh ? startY : endY);
    };
    const stops = (): number[] => {
      const vh = window.innerHeight, limit = lenis.limit;
      const ys = gsap.utils.toArray<HTMLElement>('.pm-mark').map(top);
      for (const l of ABOVE) { const y = landing(l, vh); if (y != null) ys.push(y); }
      // On a phone the three printouts stack taller than the screen: one extra stop shows the last of them.
      // Where they fit (laptops and up), this stop falls outside the chapter and is left out.
      const desk = landing(['.desk', 24, 'end'], vh), pTop = landing(ABOVE[0], vh), toll = landing(ABOVE[1], vh);
      if (desk != null && pTop != null && toll != null && desk > pTop + vh * 0.3 && desk < toll - vh * 0.3) ys.push(desk);
      return ys.map((y) => Math.min(limit, Math.max(0, Math.round(y)))).sort((a, b) => a - b).filter((y, i, a) => !i || y - a[i - 1] > 24);
    };
    // Stepped above the sample tour; free from its top down (and over the map, which zooms instead).
    const stepped = (y: number, dir: number) => y < demoTop() - 4 || (y <= demoTop() + 4 && dir < 0);

    if (import.meta.env.DEV) Object.assign(window, { __stops: stops }); // for scripts/step-check.mjs
    let stepping = false, armed = true, lastWheel = -1e9, wheeled = false, safety = 0;
    const recent: number[] = []; // the last few wheel speeds, to tell a new swipe from inertia
    const stepTo = (y: number) => {
      stepping = scrollState.stepping = true; armed = false; wheeled = false;
      const dist = Math.abs(y - lenis.targetScroll) / window.innerHeight;
      const duration = Math.min(0.8, Math.max(0.55, 0.5 + dist * 0.22));
      const done = () => { stepping = scrollState.stepping = false; window.clearTimeout(safety); };
      window.clearTimeout(safety); safety = window.setTimeout(done, duration * 1000 + 400); // never stay locked
      lenis.scrollTo(y, { duration, easing: easeInOut, lock: true, force: true, onComplete: done });
    };
    const step = (dir: number) => {
      const y = lenis.targetScroll, ys = stops(), min = window.innerHeight * 0.1; // a late layout shift is not a stop
      const next = dir > 0 ? ys.find((v) => v > y + min) : [...ys].reverse().find((v) => v < y - min);
      if (next != null) stepTo(next);
    };
    // Scrolling up out of the sample tour freely, then stopping in between: settle on the nearest stop.
    const quiet = window.setInterval(() => {
      const idle = performance.now() - lastWheel > 140;
      if (!wheeled || stepping || !idle || lenis.isScrolling) return;
      wheeled = false;
      const y = lenis.targetScroll;
      if (y >= demoTop() - 4) return;
      const ys = stops(); const near = ys.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a), ys[0]);
      if (Math.abs(near - y) > 4) stepTo(near);
    }, 50);

    const onMap = (t: EventTarget | null) => t instanceof Element && !!t.closest('.demo .riskmap.is-painted'); // a visible map zooms; a loading one scrolls the page
    let touchAcc = 0, touchDone = false;
    const onWheel = (d: { deltaY: number; event: WheelEvent }) => {
      const ts = Math.max(performance.now() - 1000, d.event.timeStamp); // when the hand moved, not when we got to it
      const gap = ts - lastWheel; lastWheel = ts;
      const dir = Math.sign(d.deltaY), speed = Math.abs(d.deltaY), prev = recent[recent.length - 1] ?? 0;
      const avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
      recent.push(speed); if (recent.length > 4) recent.shift();
      // A new gesture: after a real pause, or after a short one if it speeds up again (inertia only slows),
      // or a sharp rise in speed on top of the last swipe's tail.
      if (!stepping && (gap > 400 || (gap > 140 && speed > prev * 1.2) || (gap > 250 && speed >= 40 && speed >= prev) || (speed >= 18 && speed > avg * 1.8))) armed = true;
      if (!stepping && !stepped(lenis.targetScroll, dir)) { wheeled = true; return true; }
      // Whatever we don't hand to Lenis must also be cancelled, or the browser scrolls it natively.
      if (d.event.cancelable) d.event.preventDefault();
      if (!stepping && armed && speed >= 2) step(dir);
      return false;
    };
    const onTouch = (d: { deltaX: number; deltaY: number; event: TouchEvent }) => {
      const type = d.event.type;
      if (type === 'touchstart') { touchAcc = 0; touchDone = false; return true; }
      if (type === 'touchend' || type === 'touchcancel') { const ours = touchAcc !== 0; touchAcc = 0; return !ours; }
      if (Math.abs(d.deltaX) > Math.abs(d.deltaY)) return true; // sideways: tables and carousels
      const dir = Math.sign(d.deltaY);
      if (!stepping && !touchAcc && !stepped(lenis.targetScroll, dir)) { wheeled = true; return true; }
      if (d.event.cancelable) d.event.preventDefault();
      touchAcc += d.deltaY || 0.0001;
      if (!stepping && !touchDone && Math.abs(touchAcc) > 24) { touchDone = true; step(Math.sign(touchAcc)); }
      return false;
    };
    const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.9, touchMultiplier: 1.15, smoothWheel: true,
      prevent: (node) => !!node.closest('.riskmap.is-painted .maplibregl-map'),
      virtualScroll: (d) => {
        if (!snapOn || onMap(d.event.target)) return true;
        if (d.event.type === 'wheel') return onWheel(d as unknown as { deltaY: number; event: WheelEvent });
        if (d.event.type.startsWith('touch')) return onTouch(d as unknown as { deltaX: number; deltaY: number; event: TouchEvent });
        return true;
      } });
    let raf = 0;
    const loop = (t: number) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    const onKey = (e: KeyboardEvent) => {
      if (!snapOn || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement).closest('input, textarea, select, button, a, summary, [contenteditable], .maplibregl-map')) return;
      const dir = ['ArrowDown', 'PageDown', ' '].includes(e.key) && !e.shiftKey ? 1 : ['ArrowUp', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey) ? -1 : 0;
      if (!dir || !stepped(lenis.targetScroll, dir)) return;
      e.preventDefault();
      if (!stepping) step(dir);
    };
    window.addEventListener('keydown', onKey);

    // ── Soft landings below the sample tour ──
    const sectionSnap = new Snap(lenis, { type: 'proximity', distanceThreshold: '22%', debounce: 260, duration: 0.8, easing: easeInOut });
    let removers: (() => void)[] = [];
    const placeLandings = () => {
      removers.forEach((r) => r()); removers = [];
      if (!snapOn) return;
      for (const l of BELOW) { const y = landing(l, window.innerHeight); if (y != null) removers.push(sectionSnap.add(Math.max(0, y))); }
    };
    placeLandings();
    const ro = new ResizeObserver(() => placeLandings());
    ro.observe(document.body);
    const demo = document.querySelector('#demo');
    const demoIo = new IntersectionObserver(([e]) => { if (e.isIntersecting) sectionSnap.stop(); else sectionSnap.start(); }, { threshold: 0.12 });
    if (demo) demoIo.observe(demo);

    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const target = document.querySelector(a.getAttribute('href')!);
      if (target) { e.preventDefault(); lenis.scrollTo(target as HTMLElement, { duration: 1.4, easing: easeInOut }); }
    };
    document.addEventListener('click', onClick);
    return () => { window.clearInterval(quiet); window.removeEventListener('keydown', onKey); io.disconnect(); ro.disconnect(); demoIo.disconnect(); cancelAnimationFrame(raf); sectionSnap.destroy(); window.clearTimeout(safety); lenis.destroy(); document.removeEventListener('click', onClick); };
  }, []);
}
