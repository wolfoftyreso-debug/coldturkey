import { sv, type Catalog, type TranslationKey } from './sv.js';
import { en } from './en.js';

export type { Catalog, TranslationKey };
export { sv, en };

export type Locale = 'sv' | 'en';

export const LOCALES: Locale[] = ['sv', 'en'];
export const DEFAULT_LOCALE: Locale = 'sv';

const CATALOGS: Record<Locale, Catalog> = { sv, en };

export function catalog(locale: Locale): Catalog {
  return CATALOGS[locale] ?? CATALOGS[DEFAULT_LOCALE];
}

export type TranslateParams = Record<string, string | number>;

/**
 * Look up a key and interpolate `{name}` placeholders.
 *
 * Unknown keys return the key itself rather than throwing or rendering an empty
 * string — a visible `craving.title` in the interface is a bug report; a blank
 * space is a mystery. Missing placeholder values are left untouched for the same
 * reason.
 */
export function translate(
  locale: Locale,
  key: string,
  params?: TranslateParams,
): string {
  const table = catalog(locale) as Record<string, string | undefined>;
  const template = table[key] ?? (sv as Record<string, string | undefined>)[key];
  if (template == null) return key;
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value == null ? whole : String(value);
  });
}

/** Bind a locale once and get a `t` you can pass around. */
export function translator(locale: Locale): (key: string, params?: TranslateParams) => string {
  return (key, params) => translate(locale, key, params);
}

/**
 * Some domain values arrive as raw enum strings that need their own key
 * namespace (weekday numbers, craving locations inside a sentence). These
 * helpers keep that mapping in one place instead of scattering string
 * concatenation across the clients.
 */
export function localizeInsightParams(
  locale: Locale,
  params: TranslateParams | undefined,
): TranslateParams | undefined {
  if (!params) return params;
  const out: TranslateParams = { ...params };
  if (typeof params.period === 'string') {
    out.period = translate(locale, `insight.period.${params.period}`);
  }
  if (typeof params.weekday === 'string' || typeof params.weekday === 'number') {
    out.weekday = translate(locale, `insight.weekday.${params.weekday}`);
  }
  if (typeof params.location === 'string') {
    out.location = translate(locale, `insight.location.${params.location}`);
  }
  return out;
}

/** Pick the best supported locale from an `Accept-Language`-style string. */
export function negotiateLocale(header: string | undefined | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const wanted = header
    .split(',')
    .map((part) => part.split(';')[0]?.trim().toLowerCase() ?? '')
    .filter(Boolean);
  for (const tag of wanted) {
    const base = tag.split('-')[0] as Locale;
    if (LOCALES.includes(base)) return base;
  }
  return DEFAULT_LOCALE;
}
