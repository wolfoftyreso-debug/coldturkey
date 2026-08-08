import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { closePool, withTenant } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { createTenant, ensureDefaultTenant } from './db/tenants.js';
import { hashPassword } from './auth/password.js';
import { createUser } from './db/repository.js';

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
  let refreshToken: string;

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
      refreshToken = body.refreshToken;
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
        payload: { email: 'nobody@example.com', password },
      });
      expect(wrongPassword.statusCode).toBe(401);
      expect(noSuchUser.statusCode).toBe(401);
      expect(await json(wrongPassword)).toEqual(await json(noSuchUser));
    });

    it('rotates the refresh token on use', async () => {
      const first = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        payload: { refreshToken },
      });
      expect(first.statusCode).toBe(200);
      const rotated = (await json(first)) as never as { refreshToken: string };
      expect(rotated.refreshToken).not.toBe(refreshToken);

      // The old one is dead the moment it is used.
      const replay = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        payload: { refreshToken },
      });
      expect(replay.statusCode).toBe(401);
      refreshToken = rotated.refreshToken;
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
        payload: { confirm: 'RADERA' },
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
