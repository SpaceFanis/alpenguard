// Reads a GPX file the way real apps write it: one or several tracks, several segments, or only a route;
// GPX 1.0 or 1.1, with or without namespaces, Garmin/Strava/Komoot extensions, BOMs and stray whitespace.
// Returns the line to analyse, or a reason the file can't be used, written for the person uploading it.
import { haversine } from './terrain-math';

export type GpxResult =
  | { ok: true; name: string | null; coords: number[][]; eles: (number | null)[]; lengthM: number; notes: string[] }
  | { ok: false; reason: string };

export const GPX_LIMITS = { minLengthM: 200, maxLengthM: 80_000, maxPoints: 50_000 } as const;

type ParserLike = { parseFromString(text: string, type: string): Document };

const byName = (root: Document | Element, name: string) =>
  Array.from(root.getElementsByTagName('*')).filter((el) => (el.localName || el.nodeName.split(':').pop()) === name);

const childText = (el: Element, name: string) => {
  for (const c of Array.from(el.childNodes)) {
    const n = c as Element;
    if (n.nodeType === 1 && (n.localName || n.nodeName.split(':').pop()) === name) return (n.textContent ?? '').trim() || null;
  }
  return null;
};

function readPoint(el: Element): number[] | null {
  const lat = parseFloat(el.getAttribute('lat') ?? '');
  const lon = parseFloat(el.getAttribute('lon') ?? '');
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  if (lat === 0 && lon === 0) return null; // a GPS that had no fix writes 0,0
  const ele = parseFloat(childText(el, 'ele') ?? '');
  return Number.isFinite(ele) && ele > -500 && ele < 9000 ? [lon, lat, ele] : [lon, lat];
}

export function parseGpx(text: string, parser: ParserLike = new DOMParser()): GpxResult {
  const clean = text.replace(/^﻿/, '').trim();
  if (!clean.startsWith('<')) return { ok: false, reason: 'This isn’t a GPX file. Export the route from your app as GPX and try again.' };
  let doc: Document;
  try { doc = parser.parseFromString(clean, 'text/xml'); } catch { return { ok: false, reason: 'This file couldn’t be read as GPX. It may be damaged; export it again from your app.' }; }
  const root = doc.documentElement;
  if (!root || byName(doc, 'parsererror').length) return { ok: false, reason: 'This file couldn’t be read as GPX. It may be damaged; export it again from your app.' };
  const rootName = root.localName || root.nodeName;
  if (rootName === 'kml') return { ok: false, reason: 'This is a KML file. AlpenGuard reads GPX: most apps can export the same route as GPX.' };
  if (rootName !== 'gpx') return { ok: false, reason: 'This file isn’t GPX. Export the route from your app as GPX and try again.' };

  const notes: string[] = [];
  // Tracks first (what you recorded or drew); routes only if there are no tracks.
  const segments: number[][][] = [];
  const tracks = byName(doc, 'trk');
  for (const trk of tracks) for (const seg of byName(trk, 'trkseg')) {
    const pts = byName(seg, 'trkpt').map(readPoint).filter((p): p is number[] => !!p);
    if (pts.length) segments.push(pts);
  }
  if (!segments.length) for (const rte of byName(doc, 'rte')) {
    const pts = byName(rte, 'rtept').map(readPoint).filter((p): p is number[] => !!p);
    if (pts.length) segments.push(pts);
  }
  if (!segments.length) {
    return byName(doc, 'wpt').length
      ? { ok: false, reason: 'This GPX only has waypoints. AlpenGuard needs the line of the route: export it as a track or a route.' }
      : { ok: false, reason: 'This GPX has no track or route in it.' };
  }
  if (tracks.length > 1) notes.push(`The file had ${tracks.length} tracks; they were joined in order.`);
  else if (segments.length > 1) notes.push(`The track had ${segments.length} segments; they were joined in order.`);

  // Join, drop repeated points (a GPS standing still writes many), and measure.
  const coords: number[][] = [], eles: (number | null)[] = [];
  let lengthM = 0, longestGap = 0;
  for (const seg of segments) for (const p of seg) {
    const last = coords[coords.length - 1];
    if (last) {
      const d = haversine(last, p);
      if (d < 1) continue;
      longestGap = Math.max(longestGap, d);
      lengthM += d;
    }
    coords.push([p[0], p[1]]);
    eles.push(p.length > 2 ? p[2] : null);
  }
  if (coords.length < 2 || lengthM < GPX_LIMITS.minLengthM) return { ok: false, reason: 'This track is too short to analyse (under 200 m). Is it the whole route?' };
  if (lengthM > GPX_LIMITS.maxLengthM) return { ok: false, reason: `This track is ${(lengthM / 1000).toFixed(0)} km long. The demo analyses up to 80 km; split a multi-day tour into days.` };
  if (coords.length > GPX_LIMITS.maxPoints) return { ok: false, reason: 'This track has more than 50,000 points. Simplify it in your app and try again.' };
  if (longestGap > 2000) notes.push(`There is a ${(longestGap / 1000).toFixed(1)} km straight jump in the track (a gap in the recording); that stretch is analysed as a straight line.`);

  const name = childText(byName(doc, 'metadata')[0] ?? root, 'name') ?? (tracks[0] ? childText(tracks[0], 'name') : null) ?? (byName(doc, 'rte')[0] ? childText(byName(doc, 'rte')[0], 'name') : null);
  return { ok: true, name, coords, eles, lengthM, notes };
}
