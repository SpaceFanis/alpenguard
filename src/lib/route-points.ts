// Which points of a route deserve a marker. The summit is the highest point of the elevation profile,
// not the last point of the file: loop tours end where they start, and many tours descend another way.
import { haversine, type ProfilePoint } from './terrain-math';

export interface RoutePoint { lngLat: [number, number]; label: string; kind: 'start' | 'top' | 'end' }

const LOOP_M = 250;   // start and end this close: one "Start and finish" marker
const APART_M = 250;  // markers closer than this would sit on top of each other

// Heights from the file count only if most points have one and they vary: some apps write 0 everywhere.
function usable(eles: (number | null)[], n: number) {
  const v = eles.filter((e): e is number => e != null);
  return v.length >= n / 2 && Math.max(...v) - Math.min(...v) >= 20;
}

export function routePoints(coords: number[][], profile: ProfilePoint[] | null, opts: { sample?: boolean; eles?: (number | null)[] } = {}): RoutePoint[] {
  if (coords.length < 2) return [];
  const start = coords[0] as [number, number], end = coords[coords.length - 1] as [number, number];
  const loop = haversine(start, end) < LOOP_M;
  const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');
  const out: RoutePoint[] = [{ lngLat: start, kind: 'start', label: opts.sample ? 'Car park' : loop ? 'Start and finish' : 'Start' }];
  let top: [number, number] | null = null;
  // Heights from the terrain once the route is checked; before that, the heights written in the GPX file.
  let hi: { lon: number; lat: number; elev: number } | null = null;
  if (profile?.length) hi = profile.reduce((a, b) => (b.elev > a.elev ? b : a));
  else if (opts.eles && usable(opts.eles, coords.length)) {
    let k = -1; opts.eles.forEach((e, i) => { if (e != null && (k < 0 || e > opts.eles![k]!)) k = i; });
    if (k >= 0) hi = { lon: coords[k][0], lat: coords[k][1], elev: opts.eles[k]! };
  }
  // Flat ground has no summit worth a flag: the high point needs at least 50 m of climb below it.
  const lows = profile?.length ? profile.map((p) => p.elev) : (opts.eles ?? []).filter((e): e is number => e != null);
  if (hi && hi.elev - Math.min(...lows) < 50) hi = null;
  if (hi) {
    top = [hi.lon, hi.lat];
    if (haversine(top, start) > APART_M) out.push({ lngLat: top, kind: 'top', label: `${opts.sample ? 'Summit' : 'High point'}, ${fmt(hi.elev)} m` });
    else top = null;
  }
  if (!loop && (!top || haversine(end, top) > APART_M)) out.push({ lngLat: end, kind: 'end', label: 'Finish' });
  return out;
}
