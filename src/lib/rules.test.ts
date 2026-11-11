import { describe, expect, it } from 'vitest';
import { evaluate, alertTime, RULES, type Bulletin, type Report } from './rules';
import { horn, resample, toAspect8 } from './terrain-math';
import profiles from '../data/profile.cache.json';
import bulletinDoc from '../data/bulletin.caaml.json';
import reportsDoc from '../data/reports.json';
import ai from '../data/ai-cache.json';

const bulletin = bulletinDoc.bulletins[0] as Bulletin;
const reports = reportsDoc.documents as unknown as Report[];
const NOW = '2026-02-20T21:00:00+01:00';

describe('terrain math', () => {
  it('Horn: a plane rising to the east faces west at 45°', () => {
    const z = [[0, 10, 20], [0, 10, 20], [0, 10, 20]];
    const { slope, aspect } = horn(z, 10, 10);
    expect(slope).toBeCloseTo(45, 5);
    expect(toAspect8(aspect)).toBe('W');
  });
  it('Horn: a plane falling to the north-east faces NE', () => {
    const z = [[10, 5, 0], [15, 10, 5], [20, 15, 10]];
    expect(toAspect8(horn(z, 10, 10).aspect)).toBe('NE');
  });
  it('resample keeps the total length', () => {
    const pts = resample([[6.5, 45.6], [6.51, 45.6]], 25);
    expect(pts.at(-1)!.d).toBeGreaterThan(770);
    expect(pts[1].d).toBe(25);
  });
});

describe('rules engine on the sample tour', () => {
  const ev = evaluate(profiles.route, bulletin, reports, ai.reports, NOW);
  it('flags the NW stretch above 2,200 m around km 4.4', () => {
    expect(ev.flags.length).toBeGreaterThanOrEqual(1);
    const f = ev.flags[0];
    expect(f.from).toBeGreaterThan(4200); expect(f.to).toBeLessThan(4700);
    expect(f.elevMin).toBeGreaterThanOrEqual(2200);
    expect(['NW', 'N', 'NE']).toContain(f.aspect);
    expect(f.maxSlope).toBeGreaterThanOrEqual(RULES.slopeMin);
  });
  it('attaches the 18-hour-old French report, and only that one', () => {
    const f = ev.flags[0];
    expect(f.agree).toBe(3);
    expect(f.reports.map((r) => r.id)).toEqual([9100001]);
    expect(Math.round(f.reports[0].ageHours)).toBe(18);
  });
  it('excludes the old Italian report by age, not by AI', () => {
    const it = ev.excludedReports.find((r) => r.id === 9100003)!;
    expect(it.reason).toMatch(/Older than 48/);
  });
  it('the alternative has no flagged stretch', () => {
    expect(evaluate(profiles.alternative, bulletin, reports, ai.reports, NOW).flags).toHaveLength(0);
  });
  it('never describes anything as safe', () => {
    expect(JSON.stringify(ev).toLowerCase()).not.toMatch(/\bsafe\b/);
  });
});

describe('overdue timer', () => {
  it('fires 15 minutes after the return time', () => {
    expect(alertTime('14:00')).toBe('14:15');
    expect(alertTime('23:50')).toBe('00:05');
  });
});
