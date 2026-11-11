// Language understanding. In production this is an LLM call; in this demo it returns cached model output,
// and falls back to a small offline parser for plans the cache does not know. Rules never depend on it.
import { AI, type Plan } from './data';

export interface PlanResult { plan: Plan; source: 'cached-ai' | 'offline-parser'; missing: string[] }

const to24 = (h: number, m = 0, pm?: boolean) => {
  if (pm && h < 12) h += 12;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

function parseTime(fragment: string, assumeAfternoon: boolean) {
  const m = fragment.match(/(\d{1,2})(?:[:.h](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i);
  if (!m) return null;
  const h = +m[1], min = m[2] ? +m[2] : 0, mer = m[3]?.toLowerCase();
  if (h > 23 || min > 59) return null;
  if (mer) return to24(h % 12, min, mer.startsWith('p'));
  return to24(h, min, assumeAfternoon && h < 8);
}

export function parsePlanOffline(text: string): PlanResult {
  const t = text.trim();
  const dep = t.match(/\b(?:at|leave|leaving|start(?:ing)?|from)\s+(\d{1,2}(?:[:.h]\d{2})?\s*(?:am|pm)?)/i);
  const ret = t.match(/\b(?:back|return(?:ing)?|by|until)\b[^\d]{0,30}(\d{1,2}(?:[:.h]\d{2})?\s*(?:am|pm)?)/i);
  const party = [...t.matchAll(/\bwith\s+([A-Z][\p{L}'-]+(?:\s+(?:and|&)\s+[A-Z][\p{L}'-]+)*)/gu)]
    .flatMap((m) => m[1].split(/\s+(?:and|&)\s+/));
  const cloth = t.match(/\b(?:wearing|in)\s+(?:an?\s+|my\s+)?([a-z]+\s+(?:jacket|coat|shell|anorak|helmet))/i);
  const plan: Plan = {
    depart: dep ? parseTime(dep[1], false) ?? '' : '',
    return: ret ? parseTime(ret[1], true) ?? '' : '',
    party,
    clothing: cloth ? cloth[1].toLowerCase() : '',
    date: /tomorrow/i.test(t) ? 'tomorrow' : /today/i.test(t) ? 'today' : '',
  };
  const missing = [!plan.depart && 'start time', !plan.return && 'return time', !plan.clothing && 'what you are wearing'].filter(Boolean) as string[];
  return { plan, source: 'offline-parser', missing };
}

export async function interpretPlan(text: string): Promise<PlanResult> {
  await new Promise((r) => setTimeout(r, 650)); // the latency of a real call, roughly
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (norm(text) === norm(AI.plan.input)) return { plan: AI.plan.parsed, source: 'cached-ai', missing: [] };
  return parsePlanOffline(text);
}
