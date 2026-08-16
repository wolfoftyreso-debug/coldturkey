/**
 * Cleat Nära — the surface for somebody standing next to an addiction.
 *
 * This is not a window into another person's account. There is no link to
 * anybody's data here, by design: a relative who can watch a streak counter has
 * a surveillance tool, and in the households this is written for, surveillance
 * is already the problem. What a relative actually needs is different — to
 * understand what is happening, to stop carrying what is not theirs, and to
 * find out whether they are still in their own life.
 *
 * Five rules run through everything in this file, and they are not style:
 *
 *  1. Nothing here diagnoses. "Co-dependency" is a description of patterns, not
 *     a condition somebody can be given by an app, and this module never tells
 *     anyone they have it. It reflects back what their own answers said.
 *  2. Nothing here tells somebody to leave, or to stay. That decision belongs to
 *     the person living it, who knows things no app does.
 *  3. Nothing here blames the relative. "You enabled this" is both cruel and
 *     wrong: an addiction is not caused by the people who love the person.
 *  4. Nothing here promises the other person will recover. Hope that is
 *     manufactured is a debt somebody pays later.
 *  5. A medical emergency is never coached. It is named, and the person is told
 *     to call.
 */

/** The things a relative most often has no way to find out. */
export type SupporterTopic =
  | 'what_a_craving_is'
  | 'why_willpower_framing_fails'
  | 'the_negotiation_voice'
  | 'withdrawal_can_be_dangerous'
  | 'relapse_is_not_a_moral_failure'
  | 'why_they_lie'
  | 'what_actually_helps'
  | 'what_does_not_help'
  | 'you_did_not_cause_it';

export const SUPPORTER_TOPICS: SupporterTopic[] = [
  'what_a_craving_is',
  'the_negotiation_voice',
  'why_willpower_framing_fails',
  'why_they_lie',
  'withdrawal_can_be_dangerous',
  'relapse_is_not_a_moral_failure',
  'what_actually_helps',
  'what_does_not_help',
  'you_did_not_cause_it',
];

/**
 * Signs that stop being a conversation and start being an ambulance.
 *
 * First on the page, before anything reflective. Somebody reading this at two
 * in the morning with a person unconscious in the next room must not have to
 * scroll past a self-assessment to reach it.
 */
export const SUPPORTER_EMERGENCY_SIGNS = [
  'unresponsive',
  'seizure',
  'breathing',
  'confusion',
  'talking_about_dying',
  'alcohol_or_benzo_withdrawal',
] as const;

/** The patterns the self-check reflects back. Not a diagnosis, and not a score. */
export type SupporterPattern =
  | 'control'
  | 'rescue'
  | 'boundaries'
  | 'own_needs'
  | 'secrecy'
  | 'blame'
  | 'hypervigilance';

export const SUPPORTER_PATTERNS: SupporterPattern[] = [
  'control',
  'rescue',
  'boundaries',
  'own_needs',
  'secrecy',
  'blame',
  'hypervigilance',
];

export interface SupporterStatement {
  id: string;
  pattern: SupporterPattern;
}

/**
 * Two statements per pattern, in the first person and about ordinary Tuesdays.
 *
 * Deliberately concrete — "I count what is left in the bottle" rather than "I
 * display controlling behaviour". Somebody recognises the first one and argues
 * with the second, and the point of this instrument is recognition rather than
 * measurement.
 */
export const SUPPORTER_STATEMENTS: SupporterStatement[] = [
  { id: 'count_what_is_left', pattern: 'control' },
  { id: 'check_their_things', pattern: 'control' },
  { id: 'covered_for_them', pattern: 'rescue' },
  { id: 'paid_what_was_theirs', pattern: 'rescue' },
  { id: 'said_last_time_again', pattern: 'boundaries' },
  { id: 'agree_to_avoid_a_fight', pattern: 'boundaries' },
  { id: 'stopped_doing_what_i_liked', pattern: 'own_needs' },
  { id: 'sleep_badly_from_worry', pattern: 'own_needs' },
  { id: 'keep_people_away', pattern: 'secrecy' },
  { id: 'avoid_saying_how_it_is', pattern: 'secrecy' },
  { id: 'think_it_is_my_fault', pattern: 'blame' },
  { id: 'search_for_what_i_missed', pattern: 'blame' },
  { id: 'read_the_mood_first', pattern: 'hypervigilance' },
  { id: 'calm_only_when_i_know_where', pattern: 'hypervigilance' },
];

/** How often, from never to almost always. Four points: no comfortable middle. */
export const SUPPORTER_SCALE = [0, 1, 2, 3] as const;
export type SupporterAnswer = (typeof SUPPORTER_SCALE)[number];

export type PatternLevel = 'quiet' | 'present' | 'loud';

export interface PatternReflection {
  pattern: SupporterPattern;
  level: PatternLevel;
  /** 0–1, and deliberately not shown as a percentage anywhere. */
  weight: number;
  /** How many of this pattern's statements were actually answered. */
  answered: number;
}

export interface SupporterReflection {
  patterns: PatternReflection[];
  /** The loud ones, strongest first — what the page leads with. */
  loudest: SupporterPattern[];
  /** Answered statements, out of the ones that exist. */
  answered: number;
  total: number;
  /**
   * True when too little was answered to say anything. The page must then say
   * nothing rather than reflect back a shape built from three answers.
   */
  tooLittle: boolean;
}

/** Under this fraction of statements answered, the result is noise. */
const MINIMUM_ANSWERED = 0.5;

/** At or above this, a pattern is loud enough to be worth naming. */
const LOUD = 0.6;
const PRESENT = 0.3;

/**
 * Turn the answers into a reflection.
 *
 * Pure, and it runs on the device: this is the most sensitive thing a relative
 * could type into any app, and there is no version of the product that needs a
 * copy of it. Nothing here is stored, sent, or counted anywhere.
 */
export function reflectOnSupport(
  answers: Partial<Record<string, SupporterAnswer>>,
): SupporterReflection {
  const patterns: PatternReflection[] = SUPPORTER_PATTERNS.map((pattern) => {
    const statements = SUPPORTER_STATEMENTS.filter((s) => s.pattern === pattern);
    const given = statements
      .map((s) => answers[s.id])
      .filter((value): value is SupporterAnswer => value !== undefined);

    if (given.length === 0) {
      return { pattern, level: 'quiet', weight: 0, answered: 0 };
    }

    const max = given.length * 3;
    // Explicit accumulator type: the answers are a union of literals, so an
    // inferred one narrows to that union and the sum stops type-checking.
    const weight = given.reduce<number>((sum, value) => sum + value, 0) / max;
    const level: PatternLevel = weight >= LOUD ? 'loud' : weight >= PRESENT ? 'present' : 'quiet';
    return { pattern, level, weight, answered: given.length };
  });

  const answered = patterns.reduce((sum, p) => sum + p.answered, 0);
  const total = SUPPORTER_STATEMENTS.length;

  return {
    patterns,
    loudest: patterns
      .filter((p) => p.level === 'loud')
      .sort((a, b) => b.weight - a.weight)
      .map((p) => p.pattern),
    answered,
    total,
    tooLittle: answered < total * MINIMUM_ANSWERED,
  };
}

/**
 * Sentences a relative can actually say out loud.
 *
 * A boundary is not a threat and not an ultimatum; it is a statement about what
 * *you* will do, which is the only part anybody controls. Every line here is
 * phrased that way on purpose, and none of them is conditional on the other
 * person changing.
 */
export type BoundarySituation =
  | 'asked_for_money'
  | 'drunk_at_home'
  | 'promises_again'
  | 'wants_a_lift'
  | 'blames_you'
  | 'family_dinner'
  | 'driving';

export const BOUNDARY_SITUATIONS: BoundarySituation[] = [
  'asked_for_money',
  'drunk_at_home',
  'promises_again',
  'wants_a_lift',
  'blames_you',
  'family_dinner',
  'driving',
];

export interface SupporterResource {
  key: string;
  contact: string;
  /** Whether this one is specifically staffed for relatives, not for the user. */
  forRelatives: boolean;
}

/**
 * Where a relative can turn, per country.
 *
 * Same shape and the same rule as the emergency table: a line that does not
 * answer where the person is standing costs them the call. Kept separate from
 * `emergencyResources` because these are staffed for a different caller — the
 * one who is not the patient, and who most services have no route for.
 */
const SUPPORTER_RESOURCES: Record<string, SupporterResource[]> = {
  SE: [
    { key: 'support.se.alcohol_line', contact: '020-84 44 48', forRelatives: true },
    { key: 'support.se.gambling_line', contact: '020-81 91 00', forRelatives: true },
    { key: 'support.se.health', contact: '1177', forRelatives: false },
    { key: 'support.se.municipal', contact: '', forRelatives: true },
    { key: 'support.se.bris', contact: '116 111', forRelatives: true },
  ],
  US: [
    { key: 'support.us.samhsa', contact: '1-800-662-4357', forRelatives: true },
    { key: 'support.us.crisis', contact: '988', forRelatives: false },
  ],
  GB: [
    { key: 'support.gb.adfam', contact: '', forRelatives: true },
    { key: 'support.gb.health', contact: '111', forRelatives: false },
  ],
};

const GENERIC_SUPPORTER_RESOURCES: SupporterResource[] = [
  { key: 'support.generic.local', contact: '', forRelatives: true },
];

export function supporterResources(country?: string): SupporterResource[] {
  if (!country) return GENERIC_SUPPORTER_RESOURCES;
  return SUPPORTER_RESOURCES[country.toUpperCase()] ?? GENERIC_SUPPORTER_RESOURCES;
}
