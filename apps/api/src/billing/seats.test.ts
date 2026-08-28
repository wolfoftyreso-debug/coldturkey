import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TRIAL_SEATS } from '@cleat/core';
import { buildApp } from '../app.js';
import { closePool, withoutTenant, withTenant } from '../db/pool.js';
import { migrate } from '../db/migrate.js';
import { createTenant, ensureDefaultTenant } from '../db/tenants.js';
import { hashPassword } from '../auth/password.js';
import { createUser } from '../db/repository.js';
import { countMembers } from './repository.js';
import { setMailer, type Mail, type Mailer } from '../mail/smtp.js';

/**
 * The seat ceiling under concurrency.
 *
 * A licence is a number of people, and the only moment that number can be
 * exceeded is the moment an account is created. Checking it is easy; checking
 * it correctly when two people register in the same second is the part that
 * decides whether an organisation can quietly run a thirty-person unit on a
 * twenty-five seat licence.
 *
 * This is not a theoretical race. Registration is exactly the operation that
 * arrives in bursts — a clinic onboarding its staff sits down and does all of
 * them at once.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

class SilentMailer implements Mailer {
  readonly kind = 'log';
  async send(_mail: Mail): Promise<void> {}
}

suite('seat enforcement under concurrency', () => {
  let app: FastifyInstance;
  let tenantId: string;
  let slug: string;
  let origin: string;

  beforeAll(async () => {
    await migrate();
    await ensureDefaultTenant();
    setMailer(new SilentMailer());

    slug = `seat-race-${Date.now()}`;
    const tenant = await createTenant(slug, 'Seat Race Clinic', { publicSignup: true });
    tenantId = tenant.id;

    // A trial: TRIAL_SEATS, with no purchased quantity to lift it to the
    // clinic floor. Small enough to fill, and a real plan rather than a
    // fixture invented for this test.
    await withoutTenant(async (client) => {
      await client.query(`UPDATE tenants SET plan = 'clinic_trial' WHERE id = $1`, [tenantId]);
    });

    // Fill it to one below the ceiling.
    const hash = await hashPassword('a-long-enough-password');
    await withTenant(tenantId, async (client) => {
      for (let i = 0; i < TRIAL_SEATS - 1; i += 1) {
        await createUser(client, {
          tenantId,
          email: `seat-${i}-${Date.now()}@clinic.test`,
          passwordHash: hash,
          displayName: `Seat ${i}`,
        });
      }
    });

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

  it('has exactly one seat left before the race', async () => {
    const members = await withTenant(tenantId, (client) => countMembers(client, tenantId));
    expect(members).toBe(TRIAL_SEATS - 1);
  });

  it('lets exactly one of eight simultaneous registrations through', async () => {
    // Over a real socket, not `app.inject`. Injected requests are dispatched
    // one after another here — measured, after a version of this test passed
    // while every request but the first already saw the seat taken, which
    // would have been a green test proving nothing at all.
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_unused, index) =>
        fetch(`${origin}/v1/auth/register`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-tenant': slug },
          body: JSON.stringify({
            email: `race-${index}-${Date.now()}@clinic.test`,
            password: 'a-long-enough-password',
            displayName: `Race ${index}`,
          }),
        }),
      ),
    );

    const created = responses.filter((response) => response.status === 201).length;
    const refused = responses.filter((response) => response.status === 402).length;

    expect(created, 'one seat, one account').toBe(1);
    expect(refused, 'everyone else is told the licence is full').toBe(7);

    // And the ledger agrees, which is the part a billing dispute turns on.
    const members = await withTenant(tenantId, (client) => countMembers(client, tenantId));
    expect(members).toBe(TRIAL_SEATS);
  });

  it('keeps refusing once the licence is full', async () => {
    const response = await fetch(`${origin}/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant': slug },
      body: JSON.stringify({
        email: `after-${Date.now()}@clinic.test`,
        password: 'a-long-enough-password',
        displayName: 'After',
      }),
    });
    expect(response.status).toBe(402);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'seat_limit_reached',
    );
  });
});
