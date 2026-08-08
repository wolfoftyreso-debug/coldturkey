import { describe, expect, it } from 'vitest';
import { en } from './en.js';
import { sv } from './sv.js';
import {
  DEFAULT_LOCALE,
  localizeInsightParams,
  negotiateLocale,
  translate,
  translator,
} from './index.js';

describe('catalog completeness', () => {
  it('has the same key set in both languages', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(sv).sort());
  });

  it('has no accidentally empty strings outside the deliberately blank keys', () => {
    const intentionallyBlank = new Set(['negotiation.none', 'safety.none', 'safety.detox.none']);
    for (const [key, value] of Object.entries(sv)) {
      if (intentionallyBlank.has(key)) continue;
      expect(value, `sv.${key} is empty`).not.toBe('');
    }
    for (const [key, value] of Object.entries(en)) {
      if (intentionallyBlank.has(key)) continue;
      expect(value, `en.${key} is empty`).not.toBe('');
    }
  });

  it('uses the same placeholders in both languages', () => {
    const placeholders = (value: string) =>
      [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(sv) as (keyof typeof sv)[]) {
      expect(placeholders(en[key]), `placeholders differ for ${key}`).toEqual(
        placeholders(sv[key]),
      );
    }
  });

  it('carries no religious or twelve-step language — the product is secular by design', () => {
    const forbidden =
      /\b(gud|god'?s|higher power|högre makt|hogre makt|prayer|bön|bon\b|twelve.?step|tolvsteg|anonyma alkoholister)\b/i;
    for (const [key, value] of Object.entries({ ...sv, ...en })) {
      expect(forbidden.test(value), `${key} contains religious framing: "${value}"`).toBe(false);
    }
  });

  it('carries no shaming language', () => {
    const shaming = /\b(you failed|du misslyckades|du är svag|du ar svag|weak|pathetic|shame on)\b/i;
    for (const [key, value] of Object.entries({ ...sv, ...en })) {
      expect(shaming.test(value), `${key} shames the user: "${value}"`).toBe(false);
    }
  });
});

describe('translate', () => {
  it('returns the string for a known key', () => {
    expect(translate('sv', 'app.name')).toBe('Cold Turkey');
    expect(translate('en', 'nav.home')).toBe('Home');
    expect(translate('sv', 'nav.home')).toBe('Hem');
  });

  it('interpolates named placeholders', () => {
    expect(translate('en', 'home.dayCount', { days: 47 })).toBe('Day 47');
    expect(translate('sv', 'craving.callFirst', { name: 'Jonas' })).toBe('Ring Jonas först.');
  });

  it('reuses a placeholder that appears twice', () => {
    expect(translate('en', 'craving.delay', { minutes: 10 })).toBe(
      'We decide nothing for 10 minutes. Just 10 minutes.',
    );
  });

  it('leaves an unfilled placeholder visible rather than blanking it', () => {
    expect(translate('en', 'home.dayCount')).toBe('Day {days}');
    expect(translate('en', 'home.dayCount', { wrong: 1 })).toBe('Day {days}');
  });

  it('returns the key itself for an unknown key so bugs are visible', () => {
    expect(translate('en', 'does.not.exist')).toBe('does.not.exist');
  });

  it('falls back to Swedish for an unknown locale', () => {
    expect(translate('de' as never, 'app.name')).toBe('Cold Turkey');
  });
});

describe('translator', () => {
  it('binds a locale', () => {
    const t = translator('sv');
    expect(t('nav.coach')).toBe('Coach');
    expect(t('home.dayCount', { days: 3 })).toBe('Dag 3');
  });
});

describe('localizeInsightParams', () => {
  it('turns raw enum values into readable phrases', () => {
    const params = localizeInsightParams('sv', {
      period: 'evening',
      weekday: 5,
      location: 'home',
      percent: 60,
    });
    expect(params?.period).toBe('på kvällen');
    expect(params?.weekday).toBe('fredagar');
    expect(params?.location).toBe('hemma');
    expect(params?.percent).toBe(60);
  });

  it('produces a full readable sentence end to end', () => {
    const params = localizeInsightParams('en', { period: 'evening', percent: 62 });
    expect(translate('en', 'insight.time_of_day', params)).toBe(
      'Your cravings mostly come in the evening — 62% of them.',
    );
  });

  it('passes undefined through', () => {
    expect(localizeInsightParams('sv', undefined)).toBeUndefined();
  });
});

describe('negotiateLocale', () => {
  it('picks English when it is preferred', () => {
    expect(negotiateLocale('en-GB,en;q=0.9')).toBe('en');
  });

  it('picks Swedish when it is preferred', () => {
    expect(negotiateLocale('sv-SE,sv;q=0.9,en;q=0.8')).toBe('sv');
  });

  it('skips unsupported languages and takes the first supported one', () => {
    expect(negotiateLocale('de-DE,de;q=0.9,en;q=0.5')).toBe('en');
  });

  it('defaults to Swedish when the header is missing or unusable', () => {
    expect(negotiateLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale('')).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale('de,fr')).toBe(DEFAULT_LOCALE);
  });
});
