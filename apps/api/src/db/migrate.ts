import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { closePool, withoutTenant } from './pool.js';

const here = dirname(fileURLToPath(import.meta.url));
// Works both from `src/db` (tsx) and `dist/db` (compiled).
const MIGRATIONS_DIR = join(here, '..', '..', 'migrations');

/**
 * A deliberately small migration runner: ordered `.sql` files, each applied once
 * inside its own transaction, recorded in `schema_migrations`. No rollback
 * support — forward-only migrations are easier to reason about than a
 * half-applied down-migration at 3am.
 */
export async function migrate(): Promise<string[]> {
  const applied: string[] = [];

  await withoutTenant(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

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
