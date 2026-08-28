import type { MetadataRoute } from 'next';
import { PUBLIC_PATHS, SITE_URL } from '../lib/seo';

/**
 * Allow the public help pages; refuse everything else.
 *
 * Replaces a blanket `Disallow: /`. That was correct while the whole site was
 * the application, and wrong once there were pages whose entire purpose is to
 * be found by somebody searching at two in the morning.
 *
 * This file is not the load-bearing control and should not be mistaken for one:
 * `Allow: /` means a route added next year is crawlable until somebody
 * remembers to list it below. What actually keeps the application out of search
 * is the `robots: { index: false }` default in the root layout, which every
 * page inherits until it opts in through `publicPage()`. Two layers, and only
 * one of them fails safe — this is the other one.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: PUBLIC_PATHS,
        // Everything below is either authenticated or carries a token in the
        // query string. None of it may be crawled, and `/` above is an exact
        // path allow rather than a prefix.
        disallow: [
          '/home',
          '/coach',
          '/craving',
          '/checkin',
          '/patterns',
          '/plan',
          '/rebuild',
          '/relapse',
          '/settings',
          '/struggling',
          '/toolbox',
          '/triggers',
          '/login',
          '/forgot',
          '/reset',
          '/verify',
          '/nara/samtal',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
