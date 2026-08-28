import type { MetadataRoute } from 'next';
import { PUBLIC_PATHS, SITE_URL } from '../lib/seo';

/**
 * Only the pages that may be indexed, built from the same list robots.txt uses
 * so the two cannot drift apart.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PUBLIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path === '/' ? '' : path}`,
    lastModified: now,
    // The crisis page is the one that must never go stale in an index.
    changeFrequency: path === '/kris' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : path === '/kris' ? 0.9 : 0.8,
  }));
}
