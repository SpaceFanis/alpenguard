// The rules engine. Plain, auditable comparisons — no AI decides anything here.
// It never says a slope is safe: it only reports where the data agree with the bulletin's risks.
import { haversine, toAspect8, type Aspect8, type ProfilePoint } from './terrain-math';

export const RULES = {
  slopeMin: 30, // degrees: where slab avalanches usually start
  minStretch: 2, // consecutive 25 m samples before a stretch is flagged
  bridgeGap: 150, // metres: flagged stretches this close together count as one
  reportRadius: 500, // metres from the flagged stretch
  reportMaxAge: 48, // hours
} as const;

export const DANGER = ['low', 'moderate', 'considerable', 'high', 'very_high'] as const;
export type DangerValue = (typeof DANGER)[number];
export const dangerLevel = (v: string) => DANGER.indexOf(v as DangerValue) + 1;
export const DANGER_NAME = ['Low', 'Moderate', 'Considerable', 'High', 'Very high'];

interface Elevation { lowerBound?: string; upperBound?: string }
export interface Bulletin {
  bulletinID: string;
  publicationTime: string;
  regions: { name: string }[];
  dangerRatings: { mainValue: string; elevation?: Elevation; aspects?: string[] }[];
  avalancheProblems: { problemType: string; elevation?: Elevation; aspects?: string[]; comment?: string }[];
}
export interface Report {
  document_id: number; lang: string; author: string; created: string; title: string; conditions: string;
  point: [number, number]; elevation_max: number;
}
export interface Interpretation { translation: string; signals: string[] }

const inElev = (e: number, el?: Elevation) =>
  (!el?.lowerBound || e >= +el.lowerBound) && (!el?.upperBound || e < +el.upperBound);
const inAspect = (a: Aspect8, list?: string[]) => !list || list.includes(a);
export const hoursBetween = (a: string | Date, b: string | Date) => (new Date(b).getTime() - new Date(a).getTime()) / 36e5;

export interface ReportMatch {
  id: number; lang: string; author: string; title: string; original: string; translation: string;
  signals: string[]; ageHours: number; distance: number; used: boolean; reason: string;
}
export interface Flag {
  id: string; from: number; to: number; elevMin: number; elevMax: number; maxSlope: number; aspect: Aspect8;
  center: [number, number]; coords: [number, number][];
  bulletin: { id: string; region: string; problem: string; aspects: string[]; above?: number; danger: number; ageHours: number; comment?: string };
  reports: ReportMatch[];
  agree: 2 | 3;
}
export interface Noted { coords: [number, number][]; from: number; to: number; maxSlope: number; aspect: Aspect8; elevMin: number; elevMax: number; reason: string }
export interface Evaluation { flags: Flag[]; noted: Noted[]; excludedReports: ReportMatch[]; rules: typeof RULES; analysedAt: string }

function stretches(profile: ProfilePoint[], test: (p: ProfilePoint) => boolean) {
  // Runs of matching samples, as [start, end] indices.
  const runs: [number, number][] = [];
  profile.forEach((p, i) => {
    if (!test(p)) return;
    const last = runs.at(-1);
    if (last && last[1] === i - 1) last[1] = i; else runs.push([i, i]);
  });
  // Bridge short gaps, then drop runs that are too short.
  const merged: [number, number][] = [];
  for (const r of runs) {
    const last = merged.at(-1);
    if (last && profile[r[0]].d - profile[last[1]].d <= RULES.bridgeGap) last[1] = r[1]; else merged.push([...r]);
  }
  return merged.map(([a, b]) => profile.slice(a, b + 1)).filter((s) => s.filter(test).length >= RULES.minStretch);
}

const dominant = (s: ProfilePoint[]) => {
  const c = new Map<Aspect8, number>();
  for (const p of s) c.set(toAspect8(p.aspect), (c.get(toAspect8(p.aspect)) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0][0];
};

export function evaluate(
  profile: ProfilePoint[], bulletin: Bulletin, reports: Report[], ai: Record<string, Interpretation>, now: string | Date,
): Evaluation {
  const problemAt = (p: ProfilePoint) =>
    bulletin.avalancheProblems.find((pr) => inElev(p.elev, pr.elevation) && inAspect(toAspect8(p.aspect), pr.aspects));
  const dangerAt = (p: ProfilePoint) =>
    Math.max(0, ...bulletin.dangerRatings.filter((r) => inElev(p.elev, r.elevation) && inAspect(toAspect8(p.aspect), r.aspects)).map((r) => dangerLevel(r.mainValue)));

  const steep = (p: ProfilePoint) => p.slope >= RULES.slopeMin;
  const flagged = stretches(profile, (p) => steep(p) && !!problemAt(p));
  const flaggedSet = new Set(flagged.flat());
  const noted: Noted[] = stretches(profile, (p) => steep(p) && !flaggedSet.has(p)).map((s) => ({
    coords: s.map((p) => [p.lon, p.lat] as [number, number]),
    from: s[0].d, to: s.at(-1)!.d, maxSlope: Math.max(...s.map((p) => p.slope)), aspect: dominant(s),
    elevMin: Math.min(...s.map((p) => p.elev)), elevMax: Math.max(...s.map((p) => p.elev)),
    reason: 'Steep, but outside the aspects and elevations the bulletin names.',
  }));

  const usedIds = new Set<number>();
  const allMatches: ReportMatch[] = [];
  const flags: Flag[] = flagged.map((s, i) => {
    const pr = problemAt(s[0])!;
    const mid = s[Math.floor(s.length / 2)];
    const reportsHere = reports.map((r): ReportMatch => {
      const distance = Math.min(...s.map((p) => haversine([p.lon, p.lat], r.point)));
      const ageHours = hoursBetween(r.created, now);
      const it = ai[String(r.document_id)] ?? { translation: r.conditions, signals: [] };
      let reason = 'Within range, recent, and reports warning signs.';
      let used = true;
      if (distance > RULES.reportRadius) { used = false; reason = `More than ${RULES.reportRadius} m from this stretch.`; }
      else if (ageHours > RULES.reportMaxAge) { used = false; reason = `Older than ${RULES.reportMaxAge} hours.`; }
      else if (!it.signals.length) { used = false; reason = 'No warning signs in the report.'; }
      return { id: r.document_id, lang: r.lang, author: r.author, title: r.title, original: r.conditions, translation: it.translation, signals: it.signals, ageHours, distance, used, reason };
    });
    reportsHere.forEach((m) => { allMatches.push(m); if (m.used) usedIds.add(m.id); });
    const used = reportsHere.filter((m) => m.used);
    return {
      id: `flag-${i + 1}`,
      from: s[0].d, to: s.at(-1)!.d,
      elevMin: Math.min(...s.map((p) => p.elev)), elevMax: Math.max(...s.map((p) => p.elev)),
      maxSlope: Math.max(...s.map((p) => p.slope)), aspect: dominant(s),
      center: [mid.lon, mid.lat], coords: s.map((p) => [p.lon, p.lat]),
      bulletin: {
        id: bulletin.bulletinID, region: bulletin.regions[0]?.name ?? '', problem: pr.problemType,
        aspects: pr.aspects ?? [], above: pr.elevation?.lowerBound ? +pr.elevation.lowerBound : undefined,
        danger: dangerAt(mid), ageHours: hoursBetween(bulletin.publicationTime, now), comment: pr.comment,
      },
      reports: used,
      agree: used.length ? 3 : 2,
    };
  });

  const excluded = new Map<number, ReportMatch>();
  for (const m of allMatches) if (!usedIds.has(m.id) && !excluded.has(m.id)) excluded.set(m.id, m);
  if (!flags.length) for (const r of reports) {
    const it = ai[String(r.document_id)];
    excluded.set(r.document_id, { id: r.document_id, lang: r.lang, author: r.author, title: r.title, original: r.conditions, translation: it?.translation ?? r.conditions, signals: it?.signals ?? [], ageHours: hoursBetween(r.created, now), distance: NaN, used: false, reason: 'No flagged stretch to attach it to.' });
  }
  return { flags, noted, excludedReports: [...excluded.values()], rules: RULES, analysedAt: new Date(now).toISOString() };
}

/** Overdue rule: return time + 15 minutes. Deliberately simple and independent of AI. */
export const GRACE_MINUTES = 15;
export const alertTime = (returnHHMM: string) => {
  const [h, m] = returnHHMM.split(':').map(Number);
  const t = h * 60 + m + GRACE_MINUTES;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
