import { describe, expect, it } from 'vitest';
import { routePoints } from './route-points';
import type { ProfilePoint } from './terrain-math';
import profiles from '../data/profile.cache.json';

const prof = (pts: [number, number, number][]): ProfilePoint[] => pts.map(([lon, lat, elev], i) => ({ lon, lat, elev, d: i * 100, slope: 0, aspect: 0 }));

describe('route markers', () => {
  it('sample tour: car park and the summit at the highest point', () => {
    const r = routePoints((profiles.route as ProfilePoint[]).map((p) => [p.lon, p.lat]), profiles.route as ProfilePoint[], { sample: true });
    expect(r.map((p) => p.kind)).toEqual(['start', 'top']);
    expect(r[1].label).toBe('Summit, 2,655 m');
  });
  it('loop: one start-and-finish marker, the high point in the middle of the loop', () => {
    const c = [[6.5, 45.6], [6.51, 45.61], [6.52, 45.6], [6.5001, 45.6001]];
    const r = routePoints(c, prof([[6.5, 45.6, 1500], [6.51, 45.61, 2400], [6.52, 45.6, 1900], [6.5001, 45.6001, 1500]]));
    expect(r.map((p) => p.label)).toEqual(['Start and finish', 'High point, 2,400 m']);
    expect(r[1].lngLat).toEqual([6.51, 45.61]);
  });
  it('up and down a different way: start, high point and finish', () => {
    const c = [[6.5, 45.6], [6.51, 45.61], [6.53, 45.6]];
    const r = routePoints(c, prof([[6.5, 45.6, 1500], [6.51, 45.61, 2400], [6.53, 45.6, 1300]]));
    expect(r.map((p) => p.kind)).toEqual(['start', 'top', 'end']);
  });
  it('before the analysis: start and finish only, never a guessed summit', () => {
    expect(routePoints([[6.5, 45.6], [6.52, 45.61]], null).map((p) => p.label)).toEqual(['Start', 'Finish']);
    expect(routePoints([[6.5, 45.6], [6.52, 45.61], [6.5001, 45.6]], null).map((p) => p.label)).toEqual(['Start and finish']);
  });
  it('a descent: the high point is the start, so it is not marked twice', () => {
    const c = [[6.5, 45.6], [6.52, 45.61]];
    expect(routePoints(c, prof([[6.5, 45.6, 2800], [6.52, 45.61, 2100]])).map((p) => p.kind)).toEqual(['start', 'end']);
  });
  it('a loop before the analysis: the high point comes from the heights in the GPX file', () => {
    const c = [[6.5, 45.6], [6.51, 45.61], [6.52, 45.6], [6.5001, 45.6001]];
    const r = routePoints(c, null, { eles: [1500, 2380, 1900, 1500] });
    expect(r.map((p) => p.label)).toEqual(['Start and finish', 'High point, 2,380 m']);
    expect(routePoints(c, null, { eles: [null, null, null, 1500] }).map((p) => p.kind)).toEqual(['start']);
    expect(routePoints(c, null, { eles: [0, 0, 0, 0] }).map((p) => p.kind)).toEqual(['start']); // an app that writes 0 everywhere
  });
  it('flat ground: no high point', () => {
    const c = [[5.1, 52.1], [5.12, 52.11], [5.14, 52.1]];
    expect(routePoints(c, prof([[5.1, 52.1, 2], [5.12, 52.11, 14], [5.14, 52.1, 3]])).map((p) => p.kind)).toEqual(['start', 'end']);
  });
});
