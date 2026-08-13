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
  const decided = w.cravings.filter((c) => c.outcome !== 'unknown');

  // Nothing to measure yet.
  //
  // Self-trust here means keeping your own decisions, and on a plan made five
  // minutes ago there are no decisions to have kept. The previous version
  // returned exactly 60 for that state: `vsBest` came out at 1 because the
  // longest streak was a few milliseconds and the current streak was the same
  // few milliseconds, and `kept` fell back to a neutral 0.5. A brand new
  // account was told its self-trust was 60 out of 100, on a screen headed
  // "this is what your own data says". It wasn't.
  //
  // A streak on its own is not self-trust either — that is already shown as a
  // streak. This needs at least one check-in, or one craving somebody actually
  // resolved.
  if (w.checkIns.length === 0 && decided.length === 0) return { value: null, sample: 0 };

  // Keeping your own decisions, measured three ways: how the current streak
  // compares to your own best, whether you show up for check-ins, and whether
  // you did what you said you would when a craving hit.
  //
  // `previousBestMs`, not `longestMs`: the longest streak *includes* the current
  // one, so comparing against it returns 1 for everyone who has never relapsed —
  // a flattering constant rather than a measurement. The best *completed*
  // streak is the comparison worth making, and where there is no earlier streak
  // this part simply does not contribute.
  const hasEarlierStreak = streak.previousBestMs > 0;
  const vsBest = hasEarlierStreak ? Math.min(1, streak.currentMs / streak.previousBestMs) : null;
  const followThrough = Math.min(1, w.checkIns.length / (days * 2));
  const kept =
    decided.length > 0
      ? decided.filter((c) => c.outcome === 'resisted').length / decided.length
      : null;

  // Weight only the parts there is evidence for, then rescale. A missing
  // component should lower confidence, not quietly score zero.
  const parts = [
    ...(vsBest === null ? [] : [{ value: vsBest, weight: 50 }]),
    { value: followThrough, weight: 30 },
    ...(kept === null ? [] : [{ value: kept, weight: 20 }]),
  ];
  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  const value = parts.reduce((sum, p) => sum + p.value * p.weight, 0) / totalWeight;

  return { value: clamp(value * 100), sample: w.checkIns.length + decided.length };
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

  // Going quiet is itself a risk signal, not a neutral absence of data — but
  // only for somebody who was previously speaking.
  //
  // This fired on brand new accounts, which is where it was measured: a plan
  // created seconds earlier has no check-ins, so "fewer check-ins than
  // expected" was trivially true and risk came back as 10 with a single
  // manufactured data point. Silence from someone who has been here a fortnight
  // means something; silence from someone who arrived a minute ago means they
  // have arrived.
  //
  // The window has to have been open long enough for check-ins to plausibly
  // exist before their absence says anything.
  const QUIET_GRACE_DAYS = 3;
  const planAgeDays = snapshot.quit
    ? (now.getTime() - snapshot.quit.startedAt.getTime()) / MS_PER_DAY
    : 0;
  const expected = days * 2;
  if (planAgeDays >= QUIET_GRACE_DAYS && w.checkIns.length < expected * 0.25) {
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
    indicators: definitions.map((d) => {
      // No data, no number. This is enforced here rather than trusted to each
      // indicator because two of them got it wrong — one by adding a constant
      // to its own sample count, the other by reading an absence of check-ins
      // as withdrawal on an account minutes old. Both then showed a confident
      // figure to somebody the product had never observed, under a heading that
      // says "this is what your own data says".
      //
      // An invented assessment is worse than a blank. A blank is honest, and
      // this screen tells people what to act on.
      const hasEvidence = d.now.sample > 0;
      return {
        key: d.key,
        value: hasEvidence ? d.now.value : null,
        sample: d.now.sample,
        higherIsBetter: d.higherIsBetter,
        confidence: confidenceFor(d.now.sample),
        trend: hasEvidence ? trendOf(d.now.value, d.before.value, d.higherIsBetter) : 'unknown',
      };
    }),
  };
}

/** Pull one indicator out of a set. */
export function indicator(set: IndicatorSet, key: IndicatorKey): Indicator | undefined {
  return set.indicators.find((i) => i.key === key);
}
