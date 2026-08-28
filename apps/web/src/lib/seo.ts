import type { Metadata } from 'next';

/**
 * Search visibility, decided page by page.
 *
 * The root layout sets `robots: { index: false }` for the whole application and
 * that default is deliberately never removed: somebody's recovery is not public
 * information, and a URL that leaks through a referrer header is one of the
 * ways that goes wrong. Every authenticated route inherits the block for free,
 * and a new screen added next year is invisible to search until somebody
 * deliberately says otherwise.
 *
 * What genuinely belongs in an index is the other half of this product: the
 * crisis numbers, the page for relatives, the explanation of what withdrawal
 * does to a body. Those pages hold no personal data, work without an account,
 * and are the reason a person finds help at two in the morning by typing a
 * question into a search box. Keeping them out of the index protects nobody.
 *
 * So public pages opt in, one at a time, through this helper.
 */

/** Where this deployment actually lives. Canonical URLs are absolute. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cleat.app').replace(
  /\/+$/,
  '',
);

/** Every path that may be indexed. The sitemap and robots.txt read this list. */
export const PUBLIC_PATHS = ['/', '/kris', '/nara', '/medberoende', '/abstinens', '/organisation'];

export function publicPage(input: {
  title: string;
  description: string;
  path: string;
  /** Overrides the share image title when the page title is long. */
  ogTitle?: string;
}): Metadata {
  const url = `${SITE_URL}${input.path === '/' ? '' : input.path}`;
  return {
    title: input.title,
    description: input.description,
    robots: { index: true, follow: true },
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: 'sv_SE',
      siteName: 'Cleat',
      title: input.ogTitle ?? input.title,
      description: input.description,
      url,
    },
    twitter: {
      card: 'summary_large_image',
      title: input.ogTitle ?? input.title,
      description: input.description,
    },
  };
}

/**
 * A JSON-LD block, rendered as a script tag.
 *
 * Used only where the markup is semantically true — a page that really is a
 * list of questions and answers, an organisation that really exists. Structured
 * data describing something the page does not contain is how a site earns a
 * manual action, and it would be a lie in a product whose whole claim is that
 * it does not lie to people.
 */
export function jsonLd(data: Record<string, unknown>): { __html: string } {
  return { __html: JSON.stringify(data) };
}
