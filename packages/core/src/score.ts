import type { CheckIn, CravingLog, RecoverySnapshot } from './types.js';
import { computeStreak } from './streak.js';

/**
 * Recovery indicators.
 *
 * Deliberately plural. There is no single "you are 83% recovered" number in this
 * product and there never will be — a composite score turns a life into a
 * scoreboard, and on a bad day it tells someone they are failing at being a
 * person. Seven separate trends give a person something they can actually act
 * on: "connection is drifting down" is a to-do; "you dropped 4 points" is not.
 */
export type IndicatorKey =
  | 'stability'
  | 'craving_control'
  | 'routine'
  | 'connection'
  | 'purpose'
  | 'self_trust'
  | 'risk';

export type Trend = 'up' | 'down' | 'flat' | 'unknown';

export interface Indicator {
  key: IndicatorKey;
  /** 0–100, or null when there is not enough data to say anything honest. */
  value: number | null;
  trend: Trend;
  /** Number of data points behind the value. Surfaced so the user can discount it. */
  sample: number;
  /** For `risk`, a lower number is the good direction. */
  higherIsBetter: boolean;
  confidence: 'none' | 'low' | 'medium' | 'high';
}

export interface IndicatorSet {
  windowDays: number;
  indicators: Indicator[];
  computedAt: Date;
}

const MS_PER_DAY = 86_400_000;
const DEFAULT_WINDOW_DAYS = 14;
/** Below this many data points we show the value but mark it as low confidence. */
const LOW_CONFIDENCE_SAMPLE = 4;

interface Window {
  from: Date;
  to: Date;
  checkIns: CheckIn[];
  cravings: CravingLog[];
}

function sliceWindow(
  snapshot: RecoverySnapshot,
  to: Date,
  days: number,
): Window {
  const from = new Date(to.getTime() - days * MS_PER_DAY);
  const inRange = (d: Date) => d.getTime() > from.getTime() && d.getTime() <= to.getTime();
  return {
    from,
    to,
    checkIns: snapshot.checkIns.filter((c) => inRange(c.createdAt)),
    cravings: snapshot.cravings.filter((c) => inRange(c.occurredAt)),
  };
}

function mean(values: number[]): number | null {
  const usable = values.filter((v) => Number.isFinite(v));
  if (usable.length === 0) return null;
  return usable.reduce((a, b) => a + b, 0) / usable.length;
}

function clamp(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function confidenceFor(sample: number): Indicator['confidence'] {
  if (sample === 0) return 'none';
  if (sample < LOW_CONFIDENCE_SAMPLE) return 'low';
  if (sample < LOW_CONFIDENCE_SAMPLE * 3) return 'medium';
  return 'high';
}

// --- individual indicators -------------------------------------------------

function stability(w: Window): { value: number | null; sample: number } {
  const sleep = mean(w.checkIns.map((c) => c.sleepQuality).filter(isNum));
  const stress = mean(w.checkIns.map((c) => c.stress).filter(isNum));
  const mood = mean(w.checkIns.map((c) => c.mood).filter(isNum));
  const parts: number[] = [];
  if (sleep != null) parts.push(sleep * 10);
  if (stress != null) parts.push((10 - stress) * 10);
  if (mood != null) parts.push(mood * 10);
  const value = mean(parts);
  return { value: value == null ? null : clamp(value), sample: w.checkIns.length };
}

function cravingControl(
  w: Window,
  streakDays: number,
): { value: number | null; sample: number } {
  const decided = w.cravings.filter((c) => c.outcome !== 'unknown');
  if (decided.length === 0) {
    // No logged cravings is ambiguous: it can mean a calm fortnight or that the
    // person stopped logging. We lean on the streak, but keep the sample at 0 so
    // the confidence flag tells the truth.
    if (streakDays >= 7) return { value: 75, sample: 0 };
    return { value: null, sample: 0 };
  }
  // Resisting a 9/10 craving is worth more than resisting a 2/10 one.
  let earned = 0;
  let possible = 0;
  for (const c of decided) {
    const weight = 1 + c.intensity / 10;
    possible += weight;
    if (c.outcome === 'resisted') earned += weight;
  }
  return { value: clamp((earned / possible) * 100), sample: decided.length };
}

function routine(w: Window, days: number): { value: number | null; sample: number } {
  const expected = days * 2; // a morning and an evening check-in
  const done = w.checkIns.length;
  return { value: clamp((done / expected) * 100), sample: done };
}

function connection(
  snapshot: RecoverySnapshot,
  w: Window,
): { value: number | null; sample: number } {
  const contacts = snapshot.supportContacts.length;
  const base = contacts === 0 ? 0 : Math.min(80, 30 + contacts * 20);
  // Having numbers in a list is not connection; using them is.
  const reachedOut = w.cravings.filter(
    (c) => c.actionTaken != null && /call|ring|contact|prat|sms|telefon|messag/i.test(c.actionTaken),
  ).length;
  const bonus = Math.min(20, reachedOut * 10);
  if (contacts === 0 && w.cravings.length === 0) return { value: null, sample: 0 };
  return { value: clamp(base + bonus), sample: contacts + w.cravings.length };
}

function purpose(
  snapshot: RecoverySnapshot,
  w: Window,
): { value: number | null; sample: number } {
  let value = 0;
  let sample = 0;
  if (snapshot.profile.whyStatement && snapshot.profile.whyStatement.trim().length > 0) {
    value += 40;
    sample += 1;
  }
  const future = snapshot.profile.futureSelf;
  if (future) {
    const filled = [future.days30, future.days90, future.year1, future.year5].filter(
      (v) => v != null && v.trim().length > 0,
    ).length;
    value += Math.min(40, filled * 10);
    sample += filled;
  }
  const goodDays = w.checkIns.filter(
    (c) => c.wentWell != null && c.wentWell.trim().length > 0,
  ).length;
  value += Math.min(20, goodDays * 4);
  sample += goodDays;
  if (sample === 0) return { value: null, sample: 0 };
  return { value: clamp(value), sample };
}

function selfTrust(
  snapshot: RecoverySnapshot,
  w: Window,
  days: number,
  now: Date,
): { value: number | null; sample: number } {
  if (!snapshot.quit) return { value: null, sample: 0 };
  const streak = computeStreak(snapshot.quit, snapshot.relapses, now);

  // Keeping your own decisions, measured three ways: how the current streak
  // compares to your own best, whether you show up for check-ins, and whether
  // you did what you said you would when a craving hit.
  const vsBest =
    streak.longestMs > 0 ? Math.min(1, streak.currentMs / streak.longestMs) : 1;
  const followThrough = Math.min(1, w.checkIns.length / (days * 2));
  const decided = w.cravings.filter((c) => c.outcome !== 'unknown');
  const kept =
    decided.length > 0
      ? decided.filter((c) => c.outcome === 'resisted').length / decided.length
      : 0.5;

  const value = vsBest * 50 + followThrough * 30 + kept * 20;
  return { value: clamp(value), sample: w.checkIns.length + decided.length + 1 };
}

function risk(
  snapshot: RecoverySnapshot,
  w: Window,
  days: number,
  now: Date,
): { value: number | null; sample: number } {
  let score = 0;
  let sample = 0;

  const intensity = mean(w.cravings.map((c) => c.intensity));
  if (intensity != null) {
    score += intensity * 4; // up to 40
    sample += w.cravings.length;
  }

  const sleep = mean(w.checkIns.map((c) => c.sleepQuality).filter(isNum));
  if (sleep != null) {
    score += (10 - sleep) * 2; // up to 20
    sample += 1;
  }

  const stress = mean(w.checkIns.map((c) => c.stress).filter(isNum));
  if (stress != null) {
    score += stress * 2; // up to 20
    sample += 1;
  }

  // A relapse inside the window is the single strongest short-term signal.
  const recentRelapse = snapshot.relapses.some(
    (r) => now.getTime() - r.occurredAt.getTime() <= days * MS_PER_DAY,
  );
  if (recentRelapse) score += 20;

  // Going quiet is itself a risk signal, not a neutral absence of data.
  const expected = days * 2;
  if (w.checkIns.length < expected * 0.25) {
    score += 10;
    sample += 1;
  }

  if (sample === 0) return { value: null, sample: 0 };
  return { value: clamp(score), sample };
}

function isNum(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

// --- assembly --------------------------------------------------------------

type Computed = { value: number | null; sample: number };

function trendOf(current: number | null, previous: number | null, higherIsBetter: boolean): Trend {
  if (current == null || previous == null) return 'unknown';
  const delta = current - previous;
  if (Math.abs(delta) < 5) return 'flat';
  const improving = higherIsBetter ? delta > 0 : delta < 0;
  return improving ? 'up' : 'down';
}

/**
 * Compute all seven indicators over a window, with the previous window of the
 * same length used only to derive a direction. Trends need two comparable
 * windows; a single point is a number, not a trend.
 */
export function computeIndicators(
  snapshot: RecoverySnapshot,
  now: Date,
  windowDays: number = DEFAULT_WINDOW_DAYS,
): IndicatorSet {
  const current = sliceWindow(snapshot, now, windowDays);
  const previousEnd = new Date(now.getTime() - windowDays * MS_PER_DAY);
  const previous = sliceWindow(snapshot, previousEnd, windowDays);

  const streakDays = snapshot.quit
    ? computeStreak(snapshot.quit, snapshot.relapses, now).currentDays
    : 0;
  const prevStreakDays = snapshot.quit
    ? computeStreak(snapshot.quit, snapshot.relapses, previousEnd).currentDays
    : 0;

  const definitions: {
    key: IndicatorKey;
    higherIsBetter: boolean;
    now: Computed;
    before: Computed;
  }[] = [
    {
      key: 'stability',
      higherIsBetter: true,
      now: stability(current),
      before: stability(previous),
    },
    {
      key: 'craving_control',
      higherIsBetter: true,
      now: cravingControl(current, streakDays),
      before: cravingControl(previous, prevStreakDays),
    },
    {
      key: 'routine',
      higherIsBetter: true,
      now: routine(current, windowDays),
      before: routine(previous, windowDays),
    },
    {
      key: 'connection',
      higherIsBetter: true,
      now: connection(snapshot, current),
      before: connection(snapshot, previous),
    },
    {
      key: 'purpose',
      higherIsBetter: true,
      now: purpose(snapshot, current),
      before: purpose(snapshot, previous),
    },
    {
      key: 'self_trust',
      higherIsBetter: true,
      now: selfTrust(snapshot, current, windowDays, now),
      before: selfTrust(snapshot, previous, windowDays, previousEnd),
    },
    {
      key: 'risk',
      higherIsBetter: false,
      now: risk(snapshot, current, windowDays, now),
      before: risk(snapshot, previous, windowDays, previousEnd),
    },
  ];

  return {
    windowDays,
    computedAt: now,
    indicators: definitions.map((d) => ({
      key: d.key,
      value: d.now.value,
      sample: d.now.sample,
      higherIsBetter: d.higherIsBetter,
      confidence: confidenceFor(d.now.sample),
      trend: trendOf(d.now.value, d.before.value, d.higherIsBetter),
    })),
  };
}

/** Pull one indicator out of a set. */
export function indicator(set: IndicatorSet, key: IndicatorKey): Indicator | undefined {
  return set.indicators.find((i) => i.key === key);
}
