import type { CheckIn, CravingLog, Localized, RecoverySnapshot } from './types.js';

/**
 * The Personal Recovery Graph.
 *
 * The product's central idea is not "have you stayed clean" but "what is
 * happening in your life that makes you want to use". This module looks for the
 * answer in the person's own data and hands back plain statements they can check
 * against their memory.
 *
 * Every insight carries the evidence count that produced it. An insight the user
 * cannot audit is just the app being confident at them.
 */
export interface Insight {
  id: string;
  message: Localized;
  /** How many observations back this up. Displayed alongside the statement. */
  evidence: number;
  /** Rough effect size, 0–1, used only for ordering. */
  strength: number;
  /** What the person could do about it, as a toolbox id. */
  suggestedToolId?: string;
}

const MS_PER_DAY = 86_400_000;
/** Below this we say nothing. A pattern from two data points is a coincidence. */
const MIN_EVIDENCE = 4;

interface Options {
  windowDays?: number;
  now: Date;
  /** Maximum insights to return. The home screen shows at most two. */
  limit?: number;
}

/**
 * Find patterns worth telling the person about.
 *
 * These are descriptive correlations over a small personal dataset, not clinical
 * findings — the wording in `@cleat/i18n` is hedged to match ("your
 * strongest cravings have mostly come after…"), and nothing here is presented as
 * a cause.
 */
export function findInsights(snapshot: RecoverySnapshot, options: Options): Insight[] {
  const windowDays = options.windowDays ?? 30;
  const limit = options.limit ?? 5;
  const from = new Date(options.now.getTime() - windowDays * MS_PER_DAY);

  const cravings = snapshot.cravings
    .filter((c) => c.occurredAt >= from && c.occurredAt <= options.now)
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const checkIns = snapshot.checkIns.filter(
    (c) => c.createdAt >= from && c.createdAt <= options.now,
  );

  const insights: Insight[] = [
    ...timeOfDayPattern(cravings),
    ...weekdayPattern(cravings),
    ...triggerPattern(cravings),
    ...locationPattern(cravings),
    ...sleepPattern(cravings, checkIns),
    ...stressPattern(cravings, checkIns),
    ...whatWorksPattern(cravings),
  ];

  return insights
    .filter((i) => i.evidence >= MIN_EVIDENCE)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, limit);
}

// --- individual detectors --------------------------------------------------

function timeOfDayPattern(cravings: CravingLog[]): Insight[] {
  if (cravings.length < MIN_EVIDENCE) return [];
  const buckets = [0, 0, 0, 0]; // night, morning, afternoon, evening
  for (const c of cravings) {
    const h = c.occurredAt.getHours();
    if (h < 6) buckets[0]! += 1;
    else if (h < 12) buckets[1]! += 1;
    else if (h < 18) buckets[2]! += 1;
    else buckets[3]! += 1;
  }
  const names = ['night', 'morning', 'afternoon', 'evening'];
  const topIndex = buckets.indexOf(Math.max(...buckets));
  const share = buckets[topIndex]! / cravings.length;
  if (share < 0.4) return [];
  return [
    {
      id: 'time_of_day',
      message: {
        key: 'insight.time_of_day',
        params: { period: names[topIndex]!, percent: Math.round(share * 100) },
      },
      evidence: buckets[topIndex]!,
      strength: share,
      suggestedToolId: 'design_the_evening',
    },
  ];
}

function weekdayPattern(cravings: CravingLog[]): Insight[] {
  if (cravings.length < MIN_EVIDENCE * 2) return [];
  const buckets = new Array<number>(7).fill(0);
  for (const c of cravings) buckets[c.occurredAt.getDay()]! += 1;
  const topIndex = buckets.indexOf(Math.max(...buckets));
  const share = buckets[topIndex]! / cravings.length;
  // A flat week is 1/7 ≈ 14%. Only speak up when one day really stands out.
  if (share < 0.3) return [];
  return [
    {
      id: 'weekday',
      message: {
        key: 'insight.weekday',
        params: { weekday: String(topIndex), percent: Math.round(share * 100) },
      },
      evidence: buckets[topIndex]!,
      strength: share,
      suggestedToolId: 'implementation_intention',
    },
  ];
}

function triggerPattern(cravings: CravingLog[]): Insight[] {
  const counts = new Map<string, number>();
  for (const c of cravings) {
    const key = c.trigger?.trim().toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] < MIN_EVIDENCE) return [];
  return [
    {
      id: 'trigger',
      message: { key: 'insight.trigger', params: { trigger: top[0], count: top[1] } },
      evidence: top[1],
      strength: top[1] / Math.max(1, cravings.length),
      suggestedToolId: 'remove_the_trigger',
    },
  ];
}

function locationPattern(cravings: CravingLog[]): Insight[] {
  if (cravings.length < MIN_EVIDENCE) return [];
  const counts = new Map<string, number>();
  for (const c of cravings) counts.set(c.location, (counts.get(c.location) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top) return [];
  const share = top[1] / cravings.length;
  if (share < 0.4) return [];
  return [
    {
      id: 'location',
      message: {
        key: 'insight.location',
        params: { location: top[0], percent: Math.round(share * 100) },
      },
      evidence: top[1],
      strength: share,
      suggestedToolId: 'change_environment',
    },
  ];
}

/**
 * Cravings after a bad night. We compare the craving intensity on days
 * following poor sleep with the intensity on days following decent sleep.
 */
function sleepPattern(cravings: CravingLog[], checkIns: CheckIn[]): Insight[] {
  const sleepByDay = new Map<string, number>();
  for (const c of checkIns) {
    if (c.kind === 'morning' && typeof c.sleepQuality === 'number') {
      sleepByDay.set(c.day, c.sleepQuality);
    }
  }
  if (sleepByDay.size < MIN_EVIDENCE) return [];

  const poor: number[] = [];
  const decent: number[] = [];
  for (const c of cravings) {
    const day = toDayKey(c.occurredAt);
    const sleep = sleepByDay.get(day);
    if (sleep == null) continue;
    (sleep <= 4 ? poor : decent).push(c.intensity);
  }
  if (poor.length < MIN_EVIDENCE || decent.length < 2) return [];

  const poorAvg = avg(poor);
  const decentAvg = avg(decent);
  const delta = poorAvg - decentAvg;
  if (delta < 1.5) return [];

  return [
    {
      id: 'sleep',
      message: {
        key: 'insight.sleep',
        params: { delta: delta.toFixed(1), poorNights: poor.length },
      },
      evidence: poor.length,
      strength: Math.min(1, delta / 5),
      suggestedToolId: 'sleep_routine',
    },
  ];
}

function stressPattern(cravings: CravingLog[], checkIns: CheckIn[]): Insight[] {
  const stressByDay = new Map<string, number>();
  for (const c of checkIns) {
    if (typeof c.stress === 'number') stressByDay.set(c.day, c.stress);
  }
  if (stressByDay.size < MIN_EVIDENCE) return [];

  const high: number[] = [];
  const low: number[] = [];
  for (const c of cravings) {
    const stress = stressByDay.get(toDayKey(c.occurredAt));
    if (stress == null) continue;
    (stress >= 7 ? high : low).push(c.intensity);
  }
  if (high.length < MIN_EVIDENCE || low.length < 2) return [];

  const delta = avg(high) - avg(low);
  if (delta < 1.5) return [];

  return [
    {
      id: 'stress',
      message: {
        key: 'insight.stress',
        params: { delta: delta.toFixed(1), highDays: high.length },
      },
      evidence: high.length,
      strength: Math.min(1, delta / 5),
      suggestedToolId: 'slow_breathing',
    },
  ];
}

/**
 * What has actually worked. This is the most useful insight in the set and the
 * one people rarely notice on their own: their own successful coping, named back
 * to them.
 */
function whatWorksPattern(cravings: CravingLog[]): Insight[] {
  const counts = new Map<string, number>();
  for (const c of cravings) {
    if (c.outcome !== 'resisted') continue;
    const action = c.actionTaken?.trim().toLowerCase();
    if (!action) continue;
    counts.set(action, (counts.get(action) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] < MIN_EVIDENCE) return [];
  return [
    {
      id: 'what_works',
      message: { key: 'insight.what_works', params: { action: top[0], count: top[1] } },
      evidence: top[1],
      // Ranked slightly above the problem-finding insights on purpose.
      strength: 0.9,
    },
  ];
}

// --- helpers ---------------------------------------------------------------

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}
