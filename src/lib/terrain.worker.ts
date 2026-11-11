/// <reference lib="webworker" />
// Computes elevation, slope and aspect along a route from AWS Terrarium tiles (z13, ~13 m/pixel here).
import { decodeTerrarium, horn, resample, type ProfilePoint } from './terrain-math';

const Z = 13;
const URL_T = (z: number, x: number, y: number) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const tiles = new Map<string, Promise<Float32Array>>();

function tile(x: number, y: number) {
  const k = `${x}/${y}`;
  if (!tiles.has(k)) {
    tiles.set(k, (async () => {
      const res = await fetch(URL_T(Z, x, y));
      if (!res.ok) throw new Error(`Elevation tile ${k} returned ${res.status}`);
      return decodeTerrarium(await res.arrayBuffer());
    })());
  }
  return tiles.get(k)!;
}

function tileXY(lon: number, lat: number) {
  const n = 2 ** Z, r = (lat * Math.PI) / 180;
  return { x: ((lon + 180) / 360) * n, y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n };
}

async function px(gx: number, gy: number) {
  const tx = Math.floor(gx / 256), ty = Math.floor(gy / 256);
  const e = await tile(tx, ty);
  return e[(gy - ty * 256) * 256 + (gx - tx * 256)];
}

/** Bilinear elevation at a lon/lat. */
async function elev(lon: number, lat: number) {
  const { x, y } = tileXY(lon, lat);
  const fx = x * 256 - 0.5, fy = y * 256 - 0.5;
  const x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0;
  const [a, b, c, d] = await Promise.all([px(x0, y0), px(x0 + 1, y0), px(x0, y0 + 1), px(x0 + 1, y0 + 1)]);
  return a * (1 - ax) * (1 - ay) + b * ax * (1 - ay) + c * (1 - ax) * ay + d * ax * ay;
}

const CELL = 20; // metres between Horn samples

async function sample(lon: number, lat: number) {
  const mLat = 111320, mLon = 111320 * Math.cos((lat * Math.PI) / 180);
  const dLat = CELL / mLat, dLon = CELL / mLon;
  const z: number[][] = [];
  for (let r = 1; r >= -1; r--) {
    const row: number[] = [];
    for (let c = -1; c <= 1; c++) row.push(await elev(lon + c * dLon, lat + r * dLat));
    z.push(row);
  }
  return { elev: z[1][1], ...horn(z, CELL, CELL) };
}

self.onmessage = async (e: MessageEvent<{ coords: number[][]; step?: number }>) => {
  try {
    const pts = resample(e.data.coords, e.data.step ?? 25);
    const out: ProfilePoint[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      out.push({ ...p, ...(await sample(p.lon, p.lat)) });
      if (i % 10 === 0) self.postMessage({ type: 'progress', done: i, total: pts.length });
    }
    self.postMessage({ type: 'done', profile: out });
  } catch (err) {
    self.postMessage({ type: 'error', message: (err as Error).message });
  }
};
