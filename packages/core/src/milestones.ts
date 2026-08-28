import type { SubstanceKind } from './types.js';
import { substanceProfile, type IntakeForm, type MilestoneSource } from './substances.js';

export interface Milestone {
  key: string;
  hours: number;
  reached: boolean;
  /** Hours remaining until reached. Zero once passed. */
  hoursRemaining: number;
  /**
   * Who established this, when it is a claim about a body rather than an
   * observation about how people feel. Carried all the way to the screen: a
   * product that must never pretend to be a doctor has to be able to say where
   * a number came from, and the person reading it should be able to check.
   */
  source?: MilestoneSource;
}

export interface MilestoneSummary {
  reached: Milestone[];
  next: Milestone | null;
  /** 0–1 progress from the previously reached milestone to the next one. */
  progressToNext: number;
}

/**
 * Health and life milestones for the current streak.
 *
 * Milestones are the one place the app uses time as a reward, and they are
 * deliberately front-loaded: the first useful one arrives within hours, not
 * months, because the first hours are when a person most needs evidence that
 * something is happening.
 */
export function computeMilestones(
  substance: SubstanceKind,
  streakHours: number,
  /**
   * How the person took it, for the one substance where that changes what is
   * true. Undefined means they were never asked — every plan made before the
   * question existed — and gets only the claims that hold either way.
   */
  intake?: IntakeForm | null,
): MilestoneSummary {
  const all = substanceProfile(substance).milestones.filter((m) => {
    if (!m.intake) return true;
    // A milestone about lungs belongs to somebody who smoked. Showing it to a
    // person who has only ever used snus is a false claim about their body,
    // which this product does not get to make in order to be encouraging.
    return intake === 'smoked' || intake === 'both';
  });

  const mapped: Milestone[] = all.map((m) => ({
    key: m.key,
    hours: m.hours,
    reached: streakHours >= m.hours,
    hoursRemaining: Math.max(0, m.hours - streakHours),
    ...(m.source ? { source: m.source } : {}),
  }));

  const reached = mapped.filter((m) => m.reached);
  const next = mapped.find((m) => !m.reached) ?? null;

  let progressToNext = 1;
  if (next) {
    const previousHours = reached.length > 0 ? reached[reached.length - 1]!.hours : 0;
    const span = next.hours - previousHours;
    progressToNext = span <= 0 ? 1 : clamp01((streakHours - previousHours) / span);
  }

  return { reached, next, progressToNext };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Streak milestones that are not substance specific — the ones people actually
 * count out loud. Used for the recovery calendar and personal records.
 */
export const DAY_MILESTONES = [1, 3, 7, 14, 21, 30, 60, 90, 180, 270, 365, 730, 1825];

export function nextDayMilestone(currentDays: number): number | null {
  return DAY_MILESTONES.find((d) => d > currentDays) ?? null;
}
