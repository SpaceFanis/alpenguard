// Demo fixtures and the clock the demo runs on.
import { parseGpx } from './gpx';
import routeGpx from '../data/route.gpx?raw';
import alternative from '../data/alternative.json';
import bulletinDoc from '../data/bulletin.caaml.json';
import reportsDoc from '../data/reports.json';
import aiCache from '../data/ai-cache.json';
import profiles from '../data/profile.cache.json';
import type { Bulletin, Report, Interpretation } from './rules';
import type { ProfilePoint } from './terrain-math';

/** The demo is set on the evening before the tour. */
export const DEMO_NOW = '2026-02-20T21:00:00+01:00';
export const TOUR_DAY = 'Saturday 21 February';

const sample = parseGpx(routeGpx);
if (!sample.ok) throw new Error('The sample route failed to load: ' + sample.reason);

export const SAMPLE = {
  name: 'Sample tour, Beaufortain',
  gpx: routeGpx,
  coords: sample.coords,
  alternative: alternative.geometry.coordinates as number[][],
  cachedProfile: profiles.route as ProfilePoint[],
  cachedAlternative: profiles.alternative as ProfilePoint[],
};
export const BULLETIN = bulletinDoc.bulletins[0] as Bulletin;
export const REPORTS = reportsDoc.documents as unknown as Report[];
export const AI: { reports: Record<string, Interpretation & { elevation_m?: number }>; plan: { input: string; parsed: Plan } } = aiCache as never;

export interface Plan { depart: string; return: string; party: string[]; clothing: string; date: string }
