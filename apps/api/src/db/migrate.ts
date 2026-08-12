import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { closePool, withoutTenant } from './pool.js';

const here = dirname(fileURLToPath(import.meta.url));
// Works both from `src/db` (tsx) and `dist/db` (compiled).
const MIGRATIONS_DIR = join(here, '..', '..', 'migrations');

/**
 * The lock that lets only one process migrate at a time.
 *
 * The API runs `migrate()` at boot and the Deployment runs two replicas, so a
 * first rollout starts both pods against an empty database: both read an empty
 * `schema_migrations`, and both try to apply `001_init.sql`. Measured, with
 * three concurrent runners against a fresh database: one succeeded and two died
 * on `duplicate key value violates unique constraint "pg_type_typname_nsp_index"`
 * — Postgres's own catalogue refusing the second `CREATE TYPE`. In Kubernetes
 * that is one pod serving and one in CrashLoopBackOff, on the first deploy of
 * every new install.
 *
 * A session-level advisory lock is the right instrument here: it costs nothing
 * when uncontended, Postgres drops it by itself if the holder dies, and it
 * needs no table of its own — which matters, because what it protects is the
 * creation of the tables.
 *
 * The number is arbitrary and must never change; it *is* the lock's identity.
 */
const MIGRATION_LOCK = '8147209331055901';

/**
 * A deliberately small migration runner: ordered `.sql` files, each applied once
 * inside its own transaction, recorded in `schema_migrations`. No rollback
 * support — forward-only migrations are easier to reason about than a
 * half-applied down-migration at 3am.
 */
export async function migrate(): Promise<string[]> {
  const applied: string[] = [];

  await withoutTenant(async (client) => {
    // Everything below runs on this one connection, which is what makes a
    // session-level advisory lock the right scope: it spans the individual
    // per-migration transactions instead of living inside one of them.
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK]);
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          name       text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);

      // Read the applied list *after* taking the lock. Reading first would
      // reintroduce the whole problem: a process that waited would then act on
      // a list from before the holder did its work.
      const { rows } = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
      const done = new Set(rows.map((r) => r.name));

      const files = (await readdir(MIGRATIONS_DIR))
        .filter((f) => f.endsWith('.sql'))
        .sort();

      for (const file of files) {
        if (done.has(file)) continue;
        const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          applied.push(file);
          console.log(`[migrate] applied ${file}`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw new Error(`Migration ${file} failed: ${(error as Error).message}`, { cause: error });
        }
      }
    } finally {
      // Postgres releases this when the connection closes, but the connection
      // goes back to a pool rather than closing, so it has to be handed back
      // explicitly or the next migration run on that client would deadlock.
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK]);
    }
  });

  if (applied.length === 0) console.log('[migrate] already up to date');
  return applied;
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (entrypoint === import.meta.url) {
  migrate()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('[migrate] failed', error);
      process.exit(1);
    });
}
