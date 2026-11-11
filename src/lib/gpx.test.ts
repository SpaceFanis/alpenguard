import { describe, expect, it } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { parseGpx } from './gpx';
import routeGpx from '../data/route.gpx?raw';

const P = new DOMParser({ onError: () => {} }) as unknown as { parseFromString(t: string, m: string): Document };
const parse = (t: string) => parseGpx(t, P);
const pts = (n: number, lat0 = 45.64, lon0 = 6.5, step = 0.0005) => Array.from({ length: n }, (_, i) => [lat0 + i * step * 0.3, lon0 + i * step]);
const trk = (p: number[][], tag = 'trkpt') => p.map(([la, lo]) => `<${tag} lat="${la}" lon="${lo}"><ele>1800</ele><time>2026-02-21T08:00:00Z</time></${tag}>`).join('');
const gpx11 = (body: string) => `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="t" xmlns="http://www.topografix.com/GPX/1/1">${body}</gpx>`;

describe('GPX reading', () => {
  it('reads the sample tour', () => {
    const r = parse(routeGpx);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.coords.length).toBeGreaterThan(100); expect(r.lengthM).toBeGreaterThan(4500); expect(r.name).toMatch(/Beaufortain/); }
  });
  it('joins several segments and says so', () => {
    const r = parse(gpx11(`<trk><name>Two parts</name><trkseg>${trk(pts(20))}</trkseg><trkseg>${trk(pts(20, 45.65, 6.51))}</trkseg></trk>`));
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.coords).toHaveLength(40); expect(r.notes.join()).toMatch(/2 segments/); expect(r.name).toBe('Two parts'); expect(r.eles[0]).toBe(1800); expect(r.coords[0]).toHaveLength(2); }
  });
  it('joins several tracks', () => {
    const r = parse(gpx11(`<trk><trkseg>${trk(pts(10))}</trkseg></trk><trk><trkseg>${trk(pts(10, 45.66, 6.52))}</trkseg></trk>`));
    expect(r.ok && r.coords.length).toBe(20);
  });
  it('reads a route (rte) when there is no track', () => {
    const r = parse(gpx11(`<rte><name>Planned</name>${trk(pts(15), 'rtept')}</rte>`));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.name).toBe('Planned');
  });
  it('reads GPX 1.0 and files without a namespace', () => {
    expect(parse(`<gpx version="1.0" xmlns="http://www.topografix.com/GPX/1/0"><trk><trkseg>${trk(pts(10))}</trkseg></trk></gpx>`).ok).toBe(true);
    expect(parse(`<gpx><trk><trkseg>${trk(pts(10))}</trkseg></trk></gpx>`).ok).toBe(true);
  });
  it('ignores Garmin extensions, a BOM and Windows line endings', () => {
    const body = `﻿<?xml version="1.0"?>\r\n<gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">\r\n<trk><trkseg>` +
      pts(10).map(([la, lo]) => `<trkpt lat="${la}" lon="${lo}"><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>140</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>`).join('\r\n') + '</trkseg></trk></gpx>';
    expect(parse(body).ok).toBe(true);
  });
  it('drops repeated points, broken coordinates and 0,0 fixes', () => {
    const p = pts(10);
    const body = `<trk><trkseg>${trk([p[0], p[0], p[0]])}<trkpt lat="abc" lon="6.5"/><trkpt lat="0" lon="0"/><trkpt lat="95" lon="6.5"/>${trk(p.slice(1))}</trkseg></trk>`;
    const r = parse(gpx11(body));
    expect(r.ok && r.coords.length).toBe(10);
  });
  it('warns about a straight jump across a gap in the recording', () => {
    const r = parse(gpx11(`<trk><trkseg>${trk(pts(10))}${trk(pts(10, 45.7, 6.6))}</trkseg></trk>`));
    expect(r.ok && r.notes.join()).toMatch(/straight jump/);
  });
  it('explains what is wrong with files it cannot use', () => {
    const reason = (t: string) => { const r = parse(t); return r.ok ? '' : r.reason; };
    expect(reason(gpx11('<wpt lat="45.6" lon="6.5"/>'))).toMatch(/only has waypoints/);
    expect(reason('<kml xmlns="http://www.opengis.net/kml/2.2"><Document/></kml>')).toMatch(/KML/);
    expect(reason('lat,lon\n45.6,6.5')).toMatch(/isn’t a GPX/);
    expect(reason(gpx11(`<trk><trkseg>${trk(pts(2, 45.6, 6.5, 0.0002))}</trkseg></trk>`))).toMatch(/too short/);
    expect(reason(gpx11(`<trk><trkseg>${trk(pts(400, 45.0, 6.0, 0.005))}</trkseg></trk>`))).toMatch(/80 km/);
    expect(reason(gpx11('<trk><trkseg></trkseg></trk>'))).toMatch(/no track or route/);
    expect(reason('<gpx><trk><trkseg><trkpt lat="45"')).not.toBe('');
  });
  it('handles a long, dense recording', () => {
    const r = parse(gpx11(`<trk><trkseg>${trk(pts(20000, 45.6, 6.4, 0.00002))}</trkseg></trk>`));
    expect(r.ok).toBe(true);
  });
});
