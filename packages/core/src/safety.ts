import type { Locale, SubstanceKind } from './types.js';
import { substanceProfile } from './substances.js';
import { normalizeForMatching, phraseMatcher } from './text.js';

/**
 * Safety triage runs before anything else — before state, before phase, before
 * the coach. It is deliberately deterministic: an emergency must never depend on
 * a language model deciding to notice it.
 *
 * The bias is toward false positives. Offering emergency information to someone
 * who did not need it costs them ten seconds. Missing it costs more.
 *
 * Patterns are ASCII because the input is diacritic-folded first (see `text.ts`),
 * so "vill dö" and "vill do" both reach the same rule.
 */
export type SafetyLevel = 'none' | 'elevated' | 'urgent' | 'emergency';

export type SafetyCategory =
  | 'suicide'
  /**
   * Passive ideation — wanting to be gone, to stop existing, to not wake up —
   * as distinct from a stated intent to act. It is a real signal and it is
   * never ignored, but answering it with "stop, call the emergency number" is
   * both wrong and counterproductive: it does not fit what the person said, and
   * being alarmed at teaches them not to say the next true thing.
   */
  | 'suicidal_ideation'
  /**
   * A plan, a date, or the means to hand. In suicidology this is the strongest
   * signal there is — stronger than how distressed the message sounds — and an
   * external review found the rules caught none of it. Treated as stated
   * intent, because that is what it is.
   */
  | 'suicide_plan'
  | 'self_harm'
  | 'overdose'
  | 'unresponsive_person'
  | 'severe_medical'
  | 'withdrawal_medical'
  | 'psychosis'
  | 'violence'
  | 'cannot_stay_safe';

export interface SafetyResource {
  /** Translation key for the resource name. */
  key: string;
  /** Dialable number or URL. Empty when the resource is "your local service". */
  contact: string;
  kind: 'emergency' | 'crisis' | 'health' | 'helpline';
}

export interface TriageInput {
  /** Free text from the user. May be empty when only structured flags are set. */
  text?: string;
  /** Answer to the craving engine's "are you in immediate danger?" question. */
  immediateDanger?: boolean;
  substance?: SubstanceKind | null;
  /** Hours since last use, when known. Drives the acute withdrawal warning. */
  hoursSinceLastUse?: number | null;
  /** ISO-3166 alpha-2. Falls back to a generic set when unknown. */
  country?: string;
  locale?: Locale;
}

export interface TriageResult {
  level: SafetyLevel;
  categories: SafetyCategory[];
  resources: SafetyResource[];
  /**
   * True when the app must answer with the fixed safety response and must NOT
   * hand the message to the language model for coaching. An app never tries to
   * coach someone out of a medical emergency.
   */
  bypassCoach: boolean;
  /** Translation key for the response the user sees. */
  messageKey: string;
  /**
   * Ambiguous finality — "jag är klar", "det är över nu", "tack för allt", "ta
   * hand om hunden". These carry real weight some of the time and none of it
   * the rest, and no word list can tell which. Raising an alarm on them would
   * wreck the precision the corpus is built to protect; letting them through
   * silently is how a goodbye gets missed.
   *
   * So neither. The level stays where it was and the coach is asked to put a
   * direct question first — "hur menar du?" — which is what a person who
   * noticed would do, and which costs almost nothing when the answer is that
   * they finished a project.
   */
  askDirectly: boolean;
}

interface Rule {
  category: SafetyCategory;
  level: SafetyLevel;
  matcher: RegExp;
}

const RULES: Rule[] = [
  // ---- Immediate danger to life ----
  {
    // Stated intent. Unambiguous, and the one case where the app stops being a
    // coach and says: call the emergency number, now.
    category: 'suicide',
    level: 'emergency',
    matcher: phraseMatcher([
      'ta ~ mitt liv',
      'ta ~ sitt liv',
      'ta livet av mig',
      'ta livet av sig',
      'tar livet av mig',
      'avsluta ~ allt',
      'avsluta ~ alltihop',
      'avsluta ~ mitt liv',
      'ta mitt eget liv',
      'vill do',
      'vill bara do',
      'vill inte leva',
      'sjalvmord',
      'sjalvmordstankar',
      'ta doden pa mig',
      'kill myself',
      'killing myself',
      'end my life',
      'end it all',
      'ending it all',
      'take my own life',
      'want to die',
      'wanna die',
      'dont want to live',
      'do not want to live',
      'suicidal',
      'suicide',
      'kms',
    ]),
  },
  {
    // Plan, date, or means. Note what is deliberately NOT here: a bare "jag har
    // en plan". In a recovery app that overwhelmingly means a recovery plan,
    // and firing the emergency script at someone describing their own progress
    // is the failure mode that matters most on this side. Every pattern below
    // pairs the intent with something concrete — a method, a stockpile, a date.
    category: 'suicide_plan',
    level: 'emergency',
    matcher: phraseMatcher([
      'sparat ~ tabletter',
      'sparat pa mig tabletter',
      'samlat ~ tabletter',
      'samlar ~ tabletter',
      'lagt undan ~ tabletter',
      'kopt ~ tabletter for',
      'har ett rep',
      'kopt ett rep',
      'har en kniv redo',
      'laddat ~ vapen',
      'bestamt ~ datum',
      'bestamt mig for nar',
      'valt ~ datum',
      'vet precis hur jag ska gora',
      'vet hur jag ska ta livet',
      'har allt jag behover nu',
      'har bestamt hur',
      'planerat hur jag ska',
      'skrivit ~ avskedsbrev',
      'avskedsbrev',
      'stockpiled ~ pills',
      'saved up ~ pills',
      'been saving pills',
      'have a rope',
      'bought a rope',
      'picked ~ date',
      'decided on ~ date',
      'know exactly how i will do',
      'wrote ~ note for',
      'suicide note',
      'goodbye note',
    ]),
  },
  {
    // Passive ideation. Handled, never dismissed — but with the crisis line and
    // a continuing conversation rather than an ambulance. An earlier version
    // rated every one of these as no risk at all, which is the worse error in
    // both directions: it neither helped nor stayed out of the way.
    category: 'suicidal_ideation',
    level: 'urgent',
    matcher: phraseMatcher([
      'orkar inte ~ langre',
      'orkar inte ~ mer',
      'orkar inte ~ leva',
      'orkar inte vara har',
      'vill inte vara har',
      'vill inte vara med langre',
      'vill inte finnas',
      'snart blir det tyst',
      'snart ar det over',
      'fardig med allt',
      'far bli sista',
      'logga ut permanent',
      'checka ut permanent',
      'inte vaknade',
      'inte vaknar imorgon',
      'ger upp allt',
      'ger upp helt',
      'palla inte ~ langre',
      'pallar inte ~ langre',
      'klarar inte ~ langre',
      'vill ~ forsvinna',
      'vill ~ bort harifran',
      'vill ~ slippa finnas',
      'sluta finnas',
      'inte finnas ~ langre',
      'inte finnas till',
      'om jag inte fanns',
      'om jag forsvann',
      'battre ~ utan mig',
      'somna ~ inte vakna',
      'inte vakna igen',
      'inte vakna imorgon',
      'inget kvar att leva for',
      'ingen mening ~ leva',
      'ingen mening med ~ allt',
      'meningslost ~ allt',
      'want to disappear',
      'want to vanish',
      'want it to stop forever',
      'wish i ~ gone',
      'wish i was not here',
      'wish i wasnt here',
      'better off without me',
      'nothing left to live for',
      'no reason to ~ on',
      'cant go on',
      'cannot go on',
      'cant do this ~ longer',
      'cannot do this ~ longer',
      'not wake up',
      'never wake up',
    ]),
  },
  {
    category: 'self_harm',
    level: 'emergency',
    matcher: phraseMatcher([
      'skada mig sjalv',
      'skada mig',
      'gora illa mig',
      'gora mig illa',
      'sjalvskada',
      'sjalvskadar',
      'skara mig',
      'skar mig',
      'skurit mig',
      'ristat ~ armen',
      'branner mig sjalv',
      'hurt myself',
      'harm myself',
      'harming myself',
      'self harm',
      'selfharm',
      'cutting myself',
      'cut myself',
      // Deliberately not a bare "i cut": "i cut down to five a day" is somebody
      // reporting progress, and answering that with the emergency script is the
      // exact opposite of what the moment needs. The phrasings below carry the
      // meaning without swallowing the success story.
      'i cut last night',
      'i cut again',
      'i cut this morning',
      'burning myself',
    ]),
  },
  {
    category: 'overdose',
    level: 'emergency',
    matcher: phraseMatcher([
      'overdos',
      'overdosen',
      'overdose',
      'overdosed',
      'odat',
      'tagit for mycket',
      'tagit for manga',
      'tog for mycket',
      'tog for manga',
      'hela kartan',
      'hela burken',
      'hela forpackningen',
      'hela flaskan',
      'hela brickan',
      'svalt ~ tabletter',
      'svalde ~ tabletter',
      'atit ~ tabletter',
      'kakade ~ tabletter',
      'kakat ~ tabletter',
      'tagit ~ tabletter',
      'tog ~ tabletter',
      'kakade ~ stycken',
      'blandat ~ tabletter',
      'blandat sprit ~ tabletter',
      'blandade ~ tabletter',
      'blandat ~ benzo',
      'took too much',
      'took too many',
      'whole bottle',
      'whole pack',
      'whole packet',
      'whole box',
      'swallowed ~ pills',
      'swallowed ~ tablets',
      'took ~ pills',
      'mixed ~ pills',
      'mixed ~ benzos',
      'mixed booze ~ benzos',
      'handful of pills',
    ]),
  },
  {
    category: 'unresponsive_person',
    level: 'emergency',
    matcher: phraseMatcher([
      'andas inte',
      'andas ~ konstigt',
      'andas ~ knappt',
      'vaknar inte',
      'gar inte att vacka',
      'medvetslos',
      'far inte kontakt',
      'bla om lapparna',
      'kan inte vacka',
      'svarar inte',
      'reagerar inte',
      'helt borta',
      'not breathing',
      'breathing weird',
      'breathing funny',
      'wont wake up',
      'will not wake up',
      'cant wake ~ up',
      'cannot wake ~ up',
      'out cold',
      'unconscious',
      'unresponsive',
      'not responding',
      'turning blue',
      'blue lips',
    ]),
  },
  {
    category: 'severe_medical',
    level: 'emergency',
    matcher: phraseMatcher([
      'far inte luft',
      'far inte ~ luft',
      'kan inte andas',
      'svart att andas',
      'brostsmarta',
      'ont i brostet',
      'ont ~ brostkorgen',
      'trycker over brostet',
      'kraftig blodning',
      'blodningen ~ inte',
      'bloder ~ slutar inte',
      'bloder ~ inte slutar',
      'blodet slutar inte',
      'kraks blod',
      'krakts blod',
      'kraktes blod',
      'kaffesump',
      'cant breathe',
      'can not breathe',
      'cannot breathe',
      'cant catch my breath',
      'cannot catch my breath',
      'struggling to breathe',
      'chest pain',
      'pain in my chest',
      'heavy bleeding',
      'bleeding ~ wont stop',
      'wont stop bleeding',
      'vomiting blood',
      'coughing blood',
      'coffee grounds',
    ]),
  },
  {
    category: 'withdrawal_medical',
    level: 'emergency',
    matcher: phraseMatcher([
      'kramper',
      'krampanfall',
      'krampade',
      'krampat',
      'fick ett anfall',
      'epileptiskt anfall',
      'delirium',
      'delirium tremens',
      'skakar okontrollerat',
      'seizure',
      'seizures',
      'seizing',
      'had a fit',
      'convulsions',
      'convulsing',
      'the dts',
      'shaking uncontrollably',
    ]),
  },

  // ---- Needs a professional now, not necessarily an ambulance ----
  {
    category: 'psychosis',
    level: 'urgent',
    matcher: phraseMatcher([
      'hallucinerar',
      'ser saker som inte finns',
      'ser saker ~ inte finns',
      'hor roster',
      'hor ~ roster',
      'hor nagon ~ inte ar dar',
      'hor nagon prata ~ inte ar dar',
      'roster i huvudet',
      'paranoid',
      'kanner mig forfoljd',
      'nagon forfoljer mig',
      'nagon ~ forfoljer mig',
      'blir forfoljd',
      'de overvakar mig',
      'hallucinating',
      'hearing voices',
      'hearing someone ~ not there',
      'seeing things ~ not there',
      'being followed',
      'they are watching me',
      'psychosis',
      'psychotic',
    ]),
  },
  {
    category: 'violence',
    level: 'urgent',
    matcher: phraseMatcher([
      'skada nagon annan',
      'skada nagon',
      'gora nagon illa',
      'gor nagot dumt mot',
      'gora nagot dumt mot',
      'sla ihjal',
      'sla sonder honom',
      'sla sonder henne',
      'sla ner honom',
      'sla ner henne',
      'ge mig pa honom',
      'ge mig pa henne',
      'hurt someone',
      'hurt somebody',
      'hurt him',
      'hurt her',
      'hurt them',
      'i will hurt',
      'beat him up',
      'beat her up',
      'kill him',
      'kill her',
      'kill them',
      'kill someone',
    ]),
  },
  {
    category: 'cannot_stay_safe',
    level: 'urgent',
    matcher: phraseMatcher([
      'kan inte halla mig saker',
      'klarar inte att vara ensam',
      'vagar inte vara ensam',
      'vill inte vara ensam ikvall',
      'ska inte vara ensam',
      'inte trygg med mig sjalv',
      'litar inte pa mig sjalv',
      'litar inte riktigt pa mig sjalv',
      'cant keep myself safe',
      'can not keep myself safe',
      'cannot keep myself safe',
      'not safe alone',
      'cant be ~ my own',
      'cannot be ~ my own',
      'shouldnt be alone',
      'should not be alone',
      'dont trust myself',
      'do not trust myself',
    ]),
  },

  // ---- Worth flagging for a handoff conversation; coaching continues ----
  {
    category: 'withdrawal_medical',
    level: 'elevated',
    matcher: phraseMatcher([
      'abstinens',
      'skakningar',
      'kallsvettas',
      'svettas kallt',
      'hjartklappning',
      'withdrawal',
      'the shakes',
      'cold sweats',
      'racing heart',
      'tremors',
      // First-person, plain-language forms. Someone actually in withdrawal
      // writes "jag skakar", not the clinical noun "skakningar" — an earlier
      // version of this list only held the nouns and rated a textbook alcohol
      // withdrawal presentation as no risk at all. These will occasionally fire
      // on someone shaking with anger, which costs a handoff sentence they did
      // not need; missing the other case costs considerably more.
      'skakar',
      'jag skakar',
      'skakig',
      'jatteskakig',
      'skakiga hander',
      'handerna skakar',
      'hander ~ skakar',
      'svettas ~ mar illa',
      'kallsvettig',
      'darrar',
      'darrig',
      'huttrar',
      'im shaking',
      'i am shaking',
      'shaking',
      'shaky',
      'shaky hands',
      'hands ~ shaking',
      'hands wont stop shaking',
      'trembling',
      'sweating buckets',
      'heart is racing',
    ]),
  },
];

/**
 * Phrasings that are a goodbye about as often as they are a full stop on an
 * ordinary sentence. Not a rule — matching one changes nothing about the level
 * — only a signal that the next thing said should be a question.
 */
const ASK_DIRECTLY = phraseMatcher([
  'jag ar klar',
  'jag ar fardig',
  'det ar over nu',
  'det ar slut nu',
  'sista gangen jag skriver',
  'sista gangen ni hor',
  'tack for allt',
  'tack for att ni',
  'ta hand om',
  'sag till mamma',
  'sag till pappa',
  'sag till dem att',
  'skrivit ett brev till er',
  'hejda pa riktigt',
  'hej da pa riktigt',
  'im done',
  'i am done',
  'done with everything',
  'life is over',
  'thanks for everything',
  'look after ~ for me',
  'take care of ~ for me',
  'this is the last time i',
  'jag ger upp',
  'ge upp helt',
]);

/**
 * The same exhaustion words, but only when they stand alone.
 *
 * "Jag orkar inte träna idag" and "orkar inte" are the same two words carrying
 * entirely different weight, and what separates them is the object: give the
 * exhaustion something mundane to attach to and it is mundane. Leave it bare
 * and it is a fragment somebody typed at 2am.
 *
 * Measured, not guessed — these three patterns fired on three ordinary
 * sentences in the benign set ("orkar inte laga mat, blir pizza") until the
 * length gate went in, and on none afterwards.
 */
const ASK_DIRECTLY_IF_ALONE = phraseMatcher(['orkar inte', 'pallar inte', 'palla inte']);

/** Words in the message, at or below which a bare fragment reads as a fragment. */
const ALONE_WORD_LIMIT = 4;

function wantsADirectQuestion(text: string | undefined): boolean {
  if (!text) return false;
  const haystack = normalizeForMatching(text);
  if (ASK_DIRECTLY.test(haystack)) return true;
  const words = haystack.trim().split(/\s+/).filter(Boolean).length;
  return words <= ALONE_WORD_LIMIT && ASK_DIRECTLY_IF_ALONE.test(haystack);
}

const EMERGENCY_RESOURCES: Record<string, SafetyResource[]> = {
  SE: [
    { key: 'resource.se.emergency', contact: '112', kind: 'emergency' },
    { key: 'resource.se.health', contact: '1177', kind: 'health' },
    { key: 'resource.se.mind', contact: '90101', kind: 'crisis' },
    { key: 'resource.se.alcohol', contact: '020-84 44 48', kind: 'helpline' },
    { key: 'resource.se.gambling', contact: '020-81 91 00', kind: 'helpline' },
  ],
  US: [
    { key: 'resource.us.emergency', contact: '911', kind: 'emergency' },
    { key: 'resource.us.crisis', contact: '988', kind: 'crisis' },
    { key: 'resource.us.samhsa', contact: '1-800-662-4357', kind: 'helpline' },
  ],
  GB: [
    { key: 'resource.gb.emergency', contact: '999', kind: 'emergency' },
    { key: 'resource.gb.health', contact: '111', kind: 'health' },
    { key: 'resource.gb.samaritans', contact: '116 123', kind: 'crisis' },
  ],
};

const GENERIC_RESOURCES: SafetyResource[] = [
  { key: 'resource.generic.emergency', contact: '112 / 911', kind: 'emergency' },
  { key: 'resource.generic.local', contact: '', kind: 'crisis' },
];

export function emergencyResources(country?: string, level?: SafetyLevel): SafetyResource[] {
  const list = country
    ? (EMERGENCY_RESOURCES[country.toUpperCase()] ?? GENERIC_RESOURCES)
    : GENERIC_RESOURCES;
  if (level === 'emergency' || level == null) return list;

  // Below an emergency, the first number offered should be the one built for
  // the conversation the person is actually having. Someone saying they cannot
  // go on needs the crisis line, not an ambulance dispatcher — leading with 112
  // reads as an overreaction and makes the whole list easy to dismiss. The
  // emergency number stays on the list; it just stops being the headline.
  const rank = (resource: SafetyResource): number =>
    resource.kind === 'crisis' ? 0 : resource.kind === 'helpline' ? 1 : resource.kind === 'health' ? 2 : 3;
  return [...list].sort((a, b) => rank(a) - rank(b));
}

const LEVEL_RANK: Record<SafetyLevel, number> = {
  none: 0,
  elevated: 1,
  urgent: 2,
  emergency: 3,
};

function maxLevel(a: SafetyLevel, b: SafetyLevel): SafetyLevel {
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b;
}

/**
 * Classify a message for risk. Pure, synchronous, and always runs — including on
 * messages that are about to be sent to the language model.
 */
export function triage(input: TriageInput): TriageResult {
  const categories = new Set<SafetyCategory>();
  let level: SafetyLevel = 'none';

  if (input.text && input.text.trim().length > 0) {
    const haystack = normalizeForMatching(input.text);
    for (const rule of RULES) {
      if (rule.matcher.test(haystack)) {
        categories.add(rule.category);
        level = maxLevel(level, rule.level);
      }
    }
  }

  // The craving engine asks this outright. An explicit yes outranks any text.
  if (input.immediateDanger === true) {
    level = 'emergency';
    categories.add('cannot_stay_safe');
  }

  // Early abstinence from alcohol, benzodiazepines or other sedatives is the one
  // situation where stopping abruptly and alone is itself the medical danger —
  // the thing the person came here to do is the thing that could kill them.
  if (input.substance) {
    const profile = substanceProfile(input.substance);
    const hours = input.hoursSinceLastUse;
    const inAcuteWindow = hours != null && hours >= 0 && hours <= 96;
    if (profile.medicalDetoxAdvised && inAcuteWindow) {
      categories.add('withdrawal_medical');
      level = maxLevel(level, 'urgent');
    }

    // Symptoms outrank the timeline. Someone quitting alcohol who says they are
    // shaking needs a doctor whether or not the recorded plan puts them inside
    // the acute window — that record is self-reported and is wrong precisely
    // when it matters most, because an unlogged relapse resets a clock nobody
    // told us about. Reported symptoms escalate on their own.
    if (profile.medicalDetoxAdvised && categories.has('withdrawal_medical')) {
      level = maxLevel(level, 'urgent');
    }
  }

  return {
    level,
    categories: [...categories],
    resources: level === 'none' ? [] : emergencyResources(input.country, level),
    bypassCoach: level === 'emergency',
    messageKey: `safety.${level}`,
    // Not asked during an emergency: the fixed response is already the right
    // words, and "how do you mean?" is not what that moment needs.
    askDirectly: level !== 'emergency' && wantsADirectQuestion(input.text),
  };
}

/**
 * The handoff checklist from the product spec: situations where coaching is not
 * enough and the app has to say so plainly.
 */
export const PROFESSIONAL_HANDOFF_TRIGGERS = [
  'dangerous_withdrawal',
  'overdose_risk',
  'loss_of_consciousness',
  'serious_medical_symptoms',
  'suicidal_thoughts',
  'psychosis',
  'severe_confusion',
  'risk_of_violence',
  'unable_to_stay_safe',
  'repeated_serious_relapses',
  'needs_medical_detox',
  'needs_medication_treatment',
] as const;

export type ProfessionalHandoffTrigger = (typeof PROFESSIONAL_HANDOFF_TRIGGERS)[number];

export interface DetoxWarning {
  required: boolean;
  substance: SubstanceKind;
  risk: ReturnType<typeof substanceProfile>['withdrawalRisk'];
  messageKey: string;
}

/**
 * Whether starting (or continuing) this quit plan should lead with a medical
 * warning. Shown when the plan is created and again during the acute window.
 */
export function detoxWarning(substance: SubstanceKind): DetoxWarning {
  const profile = substanceProfile(substance);
  return {
    required: profile.medicalDetoxAdvised,
    substance,
    risk: profile.withdrawalRisk,
    messageKey: profile.medicalDetoxAdvised ? `safety.detox.${substance}` : 'safety.detox.none',
  };
}
