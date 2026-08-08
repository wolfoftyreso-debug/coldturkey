import type { Client } from './pool.js';
import { withoutTenant } from './pool.js';
import { loadConfig } from '../config.js';
import { notFound } from '../lib/errors.js';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  plan: string;
  settings: Record<string, unknown>;
}

const SELECT = 'SELECT id, slug, name, plan, settings FROM tenants WHERE archived_at IS NULL';

export async function findTenantBySlug(slug: string): Promise<Tenant | null> {
  return withoutTenant(async (client) => {
    const { rows } = await client.query<Tenant>(`${SELECT} AND slug = $1`, [slug]);
    return rows[0] ?? null;
  });
}

export async function findTenantById(id: string): Promise<Tenant | null> {
  return withoutTenant(async (client) => {
    const { rows } = await client.query<Tenant>(`${SELECT} AND id = $1`, [id]);
    return rows[0] ?? null;
  });
}

export async function requireTenantBySlug(slug: string): Promise<Tenant> {
  const tenant = await findTenantBySlug(slug);
  if (!tenant) throw notFound('Tenant');
  return tenant;
}

export async function createTenant(
  slug: string,
  name: string,
  settings: Record<string, unknown> = {},
): Promise<Tenant> {
  return withoutTenant(async (client) => {
    const { rows } = await client.query<Tenant>(
      `INSERT INTO tenants (slug, name, settings)
       VALUES ($1, $2, $3)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, slug, name, plan, settings`,
      [slug, name, settings],
    );
    return rows[0]!;
  });
}

/**
 * Make sure the shared consumer tenant exists.
 *
 * Cold Turkey serves two shapes of customer from the same deployment: individual
 * people signing up on their own, who all live in one shared "public" tenant, and
 * organisations — clinics, employers, programmes — who get their own. Both use
 * exactly the same isolation mechanism, so there is no second, weaker code path
 * for consumers.
 */
export async function ensureDefaultTenant(): Promise<Tenant> {
  const slug = loadConfig().DEFAULT_TENANT_SLUG;
  const existing = await findTenantBySlug(slug);
  if (existing) return existing;
  return createTenant(slug, 'Cold Turkey', { publicSignup: true });
}

/**
 * Resolve which tenant a request belongs to.
 *
 * Order matters: an authenticated request always uses the tenant baked into its
 * signed token. The header and subdomain are only consulted before the user has
 * a token — otherwise a client could ask for someone else's tenant simply by
 * changing a header.
 */
export function tenantSlugFromRequest(
  headerValue: string | undefined,
  host: string | undefined,
): string {
  const config = loadConfig();
  if (headerValue && headerValue.trim().length > 0) return headerValue.trim().toLowerCase();

  const slug = subdomainOf(host);
  return slug ?? config.DEFAULT_TENANT_SLUG;
}

/** Hostnames that are never a tenant, however many labels they have. */
const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'app', 'admin', 'static', 'cdn']);

/**
 * Extract a tenant slug from a Host header, or null when there is not one.
 *
 * The subtlety is that plenty of legitimate hosts have three or more
 * dot-separated parts without being a subdomain — an IPv4 literal being the
 * obvious one. Treating `127.0.0.1` as the subdomain `127` makes every request
 * to a bare IP resolve to a tenant that does not exist, which breaks Kubernetes
 * probes, direct service-to-service calls and any deployment reached by address
 * rather than by name.
 */
function subdomainOf(host: string | undefined): string | null {
  if (!host) return null;

  let hostname = host.trim().toLowerCase();
  if (hostname.startsWith('[')) {
    // IPv6 literal, e.g. "[::1]:8080".
    return null;
  }
  hostname = hostname.split(':')[0] ?? '';
  if (!hostname || hostname === 'localhost') return null;

  // IPv4 literal.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return null;
  // Bare IPv6 with no brackets, or anything else containing a colon.
  if (hostname.includes(':')) return null;

  const labels = hostname.split('.');
  if (labels.length <= 2) return null;

  const first = labels[0];
  if (!first || RESERVED_SUBDOMAINS.has(first)) return null;

  return first;
}

export async function countTenantUsers(client: Client): Promise<number> {
  const { rows } = await client.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM users WHERE deleted_at IS NULL',
  );
  return Number(rows[0]?.count ?? '0');
}
