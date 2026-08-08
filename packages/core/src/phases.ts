import type { RecoveryPhase, RecoverySnapshot } from './types.js';
import { computeStreak } from './streak.js';

export const RECOVERY_PHASES: RecoveryPhase[] = [
  'insight',
  'decision',
  'preparation',
  'day_zero',
  'acute',
  'stabilization',
  'identity',
  'relapse_prevention',
];

export interface PhaseAssessment {
  phase: RecoveryPhase;
  /** Why the app landed on this phase. Shown to the user on request — no black boxes. */
  reasonKey: string;
  /** The two or three things that matter in this phase, as translation keys. */
  focusKeys: string[];
  /**
   * How far ahead the app should let the person look. In the acute phase the
   * honest horizon is the next ten minutes, and showing five-year goals there is
   * a way of overwhelming someone who is barely holding on.
   */
  horizon: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';
}

const PHASE_FOCUS: Record<RecoveryPhase, string[]> = {
  insight: ['focus.map_the_cost', 'focus.name_the_pattern', 'focus.what_changed_now'],
  decision: ['focus.write_my_why', 'focus.what_i_want_back', 'focus.readiness_scale'],
  preparation: ['focus.trigger_map', 'focus.remove_access', 'focus.support_network'],
  day_zero: ['focus.next_ten_minutes', 'focus.tonight_plan', 'focus.who_to_call'],
  acute: ['focus.get_through_today', 'focus.sleep_and_food', 'focus.craving_protocol'],
  stabilization: ['focus.daily_routine', 'focus.money_and_work', 'focus.people_and_places'],
  identity: ['focus.who_am_i_now', 'focus.rebuild_relationships', 'focus.meaningful_activity'],
  relapse_prevention: ['focus.warning_signs', 'focus.protection_plan', 'focus.keep_the_network'],
};

const PHASE_HORIZON: Record<RecoveryPhase, PhaseAssessment['horizon']> = {
  insight: 'weeks',
  decision: 'weeks',
  preparation: 'days',
  day_zero: 'minutes',
  acute: 'hours',
  stabilization: 'weeks',
  identity: 'months',
  relapse_prevention: 'years',
};

/**
 * Work out where someone is right now.
 *
 * The self-declared phase on the profile is respected for the pre-quit phases —
 * only the person knows whether they have decided. Once there is an active quit
 * plan the phase is derived from the clock, because a person on day 1 needs day 1
 * support whatever they told us last month.
 *
 * A recent relapse pulls the phase back to the acute end, not because the person
 * lost progress, but because that is where the useful help lives.
 */
export function assessPhase(snapshot: RecoverySnapshot, now: Date): PhaseAssessment {
  const { quit, relapses, profile } = snapshot;

  if (!quit || quit.status !== 'active') {
    const declared: RecoveryPhase =
      profile.phase === 'insight' || profile.phase === 'decision' || profile.phase === 'preparation'
        ? profile.phase
        : 'insight';
    return build(declared, 'phase.reason.no_active_plan');
  }

  const streak = computeStreak(quit, relapses, now);
  const days = streak.currentMs / 86_400_000;

  if (days < 1) return build('day_zero', 'phase.reason.day_zero');
  if (days < 14) return build('acute', 'phase.reason.acute_window');
  if (days < 90) return build('stabilization', 'phase.reason.building_stability');
  if (days < 365) return build('identity', 'phase.reason.identity_rebuild');
  return build('relapse_prevention', 'phase.reason.long_term');
}

function build(phase: RecoveryPhase, reasonKey: string): PhaseAssessment {
  return {
    phase,
    reasonKey,
    focusKeys: PHASE_FOCUS[phase],
    horizon: PHASE_HORIZON[phase],
  };
}

/** Whether long-horizon content (five-year goals, identity work) should be shown at all. */
export function shouldShowLongHorizon(phase: RecoveryPhase): boolean {
  return phase !== 'day_zero' && phase !== 'acute';
}
