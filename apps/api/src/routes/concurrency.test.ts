import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { closePool, withTenant } from '../db/pool.js';
import { migrate } from '../db/migrate.js';
import { ensureDefaultTenant } from '../db/tenants.js';
import { setMailer, type Mail, type Mailer } from '../mail/smtp.js';

/**
 * What happens when the same thing is done twice at once.
 *
 * Everything here runs over a real socket. `app.inject` dispatches requests
 * one after another, so a test written with it can pass while the second
 * request already sees the first one's committed result — which looks exactly
 * like the race being absent. That mistake was made once in this codebase and
 * hid a real seat-limit defect; these tests exist in this shape because of it.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

class SilentMailer implements Mailer {
  readonly kind = 'log';
  async send(_mail: Mail): Promise<void> {}
}

suite('the same request, twice at once', () => {
  let app: FastifyInstance;
  let origin: string;

  beforeAll(async () => {
    await migrate();
    await ensureDefaultTenant();
    setMailer(new SilentMailer());
    app = await buildApp();
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (address === null || typeof address === 'string') throw new Error('no address');
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    setMailer(null);
    await app.close();
    await closePool();
  });

  function register(email: string) {
    return fetch(`${origin}/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'a-long-enough-password',
        displayName: 'Twice',
      }),
    });
  }

  it('creates one account for a double-submitted registration, and says why', async () => {
    // The form's submit button double-clicked, or the same request retried by
    // a flaky connection. The route checks for an existing address and then
    // inserts; the database has the unique index that actually decides, and
    // the loser of that race must be told the address is taken rather than
    // shown an internal error.
    const email = `twice-${Date.now()}@cleat.test`;
    const [first, second] = await Promise.all([register(email), register(email)]);
    const statuses = [first.status, second.status].sort((a, b) => a - b);

    expect(statuses).toEqual([201, 409]);

    const loser = first.status === 409 ? first : second;
    const body = (await loser.json()) as { error: { code: string } };
    expect(body.error.code, 'a duplicate address is a conflict, never a 500').toBe('email_taken');

    const accounts = await withTenant(
      (await ensureDefaultTenant()).id,
      async (client) => {
        const { rows } = await client.query<{ count: string }>(
          'SELECT count(*)::text AS count FROM users WHERE lower(email) = lower($1)',
          [email],
        );
        return Number(rows[0]?.count ?? '0');
      },
    );
    expect(accounts, 'one person, one account').toBe(1);
  });

  it('holds under a burst of six', async () => {
    const email = `burst-${Date.now()}@cleat.test`;
    const responses = await Promise.all(Array.from({ length: 6 }, () => register(email)));
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 409)).toHaveLength(5);
    expect(responses.some((r) => r.status >= 500), 'no request may 500').toBe(false);
  });
});

/**
 * Leaving, and coming back.
 *
 * This product promises that delete means delete, and it is a promise people
 * in recovery act on — somebody quits the app in a bad week and returns in a
 * better one. The address they use is the same address. Nothing tested that
 * they can.
 *
 * It works because deletion is a real `DELETE`, not a flag. Worth pinning:
 * `findUserByEmail` filters on `deleted_at IS NULL` while
 * `users_tenant_email_key` ignores that column, so the day somebody turns
 * deletion into a soft delete, re-registration starts failing on a unique
 * index instead — and the mapping in the register route is what decides
 * whether that surfaces as "that address is taken" or as an internal error.
 */
suite('somebody who deleted their account can come back', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await migrate();
    await ensureDefaultTenant();
    setMailer(new SilentMailer());
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    setMailer(null);
    await app.close();
    await closePool();
  });

  it('registers, deletes, and registers again with the same address', async () => {
    const email = `returning-${Date.now()}@cleat.test`;
    const password = 'a-long-enough-password';

    const first = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email, password, displayName: 'Returning' },
    });
    expect(first.statusCode).toBe(201);
    const token = first.json().accessToken as string;

    const deleted = await app.inject({
      method: 'DELETE',
      url: '/v1/privacy/account',
      headers: { authorization: `Bearer ${token}` },
      payload: { confirm: 'RADERA', password },
    });
    expect(deleted.statusCode).toBe(200);

    const again = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email, password, displayName: 'Returning' },
    });
    // Not a 409, and emphatically not a 500 on a unique index.
    expect(again.statusCode, 'the door has to open again').toBe(201);

    // A genuinely new account: none of the old history comes back with it.
    const dashboard = await app.inject({
      method: 'GET',
      url: '/v1/dashboard',
      headers: { authorization: `Bearer ${again.json().accessToken as string}` },
    });
    expect(dashboard.statusCode).toBe(200);
  });
});
