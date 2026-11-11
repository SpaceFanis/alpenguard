// Shared DEM helpers for build-time scripts: fetch AWS Terrarium tiles and sample elevation.
import { PNG } from 'pngjs';
const cache = new Map();
export const Z = 13;
export function lonLatToTile(lon, lat, z = Z) {
  const n = 2 ** z, x = (lon + 180) / 360 * n;
  const r = lat * Math.PI / 180;
  const y = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n;
  return { x, y };
}
async function tile(z, x, y) {
  const k = `${z}/${x}/${y}`;
  if (!cache.has(k)) cache.set(k, (async () => {
    const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${k}.png`);
    if (!res.ok) throw new Error('tile ' + k + ' ' + res.status);
    return PNG.sync.read(Buffer.from(await res.arrayBuffer()));
  })());
  return cache.get(k);
}
export async function elev(lon, lat, z = Z) {
  const { x, y } = lonLatToTile(lon, lat, z);
  const tx = Math.floor(x), ty = Math.floor(y);
  const png = await tile(z, tx, ty);
  // bilinear
  const fx = (x - tx) * 256 - 0.5, fy = (y - ty) * 256 - 0.5;
  const px = Math.max(0, Math.min(254, Math.floor(fx))), py = Math.max(0, Math.min(254, Math.floor(fy)));
  const h = (i, j) => { const o = ((py + j) * 256 + (px + i)) * 4; const d = png.data; return d[o] * 256 + d[o + 1] + d[o + 2] / 256 - 32768; };
  const ax = Math.min(1, Math.max(0, fx - px)), ay = Math.min(1, Math.max(0, fy - py));
  return h(0,0)*(1-ax)*(1-ay) + h(1,0)*ax*(1-ay) + h(0,1)*(1-ax)*ay + h(1,1)*ax*ay;
}
// Slope (deg) and aspect (deg, 0=N clockwise, direction the slope faces) using Horn's method, cell ~ d metres.
export async function slopeAspect(lon, lat, d = 20) {
  const mLat = 111320, mLon = 111320 * Math.cos(lat * Math.PI / 180);
  const dLat = d / mLat, dLon = d / mLon;
  const g = async (i, j) => elev(lon + i * dLon, lat + j * dLat);
  const [a,b,c,dd,f,gg,h,ii] = await Promise.all([g(-1,1),g(0,1),g(1,1),g(-1,0),g(1,0),g(-1,-1),g(0,-1),g(1,-1)]);
  const dzdx = ((c + 2*f + ii) - (a + 2*dd + gg)) / (8 * d); // east
  const dzdy = ((a + 2*b + c) - (gg + 2*h + ii)) / (8 * d); // north
  const slope = Math.atan(Math.hypot(dzdx, dzdy)) * 180 / Math.PI;
  let aspect = Math.atan2(-dzdx, -dzdy) * 180 / Math.PI; if (aspect < 0) aspect += 360;
  return { slope, aspect };
}
