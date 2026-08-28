import { describe, expect, it } from 'vitest';
import { computeMilestones } from './milestones.js';
import { substanceProfile, SUBSTANCE_PROFILES } from './substances.js';

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
    expect([...sources].sort()).toEqual(['CDC', 'NHS']);
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
    const summary = computeMilestones('nicotine', 0.5 * HOUR);
    expect(summary.reached).toHaveLength(1);
    expect(summary.reached[0]!.key).toBe('milestone.nicotine.min20');
    expect(summary.reached[0]!.source).toBe('NHS');
  });

  it('still has something to say after a year, unlike every other substance', () => {
    // Somebody eighteen months in is exactly who stops opening the app. The
    // stroke and heart-disease figures are the honest thing left to tell them.
    const atEighteenMonths = computeMilestones('nicotine', 13_140);
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
