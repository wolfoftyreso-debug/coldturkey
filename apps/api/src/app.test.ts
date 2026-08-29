import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { closePool, withoutTenant, withTenant } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { createTenant, ensureDefaultTenant } from './db/tenants.js';
import { hashPassword } from './auth/password.js';
import { createUser } from './db/repository.js';
import { issueToken } from './auth/recovery.js';
import { buildReport } from './observability/errors.js';
import { encryptionEnabled } from './crypto/field.js';
import { currentCode } from './auth/totp.js';

/**
 * End-to-end API tests against a real PostgreSQL instance.
 *
 * These use a real database rather than a mock on purpose: the isolation
 * guarantee this product depends on lives in row-level security policies, and a
 * mocked repository would happily "prove" an isolation that the database does
 * not actually enforce.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

let app: FastifyInstance;

const password = 'a-long-enough-password';
const alice = `alice+${Date.now()}@example.com`;
const clinicPatient = `patient+${Date.now()}@example.com`;
let clinicSlug: string;

async function json(response: { body: string }): Promise<Record<string, never>> {
  return JSON.parse(response.body);
}

suite('Cleat API', () => {
  let accessToken: string;

  beforeAll(async () => {
    await migrate();
    await ensureDefaultTenant();
    clinicSlug = `clinic-${Date.now()}`;
    const clinic = await createTenant(clinicSlug, 'Test Clinic', { publicSignup: false });

    // The clinic patient is created directly, the way an admin would provision
    // them, because the clinic tenant does not allow self sign-up.
    const hash = await hashPassword(password);
    await withTenant(clinic.id, async (client) => {
      await createUser(client, {
        tenantId: clinic.id,
        email: clinicPatient,
        passwordHash: hash,
        displayName: 'Clinic Patient',
      });
    });

    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
    await closePool();
  });

  describe('health', () => {
    it('reports liveness', async () => {
      const response = await app.inject({ method: 'GET', url: '/healthz' });
      expect(response.statusCode).toBe(200);
      expect((await json(response)).status).toBe('ok');
    });

    it('reports readiness only when the database answers', async () => {
      const response = await app.inject({ method: 'GET', url: '/readyz' });
      expect(response.statusCode).toBe(200);
      expect((await json(response)).database).toBe('ok');
    });

    it('exposes Prometheus metrics', async () => {
      const response = await app.inject({ method: 'GET', url: '/metrics' });
      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('cleat_requests_total');
    });
  });

  describe('sensitive text is ciphertext at rest', () => {
    // The claim this file exists to check: what a leaked backup, a
    // decommissioned disk, or an operator running SELECT would actually see.
    // Row level security protects none of those, and everything below is the
    // most sensitive thing this product holds.
    const secrets = {
      why: 'MITT-VARFOR-HEMLIGT-7f3a',
      craving: 'SUG-ANTECKNING-HEMLIG-9c2b',
      relapse: 'ATERFALL-ANTECKNING-HEMLIG-4e8d',
      contact: 'STODKONTAKT-NAMN-HEMLIGT-1a6f',
      coach: 'COACH-MEDDELANDE-HEMLIGT-3b5e',
      trigger: 'TRIGGER-ETIKETT-HEMLIG-5d1c',
      checkin: 'INCHECK-ANTECKNING-HEMLIG-2f9a',
      domain: 'LIVSDOMAN-ANTECKNING-HEMLIG-8b4e',
    };
    let token: string;
    let tenantId: string;
    let userId: string;

    beforeAll(async () => {
      const registered = (await json(
        await app.inject({
          method: 'POST',
          url: '/v1/auth/register',
          payload: {
            email: `crypt-${Date.now()}@cleat.app`,
            password: 'a-long-enough-password',
            displayName: 'Crypt',
          },
        }),
      )) as never as { accessToken: string; tenant: { id: string }; user: { id: string } };
      token = registered.accessToken;
      tenantId = registered.tenant.id;
      userId = registered.user.id;
      const auth = { authorization: `Bearer ${token}` };

      await app.inject({
        method: 'PUT',
        url: '/v1/me/profile',
        headers: auth,
        payload: { whyStatement: secrets.why },
      });
      await app.inject({
        method: 'POST',
        url: '/v1/quit',
        headers: auth,
        payload: {
          substance: 'alcohol',
          baselineUnitsPerDay: 4,
          unitCostMinor: 2000,
          currency: 'SEK',
          startedAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
        },
      });
      await app.inject({
        method: 'POST',
        url: '/v1/cravings',
        headers: auth,
        payload: { intensity: 6, feeling: 'craving', location: 'home', note: secrets.craving },
      });
      await app.inject({
        method: 'POST',
        url: '/v1/relapse',
        headers: auth,
        payload: { occurredAt: new Date().toISOString(), note: secrets.relapse },
      });
      await app.inject({
        method: 'POST',
        url: '/v1/support',
        headers: auth,
        payload: { name: secrets.contact, relation: 'sister', phone: '+46700000001' },
      });
      await app.inject({
        method: 'POST',
        url: '/v1/coach/message',
        headers: auth,
        payload: { message: secrets.coach },
      });
      await app.inject({
        method: 'POST',
        url: '/v1/triggers',
        headers: auth,
        payload: { label: secrets.trigger, kind: 'emotion' },
      });
      await app.inject({
        method: 'POST',
        url: '/v1/checkins',
        headers: auth,
        payload: { kind: 'evening', mood: 3, note: secrets.checkin },
      });
      await app.inject({
        method: 'PUT',
        url: '/v1/rebuild/sleep',
        headers: auth,
        payload: { status: 'working', note: secrets.domain },
      });
    });

    it('is actually running with encryption configured', () => {
      // Without keys the at-rest assertions below would still pass — by
      // finding plaintext they were never told to look for. Fail loudly
      // instead of reporting a guarantee nobody switched on.
      expect(
        encryptionEnabled(),
        'set FIELD_ENCRYPTION_KEYS to run the encryption tests',
      ).toBe(true);
    });

    it('stores none of it in the clear', async () => {
      // Read the raw columns, bypassing every application code path. This is
      // the only check that cannot be satisfied by a decrypt-on-read that
      // happens to work.
      const leaks = await withTenant(tenantId, async (client) => {
        const found: string[] = [];
        const columns: [string, string, string][] = [
          ['profiles', 'why_statement', secrets.why],
          ['cravings', 'note', secrets.craving],
          ['relapses', 'note', secrets.relapse],
          ['support_contacts', 'name', secrets.contact],
          ['coach_messages', 'content', secrets.coach],
          ['triggers', 'label', secrets.trigger],
          ['check_ins', 'note', secrets.checkin],
          ['life_domains', 'note', secrets.domain],
        ];
        for (const [table, column, secret] of columns) {
          // Scoped to this test's own user. An unscoped scan would trip over
          // rows left by any other run — including one that deliberately ran
          // without keys — and report a leak the code did not cause.
          const { rows } = await client.query<{ hits: string }>(
            `SELECT count(*)::text AS hits FROM ${table}
              WHERE user_id = $1 AND ${column} LIKE $2`,
            [userId, `%${secret}%`],
          );
          if (rows[0]?.hits !== '0') found.push(`${table}.${column}`);
        }
        return found;
      });

      expect(leaks, `plaintext found at rest in: ${leaks.join(', ')}`).toEqual([]);
    });

    it('gives the person their own words back unchanged', async () => {
      // The other half. Ciphertext at rest is worthless if the product then
      // shows somebody an envelope instead of their why statement.
      const auth = { authorization: `Bearer ${token}` };
      const dashboard = (await json(
        await app.inject({ method: 'GET', url: '/v1/dashboard', headers: auth }),
      )) as never as {
        profile: { whyStatement: string };
        supportContacts: { name: string }[];
      };
      expect(dashboard.profile.whyStatement).toBe(secrets.why);
      expect(dashboard.supportContacts.map((c) => c.name)).toContain(secrets.contact);

      const history = (await json(
        await app.inject({ method: 'GET', url: '/v1/coach/history', headers: auth }),
      )) as never as { messages: { content: string }[] };
      expect(history.messages.map((m) => m.content)).toContain(secrets.coach);

      const cravings = (await json(
        await app.inject({ method: 'GET', url: '/v1/cravings', headers: auth }),
      )) as never as { cravings: { note: string | null }[] };
      expect(cravings.cravings.map((c) => c.note)).toContain(secrets.craving);

      const triggers = (await json(
        await app.inject({ method: 'GET', url: '/v1/triggers', headers: auth }),
      )) as never as { triggers: { label: string }[] };
      expect(triggers.triggers.map((t) => t.label)).toContain(secrets.trigger);

      const rebuild = (await json(
        await app.inject({ method: 'GET', url: '/v1/rebuild', headers: auth }),
      )) as never as { domains: { note: string | null }[] };
      expect(rebuild.domains.map((d) => d.note)).toContain(secrets.domain);
    });

    it('exports plaintext, not envelopes', async () => {
      // A data export full of ciphertext would satisfy the letter of the right
      // of access and none of its point.
      const exported = await app.inject({
        method: 'GET',
        url: '/v1/privacy/export',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(exported.body).toContain(secrets.why);
      expect(exported.body).toContain(secrets.coach);
      expect(exported.body).not.toContain('c1.');
    });
  });

  describe('two-factor authentication', () => {
    const email = `totp-${Date.now()}@cleat.app`;
    const pw = 'a-long-enough-password';
    let token: string;
    let secret: string;
    let recoveryCodes: string[];

    it('enrols in two steps and will not enable without a proven code', async () => {
      const registered = (await json(
        await app.inject({
          method: 'POST',
          url: '/v1/auth/register',
          payload: { email, password: pw },
        }),
      )) as never as { accessToken: string };
      token = registered.accessToken;
      const auth = { authorization: `Bearer ${token}` };

      const setup = (await json(
        await app.inject({ method: 'POST', url: '/v1/auth/totp/setup', headers: auth }),
      )) as never as { secret: string; uri: string };
      secret = setup.secret;
      expect(setup.uri).toContain('otpauth://totp/');

      // A wrong code must not switch it on. Enabling on the first request
      // would lock people out whenever a QR code failed to scan.
      const refused = await app.inject({
        method: 'POST',
        url: '/v1/auth/totp/enable',
        headers: auth,
        payload: { code: '000000' },
      });
      expect(refused.statusCode).toBe(400);

      const enabled = (await json(
        await app.inject({
          method: 'POST',
          url: '/v1/auth/totp/enable',
          headers: auth,
          payload: { code: currentCode(secret) },
        }),
      )) as never as { enabled: boolean; recoveryCodes: string[] };
      expect(enabled.enabled).toBe(true);
      expect(enabled.recoveryCodes).toHaveLength(10);
      recoveryCodes = enabled.recoveryCodes;
    });

    it('stores the secret encrypted, not in the clear', async () => {
      // A TOTP secret next to a password hash, both readable from a backup,
      // is a second factor in name only.
      const tenant = await ensureDefaultTenant();
      const stored = await withTenant(tenant.id, async (client) => {
        const { rows } = await client.query<{ totp_secret: string }>(
          'SELECT totp_secret FROM users WHERE lower(email) = lower($1)',
          [email],
        );
        return rows[0]?.totp_secret ?? '';
      });
      expect(stored).not.toContain(secret);
      expect(stored.startsWith('c1.')).toBe(true);
    });

    it('a correct password alone no longer logs in', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email, password: pw },
      });
      const body = (await json(response)) as never as {
        mfaRequired: boolean;
        challenge: string;
        accessToken?: string;
      };
      expect(body.mfaRequired).toBe(true);
      expect(body.challenge).toBeTruthy();
      expect(body.accessToken).toBeUndefined();
    });

    it('completes with a code from the authenticator', async () => {
      const challenge = (
        (await json(
          await app.inject({
            method: 'POST',
            url: '/v1/auth/login',
            payload: { email, password: pw },
          }),
        )) as never as { challenge: string }
      ).challenge;

      const done = await app.inject({
        method: 'POST',
        url: '/v1/auth/totp/verify',
        payload: { challenge, code: currentCode(secret) },
      });
      expect(done.statusCode).toBe(200);
      const body = (await json(done)) as never as { accessToken: string };
      expect(body.accessToken).toBeTruthy();

      // Single use: the same challenge cannot be replayed.
      const replay = await app.inject({
        method: 'POST',
        url: '/v1/auth/totp/verify',
        payload: { challenge, code: currentCode(secret) },
      });
      expect(replay.statusCode).toBe(401);
    });

    it('gives up after five wrong codes rather than allowing a brute force', async () => {
      // Six digits is a million possibilities, which sounds like a lot and is
      // not: unlimited guessing inside a five-minute window is a few thousand
      // requests a second away from certain.
      const challenge = (
        (await json(
          await app.inject({
            method: 'POST',
            url: '/v1/auth/login',
            payload: { email, password: pw },
          }),
        )) as never as { challenge: string }
      ).challenge;

      // The first four say "wrong code", so a client can leave the person on
      // the code field with the tries they have left. The fifth spends the
      // challenge and says so, so the client sends them back to start over
      // instead of typing into something that can no longer succeed.
      for (let i = 0; i < 4; i += 1) {
        const wrong = await app.inject({
          method: 'POST',
          url: '/v1/auth/totp/verify',
          payload: { challenge, code: '000000' },
        });
        expect(wrong.statusCode).toBe(401);
        expect(await json(wrong)).toMatchObject({ error: { code: 'totp_invalid_code' } });
      }

      const last = await app.inject({
        method: 'POST',
        url: '/v1/auth/totp/verify',
        payload: { challenge, code: '000000' },
      });
      expect(last.statusCode).toBe(401);
      expect(await json(last)).toMatchObject({ error: { code: 'totp_challenge_expired' } });

      // Now even the right code is refused: the challenge is spent.
      const correct = await app.inject({
        method: 'POST',
        url: '/v1/auth/totp/verify',
        payload: { challenge, code: currentCode(secret) },
      });
      expect(correct.statusCode).toBe(401);
      expect(await json(correct)).toMatchObject({ error: { code: 'totp_challenge_expired' } });
    });

    it('keeps a challenge alive after a wrong code', async () => {
      // Every failure used to be the same opaque 401, so a client could not
      // tell "try again" from "start over" and had to assume the worst —
      // throwing somebody back to re-enter their password over one mistyped
      // digit, which makes the five attempts the server grants unreachable.
      const challenge = (
        (await json(
          await app.inject({
            method: 'POST',
            url: '/v1/auth/login',
            payload: { email, password: pw },
          }),
        )) as never as { challenge: string }
      ).challenge;

      const wrong = await app.inject({
        method: 'POST',
        url: '/v1/auth/totp/verify',
        payload: { challenge, code: '000000' },
      });
      expect(await json(wrong)).toMatchObject({ error: { code: 'totp_invalid_code' } });

      // A challenge that never existed is dead, not merely wrong.
      const nonsense = await app.inject({
        method: 'POST',
        url: '/v1/auth/totp/verify',
        payload: { challenge: 'a-challenge-that-was-never-issued', code: '000000' },
      });
      expect(await json(nonsense)).toMatchObject({ error: { code: 'totp_challenge_expired' } });

      // The point of the distinction: the challenge still works.
      const good = await app.inject({
        method: 'POST',
        url: '/v1/auth/totp/verify',
        payload: { challenge, code: currentCode(secret) },
      });
      expect(good.statusCode).toBe(200);
    });

    it('accepts a recovery code exactly once', async () => {
      const challenge = (
        (await json(
          await app.inject({
            method: 'POST',
            url: '/v1/auth/login',
            payload: { email, password: pw },
          }),
        )) as never as { challenge: string }
      ).challenge;

      const used = recoveryCodes[0]!;
      const first = await app.inject({
        method: 'POST',
        url: '/v1/auth/totp/verify',
        payload: { challenge, code: used },
      });
      expect(first.statusCode).toBe(200);

      const second = (
        (await json(
          await app.inject({
            method: 'POST',
            url: '/v1/auth/login',
            payload: { email, password: pw },
          }),
        )) as never as { challenge: string }
      ).challenge;
      const replay = await app.inject({
        method: 'POST',
        url: '/v1/auth/totp/verify',
        payload: { challenge: second, code: used },
      });
      expect(replay.statusCode).toBe(401);
    });

    it('cannot be switched off with a borrowed session alone', async () => {
      // Otherwise an attacker who already has a token simply removes the
      // second factor, which makes it protection against nobody.
      const auth = { authorization: `Bearer ${token}` };
      const withoutPassword = await app.inject({
        method: 'POST',
        url: '/v1/auth/totp/disable',
        headers: auth,
        payload: { password: 'not-the-password' },
      });
      expect(withoutPassword.statusCode).toBe(401);

      const withPassword = await app.inject({
        method: 'POST',
        url: '/v1/auth/totp/disable',
        headers: auth,
        payload: { password: pw },
      });
      expect(withPassword.statusCode).toBe(200);

      // And a plain login works again.
      const after = (await json(
        await app.inject({
          method: 'POST',
          url: '/v1/auth/login',
          payload: { email, password: pw },
        }),
      )) as never as { accessToken?: string; mfaRequired?: boolean };
      expect(after.accessToken).toBeTruthy();
      expect(after.mfaRequired).toBeUndefined();
    });
  });

  describe('attacks are blocked, not merely unlikely', () => {
    // Each of these was probed against a running server first. They are here so
    // the probe does not have to be re-run by hand to know they still fail.
    let victim: { token: string; supportId: string; triggerId: string };
    let attacker: string;

    beforeAll(async () => {
      const make = async (tag: string) => {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/auth/register',
          payload: {
            email: `atk-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@cleat.app`,
            password: 'a-long-enough-password',
            displayName: tag,
          },
        });
        return (await json(response)) as never as { accessToken: string };
      };

      const v = await make('victim');
      const a = await make('attacker');
      attacker = a.accessToken;

      const support = (await json(
        await app.inject({
          method: 'POST',
          url: '/v1/support',
          headers: { authorization: `Bearer ${v.accessToken}` },
          payload: { name: 'Victim Sister', phone: '+46700000000' },
        }),
      )) as never as { contact: { id: string } };
      const trigger = (await json(
        await app.inject({
          method: 'POST',
          url: '/v1/triggers',
          headers: { authorization: `Bearer ${v.accessToken}` },
          payload: { label: 'stress', kind: 'emotion' },
        }),
      )) as never as { trigger: { id: string } };

      // Assert the ids exist. Reading the wrong field would put "undefined" in
      // the URL, the uuid check would reject it, and an IDOR test that never
      // reached an authorization check would pass forever.
      expect(support.contact?.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(trigger.trigger?.id).toMatch(/^[0-9a-f-]{36}$/);

      victim = {
        token: v.accessToken,
        supportId: support.contact.id,
        triggerId: trigger.trigger.id,
      };
    });

    it('IDOR: another account cannot delete a support contact by id', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/v1/support/${victim.supportId}`,
        headers: { authorization: `Bearer ${attacker}` },
      });
      expect([403, 404]).toContain(response.statusCode);

      // And it is still there. A 404 that deleted the row anyway would pass
      // the status check and fail the person.
      const still = (await json(
        await app.inject({
          method: 'GET',
          url: '/v1/support',
          headers: { authorization: `Bearer ${victim.token}` },
        }),
      )) as never as { contacts: { id: string }[] };
      expect(still.contacts.map((c) => c.id)).toContain(victim.supportId);
    });

    it('IDOR: another account cannot delete a trigger by id', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/v1/triggers/${victim.triggerId}`,
        headers: { authorization: `Bearer ${attacker}` },
      });
      expect([403, 404]).toContain(response.statusCode);
    });

    it('mass assignment: role cannot be set at registration', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          email: `esc-${Date.now()}@cleat.app`,
          password: 'a-long-enough-password',
          role: 'owner',
        },
      });
      const body = (await json(response)) as never as { user: { role: string } };
      expect(body.user.role).toBe('member');
    });

    it('a token signed with alg=none is rejected', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/dashboard',
        headers: {
          authorization:
            'Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJhIiwidGlkIjoiYiJ9.',
        },
      });
      expect(response.statusCode).toBe(401);
    });

    it('malformed and oversized bodies are client errors, not 500s', async () => {
      // These used to fall through to the generic 500 handler, which told the
      // caller the server broke and polluted the error rate that pages
      // somebody at 3am.
      const malformed = await app.inject({
        method: 'POST',
        url: '/v1/cravings',
        headers: { authorization: `Bearer ${attacker}`, 'content-type': 'application/json' },
        payload: '{"intensity":',
      });
      expect(malformed.statusCode).toBe(400);

      const empty = await app.inject({
        method: 'DELETE',
        url: `/v1/support/${victim.supportId}`,
        headers: { authorization: `Bearer ${attacker}`, 'content-type': 'application/json' },
      });
      expect(empty.statusCode).toBeLessThan(500);
    });

    it('error responses disclose nothing internal', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/cravings',
        headers: { authorization: `Bearer ${attacker}` },
        payload: { intensity: 'not-a-number' },
      });
      const body = response.body;
      for (const leak of ['at Object.', 'node_modules', '/workspace', 'SELECT ', 'pg_']) {
        expect(body).not.toContain(leak);
      }
    });

    it('SQL injection in a path or query parameter does not reach the database', async () => {
      for (const payload of ["' OR '1'='1", "'; DROP TABLE users; --", "1' UNION SELECT null--"]) {
        const byQuery = await app.inject({
          method: 'GET',
          url: `/v1/cravings?limit=${encodeURIComponent(payload)}`,
          headers: { authorization: `Bearer ${attacker}` },
        });
        const byPath = await app.inject({
          method: 'PATCH',
          url: `/v1/cravings/${encodeURIComponent(payload)}`,
          headers: { authorization: `Bearer ${attacker}` },
          payload: { outcome: 'passed' },
        });
        expect(byQuery.statusCode).toBeLessThan(500);
        expect(byPath.statusCode).toBeLessThan(500);
      }
      // The table is still there.
      const alive = await app.inject({
        method: 'GET',
        url: '/v1/me',
        headers: { authorization: `Bearer ${attacker}` },
      });
      expect(alive.statusCode).toBe(200);
    });

    it('account deletion requires the password, not just a confirmation word', async () => {
      const wrong = await app.inject({
        method: 'DELETE',
        url: '/v1/privacy/account',
        headers: { authorization: `Bearer ${attacker}` },
        payload: { confirm: 'RADERA', password: 'not-the-password' },
      });
      expect(wrong.statusCode).toBe(401);

      const missing = await app.inject({
        method: 'DELETE',
        url: '/v1/privacy/account',
        headers: { authorization: `Bearer ${attacker}` },
        payload: { confirm: 'RADERA' },
      });
      expect(missing.statusCode).toBe(400);

      // The account survived both attempts.
      const alive = await app.inject({
        method: 'GET',
        url: '/v1/me',
        headers: { authorization: `Bearer ${attacker}` },
      });
      expect(alive.statusCode).toBe(200);
    });

    it('a replayed refresh token ends every session for that account', async () => {
      // Rotation alone meant a stolen token worked once and the loser of the
      // race simply signed in again, while the winner kept a live session.
      // Replaying a consumed token is proof two parties hold it.
      const account = (await json(
        await app.inject({
          method: 'POST',
          url: '/v1/auth/register',
          payload: {
            email: `reuse-${Date.now()}@cleat.app`,
            password: 'a-long-enough-password',
          },
        }),
      )) as never as { accessToken: string; refreshToken: string };

      const rotated = (await json(
        await app.inject({
          method: 'POST',
          url: '/v1/auth/refresh',
          payload: { refreshToken: account.refreshToken },
        }),
      )) as never as { refreshToken: string; accessToken: string };

      // The thief replays the original.
      const replay = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        payload: { refreshToken: account.refreshToken },
      });
      expect(replay.statusCode).toBe(401);

      // Everything the legitimate client holds is now dead too — both the
      // refresh token it rotated to and the access token it was issued.
      const afterRefresh = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        payload: { refreshToken: rotated.refreshToken },
      });
      expect(afterRefresh.statusCode).toBe(401);

      const afterAccess = await app.inject({
        method: 'GET',
        url: '/v1/dashboard',
        headers: { authorization: `Bearer ${rotated.accessToken}` },
      });
      expect(afterAccess.statusCode).toBe(401);
    });

    it('signing out invalidates the access token, not only the refresh token', async () => {
      const account = (await json(
        await app.inject({
          method: 'POST',
          url: '/v1/auth/register',
          payload: {
            email: `logout-${Date.now()}@cleat.app`,
            password: 'a-long-enough-password',
          },
        }),
      )) as never as { accessToken: string };
      const auth = { authorization: `Bearer ${account.accessToken}` };

      expect((await app.inject({ method: 'GET', url: '/v1/me', headers: auth })).statusCode).toBe(
        200,
      );
      await app.inject({ method: 'POST', url: '/v1/auth/logout', headers: auth });

      // Previously this stayed 200 for the token's full fifteen minutes.
      expect((await app.inject({ method: 'GET', url: '/v1/me', headers: auth })).statusCode).toBe(
        401,
      );
    });

    it('a completed password reset ends existing sessions', async () => {
      const email = `reset-sess-${Date.now()}@cleat.app`;
      const account = (await json(
        await app.inject({
          method: 'POST',
          url: '/v1/auth/register',
          payload: { email, password: 'a-long-enough-password' },
        }),
      )) as never as { accessToken: string };

      const tenant = await ensureDefaultTenant();
      const issued = await withTenant(tenant.id, async (client) => {
        const { rows } = await client.query<{ id: string }>(
          'SELECT id FROM users WHERE lower(email) = lower($1)',
          [email],
        );
        return issueToken(client, {
          tenantId: tenant.id,
          userId: rows[0]!.id,
          purpose: 'password_reset',
        });
      });

      await app.inject({
        method: 'POST',
        url: '/v1/auth/reset-password',
        payload: { token: issued.token, password: 'a-completely-new-password' },
      });

      // The reason somebody resets a password is usually that they think
      // another person is in the account. That person must lose access now,
      // not when the token happens to expire.
      const stillIn = await app.inject({
        method: 'GET',
        url: '/v1/me',
        headers: { authorization: `Bearer ${account.accessToken}` },
      });
      expect(stillIn.statusCode).toBe(401);
    });

    it('serves a content security policy and HSTS', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/public/meta' });
      expect(response.headers['content-security-policy']).toContain("default-src 'none'");
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('observability leaks nothing about a person', () => {
    it('labels metrics with the route template, never the resolved URL', async () => {
      // Hit a route with an id in the path, then check the id is not in the
      // metrics. A metrics store is scraped, kept for months and rendered on
      // dashboards shared far more casually than a database.
      const id = '11111111-2222-3333-4444-555555555555';
      await app.inject({
        method: 'PATCH',
        url: `/v1/cravings/${id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { outcome: 'passed' },
      });

      const response = await app.inject({ method: 'GET', url: '/metrics' });
      expect(response.body).not.toContain(id);
      expect(response.body).toContain('/v1/cravings/:id');
    });

    it('records an unrecognised URL as "unmatched" rather than echoing it', async () => {
      // A 404 must not put an attacker-chosen path into the metrics store, and
      // must not create a new time series per probe.
      await app.inject({ method: 'GET', url: '/v1/does-not-exist/secret-looking-value' });
      const response = await app.inject({ method: 'GET', url: '/metrics' });
      expect(response.body).not.toContain('secret-looking-value');
      expect(response.body).toContain('route="unmatched"');
    });

    it('carries no tenant or user identifier in any metric', async () => {
      const tenant = await ensureDefaultTenant();
      const response = await app.inject({ method: 'GET', url: '/metrics' });
      expect(response.body).not.toContain(tenant.id);
      expect(response.body).not.toContain(alice);
      // No label named after a person or an organisation, either.
      expect(response.body).not.toMatch(/\b(user|tenant|email|patient)=/);
    });

    it('exposes latency as a histogram Prometheus can read', async () => {
      const response = await app.inject({ method: 'GET', url: '/metrics' });
      expect(response.body).toContain('# TYPE cleat_http_request_duration_ms histogram');
      expect(response.body).toContain('cleat_http_request_duration_ms_bucket{');
      expect(response.body).toContain('le="+Inf"');
      expect(response.body).toContain('cleat_http_request_duration_ms_count{');
    });

    it('pseudonymises the user in an error report and keeps bodies out', () => {
      const report = buildReport(new Error('boom while saving a craving'), {
        route: '/v1/cravings/:id',
        method: 'POST',
        statusCode: 500,
        userId: 'a-real-user-id',
        tenantId: 'a-real-tenant-id',
      });
      expect(report.context.user).not.toBe('a-real-user-id');
      expect(report.context.user).toMatch(/^[0-9a-f]{16}$/);
      expect(report.context.tenant).not.toBe('a-real-tenant-id');
      // Stable across reports, so the same person is recognisable without the
      // reporter learning who they are.
      expect(buildReport(new Error('again'), { userId: 'a-real-user-id' }).context.user).toBe(
        report.context.user,
      );
      // Nothing in the shape can hold a request body.
      expect(JSON.stringify(report)).not.toContain('password');
      expect(Object.keys(report.context).sort()).toEqual([
        'method',
        'route',
        'statusCode',
        'tenant',
        'user',
      ]);
    });
  });

  describe('the public surface needs no account', () => {
    // The crisis numbers used to sit behind a login, so somebody who found the
    // product mid-crisis had to register before it would tell them what to
    // ring. Any change that puts them back behind auth must fail here.
    it('serves emergency resources with no token at all', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/public/safety/resources?country=SE',
      });
      expect(response.statusCode).toBe(200);
      const body = (await json(response)) as never as {
        resources: { contact: string; label: string }[];
      };
      expect(body.resources.map((r) => r.contact)).toContain('112');
      expect(body.resources.map((r) => r.contact)).toContain('90101');
      // Labels must be translated, not raw keys.
      expect(body.resources[0]?.label).not.toMatch(/^resource\./);
    });

    it('triages without an account and without storing anything', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/public/safety/triage',
        payload: { text: 'jag tänker ta livet av mig', country: 'SE' },
      });
      expect(response.statusCode).toBe(200);
      const body = (await json(response)) as never as {
        level: string;
        bypassCoach: boolean;
        stored: boolean;
      };
      expect(body.level).toBe('emergency');
      expect(body.bypassCoach).toBe(true);
      expect(body.stored).toBe(false);
    });

    it('publishes an OpenAPI document that describes the endpoints that exist', async () => {
      // /v1/public/meta advertises this path. An advertised document that
      // 404s is the API lying about itself.
      const meta = (await json(
        await app.inject({ method: 'GET', url: '/v1/public/meta' }),
      )) as never as { docs: string };

      const response = await app.inject({ method: 'GET', url: meta.docs });
      expect(response.statusCode).toBe(200);
      const doc = (await json(response)) as never as {
        openapi: string;
        paths: Record<string, unknown>;
      };
      expect(doc.openapi).toMatch(/^3\./);

      // Every documented path must actually answer. A spec describing routes
      // that do not exist is worse than no spec.
      for (const path of Object.keys(doc.paths)) {
        const probe =
          path === '/v1/public/safety/triage'
            ? await app.inject({ method: 'POST', url: path, payload: { text: 'hej' } })
            : await app.inject({ method: 'GET', url: path });
        expect(probe.statusCode, `${path} is documented but did not answer`).toBeLessThan(400);
      }
    });

    it('answers in the language the caller asked for', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/public/safety/resources?country=GB&locale=en',
      });
      const body = (await json(response)) as never as { disclaimer: string };
      expect(body.disclaimer.length).toBeGreaterThan(0);
    });
  });

  describe('registration and login', () => {
    it('rejects a short password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: { email: `short+${Date.now()}@example.com`, password: 'short' },
      });
      expect(response.statusCode).toBe(400);
      expect((await json(response)).error).toMatchObject({ code: 'weak_password' });
    });

    it('registers into the shared consumer tenant', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: { email: alice, password, displayName: 'Alice', locale: 'sv', country: 'SE' },
      });
      expect(response.statusCode).toBe(201);
      const body = (await json(response)) as never as {
        accessToken: string;
        refreshToken: string;
        user: { email: string };
      };
      expect(body.user.email).toBe(alice);
      accessToken = body.accessToken;
    });

    it('refuses a duplicate email in the same tenant', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: { email: alice, password },
      });
      expect(response.statusCode).toBe(409);
    });

    it('refuses self sign-up into a clinic tenant', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        headers: { 'x-tenant': clinicSlug },
        payload: { email: `walkin+${Date.now()}@example.com`, password },
      });
      expect(response.statusCode).toBe(403);
    });

    it('logs in with the right password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: alice, password },
      });
      expect(response.statusCode).toBe(200);
    });

    it('rejects the wrong password without revealing which part was wrong', async () => {
      const wrongPassword = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: alice, password: 'not-the-right-password' },
      });
      const noSuchUser = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        // Unique per run, like `alice` above. A fixed address accumulates a
        // failure here on every run, and the account lockout keeps its counter
        // in Postgres for fifteen minutes — so on the fifth run inside a
        // quarter of an hour this assertion started getting 429 instead of
        // 401, on a code path nobody had touched.
        payload: { email: `nobody+${Date.now()}@example.com`, password },
      });
      expect(wrongPassword.statusCode).toBe(401);
      expect(noSuchUser.statusCode).toBe(401);
      expect(await json(wrongPassword)).toEqual(await json(noSuchUser));
    });

    it('rotates the refresh token on use', async () => {
      // On its own account: replaying a consumed token now ends every session
      // for that user, which is the point of the reuse-detection test further
      // up — and would take the shared fixture down with it.
      const own = (await json(
        await app.inject({
          method: 'POST',
          url: '/v1/auth/register',
          payload: {
            email: `rotate-${Date.now()}@example.com`,
            password,
          },
        }),
      )) as never as { refreshToken: string };

      const first = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        payload: { refreshToken: own.refreshToken },
      });
      expect(first.statusCode).toBe(200);
      const rotated = (await json(first)) as never as { refreshToken: string };
      expect(rotated.refreshToken).not.toBe(own.refreshToken);

      // The old one is dead the moment it is used.
      const replay = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        payload: { refreshToken: own.refreshToken },
      });
      expect(replay.statusCode).toBe(401);
    });
  });

  describe('authentication is required', () => {
    it('rejects a missing token', async () => {
      const response = await app.inject({ method: 'GET', url: '/v1/dashboard' });
      expect(response.statusCode).toBe(401);
    });

    it('rejects a forged token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/dashboard',
        headers: { authorization: 'Bearer not.a.real.token' },
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('the quit plan', () => {
    it('returns the medical warning when the substance has dangerous withdrawal', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/quit',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          substance: 'alcohol',
          baselineUnitsPerDay: 6,
          unitCostMinor: 3000,
          currency: 'SEK',
          startedAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
        },
      });
      expect(response.statusCode).toBe(201);
      const body = (await json(response)) as never as {
        detoxWarning: { required: boolean; message: string };
      };
      expect(body.detoxWarning.required).toBe(true);
      expect(body.detoxWarning.message).toContain('livsfarligt');
    });
  });

  describe('the dashboard', () => {
    it('returns streak, reclaimed money, milestones and seven indicators', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/dashboard',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(response.statusCode).toBe(200);
      const body = (await json(response)) as never as {
        streak: { currentDays: number };
        reclaimed: { soFar: { moneyMinor: number } };
        milestones: { reached: unknown[] };
        indicators: unknown[];
        mantra: string;
      };
      expect(body.streak.currentDays).toBe(10);
      expect(body.reclaimed.soFar.moneyMinor).toBe(10 * 6 * 3000);
      expect(body.milestones.reached.length).toBeGreaterThan(0);
      expect(body.indicators).toHaveLength(7);
      expect(body.mantra.length).toBeGreaterThan(0);
    });
  });

  describe('the craving flow', () => {
    it('builds a plan without recording anything about the person', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/craving/plan',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { feeling: 'social_pressure', location: 'with_users', intensity: 9 },
      });
      expect(response.statusCode).toBe(200);
      const body = (await json(response)) as never as {
        leaveFirst: boolean;
        delayMinutes: number;
        tools: { id: string }[];
        protocol: string[];
      };
      expect(body.leaveFirst).toBe(true);
      expect(body.tools[0]?.id).toBe('leave_the_situation');
      expect(body.delayMinutes).toBe(5);
      expect(body.protocol).toHaveLength(10);

      const cravings = await app.inject({
        method: 'GET',
        url: '/v1/cravings',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(((await json(cravings)) as never as { cravings: unknown[] }).cravings).toHaveLength(0);
    });

    it('logs a craving and lets the outcome be filled in later', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/v1/cravings',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { intensity: 8, feeling: 'stress', location: 'home', trigger: 'Bråk på jobbet' },
      });
      expect(created.statusCode).toBe(201);
      const id = ((await json(created)) as never as { craving: { id: string } }).craving.id;

      const updated = await app.inject({
        method: 'PATCH',
        url: `/v1/cravings/${id}`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { outcome: 'resisted', actionTaken: 'Ringde Jonas' },
      });
      expect(updated.statusCode).toBe(200);
      expect(
        ((await json(updated)) as never as { craving: { outcome: string } }).craving.outcome,
      ).toBe('resisted');
    });
  });

  describe('check-ins', () => {
    it('is idempotent for the same day and kind', async () => {
      const day = '2026-03-01';
      const first = await app.inject({
        method: 'POST',
        url: '/v1/checkins',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { kind: 'morning', day, sleepQuality: 4, stress: 8 },
      });
      const second = await app.inject({
        method: 'POST',
        url: '/v1/checkins',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { kind: 'morning', day, sleepQuality: 7, stress: 3 },
      });
      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(201);

      const list = await app.inject({
        method: 'GET',
        url: '/v1/checkins',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const checkIns = ((await json(list)) as never as {
        checkIns: { day: string; sleepQuality: number }[];
      }).checkIns.filter((c) => c.day === day);
      expect(checkIns).toHaveLength(1);
      expect(checkIns[0]?.sleepQuality).toBe(7);
    });
  });

  describe('relapse', () => {
    it('records the relapse without erasing the earlier recovery', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/relapse',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          occurredAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
          autopsy: {
            firstTrigger: 'Bråk med chefen',
            thought: 'Jag förtjänar en öl',
            whatCouldHaveBrokenTheChain: 'Ringt Jonas på vägen hem',
            whatChangesNow: 'Åker inte förbi butiken',
          },
        },
      });
      expect(response.statusCode).toBe(201);
      const body = (await json(response)) as never as {
        message: string;
        protectionPlan: { warningSigns: string[]; needsWork: boolean };
        streak: { currentDays: number; longestDays: number; totalDaysInRecovery: number };
      };
      expect(body.protectionPlan.warningSigns).toContain('Bråk med chefen');
      expect(body.protectionPlan.needsWork).toBe(false);
      expect(body.streak.currentDays).toBe(2);
      // The point of the whole design: the earlier streak is still there.
      expect(body.streak.longestDays).toBe(8);
      expect(body.streak.totalDaysInRecovery).toBe(10);
    });
  });

  describe('login is not a free guessing gallery', () => {
    // The global limit is 300/minute. Without a per-route brake that is 300
    // password guesses a minute against an account holding somebody's relapse
    // history.
    it('locks a single account out well before the global limit', async () => {
      const attempt = () =>
        app.inject({
          method: 'POST',
          url: '/v1/auth/login',
          payload: { email: 'bruteforce@cleat.app', password: 'wrong-password' },
        });

      const codes: number[] = [];
      for (let i = 0; i < 12; i += 1) codes.push((await attempt()).statusCode);

      expect(codes).toContain(429);
      expect(codes.indexOf(429)).toBeLessThan(10);
    });

    it('does not lock out everyone sharing an address', async () => {
      // Mobile carriers put thousands of real people behind one IP via CGNAT.
      // A per-IP limit tight enough to matter against an attacker would lock
      // out an entire phone network, so the per-IP ceiling is deliberately far
      // looser than the per-account one — and successes never count at all.
      const email = `shared-${Date.now()}@cleat.app`;
      await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: { email, password: 'correct-horse-battery', displayName: 'Shared' },
      });
      for (let i = 0; i < 5; i += 1) {
        const ok = await app.inject({
          method: 'POST',
          url: '/v1/auth/login',
          payload: { email, password: 'correct-horse-battery' },
        });
        expect(ok.statusCode).toBe(200);
      }
    });

    it('says nothing that confirms the account exists', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: 'bruteforce@cleat.app', password: 'wrong-password' },
      });
      // Same wording as a wrong password: a different message would tell an
      // attacker they had found a real account.
      const body = (await json(response)) as never as { error: { message: string } };
      expect(body.error.message).toBe('Invalid credentials');
    });

    it('still lets the real person in after a couple of typos', async () => {
      const email = `typo-${Date.now()}@cleat.app`;
      await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: { email, password: 'correct-horse-battery', displayName: 'Typo' },
      });
      for (let i = 0; i < 2; i += 1) {
        await app.inject({
          method: 'POST',
          url: '/v1/auth/login',
          payload: { email, password: 'nope' },
        });
      }
      const ok = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email, password: 'correct-horse-battery' },
      });
      expect(ok.statusCode).toBe(200);
    });
  });

  describe('account recovery', () => {
    const forgetful = `forgetful-${Date.now()}@cleat.app`;
    let resetToken: string;

    it('registers an account to lose the password to', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: { email: forgetful, password: 'the-original-password', displayName: 'F' },
      });
      expect(response.statusCode).toBe(201);
    });

    it('answers identically for a real and an unknown address', async () => {
      // Anything else makes this endpoint a membership oracle. "Is this person
      // in a recovery app" is precisely the question an employer, an insurer
      // or an abusive partner would like answered.
      const known = await app.inject({
        method: 'POST',
        url: '/v1/auth/forgot-password',
        payload: { email: forgetful },
      });
      const unknown = await app.inject({
        method: 'POST',
        url: '/v1/auth/forgot-password',
        payload: { email: `nobody-${Date.now()}@cleat.app` },
      });
      expect(known.statusCode).toBe(202);
      expect(unknown.statusCode).toBe(202);
      expect(known.body).toBe(unknown.body);
    });

    it('stores only a hash of the token', async () => {
      const tenant = await ensureDefaultTenant();
      const stored = await withTenant(tenant.id, async (client) => {
        const { rows } = await client.query<{ token_hash: string }>(
          `SELECT token_hash FROM account_tokens
            WHERE purpose = 'password_reset' AND consumed_at IS NULL
            ORDER BY created_at DESC LIMIT 1`,
        );
        return rows[0]?.token_hash ?? '';
      });
      // A sha256 hex digest, not something that could be pasted into a URL.
      expect(stored).toMatch(/^[0-9a-f]{64}$/);
    });

    it('issues a token that resets the password exactly once', async () => {
      const tenant = await ensureDefaultTenant();

      // Mint one directly: the plaintext only ever exists in the mail, which
      // is the property under test everywhere else.
      const issued = await withTenant(tenant.id, async (client) => {
        const { rows } = await client.query<{ id: string }>(
          'SELECT id FROM users WHERE lower(email) = lower($1)',
          [forgetful],
        );
        const userId = rows[0]!.id;
        return issueToken(client, { tenantId: tenant.id, userId, purpose: 'password_reset' });
      });
      resetToken = issued.token;

      const first = await app.inject({
        method: 'POST',
        url: '/v1/auth/reset-password',
        payload: { token: resetToken, password: 'a-brand-new-password' },
      });
      expect(first.statusCode).toBe(200);

      const replay = await app.inject({
        method: 'POST',
        url: '/v1/auth/reset-password',
        payload: { token: resetToken, password: 'another-password-entirely' },
      });
      expect(replay.statusCode).toBe(400);
    });

    it('lets the new password in and the old one out', async () => {
      const fresh = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: forgetful, password: 'a-brand-new-password' },
      });
      expect(fresh.statusCode).toBe(200);

      const stale = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: forgetful, password: 'the-original-password' },
      });
      expect(stale.statusCode).toBe(401);
    });

    it('rejects a weak new password rather than accepting it quietly', async () => {
      const tenant = await ensureDefaultTenant();
      const issued = await withTenant(tenant.id, async (client) => {
        const { rows } = await client.query<{ id: string }>(
          'SELECT id FROM users WHERE lower(email) = lower($1)',
          [forgetful],
        );
        return issueToken(client, {
          tenantId: tenant.id,
          userId: rows[0]!.id,
          purpose: 'password_reset',
        });
      });
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/reset-password',
        payload: { token: issued.token, password: 'short' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('refuses an expired token', async () => {
      const tenant = await ensureDefaultTenant();
      const issued = await withTenant(tenant.id, async (client) => {
        const { rows } = await client.query<{ id: string }>(
          'SELECT id FROM users WHERE lower(email) = lower($1)',
          [forgetful],
        );
        const token = await issueToken(client, {
          tenantId: tenant.id,
          userId: rows[0]!.id,
          purpose: 'password_reset',
        });
        await client.query(
          `UPDATE account_tokens SET expires_at = now() - interval '1 minute'
            WHERE consumed_at IS NULL AND purpose = 'password_reset'`,
        );
        return token;
      });
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/reset-password',
        payload: { token: issued.token, password: 'yet-another-password' },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('the coach', () => {
    it('never reaches the model for an emergency and returns resources instead', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/coach/message',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { message: 'jag orkar inte mer, jag vill ta livet av mig' },
      });
      expect(response.statusCode).toBe(200);
      const body = (await json(response)) as never as {
        safety: { level: string; bypassedCoach: boolean; resources: { contact: string }[] };
        source: string;
      };
      expect(body.safety.level).toBe('emergency');
      expect(body.safety.bypassedCoach).toBe(true);
      expect(body.safety.resources.map((r) => r.contact)).toContain('112');
      expect(body.source).toBe('local');
    });

    it('names a negotiation without shaming', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/coach/message',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { message: 'jag har varit duktig hela veckan, bara en gång kan väl inte skada' },
      });
      const body = (await json(response)) as never as {
        negotiation: { detected: boolean; types: string[] };
        reply: string;
      };
      expect(body.negotiation.detected).toBe(true);
      expect(body.negotiation.types).toContain('just_once');
      expect(body.reply.length).toBeGreaterThan(0);
    });

    it('speaks Swedish all the way through, including interpolated enums', async () => {
      // Regression: the local coach interpolated an insight's raw parameters, so
      // a Swedish reply read "dina sug kommer oftast afternoon" — an English
      // enum surfacing in the one sentence that claims to know the person's own
      // pattern. The dashboard route localised these; this path did not.
      const response = await app.inject({
        method: 'POST',
        url: '/v1/coach/message',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { message: 'hur går det för mig egentligen' },
      });
      const { reply } = (await json(response)) as never as { reply: string };
      for (const leaked of ['afternoon', 'evening', 'morning', 'undefined']) {
        expect(reply.toLowerCase()).not.toContain(leaked);
      }
    });

    it('keeps a transcript', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/coach/history',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const messages = ((await json(response)) as never as { messages: unknown[] }).messages;
      expect(messages.length).toBeGreaterThanOrEqual(4);
    });

    it('does not fold a Cleat Nära conversation into the recovery transcript', async () => {
      // The supporter surface is stored nowhere and reads nothing. A relative's
      // "I can't cope" is not a turn in the account holder's recovery record —
      // it must not surface the next time they open /coach, and it must not be
      // fed back as context across the two system prompts. The screen keeps the
      // conversation ephemeral; the regression was that the server did not, and
      // wrote the supporter turns into the shared coach memory.
      const before = await app.inject({
        method: 'GET',
        url: '/v1/coach/history',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const countBefore = ((await json(before)) as never as { messages: unknown[] }).messages
        .length;

      const supporter = await app.inject({
        method: 'POST',
        url: '/v1/coach/message',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          message: 'jag är anhörig och jag orkar inte längre med hans drickande',
          mode: 'supporter',
        },
      });
      expect(supporter.statusCode).toBe(200);

      const after = await app.inject({
        method: 'GET',
        url: '/v1/coach/history',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const messagesAfter = ((await json(after)) as never as {
        messages: { content: string }[];
      }).messages;
      expect(messagesAfter.length).toBe(countBefore);
      expect(messagesAfter.some((m) => m.content.includes('anhörig'))).toBe(false);
    });
  });

  describe('rebuild my life', () => {
    it('offers only the domains the current phase makes realistic', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/rebuild',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(response.statusCode).toBe(200);
      const body = (await json(response)) as never as {
        domains: { id: string }[];
        locked: { id: string }[];
        suggestion: { domain: string } | null;
        progress: { total: number };
      };
      const ids = body.domains.map((d) => d.id);
      expect(ids).toContain('sleep');
      // The relapse recorded above put this account back into the acute phase,
      // so identity work is deferred rather than offered.
      expect(ids).not.toContain('identity');
      expect(body.locked.map((d) => d.id)).toContain('identity');
      expect(body.suggestion).not.toBeNull();
      expect(body.progress.total).toBeGreaterThan(0);
    });

    it('records progress on a domain and reads it back', async () => {
      const put = await app.inject({
        method: 'PUT',
        url: '/v1/rebuild/sleep',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { status: 'working', note: 'Ingen skärm efter 22' },
      });
      expect(put.statusCode).toBe(200);
      expect((await json(put)) as never as { status: string }).toMatchObject({
        status: 'working',
      });

      const view = await app.inject({
        method: 'GET',
        url: '/v1/rebuild',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const sleep = ((await json(view)) as never as { domains: { id: string; status: string }[] })
        .domains.find((d) => d.id === 'sleep');
      expect(sleep?.status).toBe('working');
    });

    it('rejects a domain that does not exist', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/v1/rebuild/cryptocurrency',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { status: 'working' },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('tenant isolation', () => {
    it('does not let one tenant see another tenant’s data', async () => {
      const clinicLogin = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        headers: { 'x-tenant': clinicSlug },
        payload: { email: clinicPatient, password },
      });
      expect(clinicLogin.statusCode).toBe(200);
      const clinicToken = ((await json(clinicLogin)) as never as { accessToken: string })
        .accessToken;

      const clinicDashboard = await app.inject({
        method: 'GET',
        url: '/v1/dashboard',
        headers: { authorization: `Bearer ${clinicToken}` },
      });
      const body = (await json(clinicDashboard)) as never as {
        quit: unknown;
        user: { email: string };
      };
      // Alice's plan, cravings and relapse are invisible here — enforced by the
      // row-level security policy, not by a WHERE clause someone could forget.
      expect(body.user.email).toBe(clinicPatient);
      expect(body.quit).toBeNull();
    });

    it('ignores an x-tenant header on an authenticated request', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/dashboard',
        headers: { authorization: `Bearer ${accessToken}`, 'x-tenant': clinicSlug },
      });
      // The tenant comes from the signed token; the header cannot move a session
      // sideways into someone else's organisation.
      expect(((await json(response)) as never as { user: { email: string } }).user.email).toBe(
        alice,
      );
    });

    it('returns nothing at all when no tenant context is set', async () => {
      const rows = await withTenant('00000000-0000-0000-0000-000000000000', async (client) => {
        const result = await client.query('SELECT count(*)::int AS count FROM cravings');
        return result.rows[0].count as number;
      });
      expect(rows).toBe(0);
    });
  });

  describe('row-level security fails closed, on a warm connection too', () => {
    it('returns no rows rather than raising when there is no tenant context', async () => {
      // PostgreSQL reverts a transaction-local custom GUC to the empty string,
      // not to unset. So on any pooled connection that has already served one
      // request, `current_setting('app.tenant_id', true)` is '' rather than
      // NULL, and the original policies evaluated `''::uuid` — which raises
      // "invalid input syntax for type uuid" instead of returning nothing.
      //
      // Isolation still held (it failed closed, loudly), but it failed as a
      // 500 on a path that expected an empty result, and only after the pool
      // warmed up. Migration 008 restores the documented behaviour.
      // Warm a pooled connection by running one transaction with a context.
      const probe = await createTenant(`rls-probe-${Date.now()}`, 'RLS probe');
      await withTenant(probe.id, async (client) => {
        await client.query('SELECT 1');
      });

      const rows = await withoutTenant(async (client) => {
        const result = await client.query<{ count: string }>(
          'SELECT count(*)::text AS count FROM users',
        );
        return Number(result.rows[0]!.count);
      });
      expect(rows).toBe(0);
    });
  });

  describe('privacy', () => {
    it('exports everything the app holds', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/privacy/export',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(response.statusCode).toBe(200);
      const body = (await json(response)) as never as {
        user: unknown;
        cravings: unknown[];
        coachMessages: unknown[];
      };
      expect(body.user).toBeTruthy();
      expect(Array.isArray(body.cravings)).toBe(true);
      expect(Array.isArray(body.coachMessages)).toBe(true);
    });

    it('requires the confirmation word before deleting an account', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/privacy/account',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { confirm: 'maybe' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('deletes the account and everything attached to it', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/privacy/account',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { confirm: 'RADERA', password },
      });
      expect(response.statusCode).toBe(200);

      const afterwards = await app.inject({
        method: 'GET',
        url: '/v1/dashboard',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(afterwards.statusCode).toBe(401);
    });
  });
});
