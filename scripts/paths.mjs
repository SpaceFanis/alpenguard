import fs from 'node:fs';
const G = JSON.parse(fs.readFileSync(new URL('./grid.json', import.meta.url)));
const { SUM, STEP, N, W, E, S, A } = G;
const mLat = 111320, mLon = 111320 * Math.cos(SUM.lat * Math.PI / 180);
export const ll = (k) => ({ lat: SUM.lat + (Math.floor(k / W) - N) * STEP, lon: SUM.lon + (k % W - N) * STEP });
export const idx = (lat, lon) => Math.round((lat - SUM.lat) / STEP + N) * W + Math.round((lon - SUM.lon) / STEP + N);
export function dijkstra(src, costFn) {
  const dist = new Float64Array(W * W).fill(Infinity), prev = new Int32Array(W * W).fill(-1);
  dist[src] = 0; const heap = [[0, src]];
  const push = (x) => { heap.push(x); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const t = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let i = 0; for (;;) { let m = i; const a = 2*i+1, b = a+1; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return t; };
  while (heap.length) {
    const [d, k] = pop(); if (d > dist[k]) continue;
    const i = Math.floor(k / W), j = k % W;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      if (!a && !b) continue; const ni = i + a, nj = j + b; if (ni < 1 || nj < 1 || ni >= W - 1 || nj >= W - 1) continue;
      const nk = ni * W + nj; const len = Math.hypot(a * STEP * mLat, b * STEP * mLon);
      const c = costFn(k, nk, len); if (!isFinite(c)) continue;
      if (d + c < dist[nk]) { dist[nk] = d + c; prev[nk] = k; push([d + c, nk]); }
    }
  }
  return { dist, prev };
}
export const G_ = G;
