import type { SubstanceKind } from './types.js';

/**
 * How dangerous unsupervised withdrawal is for a given substance.
 *
 * This drives whether Cold Turkey is allowed to coach someone through stopping
 * at all, or must instead tell them plainly to get medical help first. It is
 * never softened for motivational reasons.
 */
export type WithdrawalRisk = 'low' | 'moderate' | 'high' | 'life_threatening';

export interface SubstanceProfile {
  kind: SubstanceKind;
  withdrawalRisk: WithdrawalRisk;
  /**
   * True when stopping abruptly without medical supervision can kill or cause
   * seizures. For these, the app must recommend professional detox up front —
   * "cold turkey" is the name of the product, not a medical instruction.
   */
  medicalDetoxAdvised: boolean;
  /** Overdose is a realistic acute danger for this substance. */
  overdoseRisk: boolean;
  /** Default minutes lost per unit — used for the Time Reclaimed estimate. */
  defaultMinutesPerUnit: number;
  /** Unit label translation key, e.g. a cigarette, a standard drink, a session. */
  unitKey: string;
  /**
   * Milestone timeline in hours since the last use. Keys resolve to text in
   * `@coldturkey/i18n`; the wording there is deliberately non-clinical and
   * describes what people commonly report rather than promising outcomes.
   */
  milestones: { hours: number; key: string }[];
}

const SHARED_TIME_MILESTONES: { hours: number; key: string }[] = [
  { hours: 24, key: 'milestone.shared.day1' },
  { hours: 72, key: 'milestone.shared.day3' },
  { hours: 168, key: 'milestone.shared.week1' },
  { hours: 336, key: 'milestone.shared.week2' },
  { hours: 720, key: 'milestone.shared.month1' },
  { hours: 2160, key: 'milestone.shared.month3' },
  { hours: 4320, key: 'milestone.shared.month6' },
  { hours: 8760, key: 'milestone.shared.year1' },
];

export const SUBSTANCE_PROFILES: Record<SubstanceKind, SubstanceProfile> = {
  alcohol: {
    kind: 'alcohol',
    withdrawalRisk: 'life_threatening',
    medicalDetoxAdvised: true,
    overdoseRisk: true,
    defaultMinutesPerUnit: 45,
    unitKey: 'unit.alcohol',
    milestones: [
      { hours: 12, key: 'milestone.alcohol.h12' },
      { hours: 72, key: 'milestone.alcohol.h72' },
      { hours: 168, key: 'milestone.alcohol.week1' },
      { hours: 720, key: 'milestone.alcohol.month1' },
      { hours: 2160, key: 'milestone.alcohol.month3' },
      { hours: 8760, key: 'milestone.alcohol.year1' },
    ],
  },
  benzodiazepines: {
    kind: 'benzodiazepines',
    withdrawalRisk: 'life_threatening',
    medicalDetoxAdvised: true,
    overdoseRisk: true,
    defaultMinutesPerUnit: 20,
    unitKey: 'unit.dose',
    milestones: SHARED_TIME_MILESTONES,
  },
  sedatives: {
    kind: 'sedatives',
    withdrawalRisk: 'life_threatening',
    medicalDetoxAdvised: true,
    overdoseRisk: true,
    defaultMinutesPerUnit: 20,
    unitKey: 'unit.dose',
    milestones: SHARED_TIME_MILESTONES,
  },
  opioids: {
    kind: 'opioids',
    withdrawalRisk: 'high',
    // Opioid withdrawal is rarely fatal in itself, but tolerance drops fast and
    // a return to the previous dose is a leading cause of fatal overdose.
    medicalDetoxAdvised: true,
    overdoseRisk: true,
    defaultMinutesPerUnit: 60,
    unitKey: 'unit.dose',
    milestones: [
      { hours: 12, key: 'milestone.opioids.h12' },
      { hours: 72, key: 'milestone.opioids.h72' },
      { hours: 168, key: 'milestone.opioids.week1' },
      { hours: 720, key: 'milestone.opioids.month1' },
      { hours: 2160, key: 'milestone.opioids.month3' },
      { hours: 8760, key: 'milestone.shared.year1' },
    ],
  },
  polysubstance: {
    kind: 'polysubstance',
    withdrawalRisk: 'life_threatening',
    medicalDetoxAdvised: true,
    overdoseRisk: true,
    defaultMinutesPerUnit: 60,
    unitKey: 'unit.dose',
    milestones: SHARED_TIME_MILESTONES,
  },
  stimulants: {
    kind: 'stimulants',
    withdrawalRisk: 'moderate',
    medicalDetoxAdvised: false,
    overdoseRisk: true,
    defaultMinutesPerUnit: 90,
    unitKey: 'unit.dose',
    milestones: [
      { hours: 72, key: 'milestone.stimulants.h72' },
      { hours: 168, key: 'milestone.stimulants.week1' },
      { hours: 720, key: 'milestone.stimulants.month1' },
      { hours: 2160, key: 'milestone.stimulants.month3' },
      { hours: 8760, key: 'milestone.shared.year1' },
    ],
  },
  cannabis: {
    kind: 'cannabis',
    withdrawalRisk: 'low',
    medicalDetoxAdvised: false,
    overdoseRisk: false,
    defaultMinutesPerUnit: 60,
    unitKey: 'unit.session',
    milestones: [
      { hours: 72, key: 'milestone.cannabis.h72' },
      { hours: 336, key: 'milestone.cannabis.week2' },
      { hours: 720, key: 'milestone.cannabis.month1' },
      { hours: 2160, key: 'milestone.cannabis.month3' },
      { hours: 8760, key: 'milestone.shared.year1' },
    ],
  },
  nicotine: {
    kind: 'nicotine',
    withdrawalRisk: 'low',
    medicalDetoxAdvised: false,
    overdoseRisk: false,
    defaultMinutesPerUnit: 7,
    unitKey: 'unit.nicotine',
    milestones: [
      { hours: 0.34, key: 'milestone.nicotine.min20' },
      { hours: 12, key: 'milestone.nicotine.h12' },
      { hours: 48, key: 'milestone.nicotine.h48' },
      { hours: 336, key: 'milestone.nicotine.week2' },
      { hours: 720, key: 'milestone.nicotine.month1' },
      { hours: 2160, key: 'milestone.nicotine.month3' },
      { hours: 8760, key: 'milestone.nicotine.year1' },
    ],
  },
  gambling: {
    kind: 'gambling',
    withdrawalRisk: 'low',
    medicalDetoxAdvised: false,
    overdoseRisk: false,
    defaultMinutesPerUnit: 120,
    unitKey: 'unit.session',
    milestones: [
      { hours: 72, key: 'milestone.gambling.h72' },
      { hours: 336, key: 'milestone.gambling.week2' },
      { hours: 720, key: 'milestone.gambling.month1' },
      { hours: 2160, key: 'milestone.gambling.month3' },
      { hours: 8760, key: 'milestone.shared.year1' },
    ],
  },
  other_behaviour: {
    kind: 'other_behaviour',
    withdrawalRisk: 'low',
    medicalDetoxAdvised: false,
    overdoseRisk: false,
    defaultMinutesPerUnit: 60,
    unitKey: 'unit.session',
    milestones: SHARED_TIME_MILESTONES,
  },
};

export function substanceProfile(kind: SubstanceKind): SubstanceProfile {
  return SUBSTANCE_PROFILES[kind];
}

/**
 * Substances where the app must lead with "get medical help before you stop"
 * rather than with encouragement.
 */
export function requiresMedicalDetoxWarning(kind: SubstanceKind): boolean {
  return SUBSTANCE_PROFILES[kind].medicalDetoxAdvised;
}
