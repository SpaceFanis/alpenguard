/// <reference lib="webworker" />
// Turns one Terrarium elevation tile into a slope-angle tile off the main thread.
// The elevation tiles store heights in small steps, and the slope at a tile's edge needs the pixels of the
// next tile. So each tile is read with a 2-pixel border from its eight neighbours, lightly smoothed, and only
// then measured: no seams along tile edges, no striped texture from the steps.
import { decodeTerrarium } from './terrain-math';
import { TERRARIUM, SLOPE_BANDS } from './slope-bands';

const PAD = 2, N = 256, S = N + PAD * 2;
const cache = new Map<string, Promise<Float32Array | null>>(); // decoded tiles, shared by neighbouring requests

function tile(z: number, x: number, y: number): Promise<Float32Array | null> {
  const n = 2 ** z;
  if (y < 0 || y >= n) return Promise.resolve(null);
  x = ((x % n) + n) % n;
  const key = `${z}/${x}/${y}`;
  let p = cache.get(key);
  if (!p) {
    p = fetch(TERRARIUM.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)))
      .then(async (r) => (r.ok ? Float32Array.from(decodeTerrarium(await r.arrayBuffer())) : null))
      .catch(() => null);
    cache.set(key, p);
    if (cache.size > 96) cache.delete(cache.keys().next().value!);
  }
  return p;
}

self.onmessage = async (e: MessageEvent<{ id: number; z: number; x: number; y: number }>) => {
  const { id, z, x, y } = e.data;
  try {
    const grid = await Promise.all([-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => tile(z, x + dx, y + dy))));
    const C = grid[4];
    if (!C) throw new Error(`slope tile ${z}/${x}/${y}: no elevation`);
    // Padded heights: the centre tile plus a border taken from its neighbours (or its own edge if missing).
    const H = new Float32Array(S * S);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const gi = i - PAD, gj = j - PAD;
      const tx = gi < 0 ? 0 : gi >= N ? 2 : 1, ty = gj < 0 ? 0 : gj >= N ? 2 : 1;
      const T = grid[ty * 3 + tx];
      const li = (gi + N) % N, lj = (gj + N) % N;
      H[j * S + i] = T ? T[lj * N + li] : C[Math.min(N - 1, Math.max(0, gj)) * N + Math.min(N - 1, Math.max(0, gi))];
    }
    // A light 3×3 smoothing removes the stair-steps of the stored heights without blurring real terrain.
    const B = new Float32Array(S * S);
    for (let j = 1; j < S - 1; j++) for (let i = 1; i < S - 1; i++) {
      const k = j * S + i;
      B[k] = (4 * H[k] + 2 * (H[k - 1] + H[k + 1] + H[k - S] + H[k + S]) + H[k - S - 1] + H[k - S + 1] + H[k + S - 1] + H[k + S + 1]) / 16;
    }
    const c = new OffscreenCanvas(N, N);
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(N, N);
    const d = img.data;
    const n = 2 ** z;
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n))) * 180) / Math.PI;
    const px = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (N * n);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = (j + PAD) * S + (i + PAD);
      const dzdx = (B[k - S + 1] + 2 * B[k + 1] + B[k + S + 1] - B[k - S - 1] - 2 * B[k - 1] - B[k + S - 1]) / (8 * px);
      const dzdy = (B[k + S - 1] + 2 * B[k + S] + B[k + S + 1] - B[k - S - 1] - 2 * B[k - S] - B[k - S + 1]) / (8 * px);
      const s = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
      if (s < 30) continue;
      const band = s >= 45 ? SLOPE_BANDS[3] : s >= 40 ? SLOPE_BANDS[2] : s >= 35 ? SLOPE_BANDS[1] : SLOPE_BANDS[0];
      const o = (j * N + i) * 4;
      d[o] = band.color[0]; d[o + 1] = band.color[1]; d[o + 2] = band.color[2]; d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const buf = await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer();
    self.postMessage({ id, buf }, [buf]);
  } catch (err) {
    self.postMessage({ id, error: (err as Error).message });
  }
};
