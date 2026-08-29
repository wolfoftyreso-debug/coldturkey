import { Client } from 'pg';

/**
 * Clear the shared per-IP lockout counter before each test file.
 *
 * Every suite here talks to the API from 127.0.0.1, and the login lockout
 * deliberately keeps its state in Postgres so it survives across replicas —
 * which means it also survives across test files and across consecutive runs.
 * `FAILURES_PER_IP` is 100 in a fifteen-minute window, and a full workspace run
 * makes a great many *deliberately* failed logins: the lockout tests alone burn
 * a dozen, and there is a wrong-password assertion in most auth suites.
 *
 * Run the suite enough times inside a quarter of an hour and that counter
 * crosses 100, after which arbitrary login assertions come back 429 on code
 * paths nobody has touched. This is prevention rather than a fix for something
 * observed — the failure that prompted the search turned out to be a fixed
 * email address in one test, corrected there — but the shared ceiling is real
 * and costs nothing to clear.
 *
 * Only the `ip:` keys are cleared. The per-account and per-reset counters are
 * what the lockout tests actually assert on, and those are created and consumed
 * inside a single test.
 */
export async function setup(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;
  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query("DELETE FROM login_failures WHERE key LIKE 'ip:%'");
  } catch {
    // A fresh database has no such table yet; the migration runs in the suite.
  } finally {
    await client.end().catch(() => undefined);
  }
}

await setup();
