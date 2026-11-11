// The motion layer: masked headline on load, staggered entrances per section, smooth scrolling.
// Everything is skipped under prefers-reduced-motion, and content is visible if this never runs.
import { useEffect } from 'react';
import gsap from 'gsap';
import Lenis from 'lenis';
import Snap from 'lenis/snap';

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
    const coarse = window.matchMedia('(pointer: coarse)').matches;

    // ── One scroll, one change, down to the sample tour ──
    // On a mouse or trackpad, each wheel gesture eases to the next stop: the mountain's beats, then each
    // chapter above the sample tour. A section taller than the screen gets extra stops inside it, but a stop
    // never straddles two sections. The rest of the gesture (trackpad inertia keeps firing for a second) is
    // swallowed until the wheel goes quiet, so one flick moves one stop. From the sample tour down, the page
    // scrolls freely and settles softly on chapters, so you can type, read and use the map.
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
      const sorted = ys.map((y) => Math.min(limit, Math.max(0, Math.round(y)))).sort((a, b) => a - b)
        .filter((y, i, a) => !i || y - a[i - 1] > 24);
      // Extra stops only where both ends of the gap show the same section: a tall section is read in
      // screens, and leaving one always lands squarely on the next.
      const sections = gsap.utils.toArray<HTMLElement>('main section:not(.pm)').map((el) => [top(el), bottom(el)]);
      const out: number[] = [];
      sorted.forEach((y, i) => {
        const prev = sorted[i - 1];
        if (prev != null && y - prev > vh * 0.85 && sections.some(([a, b]) => prev >= a - 4 && y + vh <= b + 4)) {
          const n = Math.ceil((y - prev) / (vh * 0.8));
          for (let k = 1; k < n; k++) out.push(Math.round(prev + ((y - prev) * k) / n));
        }
        out.push(y);
      });
      return out;
    };
    // Stepped above the sample tour; free from its top down (and over the map, which zooms instead).
    const stepped = (y: number, dir: number) => y < demoTop() - 4 || (y <= demoTop() + 4 && dir < 0);

    if (import.meta.env.DEV) Object.assign(window, { __stops: stops }); // for scripts/step-check.mjs
    let stepping = false, armed = true, lastWheel = 0, wheeled = false;
    const stepTo = (y: number) => {
      stepping = true; armed = false; wheeled = false;
      const dist = Math.abs(y - lenis.targetScroll) / window.innerHeight;
      lenis.scrollTo(y, { duration: Math.min(1.05, Math.max(0.7, 0.62 + dist * 0.3)), easing: easeInOut, lock: true, force: true, onComplete: () => { stepping = false; } });
    };
    const step = (dir: number) => {
      const y = lenis.targetScroll, ys = stops();
      const next = dir > 0 ? ys.find((v) => v > y + 4) : [...ys].reverse().find((v) => v < y - 4);
      if (next != null) stepTo(next);
    };
    // Scrolling up out of the sample tour freely, then stopping in between: settle on the nearest stop.
    const quiet = window.setInterval(() => {
      const idle = performance.now() - lastWheel > 140;
      if (!stepping && idle) armed = true;
      if (!wheeled || stepping || !idle || lenis.isScrolling) return;
      wheeled = false;
      const y = lenis.targetScroll;
      if (y >= demoTop() - 4) return;
      const ys = stops(); const near = ys.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a), ys[0]);
      if (Math.abs(near - y) > 4) stepTo(near);
    }, 50);

    const onMap = (t: EventTarget | null) => t instanceof Element && !!t.closest('.demo .riskmap'); // the map, its overlays and its loading cover
    const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9, touchMultiplier: 1.15, smoothWheel: true,
      prevent: (node) => !!node.closest('.maplibregl-map'),
      virtualScroll: (d) => {
        if (!snapOn || coarse || d.event.type !== 'wheel' || onMap(d.event.target)) return true;
        lastWheel = Math.max(performance.now() - 1000, d.event.timeStamp); // when the hand moved, not when we got to it
        const dir = Math.sign(d.deltaY);
        if (!stepping && !stepped(lenis.targetScroll, dir)) { wheeled = true; return true; }
        // Whatever we don't hand to Lenis must also be cancelled, or the browser scrolls it natively.
        if (d.event.cancelable) d.event.preventDefault();
        if (!stepping && armed && Math.abs(d.deltaY) >= 2) step(dir);
        return false;
      } });
    let raf = 0;
    const loop = (t: number) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    const onKey = (e: KeyboardEvent) => {
      if (!snapOn || coarse || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement).closest('input, textarea, select, button, a, summary, [contenteditable], .maplibregl-map')) return;
      const dir = ['ArrowDown', 'PageDown', ' '].includes(e.key) && !e.shiftKey ? 1 : ['ArrowUp', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey) ? -1 : 0;
      if (!dir || !stepped(lenis.targetScroll, dir)) return;
      e.preventDefault();
      if (!stepping) step(dir);
    };
    window.addEventListener('keydown', onKey);

    // ── Soft landings: below the sample tour on every screen; above it on touch screens only ──
    const sectionSnap = new Snap(lenis, { type: 'proximity', distanceThreshold: '22%', debounce: 260, duration: 0.9, easing: easeInOut });
    let removers: (() => void)[] = [];
    const placeLandings = () => {
      removers.forEach((r) => r()); removers = [];
      if (!snapOn) return;
      for (const l of coarse ? [...ABOVE, ...BELOW] : BELOW) { const y = landing(l, window.innerHeight); if (y != null) removers.push(sectionSnap.add(Math.max(0, y))); }
    };
    placeLandings();
    const ro = new ResizeObserver(() => placeLandings());
    ro.observe(document.body);
    const demo = document.querySelector('#demo');
    const demoIo = new IntersectionObserver(([e]) => { if (e.isIntersecting) sectionSnap.stop(); else sectionSnap.start(); }, { threshold: 0.12 });
    if (demo) demoIo.observe(demo);
    const beatSnap = new Snap(lenis, { type: 'proximity', distanceThreshold: '40%', debounce: 220, duration: 0.85, easing: easeInOut });
    if (snapOn && coarse) beatSnap.addElements(gsap.utils.toArray<HTMLElement>('.pm-mark'), { align: ['start'] });

    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const target = document.querySelector(a.getAttribute('href')!);
      if (target) { e.preventDefault(); lenis.scrollTo(target as HTMLElement, { duration: 1.4, easing: easeInOut }); }
    };
    document.addEventListener('click', onClick);
    return () => { window.clearInterval(quiet); window.removeEventListener('keydown', onKey); io.disconnect(); ro.disconnect(); demoIo.disconnect(); cancelAnimationFrame(raf); sectionSnap.destroy(); beatSnap.destroy(); lenis.destroy(); document.removeEventListener('click', onClick); };
  }, []);
}
