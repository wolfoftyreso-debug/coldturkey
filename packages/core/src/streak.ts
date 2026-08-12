import type { QuitPlan, RelapseEvent } from './types.js';

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

export interface StreakSummary {
  /** Milliseconds since the last use — the clock the home screen shows. */
  currentMs: number;
  currentDays: number;
  currentHours: number;
  /** Longest clean stretch so far, including the current one. */
  longestMs: number;
  longestDays: number;
  /**
   * Longest *completed* stretch — the best the person had managed before the
   * streak they are on now. Zero when they have never relapsed, because then
   * there is nothing behind them to compare against.
   */
  previousBestMs: number;
  previousBestDays: number;
  /** Total days since the person first stopped, relapses included. */
  totalDaysInRecovery: number;
  /** Number of times the streak restarted. Never displayed as a failure count. */
  restarts: number;
  lastUseAt: Date;
  /**
   * True when the current streak has passed every earlier one.
   *
   * This deliberately stays false for somebody who has never relapsed. They
   * hold the record by default, and a badge you cannot not have says nothing —
   * on day zero of a first attempt it reads as hollow, which is exactly the
   * tone this app must never take. The badge means "you have gone further than
   * you ever managed before", so it needs a before to have existed.
   */
  isPersonalRecord: boolean;
}

function sortedRelapseTimes(relapses: RelapseEvent[], from: Date, now: Date): number[] {
  return relapses
    .map((r) => r.occurredAt.getTime())
    .filter((t) => Number.isFinite(t) && t >= from.getTime() && t <= now.getTime())
    .sort((a, b) => a - b);
}

/**
 * Compute the streak picture.
 *
 * A relapse restarts the current streak but never erases the longest one, and
 * never resets `totalDaysInRecovery`. That is the whole point: the previous
 * recovery did not disappear, we just start again from here with more
 * information.
 */
export function computeStreak(
  quit: QuitPlan,
  relapses: RelapseEvent[],
  now: Date,
): StreakSummary {
  const start = quit.startedAt.getTime();
  const nowMs = now.getTime();
  const times = sortedRelapseTimes(relapses, quit.startedAt, now);

  // Every stretch between two boundaries is a streak. The final one — from the
  // last relapse to now — is the current streak; all the earlier ones are
  // finished, and it is those we have to beat to have beaten anything.
  const boundaries = [start, ...times, nowMs];
  let longestMs = 0;
  let previousBestMs = 0;
  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const from = boundaries[i]!;
    const to = boundaries[i + 1]!;
    const span = to - from;
    if (span > longestMs) longestMs = span;
    const isCurrentStreak = i === boundaries.length - 2;
    if (!isCurrentStreak && span > previousBestMs) previousBestMs = span;
  }

  const lastUseMs = times.length > 0 ? times[times.length - 1]! : start;
  const currentMs = Math.max(0, nowMs - lastUseMs);

  return {
    currentMs,
    currentDays: Math.floor(currentMs / MS_PER_DAY),
    currentHours: Math.floor(currentMs / MS_PER_HOUR),
    longestMs,
    longestDays: Math.floor(longestMs / MS_PER_DAY),
    previousBestMs,
    previousBestDays: Math.floor(previousBestMs / MS_PER_DAY),
    totalDaysInRecovery: Math.max(0, Math.floor((nowMs - start) / MS_PER_DAY)),
    restarts: times.length,
    lastUseAt: new Date(lastUseMs),
    isPersonalRecord: previousBestMs > 0 && currentMs > previousBestMs,
  };
}

/** Hours since the last use — the input the safety layer needs for detox risk. */
export function hoursSinceLastUse(
  quit: QuitPlan,
  relapses: RelapseEvent[],
  now: Date,
): number {
  return computeStreak(quit, relapses, now).currentMs / MS_PER_HOUR;
}
