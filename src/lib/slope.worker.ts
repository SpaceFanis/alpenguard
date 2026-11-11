/// <reference lib="webworker" />
// Turns one Terrarium elevation tile into a slope-angle tile off the main thread.
import { decodeTerrarium } from './terrain-math';
import { TERRARIUM, SLOPE_BANDS } from './slope-bands';

self.onmessage = async (e: MessageEvent<{ id: number; z: number; x: number; y: number }>) => {
  const { id, z, x, y } = e.data;
  try {
    const res = await fetch(TERRARIUM.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)));
    if (!res.ok) throw new Error(`slope tile ${z}/${x}/${y}: ${res.status}`);
    const E = decodeTerrarium(await res.arrayBuffer());
    const c = new OffscreenCanvas(256, 256);
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(256, 256);
    const d = img.data;
    const n = 2 ** z;
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n))) * 180) / Math.PI;
    const px = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (256 * n);
    const at = (i: number, j: number) => E[Math.min(255, Math.max(0, j)) * 256 + Math.min(255, Math.max(0, i))];
    for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
      const dzdx = (at(i + 1, j - 1) + 2 * at(i + 1, j) + at(i + 1, j + 1) - at(i - 1, j - 1) - 2 * at(i - 1, j) - at(i - 1, j + 1)) / (8 * px);
      const dzdy = (at(i - 1, j + 1) + 2 * at(i, j + 1) + at(i + 1, j + 1) - at(i - 1, j - 1) - 2 * at(i, j - 1) - at(i + 1, j - 1)) / (8 * px);
      const s = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
      const o = (j * 256 + i) * 4;
      const band = SLOPE_BANDS.find((b) => s >= b.from && s < b.to);
      if (band) { d[o] = band.color[0]; d[o + 1] = band.color[1]; d[o + 2] = band.color[2]; d[o + 3] = 255; }
    }
    ctx.putImageData(img, 0, 0);
    const buf = await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer();
    self.postMessage({ id, buf }, [buf]);
  } catch (err) {
    self.postMessage({ id, error: (err as Error).message });
  }
};
