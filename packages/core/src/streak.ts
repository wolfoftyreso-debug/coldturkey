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
  /** Total days since the person first stopped, relapses included. */
  totalDaysInRecovery: number;
  /** Number of times the streak restarted. Never displayed as a failure count. */
  restarts: number;
  lastUseAt: Date;
  /** True when the current streak is the longest one so far. */
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

  const boundaries = [start, ...times, nowMs];
  let longestMs = 0;
  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const from = boundaries[i]!;
    const to = boundaries[i + 1]!;
    const span = to - from;
    if (span > longestMs) longestMs = span;
  }

  const lastUseMs = times.length > 0 ? times[times.length - 1]! : start;
  const currentMs = Math.max(0, nowMs - lastUseMs);

  return {
    currentMs,
    currentDays: Math.floor(currentMs / MS_PER_DAY),
    currentHours: Math.floor(currentMs / MS_PER_HOUR),
    longestMs,
    longestDays: Math.floor(longestMs / MS_PER_DAY),
    totalDaysInRecovery: Math.max(0, Math.floor((nowMs - start) / MS_PER_DAY)),
    restarts: times.length,
    lastUseAt: new Date(lastUseMs),
    isPersonalRecord: currentMs >= longestMs && currentMs > 0,
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
