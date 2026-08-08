import type { RelapseAutopsy } from './types.js';

/**
 * The "I messed up" flow.
 *
 * A relapse is a system failure to analyse, not a character failure to punish.
 * The flow therefore starts with safety, not with questions — nobody should have
 * to answer "what was the first link in the chain" while they are still in
 * physical danger.
 */
export const RELAPSE_SAFETY_QUESTIONS = [
  'relapse.safety.are_you_safe',
  'relapse.safety.dangerous_amount',
  'relapse.safety.are_you_alone',
  'relapse.safety.need_medical_help',
] as const;

/** The autopsy, in the order it is asked. Every question is skippable. */
export const RELAPSE_AUTOPSY_QUESTIONS: {
  field: keyof RelapseAutopsy;
  key: string;
}[] = [
  { field: 'whatHappened', key: 'relapse.autopsy.what_happened' },
  { field: 'chainStartedAt', key: 'relapse.autopsy.when_did_it_start' },
  { field: 'firstTrigger', key: 'relapse.autopsy.first_trigger' },
  { field: 'thought', key: 'relapse.autopsy.what_thought' },
  { field: 'feeling', key: 'relapse.autopsy.what_feeling' },
  { field: 'decision', key: 'relapse.autopsy.what_decision' },
  { field: 'ignoredWarnings', key: 'relapse.autopsy.ignored_warnings' },
  { field: 'peoplePresent', key: 'relapse.autopsy.who_was_there' },
  { field: 'whatCouldHaveBrokenTheChain', key: 'relapse.autopsy.what_could_have_broken_it' },
  { field: 'whatChangesNow', key: 'relapse.autopsy.what_changes_now' },
];

export interface ProtectionPlan {
  /** Warning signs the person named, in their own words. */
  warningSigns: string[];
  /** What they will do instead, drawn from their answers. */
  countermeasures: string[];
  /** Toolbox ids to surface first next time this pattern appears. */
  toolIds: string[];
  /** True when the plan is thin enough that the coach should help fill it in. */
  needsWork: boolean;
}

/**
 * Turn an autopsy into a forward-looking plan.
 *
 * This is intentionally mechanical: it reuses the person's own sentences rather
 * than generating advice, because a plan in your own words is one you recognise
 * at 2am. The coach can enrich it afterwards, but the skeleton is yours.
 */
export function buildProtectionPlan(autopsy: RelapseAutopsy): ProtectionPlan {
  const warningSigns = [autopsy.firstTrigger, autopsy.thought, autopsy.feeling, autopsy.ignoredWarnings]
    .map((v) => v?.trim())
    .filter((v): v is string => !!v && v.length > 0);

  const countermeasures = [autopsy.whatCouldHaveBrokenTheChain, autopsy.whatChangesNow]
    .map((v) => v?.trim())
    .filter((v): v is string => !!v && v.length > 0);

  const toolIds: string[] = ['delay_10_minutes'];
  if (autopsy.peoplePresent && autopsy.peoplePresent.trim().length > 0) {
    toolIds.push('leave_the_situation', 'call_someone');
  }
  if (autopsy.firstTrigger && autopsy.firstTrigger.trim().length > 0) {
    toolIds.push('remove_the_trigger');
  }
  if (autopsy.thought && autopsy.thought.trim().length > 0) {
    toolIds.push('name_the_negotiation');
  }

  return {
    warningSigns,
    countermeasures,
    toolIds: [...new Set(toolIds)],
    needsWork: warningSigns.length === 0 || countermeasures.length === 0,
  };
}

/**
 * What to say the moment the button is pressed. No shame, no lost-progress
 * language, and no questions until we know the person is physically safe.
 */
export const RELAPSE_OPENING_KEY = 'relapse.opening';

/**
 * Explicitly reassures that previous recovery still counts. This is the
 * anti-gamification rule from the product spec, encoded so no future screen can
 * quietly turn a relapse into a lost level.
 */
export const RELAPSE_CONTINUITY_KEY = 'relapse.continuity';
