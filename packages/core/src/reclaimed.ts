import type { QuitPlan } from './types.js';

const MS_PER_DAY = 86_400_000;

export interface ReclaimedHorizon {
  /** Minor currency units (öre, cents) — never floats, so totals stay exact. */
  moneyMinor: number;
  minutes: number;
  units: number;
}

export interface ReclaimedSummary {
  currency: string;
  today: ReclaimedHorizon;
  thisWeek: ReclaimedHorizon;
  thisMonth: ReclaimedHorizon;
  soFar: ReclaimedHorizon;
  /** Straight-line projections, used for the "what this buys back" view. */
  projectedYear1: ReclaimedHorizon;
  projectedYear5: ReclaimedHorizon;
}

function horizon(quit: QuitPlan, days: number): ReclaimedHorizon {
  const units = quit.baselineUnitsPerDay * days;
  return {
    units: round2(units),
    moneyMinor: Math.round(units * quit.unitCostMinor),
    minutes: Math.round(units * quit.minutesPerUnit),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * What the person has bought back.
 *
 * Framed as reclamation, not savings: the number is not "money you did not
 * spend", it is time and money that is now available for a life. The UI wording
 * carries that; this function just has to be arithmetically honest.
 *
 * `soFar` is capped at the current streak, so a relapse does not silently keep
 * accruing a total the person did not earn — but the historical totals live in
 * `totalDaysClean` and are never wiped.
 */
export function computeReclaimed(
  quit: QuitPlan,
  streakMs: number,
  now: Date,
): ReclaimedSummary {
  const cleanDays = Math.max(0, streakMs / MS_PER_DAY);

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const elapsedToday = Math.min(
    cleanDays,
    (now.getTime() - startOfToday.getTime()) / MS_PER_DAY,
  );

  return {
    currency: quit.currency,
    today: horizon(quit, elapsedToday),
    thisWeek: horizon(quit, Math.min(cleanDays, 7)),
    thisMonth: horizon(quit, Math.min(cleanDays, 30)),
    soFar: horizon(quit, cleanDays),
    projectedYear1: horizon(quit, 365),
    projectedYear5: horizon(quit, 365 * 5),
  };
}

/** Format minor units as a display string, e.g. 123456 SEK → "1 234,56". */
export function formatMoneyMinor(
  minor: number,
  currency: string,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

/** Minutes → a rounded `{ hours, minutes }` pair for display. */
export function splitMinutes(total: number): { hours: number; minutes: number } {
  const hours = Math.floor(total / 60);
  return { hours, minutes: Math.round(total - hours * 60) };
}
