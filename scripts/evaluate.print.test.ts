// Prints the rules engine's evaluation of the sample tour (used to write page copy from real numbers).
import { it } from 'vitest';
import { evaluate, type Bulletin, type Report } from '../src/lib/rules';
import p from '../src/data/profile.cache.json';
import b from '../src/data/bulletin.caaml.json';
import r from '../src/data/reports.json';
import ai from '../src/data/ai-cache.json';
it('prints', () => {
  const e = evaluate(p.route, b.bulletins[0] as Bulletin, r.documents as unknown as Report[], ai.reports, '2026-02-20T21:00:00+01:00');
  console.log(JSON.stringify({ flags: e.flags.map((f) => ({ ...f, coords: f.coords.length, reports: f.reports.map((x) => [x.id, x.ageHours, Math.round(x.distance)]) })), noted: e.noted, ex: e.excludedReports.map((x) => [x.id, x.reason, Math.round(x.distance)]) }, null, 1));
});
