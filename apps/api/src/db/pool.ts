import pg from 'pg';
import { loadConfig } from '../config.js';

const { Pool } = pg;

export type Client = pg.PoolClient;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const config = loadConfig();
    pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: config.DATABASE_POOL_MAX,
      // Recovery data is sensitive; do not leave idle connections lying around
      // any longer than a busy app actually needs.
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    pool.on('error', (error) => {
      // A pooled client can die between checkouts. Log and let pg replace it
      // rather than taking the process down.
      console.error('[db] idle client error', error);
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Forget the cached pool without closing it, so the next call reads the current
 * `DATABASE_URL`.
 *
 * A test seam, and only that: the migration tests create a throwaway database
 * and have to point at it. Production has exactly one database for the lifetime
 * of the process and should never call this.
 */
export function resetPool(): void {
  pool = null;
}

/**
 * Run work inside a transaction with the tenant context set.
 *
 * `set_config(..., true)` scopes the setting to this transaction, so a pooled
 * connection handed to the next request never carries the previous tenant's
 * context. Every tenant-scoped table's RLS policy reads this value; if it is not
 * set the policy predicate is NULL and the query returns no rows, which is the
 * failure mode we want.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', tenantId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The connection is already broken; the pool will discard it.
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Run work with no tenant context.
 *
 * Only for the operations that genuinely cannot have one: resolving a tenant by
 * slug, creating a tenant, and reading the migration table. Everything that
 * touches user data goes through `withTenant`.
 */
export async function withoutTenant<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
