import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { substanceProfile } from '@cleat/core';
import { translate } from '@cleat/i18n';

/**
 * Where the app and the public page have to agree.
 *
 * `/sluta-roka` answers the most-searched question about quitting anything —
 * what happens in the body, and when — and then the app answers it again, to
 * the same person, once they have signed up. It used to answer it differently:
 * the page said the risk of a heart attack is halved after a year, the app
 * said it had "dropped markedly". A person who reads the honest number and
 * then meets the vague one has been given a reason to distrust both.
 *
 * They now render the same array through the same catalogue. This file is the
 * thing that notices if somebody hand-writes a timeline back into the page.
 */
const nicotine = substanceProfile('nicotine');
const page = readFileSync(
  join(import.meta.dirname, '../app/sluta-roka/page.tsx'),
  'utf8',
);

describe('the quit-smoking page and the app tell the same story', () => {
  it('renders the product’s own milestones rather than its own copy', () => {
    expect(page).toContain("substanceProfile('nicotine').milestones");
    // A hand-typed Swedish timeline creeping back in is exactly the failure
    // this guards. The rows come from the catalogue or they do not exist.
    expect(page).toContain('translate(LOCALE, row.key)');
  });

  it('shows the source beside every claim it makes about a body', () => {
    expect(page).toContain('Källa: {row.source}');
    for (const milestone of nicotine.milestones) {
      expect(milestone.source, milestone.key).toBeTruthy();
    }
  });

  it('has copy in both languages for every milestone, in both catalogues', () => {
    for (const milestone of nicotine.milestones) {
      for (const locale of ['sv', 'en'] as const) {
        const text = translate(locale, milestone.key);
        expect(text, `${locale} ${milestone.key}`).not.toBe(milestone.key);
        expect(text.length, `${locale} ${milestone.key}`).toBeGreaterThan(20);
      }
    }
  });

  it('gives the one-year figure as halved, in both languages', () => {
    // The exact sentence the divergence was about.
    expect(translate('sv', 'milestone.nicotine.year1')).toContain('halverad');
    expect(translate('en', 'milestone.nicotine.year1')).toContain('half');
  });

  it('tells somebody on day one that the worst of it is normal', () => {
    // Day one is when people quit quitting. The milestone that lands then has
    // to name what is happening rather than congratulate.
    const text = translate('sv', 'milestone.nicotine.h24');
    expect(text).toContain('tyngst');
    expect(text).toContain('inte att något gått fel');
  });

  it('promises nothing about anybody’s chances, anywhere in the copy', () => {
    // The standing constraint: never guarantee that somebody will not relapse.
    for (const milestone of nicotine.milestones) {
      for (const locale of ['sv', 'en'] as const) {
        const text = translate(locale, milestone.key).toLowerCase();
        for (const forbidden of ['garanter', 'guarantee', 'aldrig igen', 'never again']) {
          expect(text, `${locale} ${milestone.key}`).not.toContain(forbidden);
        }
      }
    }
  });

  it('still carries the page’s own honest framing around the sourced rows', () => {
    // The timeline is the sourced half. The paragraph next to it — that the
    // first week does not feel like a list of benefits — is the page's own,
    // and is the reason the page is not just a rewrite of an NHS leaflet.
    expect(page).toContain('Det som inte står på tidslinjen');
    expect(page).toContain('vi är inte läkare');
  });
});

describe('the plan form asks for what a smoker actually knows', () => {
  const plan = readFileSync(join(import.meta.dirname, '../app/plan/page.tsx'), 'utf8');

  it('names the unit in the label instead of an empty gap', () => {
    // The label used to be produced by `t('onboarding.cost').replace('{unit}',
    // '')`, which rendered the literal Swedish "Ungefär vad kostade ett ?" —
    // a broken sentence with a dangling article, on the first screen of the
    // product, for every substance.
    expect(plan).not.toContain("replace('{unit}', '')");
    expect(plan).toContain("t('onboarding.unitsPerDay', { unit: unitLabel })");
  });

  it('switches to pack pricing from the substance profile, not a hardcoded check', () => {
    expect(plan).toContain('substanceProfile(substance).costBasis');
    expect(plan).toContain("t('onboarding.purchaseCost', { purchase: purchaseLabel })");
    // No `substance === 'nicotine'` anywhere: the data decides.
    expect(plan).not.toContain("substance === 'nicotine'");
  });

  it('has copy for every interpolation the form performs', () => {
    for (const locale of ['sv', 'en'] as const) {
      for (const key of [
        'onboarding.unitsPerDay',
        'onboarding.cost',
        'onboarding.purchaseCost',
        'onboarding.purchaseSize',
        'purchase.pack',
      ]) {
        expect(translate(locale, key), `${locale} ${key}`).not.toBe(key);
      }
      // And the placeholders are actually filled, never left showing.
      expect(translate(locale, 'onboarding.purchaseCost', { purchase: 'x' })).not.toContain('{');
      expect(translate(locale, 'onboarding.unitsPerDay', { unit: 'x' })).not.toContain('{');
    }
  });
});
