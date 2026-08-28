import type { SubstanceKind } from './types.js';

/**
 * How dangerous unsupervised withdrawal is for a given substance.
 *
 * This drives whether Cleat is allowed to coach someone through stopping
 * at all, or must instead tell them plainly to get medical help first. It is
 * never softened for motivational reasons.
 */
export type WithdrawalRisk = 'low' | 'moderate' | 'high' | 'life_threatening';

export interface SubstanceProfile {
  kind: SubstanceKind;
  withdrawalRisk: WithdrawalRisk;
  /**
   * True when stopping abruptly without medical supervision can kill or cause
   * seizures. For these the app must recommend professional detox up front, and
   * must never present quitting abruptly as the brave or preferable option.
   */
  medicalDetoxAdvised: boolean;
  /** Overdose is a realistic acute danger for this substance. */
  overdoseRisk: boolean;
  /** Default minutes lost per unit — used for the Time Reclaimed estimate. */
  defaultMinutesPerUnit: number;
  /** Unit label translation key, e.g. a cigarette, a standard drink, a session. */
  unitKey: string;
  /**
   * What the person actually buys, when that is not one unit.
   *
   * Nobody knows what one cigarette costs. They know the pack price. Asking
   * for the per-unit figure gets either a wrong number or an abandoned form,
   * and the money this product gives back is one of the few things that keeps
   * somebody opening it in week three.
   */
  costBasis: CostBasis;
  /**
   * Milestone timeline in hours since the last use. Keys resolve to text in
   * `@cleat/i18n`; the wording there is deliberately non-clinical and
   * describes what people commonly report rather than promising outcomes.
   */
  milestones: SubstanceMilestone[];
}

/**
 * Where a milestone's claim comes from, when it is a physiological one.
 *
 * Most milestones in this file describe what people commonly report, and
 * those carry no source because there is nothing to cite — "the cough has
 * usually settled" is an observation, not a finding. Nicotine is different:
 * the timeline for stopping smoking is established public-health data, people
 * search for it by the number, and this product must never assert a fact about
 * somebody's body as though it established it. So the ones that come from a
 * body carry that body, and every surface that shows the milestone shows the
 * source with it.
 */
export type MilestoneSource = 'NHS' | 'CDC' | '1177';

/**
 * How somebody takes nicotine.
 *
 * Only nicotine needs this, and only because the sourced timeline for
 * stopping smoking is about lungs and carbon monoxide. Somebody quitting snus
 * in Sweden may never have lit anything, and telling them their lung function
 * has improved is not encouragement that misses — it is a false claim about
 * their body.
 */
export type IntakeForm = 'smoked' | 'oral' | 'both';

export interface CostBasis {
  /** Units in one purchase. 1 when people buy them one at a time. */
  unitsPerPurchase: number;
  /** Translation key for the thing bought — a pack, a bottle, a single unit. */
  purchaseKey: string;
}

export interface SubstanceMilestone {
  hours: number;
  key: string;
  source?: MilestoneSource;
  /**
   * Present when the claim only holds for somebody who took it this way.
   * Absent means it holds regardless — which is the safe default, and the one
   * anybody who was never asked receives.
   */
  intake?: 'smoked';
}

const SHARED_TIME_MILESTONES: SubstanceMilestone[] = [
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
    costBasis: { unitsPerPurchase: 1, purchaseKey: 'unit.alcohol' },
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
    costBasis: { unitsPerPurchase: 1, purchaseKey: 'unit.dose' },
    milestones: SHARED_TIME_MILESTONES,
  },
  sedatives: {
    kind: 'sedatives',
    withdrawalRisk: 'life_threatening',
    medicalDetoxAdvised: true,
    overdoseRisk: true,
    defaultMinutesPerUnit: 20,
    unitKey: 'unit.dose',
    costBasis: { unitsPerPurchase: 1, purchaseKey: 'unit.dose' },
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
    costBasis: { unitsPerPurchase: 1, purchaseKey: 'unit.dose' },
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
    costBasis: { unitsPerPurchase: 1, purchaseKey: 'unit.dose' },
    milestones: SHARED_TIME_MILESTONES,
  },
  stimulants: {
    kind: 'stimulants',
    withdrawalRisk: 'moderate',
    medicalDetoxAdvised: false,
    overdoseRisk: true,
    defaultMinutesPerUnit: 90,
    unitKey: 'unit.dose',
    costBasis: { unitsPerPurchase: 1, purchaseKey: 'unit.dose' },
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
    costBasis: { unitsPerPurchase: 1, purchaseKey: 'unit.session' },
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
    // A pack of twenty is what a Swedish smoker actually buys.
    costBasis: { unitsPerPurchase: 20, purchaseKey: 'purchase.pack' },
    /**
     * The one timeline in this file taken from published public-health data
     * rather than from what people report, and the reason is that it is the
     * single most-searched question about quitting anything: what happens in
     * the body, and when.
     *
     * Sourced from NHS Better Health and the CDC, attributed per row. The
     * public page at /sluta-roka renders this same array — it used to carry
     * its own copy, and the two had already drifted apart: the page said the
     * risk of a heart attack is halved at one year, the app said it had
     * "dropped markedly". Somebody who reads the page and then opens the app
     * should meet the same number, not a softer one.
     *
     * It also runs past a year, which nothing else here does. At eighteen
     * months a person needs to be told they are still winning something, and
     * the stroke figure is the honest thing to tell them.
     */
    milestones: [
      { hours: 0.34, key: 'milestone.nicotine.min20', source: 'NHS', intake: 'smoked' },
      { hours: 12, key: 'milestone.nicotine.h12', source: 'CDC', intake: 'smoked' },
      // Nicotine leaves the blood the same way whichever route it arrived by,
      // and the first day is the hardest either way. Everybody gets this one.
      { hours: 24, key: 'milestone.nicotine.h24', source: 'CDC' },
      { hours: 48, key: 'milestone.nicotine.h48', source: 'NHS', intake: 'smoked' },
      // Craving waves and the shape of withdrawal are about nicotine, not about
      // lungs. 1177, the Swedish regions' joint health service, is the source
      // that covers snus — and the only public one that does. Everything the
      // web offers beyond this about quitting snus is published by companies
      // that sell snus or sell the patches, which is not a source this product
      // will build a claim on.
      { hours: 72, key: 'milestone.nicotine.h72', source: '1177' },
      { hours: 336, key: 'milestone.nicotine.week2', source: 'CDC', intake: 'smoked' },
      { hours: 504, key: 'milestone.nicotine.week3', source: '1177' },
      // One month sits inside the CDC's "2 weeks to 3 months" band rather than
      // being a finding of its own. It stays because a month is the first
      // number most people say out loud, and dropping it would leave a
      // ten-week hole in exactly the stretch where somebody needs evidence
      // that time is still buying them something.
      { hours: 720, key: 'milestone.nicotine.month1', source: 'CDC', intake: 'smoked' },
      { hours: 2016, key: 'milestone.nicotine.week12', source: 'NHS', intake: 'smoked' },
      { hours: 8760, key: 'milestone.nicotine.year1', source: 'NHS', intake: 'smoked' },
      { hours: 43_800, key: 'milestone.nicotine.year5', source: 'CDC', intake: 'smoked' },
      { hours: 131_400, key: 'milestone.nicotine.year15', source: 'CDC', intake: 'smoked' },
    ],
  },
  gambling: {
    kind: 'gambling',
    withdrawalRisk: 'low',
    medicalDetoxAdvised: false,
    overdoseRisk: false,
    defaultMinutesPerUnit: 120,
    unitKey: 'unit.session',
    costBasis: { unitsPerPurchase: 1, purchaseKey: 'unit.session' },
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
    costBasis: { unitsPerPurchase: 1, purchaseKey: 'unit.session' },
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
