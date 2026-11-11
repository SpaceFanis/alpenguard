// Build-time: compute a grid of elevation/slope/aspect around the summit and find routes by Dijkstra.
import { elev } from './dem.mjs';
import fs from 'node:fs';
const SUM = { lat: 45.632, lon: 6.538 };
const R = 0.045, STEP = 0.0004; // ~45 m lon / ~31 m... keep it simple
const N = Math.round(R / STEP);
const mLat = 111320, mLon = 111320 * Math.cos(SUM.lat * Math.PI / 180);
const W = 2 * N + 1;
const E = new Float32Array(W * W);
for (let i = 0; i < W; i++) for (let j = 0; j < W; j++) E[i * W + j] = await elev(SUM.lon + (j - N) * STEP, SUM.lat + (i - N) * STEP);
const dx = STEP * mLon, dy = STEP * mLat;
const S = new Float32Array(W * W), A = new Float32Array(W * W);
for (let i = 1; i < W - 1; i++) for (let j = 1; j < W - 1; j++) {
  const z = (a, b) => E[(i + a) * W + (j + b)]; // a: north(+), b: east(+)
  const dzdx = ((z(1,1) + 2*z(0,1) + z(-1,1)) - (z(1,-1) + 2*z(0,-1) + z(-1,-1))) / (8 * dx);
  const dzdy = ((z(1,-1) + 2*z(1,0) + z(1,1)) - (z(-1,-1) + 2*z(-1,0) + z(-1,1))) / (8 * dy);
  S[i*W+j] = Math.atan(Math.hypot(dzdx, dzdy)) * 180 / Math.PI;
  let a = Math.atan2(-dzdx, -dzdy) * 180 / Math.PI; if (a < 0) a += 360; A[i*W+j] = a;
}
fs.writeFileSync(new URL('./grid.json', import.meta.url), JSON.stringify({ SUM, STEP, N, W, E: Array.from(E, v => Math.round(v)), S: Array.from(S, v => +v.toFixed(1)), A: Array.from(A, v => Math.round(v)) }));
console.log('grid', W, 'x', W);
