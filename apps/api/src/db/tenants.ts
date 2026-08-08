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

  if (host) {
    const hostname = host.split(':')[0] ?? '';
    const labels = hostname.split('.');
    // clinic.coldturkey.app → "clinic"; localhost and bare domains fall through.
    if (labels.length > 2 && labels[0] && labels[0] !== 'www' && labels[0] !== 'api') {
      return labels[0].toLowerCase();
    }
  }

  return config.DEFAULT_TENANT_SLUG;
}

export async function countTenantUsers(client: Client): Promise<number> {
  const { rows } = await client.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM users WHERE deleted_at IS NULL',
  );
  return Number(rows[0]?.count ?? '0');
}
