import { withoutTenant } from '../db/pool.js';

/**
 * Login and reset throttling, shared across replicas.
 *
 * Two counters, because one attacker hammering a single account and one
 * spraying many look nothing alike. The per-account limit is tight. The per-IP
 * limit is deliberately far looser, because mobile carriers put thousands of
 * real people behind one address via CGNAT — a per-IP number tight enough to
 * stop a botnet locks out an entire phone network, and does not stop the
 * botnet anyway.
 *
 * Only failures count. Counting every attempt meant ordinary successful logins
 * consumed the quota, which locked out everyone sharing an address almost
 * immediately.
 *
 * State lives in Postgres rather than in the process. In memory the ceiling
 * multiplied by replica count — five failures per account became fifteen
 * across three pods, and reconnecting onto a different pod handed the attacker
 * a fresh budget.
 */

export const FAILURES_PER_IP = 100;
export const FAILURES_PER_ACCOUNT = 5;
/** Reset requests are cheaper to abuse as a mail bomb than as a password guess. */
export const RESETS_PER_ACCOUNT = 3;
export const LOCKOUT_WINDOW = '15 minutes';

export const ipKey = (ip: string): string => `ip:${ip}`;
export const accountKey = (email: string): string => `account:${email.trim().toLowerCase()}`;
export const resetKey = (email: string): string => `reset:${email.trim().toLowerCase()}`;

/**
 * Whether this key is over its limit right now, without recording anything.
 *
 * Failing open on a database error is the deliberate choice: the alternative
 * is that a database blip locks every person out of their own recovery
 * history. The login itself cannot succeed without the database anyway, so an
 * open brake here grants an attacker nothing they did not already have.
 */
export async function isLockedOut(key: string, limit: number): Promise<boolean> {
  try {
    return await withoutTenant(async (client) => {
      const { rows } = await client.query<{ failures: number }>(
        'SELECT failures FROM login_failures WHERE key = $1 AND reset_at > now()',
        [key],
      );
      return (rows[0]?.failures ?? 0) >= limit;
    });
  } catch {
    return false;
  }
}

/** Record a failure and return the running count within the window. */
export async function recordFailure(key: string): Promise<number> {
  try {
    return await withoutTenant(async (client) => {
      const { rows } = await client.query<{ record_login_failure: number }>(
        'SELECT record_login_failure($1, $2::interval)',
        [key, LOCKOUT_WINDOW],
      );
      return rows[0]?.record_login_failure ?? 0;
    });
  } catch {
    return 0;
  }
}

/**
 * Clear counters. Called on a successful login and after a completed password
 * reset — the person just proved control of the account or the mailbox, and
 * leaving them locked out is the product fighting itself, especially since the
 * lockout is what sent many of them to the reset in the first place.
 */
export async function clearFailures(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await withoutTenant(async (client) => {
      await client.query('DELETE FROM login_failures WHERE key = ANY($1::text[])', [keys]);
    });
  } catch {
    // A failure to clear costs the person a wait, not their account.
  }
}

/** Drop expired rows. Called from the maintenance job, not the request path. */
export async function purgeExpiredLockouts(): Promise<number> {
  return withoutTenant(async (client) => {
    const { rowCount } = await client.query(
      "DELETE FROM login_failures WHERE reset_at < now() - interval '1 day'",
    );
    return rowCount ?? 0;
  });
}
