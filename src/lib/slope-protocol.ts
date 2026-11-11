// A MapLibre protocol that returns slope-angle tiles, computed in a small pool of workers
// so the page stays responsive while the map loads.
import { addProtocol } from 'maplibre-gl';
export { TERRARIUM, SLOPE_BANDS } from './slope-bands';

let registered = false;
export function registerSlopeProtocol() {
  if (registered) return;
  registered = true;
  const size = Math.max(1, Math.min(3, (navigator.hardwareConcurrency ?? 4) - 2));
  const pool = Array.from({ length: size }, () => new Worker(new URL('./slope.worker.ts', import.meta.url), { type: 'module' }));
  const pending = new Map<number, { resolve: (b: ArrayBuffer) => void; reject: (e: Error) => void }>();
  pool.forEach((w) => { w.onmessage = (e) => { const p = pending.get(e.data.id); if (!p) return; pending.delete(e.data.id); if (e.data.error) p.reject(new Error(e.data.error)); else p.resolve(e.data.buf); }; });
  let next = 0;
  addProtocol('slope', (params, abort) => new Promise((resolve, reject) => {
    const [z, x, y] = params.url.replace('slope://', '').split('/').map(Number);
    const id = next++;
    pending.set(id, { resolve: (buf) => resolve({ data: buf }), reject });
    abort.signal.addEventListener('abort', () => { pending.delete(id); reject(new Error('aborted')); });
    pool[id % pool.length].postMessage({ id, z, x, y });
  }));
}
