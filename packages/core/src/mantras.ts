/**
 * Cold Turkey's core principles, used as short recurring lines in the interface.
 *
 * They are short on purpose: in an acute craving, a sentence is the most a
 * person can hold. Each key resolves to a line in `@coldturkey/i18n`.
 */
export const MANTRAS = [
  'mantra.craving_is_not_command',
  'mantra.thought_is_not_decision',
  'mantra.delay_the_decision',
  'mantra.change_the_environment',
  'mantra.tell_someone',
  'mantra.one_good_decision',
  'mantra.relapse_is_information',
  'mantra.shame_feeds_the_cycle',
  'mantra.you_are_not_your_addiction',
  'mantra.your_next_decision_matters',
] as const;

export type MantraKey = (typeof MANTRAS)[number];

/**
 * Pick the day's mantra deterministically so it stays stable across a day and
 * across devices — the same line on the phone and on the web, and it does not
 * shuffle every time the screen re-renders.
 */
export function mantraOfTheDay(date: Date): MantraKey {
  const dayNumber = Math.floor(date.getTime() / 86_400_000);
  return MANTRAS[dayNumber % MANTRAS.length]!;
}

/** Mantras that fit a specific moment, in priority order. */
export function mantrasForCraving(): MantraKey[] {
  return [
    'mantra.craving_is_not_command',
    'mantra.delay_the_decision',
    'mantra.change_the_environment',
    'mantra.tell_someone',
  ];
}

export function mantrasForRelapse(): MantraKey[] {
  return [
    'mantra.relapse_is_information',
    'mantra.shame_feeds_the_cycle',
    'mantra.your_next_decision_matters',
    'mantra.you_are_not_your_addiction',
  ];
}
