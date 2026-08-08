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
}

interface Rule {
  category: SafetyCategory;
  level: SafetyLevel;
  matcher: RegExp;
}

const RULES: Rule[] = [
  // ---- Immediate danger to life ----
  {
    category: 'suicide',
    level: 'emergency',
    matcher: phraseMatcher([
      'ta mitt liv',
      'ta sitt liv',
      'ta livet av mig',
      'vill inte leva',
      'vill do',
      'orkar inte leva',
      'orkar inte mer',
      'sjalvmord',
      'sluta finnas',
      'inte vakna igen',
      'kill myself',
      'end my life',
      'end it all',
      'want to die',
      'dont want to live',
      'do not want to live',
      'suicidal',
      'suicide',
    ]),
  },
  {
    category: 'self_harm',
    level: 'emergency',
    matcher: phraseMatcher([
      'skada mig sjalv',
      'sjalvskada',
      'skara mig',
      'hurt myself',
      'harm myself',
      'self harm',
      'cutting myself',
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
      'took too much',
      'took too many',
      'whole bottle',
      'whole pack',
    ]),
  },
  {
    category: 'unresponsive_person',
    level: 'emergency',
    matcher: phraseMatcher([
      'andas inte',
      'vaknar inte',
      'medvetslos',
      'far inte kontakt',
      'bla om lapparna',
      'kan inte vacka',
      'not breathing',
      'wont wake up',
      'will not wake up',
      'unconscious',
      'unresponsive',
      'turning blue',
      'blue lips',
    ]),
  },
  {
    category: 'severe_medical',
    level: 'emergency',
    matcher: phraseMatcher([
      'far inte luft',
      'kan inte andas',
      'brostsmarta',
      'kraftig blodning',
      'kraks blod',
      'cant breathe',
      'can not breathe',
      'chest pain',
      'heavy bleeding',
      'vomiting blood',
      'coughing blood',
    ]),
  },
  {
    category: 'withdrawal_medical',
    level: 'emergency',
    matcher: phraseMatcher([
      'kramper',
      'krampanfall',
      'epileptiskt anfall',
      'delirium',
      'delirium tremens',
      'skakar okontrollerat',
      'seizure',
      'seizures',
      'convulsions',
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
      'hor roster',
      'roster i huvudet',
      'paranoid',
      'kanner mig forfoljd',
      'hallucinating',
      'hearing voices',
      'psychosis',
      'psychotic',
    ]),
  },
  {
    category: 'violence',
    level: 'urgent',
    matcher: phraseMatcher([
      'skada nagon annan',
      'gora nagon illa',
      'sla ihjal',
      'hurt someone',
      'hurt somebody',
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
      'inte trygg med mig sjalv',
      'litar inte pa mig sjalv',
      'cant keep myself safe',
      'can not keep myself safe',
      'not safe alone',
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
    ]),
  },
];

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

export function emergencyResources(country?: string): SafetyResource[] {
  if (!country) return GENERIC_RESOURCES;
  return EMERGENCY_RESOURCES[country.toUpperCase()] ?? GENERIC_RESOURCES;
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
  // situation where stopping abruptly and alone is itself the medical danger.
  // Cold Turkey is the name of the product, not a medical instruction.
  if (input.substance) {
    const profile = substanceProfile(input.substance);
    const hours = input.hoursSinceLastUse;
    const inAcuteWindow = hours != null && hours >= 0 && hours <= 96;
    if (profile.medicalDetoxAdvised && inAcuteWindow) {
      categories.add('withdrawal_medical');
      level = maxLevel(level, 'urgent');
    }
  }

  return {
    level,
    categories: [...categories],
    resources: level === 'none' ? [] : emergencyResources(input.country),
    bypassCoach: level === 'emergency',
    messageKey: `safety.${level}`,
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
