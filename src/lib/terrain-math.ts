// Pure terrain math, shared by the browser worker, build scripts and tests.
import { decode } from 'fast-png';

export type Aspect8 = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export const ASPECTS: Aspect8[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Decode one Terrarium-encoded pixel to metres. */
export const terrarium = (r: number, g: number, b: number) => r * 256 + g + b / 256 - 32768;

/**
 * Horn's method on a 3×3 window.
 * z[row][col], row 0 = north, col 0 = west. dx, dy = cell size in metres.
 * Returns slope in degrees and aspect in degrees clockwise from north (the direction the slope faces).
 */
export function horn(z: number[][], dx: number, dy: number) {
  const [[a, b, c], [d, , f], [g, h, i]] = z;
  const dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * dx); // + = rises to the east
  const dzdy = ((a + 2 * b + c) - (g + 2 * h + i)) / (8 * dy); // + = rises to the north
  const slope = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
  let aspect = (Math.atan2(-dzdx, -dzdy) * 180) / Math.PI;
  if (aspect < 0) aspect += 360;
  return { slope, aspect };
}

export const toAspect8 = (deg: number): Aspect8 => ASPECTS[Math.round(deg / 45) % 8];

const R = 6371008.8;
export function haversine([lon1, lat1]: number[], [lon2, lat2]: number[]) {
  const p = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * p) / 2) ** 2 + Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin(((lon2 - lon1) * p) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Resample a polyline every `step` metres. Returns points with their distance along the line (m). */
export function resample(coords: number[][], step = 25) {
  const out: { lon: number; lat: number; d: number }[] = [{ lon: coords[0][0], lat: coords[0][1], d: 0 }];
  let carried = 0, total = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1], b = coords[i];
    const seg = haversine(a, b);
    let t = step - carried;
    while (t <= seg) {
      const f = t / seg;
      out.push({ lon: a[0] + (b[0] - a[0]) * f, lat: a[1] + (b[1] - a[1]) * f, d: total + t });
      t += step;
    }
    carried = seg - (t - step);
    total += seg;
  }
  const last = coords[coords.length - 1];
  if (total - out[out.length - 1].d > 1) out.push({ lon: last[0], lat: last[1], d: total });
  return out;
}

export interface ProfilePoint { lon: number; lat: number; d: number; elev: number; slope: number; aspect: number }

/**
 * Decode a Terrarium PNG to metres without a canvas. Canvas decoding can shift colour values slightly,
 * and in Terrarium one step of the red channel is 256 m, which shows up as false cliffs.
 */
export function decodeTerrarium(buf: ArrayBuffer): Float32Array {
  const png = decode(new Uint8Array(buf));
  const n = png.width * png.height, out = new Float32Array(n), d = png.data, c = png.channels;
  const pal = png.palette;
  for (let i = 0; i < n; i++) {
    if (pal) { const [r, g, b] = pal[d[i]]; out[i] = terrarium(r, g, b); }
    else out[i] = terrarium(d[i * c], d[i * c + 1], d[i * c + 2]);
  }
  return out;
}
