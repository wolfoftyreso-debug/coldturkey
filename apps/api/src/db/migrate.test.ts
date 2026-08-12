import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from './migrate.js';
import { closePool, resetPool } from './pool.js';
import { resetConfig } from '../config.js';

/**
 * Migrations, checked the way they are actually run.
 *
 * The API calls `migrate()` at boot and the Deployment runs two replicas, so a
 * first rollout starts two processes against an empty database at the same
 * moment. Before the advisory lock, that killed one of them: measured with
 * three concurrent runners against a fresh database, one succeeded and two died
 * on `duplicate key value violates unique constraint "pg_type_typname_nsp_index"`,
 * which in Kubernetes is a pod in CrashLoopBackOff on the first deploy of every
 * new install.
 *
 * These tests need their own database — they create and drop one — so they are
 * skipped unless a superuser-ish connection is available.
 */

const adminUrl = process.env.DATABASE_URL;
const canCreateDatabases = Boolean(adminUrl);
const suite = canCreateDatabases ? describe : describe.skip;

const DB = `cleat_migrate_test_${process.pid}`;

function urlFor(database: string): string {
  const url = new URL(adminUrl!);
  url.pathname = `/${database}`;
  return url.toString();
}

async function admin<T>(work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

suite('migrations', () => {
  const originalUrl = process.env.DATABASE_URL;

  beforeAll(async () => {
    await admin(async (client) => {
      await client.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
      await client.query(`CREATE DATABASE ${DB}`);
    });
    process.env.DATABASE_URL = urlFor(DB);
    // The pool builds its connection string from the cached config, so both
    // caches have to be dropped for the new URL to take effect.
    resetConfig();
    resetPool();
  });

  afterAll(async () => {
    await closePool();
    process.env.DATABASE_URL = originalUrl;
    resetConfig();
    resetPool();
    await admin(async (client) => {
      await client.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
    });
  });

  it('applies every migration to an empty database', async () => {
    const applied = await migrate();
    expect(applied.length).toBeGreaterThan(0);
    expect(applied).toEqual([...applied].sort());
  });

  it('is a no-op the second time', async () => {
    // Every pod restart runs this. If it were not a no-op, a rolling restart
    // would try to recreate the schema under a live application.
    expect(await migrate()).toEqual([]);
  });

  it('survives two replicas booting at once', async () => {
    // The actual first-deploy shape. Reset to a bare database so the runners
    // genuinely race on creating the schema rather than on finding it done.
    await closePool();
    await admin(async (client) => {
      await client.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
      await client.query(`CREATE DATABASE ${DB}`);
    });
    resetConfig();
    resetPool();

    const runners = await Promise.allSettled([migrate(), migrate(), migrate()]);
    const rejected = runners.filter((r) => r.status === 'rejected');
    expect(
      rejected.map((r) => String(r.reason)),
      'a concurrent migration run crashed',
    ).toEqual([]);

    // Exactly one of them did the work; the others waited and found it done.
    const counts = runners
      .map((r) => (r.status === 'fulfilled' ? r.value.length : -1))
      .sort((a, b) => b - a);
    expect(counts[0]).toBeGreaterThan(0);
    expect(counts.slice(1)).toEqual([0, 0]);
  });

  it('upgrades a database that already has data, without losing any of it', async () => {
    // The path a running deployment takes, and the only one that can destroy
    // somebody's recovery history. Testing only the fresh-install path would
    // green-light a migration that drops a column people's data lives in.
    const upgradeDb = `${DB}_upgrade`;
    await closePool();
    await admin(async (client) => {
      await client.query(`DROP DATABASE IF EXISTS ${upgradeDb} WITH (FORCE)`);
      await client.query(`CREATE DATABASE ${upgradeDb}`);
    });

    const client = new Client({ connectionString: urlFor(upgradeDb) });
    await client.connect();
    try {
      // Bring it up to an earlier release, by hand, the way a deployment that
      // has been running for months already is.
      const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../migrations');
      const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
      const baseline = files.indexOf('002_life_domains.sql');
      expect(baseline, 'the baseline migration is missing').toBeGreaterThanOrEqual(0);

      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
        )`);
      for (const file of files.slice(0, baseline + 1)) {
        await client.query(await readFile(join(migrationsDir, file), 'utf8'));
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      }

      // Real rows, of the kind that must survive an upgrade. The tenant context
      // has to be set for the insert, because row level security refuses it
      // otherwise — which is the policy working, and worth seeing here.
      await client.query(`
        INSERT INTO tenants (id, slug, name)
        VALUES ('11111111-1111-1111-1111-111111111111', 'upgrade-check', 'Upgrade Check')`);
      await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [
        '11111111-1111-1111-1111-111111111111',
      ]);
      await client.query(`
        INSERT INTO users (id, tenant_id, email, password_hash, display_name)
        VALUES ('22222222-2222-2222-2222-222222222222',
                '11111111-1111-1111-1111-111111111111',
                'upgrade@example.com', 'not-a-real-hash', 'Upgrade')`);

      // Now the rollout applies everything since.
      process.env.DATABASE_URL = urlFor(upgradeDb);
      resetConfig();
      resetPool();
      const applied = await migrate();
      expect(applied.length, 'the upgrade applied nothing, so it proved nothing').toBeGreaterThan(0);

      const { rows } = await client.query<{ email: string }>(
        `SELECT email FROM users WHERE id = '22222222-2222-2222-2222-222222222222'`,
      );
      expect(rows.map((r) => r.email)).toEqual(['upgrade@example.com']);

      // A fresh install and an upgraded one must end up with the same schema.
      // When they diverge, every later migration is written against a shape
      // only some deployments have — and the failure lands on somebody else's
      // server, months later.
      const columnsOf = async (database: string) => {
        const c = new Client({ connectionString: urlFor(database) });
        await c.connect();
        try {
          const { rows } = await c.query<{ signature: string }>(`
            SELECT table_name || '.' || column_name || ':' || data_type || ':' || is_nullable
                     AS signature
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY 1`);
          return rows.map((r) => r.signature);
        } finally {
          await c.end();
        }
      };
      expect(await columnsOf(upgradeDb)).toEqual(await columnsOf(DB));
    } finally {
      await client.end();
      await closePool();
      process.env.DATABASE_URL = urlFor(DB);
      resetConfig();
      resetPool();
      await admin(async (c) => {
        await c.query(`DROP DATABASE IF EXISTS ${upgradeDb} WITH (FORCE)`);
      });
    }
  });

  it('leaves every tenant-scoped table with row level security forced', async () => {
    // A new migration that adds a table with a tenant_id and forgets the policy
    // is the single most dangerous mistake available in this codebase: the
    // table would be readable across tenants and nothing else would notice.
    const client = new Client({ connectionString: urlFor(DB) });
    await client.connect();
    try {
      const { rows } = await client.query<{ relname: string }>(`
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = c.relname
              AND column_name = 'tenant_id'
          )
          AND NOT (c.relrowsecurity AND c.relforcerowsecurity)
      `);
      expect(
        rows.map((r) => r.relname),
        'tables carrying tenant_id without FORCE ROW LEVEL SECURITY',
      ).toEqual([]);
    } finally {
      await client.end();
    }
  });
});
