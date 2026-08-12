import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from './app.js';
import { closePool } from './db/pool.js';
import * as pool from './db/pool.js';

/**
 * What still works when the database does not.
 *
 * This is the most important resilience property in the product and it had no
 * test at all. Everything an authenticated user does needs Postgres, and that
 * is fine — a dashboard can wait. The crisis surface cannot. Somebody typing
 * "jag vill inte leva längre" at three in the morning has to get the emergency
 * number whether or not our database is up, and they must get it without an
 * account, because requiring one at that moment is its own kind of harm.
 *
 * The property was verified by hand — Postgres stopped, `/v1/public/safety/
 * resources` still answering 200 with 112 in the body — and this file is what
 * keeps it true. It holds by construction: the resources and the triage are
 * computed in `packages/core` from the request alone and touch no client. A
 * refactor that "helpfully" moves the crisis numbers into a table would pass
 * every other test in the suite and fail here.
 */

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

let app: FastifyInstance;

suite('with the database unreachable', () => {
  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Fail every query the way a stopped Postgres does. `getPool` is the single
    // door to the database, so this cuts off every path at once — including any
    // new one somebody adds later without thinking about this file.
    const refused = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
      code: 'ECONNREFUSED',
    });
    vi.spyOn(pool, 'getPool').mockReturnValue({
      query: () => Promise.reject(refused),
      connect: () => Promise.reject(refused),
    } as never);
    vi.spyOn(pool, 'withTenant').mockRejectedValue(refused);
    vi.spyOn(pool, 'withoutTenant').mockRejectedValue(refused);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app?.close();
    await closePool();
  });

  it('still gives out the emergency numbers', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/public/safety/resources?country=SE',
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      resources: { contact: string; kind: string }[];
    };
    // 112 is the number. If this assertion ever needs relaxing, the change is
    // wrong.
    expect(body.resources.some((r) => r.contact.includes('112'))).toBe(true);
    expect(body.resources.some((r) => r.kind === 'emergency')).toBe(true);
  });

  it('still triages an emergency and still says to stop and call', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/public/safety/triage',
      payload: { text: 'jag vill inte leva längre' },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      level: string;
      bypassCoach: boolean;
      resources: unknown[];
    };
    expect(body.level).toBe('emergency');
    expect(body.bypassCoach).toBe(true);
    expect(body.resources.length).toBeGreaterThan(0);
  });

  it('still answers the liveness probe, because the process is alive', async () => {
    // Getting this wrong makes Kubernetes restart every pod during a database
    // outage, turning a recoverable incident into a crash loop.
    const response = await app.inject({ method: 'GET', url: '/healthz' });
    expect(response.statusCode).toBe(200);
  });

  it('fails the readiness probe without naming the host it could not reach', async () => {
    const response = await app.inject({ method: 'GET', url: '/readyz' });
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain('ECONNREFUSED');
    expect(response.body).not.toContain('5432');
    expect(response.body).not.toContain('127.0.0.1');
  });

  it('tells a client to come back rather than to give up', async () => {
    // 503 with Retry-After, not 500: an outage is weather, and the client
    // should retry. A 500 tells it to stop trying.
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'someone@example.com', password: 'a-long-enough-password' },
    });
    expect(response.statusCode).toBe(503);
    expect(response.headers['retry-after']).toBe('5');
    expect(JSON.parse(response.body)).toMatchObject({ error: { code: 'unavailable' } });
  });

  it('leaks nothing about the database in any error body', async () => {
    for (const url of ['/v1/dashboard', '/v1/me', '/v1/cravings']) {
      const response = await app.inject({ method: 'GET', url });
      expect(response.body).not.toContain('ECONNREFUSED');
      expect(response.body).not.toContain('5432');
      expect(response.body.toLowerCase()).not.toContain('postgres');
    }
  });
});
