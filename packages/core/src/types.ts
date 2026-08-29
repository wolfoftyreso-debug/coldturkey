import type { IntakeForm } from './substances.js';
/**
 * Shared domain types for Cleat.
 *
 * Everything in this package is pure: no I/O, no clock reads that are not passed
 * in explicitly. Callers hand in `now` so the same functions can be used on the
 * server, in the browser and in tests without drift.
 */

export type Locale = 'sv' | 'en';

/**
 * Substances and compulsive behaviours the coach can be configured for.
 * The risk profile differs sharply between these — see `substances.ts`.
 */
export type SubstanceKind =
  | 'alcohol'
  | 'nicotine'
  | 'cannabis'
  | 'opioids'
  | 'stimulants'
  | 'benzodiazepines'
  | 'sedatives'
  | 'polysubstance'
  | 'gambling'
  | 'other_behaviour';

/**
 * Recovery is modelled as a dynamic state, not a ladder. A person can move
 * forward, stall, fall back, and start again — the phase is a description of
 * where they are right now, never a score.
 */
export type RecoveryPhase =
  | 'insight'
  | 'decision'
  | 'preparation'
  | 'day_zero'
  | 'acute'
  | 'stabilization'
  | 'identity'
  | 'relapse_prevention';

export type CravingFeeling =
  | 'craving'
  | 'panic'
  | 'loneliness'
  | 'anger'
  | 'stress'
  | 'boredom'
  | 'grief'
  | 'pain'
  | 'social_pressure'
  | 'other';

/**
 * Where somebody was when the craving arrived.
 *
 * The first list was written for drinking and drugs: a party, people who are
 * using, being alone. Those are real, and they are also not where a smoker's
 * day happens. The break outside the door, the cigarette after eating, the one
 * with the coffee — those are the moments, and "at work" told nobody anything
 * they could act on.
 *
 * Drinking is on the list twice over: it is the single most reliable way to
 * lose a night's abstinence from nicotine, and the reverse is true too.
 */
export type CravingLocation =
  | 'home'
  | 'work'
  | 'on_a_break'
  | 'after_meal'
  | 'with_coffee'
  | 'after_drinking'
  | 'party'
  | 'with_users'
  | 'alone'
  | 'in_transit'
  | 'other';

export type CravingOutcome = 'resisted' | 'used' | 'unknown';

export type CheckInKind = 'morning' | 'evening';

export interface QuitPlan {
  id: string;
  substance: SubstanceKind;
  /** When the person stopped. Day 0 is this instant. */
  startedAt: Date;
  /** Typical consumption before quitting, in units per day. */
  baselineUnitsPerDay: number;
  /** Cost of one unit, in minor currency units (öre, cents). */
  unitCostMinor: number;
  currency: string;
  /**
   * Minutes the habit consumed per unit — not just using, but acquiring,
   * recovering, hiding and dealing with consequences. Defaults per substance.
   */
  minutesPerUnit: number;
  /**
   * Nicotine only, and null for every plan made before the question existed.
   * Decides whether the milestones about lungs and carbon monoxide apply —
   * see `computeMilestones`.
   */
  intakeForm: IntakeForm | null;
  status: 'active' | 'paused' | 'archived';
}

export interface RelapseEvent {
  id: string;
  quitId: string;
  occurredAt: Date;
  note?: string | null;
  autopsy?: RelapseAutopsy | null;
}

/**
 * A relapse is treated as a system failure to analyse, never a character flaw.
 * The autopsy exists to produce a better protection plan, not a verdict.
 */
export interface RelapseAutopsy {
  whatHappened?: string;
  chainStartedAt?: string;
  firstTrigger?: string;
  thought?: string;
  feeling?: string;
  decision?: string;
  ignoredWarnings?: string;
  peoplePresent?: string;
  whatCouldHaveBrokenTheChain?: string;
  whatChangesNow?: string;
}

export interface CheckIn {
  id: string;
  kind: CheckInKind;
  /** Local calendar day, `YYYY-MM-DD`. */
  day: string;
  createdAt: Date;
  /** All 0–10 scales. Higher is more of the named thing. */
  mood?: number | null;
  sleepQuality?: number | null;
  stress?: number | null;
  cravingIntensity?: number | null;
  biggestRisk?: string | null;
  wentWell?: string | null;
  wasHard?: string | null;
  learned?: string | null;
  note?: string | null;
}

export interface CravingLog {
  id: string;
  occurredAt: Date;
  /** 0–10. */
  intensity: number;
  feeling: CravingFeeling;
  location: CravingLocation;
  trigger?: string | null;
  thought?: string | null;
  actionTaken?: string | null;
  outcome: CravingOutcome;
  note?: string | null;
}

export interface SupportContact {
  id: string;
  name: string;
  relation: string;
  phone?: string | null;
  isPrimary: boolean;
}

export interface RecoveryProfile {
  whyStatement?: string | null;
  futureSelf?: {
    days30?: string;
    days90?: string;
    year1?: string;
    year5?: string;
    letter?: string;
  } | null;
  phase: RecoveryPhase;
  timezone: string;
  /** ISO-3166 alpha-2, used to pick the right emergency resources. */
  country: string;
}

/**
 * The full picture the pure functions operate on. Assembled by the API from the
 * database, or by a client from its local cache.
 */
export interface RecoverySnapshot {
  profile: RecoveryProfile;
  quit: QuitPlan | null;
  relapses: RelapseEvent[];
  checkIns: CheckIn[];
  cravings: CravingLog[];
  supportContacts: SupportContact[];
}

/** A translation key plus its interpolation values. Rendering lives in `@cleat/i18n`. */
export interface Localized {
  key: string;
  params?: Record<string, string | number>;
}
