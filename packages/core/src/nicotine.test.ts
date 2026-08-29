import { describe, expect, it } from 'vitest';
import { computeMilestones } from './milestones.js';
import {
  costBasisFor,
  substanceProfile,
  SUBSTANCE_PROFILES,
  unitKeyFor,
} from './substances.js';

/**
 * The nicotine timeline, as data.
 *
 * The wording lives in `@cleat/i18n`, which this package deliberately does not
 * depend on — core is the engine and knows nothing about language. The
 * assertions about what the copy actually says are in `apps/web`, which is the
 * one place that holds both halves and renders them side by side.
 *
 *
 * It is the one timeline in this product taken from published public-health
 * data rather than from what people report, because it is the single
 * most-searched question about quitting anything — what happens in the body,
 * and when — and because both the app and the public page answer it. They used
 * to answer it differently. These tests exist so that they cannot again.
 */
const HOUR = 1;
const nicotine = substanceProfile('nicotine');

describe('the nicotine milestones', () => {
  it('attributes every claim about a body to the body that established it', () => {
    // The product must never assert a fact about somebody's health as though
    // it worked it out itself. Every nicotine milestone is physiological, so
    // every one of them carries a source.
    const unsourced = nicotine.milestones.filter((m) => !m.source);
    expect(unsourced.map((m) => m.key)).toEqual([]);
  });

  it('cites only the sources the copy actually names', () => {
    const sources = new Set(nicotine.milestones.map((m) => m.source));
    expect([...sources].sort()).toEqual(['1177', 'CDC', 'NHS']);
  });

  it('runs in order, with no two entries within a day of each other', () => {
    // Two milestones six days apart is one milestone and a duplicate. The
    // ladder only works if each rung is a genuinely new thing to be told.
    const hours = nicotine.milestones.map((m) => m.hours);
    expect(hours).toEqual([...hours].sort((a, b) => a - b));
    for (let i = 1; i < hours.length; i += 1) {
      expect(hours[i]! - hours[i - 1]!, `gap before ${nicotine.milestones[i]!.key}`).toBeGreaterThan(
        11,
      );
    }
  });

  it('gives somebody something within the first hour', () => {
    // The whole argument for a front-loaded ladder: on day zero a person needs
    // evidence that something is already happening, and twenty minutes is the
    // first honest thing there is to say.
    // A smoker: the twenty-minute marker is about carbon monoxide, so it is
    // one of the claims that only holds for somebody who lit something.
    const summary = computeMilestones('nicotine', 0.5 * HOUR, 'smoked');
    expect(summary.reached).toHaveLength(1);
    expect(summary.reached[0]!.key).toBe('milestone.nicotine.min20');
    expect(summary.reached[0]!.source).toBe('NHS');
  });

  it('still has something to say after a year, unlike every other substance', () => {
    // Somebody eighteen months in is exactly who stops opening the app. The
    // stroke and heart-disease figures are the honest thing left to tell them.
    const atEighteenMonths = computeMilestones('nicotine', 13_140, 'smoked');
    expect(atEighteenMonths.next).not.toBeNull();
    expect(atEighteenMonths.next!.key).toBe('milestone.nicotine.year5');

    const others = Object.values(SUBSTANCE_PROFILES).filter((p) => p.kind !== 'nicotine');
    for (const profile of others) {
      const last = profile.milestones[profile.milestones.length - 1]!;
      expect(last.hours, `${profile.kind} stops at a year`).toBeLessThanOrEqual(8760);
    }
  });

  it('never leaves a gap longer than a year between rungs', () => {
    const hours = [0, ...nicotine.milestones.map((m) => m.hours)];
    for (let i = 1; i < hours.length - 2; i += 1) {
      // Checked up to the one-year mark; beyond that the intervals are the
      // data's, not ours to choose.
      if (hours[i]! > 8760) break;
      expect(hours[i]! - hours[i - 1]!, 'gap in the first year').toBeLessThanOrEqual(8760);
    }
  });

  it('is not treated as needing medical detox, unlike alcohol', () => {
    // The clinically important difference, and the reason the two pages read
    // so differently: stopping nicotine abruptly is unpleasant, not dangerous.
    expect(nicotine.medicalDetoxAdvised).toBe(false);
    expect(nicotine.withdrawalRisk).toBe('low');
    expect(substanceProfile('alcohol').medicalDetoxAdvised).toBe(true);
  });
});

describe('what the app asks a smoker to type', () => {
  it('prices cigarettes by the pack, not one at a time', () => {
    // Nobody knows what one cigarette costs. Asking for it gets a wrong number
    // or an abandoned form, and the money figure is one of the few things that
    // keeps somebody opening the app in week three.
    expect(nicotine.costBasis.unitsPerPurchase).toBe(20);
    expect(nicotine.costBasis.purchaseKey).toBe('purchase.pack');
  });

  it('leaves every other substance priced per unit', () => {
    // A bottle of wine is not a unit of alcohol and a pack is not a dose. Only
    // cigarettes have a purchase size that everybody already knows.
    for (const profile of Object.values(SUBSTANCE_PROFILES)) {
      if (profile.kind === 'nicotine') continue;
      expect(profile.costBasis.unitsPerPurchase, profile.kind).toBe(1);
      expect(profile.costBasis.purchaseKey, profile.kind).toBe(profile.unitKey);
    }
  });

  it('turns a Swedish pack price into a sane per-cigarette cost', () => {
    // 20 a day, 75 kr a pack: the arithmetic the form does before it posts.
    const perUnitMinor = Math.round((75 * 100) / nicotine.costBasis.unitsPerPurchase);
    expect(perUnitMinor).toBe(375);
    // Which is what a pack a day actually costs over a year, to the krona.
    expect(Math.round((perUnitMinor * 20 * 365) / 100)).toBe(27_375);
  });

  it('counts seven minutes a cigarette, so a pack a day is over two hours', () => {
    expect(nicotine.defaultMinutesPerUnit).toBe(7);
    expect(nicotine.defaultMinutesPerUnit * 20).toBeGreaterThan(120);
  });
});

/**
 * Snus.
 *
 * Cleat models nicotine as one substance and that is right — the dependence,
 * the craving waves and the withdrawal are the same. What is not the same is
 * the body. The sourced timeline for stopping smoking is about lungs, carbon
 * monoxide and cardiovascular risk, and this is Sweden: a large share of the
 * people this product is for have never lit anything.
 *
 * Telling one of them that their lung function has improved is not
 * encouragement that misses. It is a false claim about their body, from a
 * product whose entire argument is that it does not make those.
 */
describe('somebody quitting snus', () => {
  const lungClaims = [
    'milestone.nicotine.min20',
    'milestone.nicotine.h12',
    'milestone.nicotine.h48',
    'milestone.nicotine.week2',
    'milestone.nicotine.month1',
    'milestone.nicotine.week12',
    'milestone.nicotine.year1',
    'milestone.nicotine.year5',
    'milestone.nicotine.year15',
  ];

  /** Every milestone the ladder would ever reach, at any streak length. */
  function everything(intake: 'smoked' | 'oral' | 'both' | null) {
    return computeMilestones('nicotine', 1_000_000, intake).reached.map((m) => m.key);
  }

  it('is never told anything about lungs or carbon monoxide', () => {
    const keys = everything('oral');
    for (const claim of lungClaims) {
      expect(keys, claim).not.toContain(claim);
    }
  });

  it('still gets the milestones that are about nicotine rather than lungs', () => {
    expect(everything('oral')).toEqual([
      'milestone.nicotine.h24',
      'milestone.nicotine.h72',
      'milestone.nicotine.week3',
    ]);
  });

  it('gets something in the first day, when it is hardest', () => {
    const dayone = computeMilestones('nicotine', 25, 'oral');
    expect(dayone.reached.map((m) => m.key)).toEqual(['milestone.nicotine.h24']);
  });

  it('sources the ones it does get from a public health service, not a shop', () => {
    // Everything published about quitting snus beyond this comes from
    // companies that sell snus or sell the patches. 1177 is the Swedish
    // regions' joint health service and is the only public source that covers
    // it — so the claims stop where 1177 stops.
    const sources = computeMilestones('nicotine', 1_000_000, 'oral').reached.map((m) => m.source);
    expect(sources).toEqual(['CDC', '1177', '1177']);
  });

  it('gives somebody who does both the full smoking ladder', () => {
    // The stronger claim set applies: they have smoked.
    expect(everything('both')).toEqual(everything('smoked'));
    expect(everything('both')).toContain('milestone.nicotine.year1');
  });

  it('treats an unanswered question as snus, not as smoking', () => {
    // Every plan made before the question existed, and everybody who skips it.
    // The safe subset is the one that cannot be wrong about a body.
    expect(everything(null)).toEqual(everything('oral'));
    expect(everything(undefined as unknown as null)).toEqual(everything('oral'));
  });

  it('leaves every other substance unaffected by intake', () => {
    for (const kind of ['alcohol', 'cannabis', 'gambling'] as const) {
      const withIntake = computeMilestones(kind, 1_000_000, 'oral').reached.map((m) => m.key);
      const without = computeMilestones(kind, 1_000_000).reached.map((m) => m.key);
      expect(withIntake, kind).toEqual(without);
    }
  });
});

describe('once the app knows how somebody takes it', () => {
  it('asks a smoker about cigarettes and a snusare about prillor', () => {
    // `unit.nicotine` is "cigarett/prilla" — the compromise a product makes
    // when it cannot ask. It can ask now.
    expect(unitKeyFor('nicotine', 'smoked')).toBe('unit.nicotine.smoked');
    expect(unitKeyFor('nicotine', 'oral')).toBe('unit.nicotine.oral');
  });

  it('keeps the slash for somebody who does both, and for somebody unasked', () => {
    expect(unitKeyFor('nicotine', 'both')).toBe('unit.nicotine');
    expect(unitKeyFor('nicotine', null)).toBe('unit.nicotine');
    expect(unitKeyFor('nicotine')).toBe('unit.nicotine');
  });

  it('prices snus by the can and cigarettes by the pack', () => {
    expect(costBasisFor('nicotine', 'oral')).toEqual({
      unitsPerPurchase: 24,
      purchaseKey: 'purchase.can',
    });
    expect(costBasisFor('nicotine', 'smoked').unitsPerPurchase).toBe(20);
  });

  it('turns a can price into a sane per-portion cost', () => {
    // A can at 55 kr: about 2.29 kr a prilla, and a can a day is 20 075 kr a
    // year. The arithmetic the form does before it posts.
    const perUnitMinor = Math.round((55 * 100) / costBasisFor('nicotine', 'oral').unitsPerPurchase);
    expect(perUnitMinor).toBe(229);
    expect(Math.round((perUnitMinor * 24 * 365) / 100)).toBe(20_060);
  });

  it('leaves every other substance alone', () => {
    for (const kind of ['alcohol', 'cannabis', 'gambling'] as const) {
      expect(unitKeyFor(kind, 'oral')).toBe(SUBSTANCE_PROFILES[kind].unitKey);
      expect(costBasisFor(kind, 'oral')).toEqual(SUBSTANCE_PROFILES[kind].costBasis);
    }
  });
});
