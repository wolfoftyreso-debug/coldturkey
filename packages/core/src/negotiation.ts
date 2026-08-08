import { normalizeForMatching, phraseMatcher } from './text.js';

/**
 * The Negotiation Detector.
 *
 * Addiction rarely announces itself as "I want to use". It arrives as a
 * reasonable-sounding argument. This module names the argument so the person can
 * look at it instead of acting on it.
 *
 * It never scolds. The output feeds one question: do you want to examine this
 * thought, or act on it?
 *
 * Patterns are ASCII; input is diacritic-folded first (see `text.ts`).
 */
export type NegotiationType =
  | 'just_once'
  | 'earned_it'
  | 'in_control_now'
  | 'start_monday'
  | 'need_it_to_sleep'
  | 'need_it_to_function'
  | 'everyone_does_it'
  | 'deserve_it'
  | 'last_time'
  | 'special_occasion'
  | 'nothing_matters'
  | 'testing_myself';

export interface NegotiationMatch {
  type: NegotiationType;
  /** The fragment that matched, so the UI can quote the person's own words. */
  excerpt: string;
}

export interface NegotiationResult {
  detected: boolean;
  matches: NegotiationMatch[];
  /** Translation key for the counter-question the coach opens with. */
  promptKey: string;
}

const RULES: { type: NegotiationType; matcher: RegExp }[] = [
  {
    type: 'just_once',
    matcher: phraseMatcher([
      'bara en gang',
      'bara en till',
      'bara den har',
      'en enda gang',
      'just once',
      'just one',
      'only one more',
      'one wont hurt',
      'one will not hurt',
    ]),
  },
  {
    type: 'earned_it',
    matcher: phraseMatcher([
      'jag har varit duktig',
      'jag har skott mig',
      'jag har kampat',
      'ive been good',
      'i have been good',
      'ive earned it',
      'i have earned it',
    ]),
  },
  {
    type: 'in_control_now',
    matcher: phraseMatcher([
      'jag kan kontrollera det',
      'jag har kontroll',
      'jag klarar av det nu',
      'kan hantera det nu',
      'i can control it',
      'i can handle it now',
      'im in control',
      'i am in control',
    ]),
  },
  {
    type: 'start_monday',
    matcher: phraseMatcher([
      'borjar pa mandag',
      'borjar om imorgon',
      'tar nystart imorgon',
      'start on monday',
      'starting monday',
      'start tomorrow',
      'starting tomorrow',
    ]),
  },
  {
    type: 'need_it_to_sleep',
    matcher: phraseMatcher([
      'behover det for att sova',
      'kan inte sova utan',
      'somnar inte utan',
      'need it to sleep',
      'cant sleep without',
      'can not sleep without',
    ]),
  },
  {
    type: 'need_it_to_function',
    matcher: phraseMatcher([
      'behover det for att fungera',
      'behover det for att orka',
      'klarar inte jobbet utan',
      'orkar inte utan',
      'need it to function',
      'cant function without',
      'can not function without',
      'need it to get through',
    ]),
  },
  {
    type: 'everyone_does_it',
    matcher: phraseMatcher([
      'alla andra gor det',
      'alla dricker',
      'alla tar',
      'everyone does it',
      'everyone else does',
      'everybody drinks',
    ]),
  },
  {
    type: 'deserve_it',
    matcher: phraseMatcher([
      'jag fortjanar det',
      'jag har fortjanat det',
      'jag fortjanar',
      'i deserve it',
      'i deserve this',
      'i have deserved it',
    ]),
  },
  {
    type: 'last_time',
    matcher: phraseMatcher([
      'sista gangen',
      'slutar efter den har',
      'efter det slutar jag',
      'last time',
      'after this ill stop',
      'after this i will stop',
      'one last time',
    ]),
  },
  {
    type: 'special_occasion',
    matcher: phraseMatcher([
      'det ar ju fredag',
      'det ar ju helg',
      'det ar ju min fodelsedag',
      'speciellt tillfalle',
      'its friday',
      'its the weekend',
      'its my birthday',
      'special occasion',
      'its a celebration',
    ]),
  },
  {
    type: 'nothing_matters',
    matcher: phraseMatcher([
      'spelar ingen roll',
      'kvittar anda',
      'ingenting spelar roll',
      'doesnt matter anyway',
      'does not matter anyway',
      'nothing matters',
      'whats the point',
    ]),
  },
  {
    type: 'testing_myself',
    matcher: phraseMatcher([
      'bara testa om jag klarar',
      'se om jag klarar',
      'testa mig sjalv',
      'just to test',
      'see if i can handle it',
      'test myself',
    ]),
  },
];

/**
 * Scan text for rationalisation patterns. Returns every match, not just the
 * first — people usually stack several arguments at once, and seeing the stack
 * is more convincing than seeing one line.
 */
export function detectNegotiation(text: string): NegotiationResult {
  if (!text || text.trim().length === 0) {
    return { detected: false, matches: [], promptKey: 'negotiation.none' };
  }

  const haystack = normalizeForMatching(text);
  const matches: NegotiationMatch[] = [];

  for (const rule of RULES) {
    const found = haystack.match(rule.matcher);
    if (found) matches.push({ type: rule.type, excerpt: found[0].trim() });
  }

  return {
    detected: matches.length > 0,
    matches,
    promptKey: matches.length > 0 ? 'negotiation.detected' : 'negotiation.none',
  };
}

/** Translation key for the short counter to a specific rationalisation. */
export function counterKey(type: NegotiationType): string {
  return `negotiation.counter.${type}`;
}
