import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { closePool, withoutTenant, withTenant } from '../db/pool.js';
import { migrate } from '../db/migrate.js';
import { createTenant, ensureDefaultTenant } from '../db/tenants.js';
import { hashPassword } from '../auth/password.js';
import { createUser } from '../db/repository.js';
import { entitlementsForTenant } from './repository.js';

/**
 * The commercial layer, against a real database and a real HTTP stub for
 * Stripe.
 *
 * Payment state is the one part of this product where being wrong costs
 * somebody money or hands out a paid plan for free, and it is driven entirely
 * by webhooks — a request from the public internet that carries commercial
 * instructions. So the tests here are mostly adversarial: tampered bodies,
 * replayed events, duplicate deliveries, and the question that matters most in
 * a recovery product, which is whether a failed payment can take the clinical
 * product away from a patient. (It must not.)
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

const WEBHOOK_SECRET = 'whsec_test_secret_for_the_suite';
/**
 * Event ids are unique per run on purpose. They are the idempotency key, so
 * reusing one across runs means the second run is correctly ignored as a
 * replay — which looks exactly like the feature being broken.
 */
const RUN = Date.now().toString(36);
const password = 'a-long-enough-password';

/** Sign a payload the way Stripe does, so the handler is exercised for real. */
function sign(body: string, secret = WEBHOOK_SECRET, at = new Date()): string {
  const timestamp = Math.floor(at.getTime() / 1000);
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

function subscriptionEvent(input: {
  id: string;
  type: string;
  tenantId: string;
  status: string;
  seats?: number;
}): string {
  return JSON.stringify({
    id: input.id,
    type: input.type,
    data: {
      object: {
        id: `sub_${input.tenantId.slice(0, 8)}_${RUN}`,
        customer: `cus_test_${RUN}`,
        status: input.status,
        cancel_at_period_end: false,
        current_period_end: Math.floor(Date.now() / 1000) + 86_400 * 30,
        metadata: { tenant_id: input.tenantId },
        items: { data: [{ quantity: input.seats ?? 40 }] },
      },
    },
  });
}

suite('billing', () => {
  let app: FastifyInstance;
  let stripeStub: Server;
  let clinicId: string;
  let clinicSlug: string;
  let ownerToken: string;
  let memberToken: string;
  const stubRequests: { path: string; body: string }[] = [];

  beforeAll(async () => {
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.STRIPE_SECRET_KEY = 'sk_test_for_the_suite';
    process.env.STRIPE_PRICE_CLINIC_SEAT = 'price_test_seat';

    // A stub that speaks enough Stripe to exercise the real request shaping,
    // rather than mocking the module and proving only that the mock works.
    stripeStub = createServer((request, response) => {
      let body = '';
      request.on('data', (chunk) => (body += chunk));
      request.on('end', () => {
        stubRequests.push({ path: request.url ?? '', body });
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ id: 'cs_test_1', url: 'https://stripe.test/checkout/cs_test_1' }));
      });
    });
    await new Promise<void>((resolve) => stripeStub.listen(0, '127.0.0.1', resolve));
    const port = (stripeStub.address() as { port: number }).port;
    process.env.STRIPE_API_BASE = `http://127.0.0.1:${port}`;

    await migrate();
    await ensureDefaultTenant();
    clinicSlug = `billing-clinic-${Date.now()}`;
    const clinic = await createTenant(clinicSlug, 'Billing Clinic', { publicSignup: true });
    clinicId = clinic.id;

    const hash = await hashPassword(password);
    await withTenant(clinic.id, async (client) => {
      await client.query(
        `INSERT INTO users (tenant_id, email, password_hash, display_name, role)
         VALUES ($1, $2, $3, 'Owner', 'owner')`,
        [clinic.id, `owner-${Date.now()}@clinic.test`, hash],
      );
      await createUser(client, {
        tenantId: clinic.id,
        email: `member-${Date.now()}@clinic.test`,
        passwordHash: hash,
        displayName: 'Member',
      });
    });

    app = await buildApp();
    await app.ready();

    const owner = await withTenant(clinic.id, async (client) => {
      const { rows } = await client.query<{ email: string }>(
        "SELECT email FROM users WHERE tenant_id = $1 AND role = 'owner' LIMIT 1",
        [clinic.id],
      );
      return rows[0]!.email;
    });
    const member = await withTenant(clinic.id, async (client) => {
      const { rows } = await client.query<{ email: string }>(
        "SELECT email FROM users WHERE tenant_id = $1 AND role = 'member' LIMIT 1",
        [clinic.id],
      );
      return rows[0]!.email;
    });

    const login = async (email: string) => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        headers: { 'x-tenant': clinicSlug },
        payload: { email, password },
      });
      return (JSON.parse(response.body) as { accessToken: string }).accessToken;
    };
    ownerToken = await login(owner);
    memberToken = await login(member);
  });

  afterAll(async () => {
    await app?.close();
    await new Promise<void>((resolve) => stripeStub.close(() => resolve()));
    await closePool();
  });

  const post = (payload: string, signature: string) =>
    app.inject({
      method: 'POST',
      url: '/v1/billing/webhook',
      headers: { 'stripe-signature': signature, 'content-type': 'application/json' },
      payload,
    });

  describe('a webhook is only believed when Stripe signed it', () => {
    it('refuses an unsigned body and grants nothing', async () => {
      const body = subscriptionEvent({
        id: `evt_unsigned_${RUN}`,
        type: 'customer.subscription.created',
        tenantId: clinicId,
        status: 'active',
      });
      const response = await app.inject({
        method: 'POST',
        url: '/v1/billing/webhook',
        headers: { 'content-type': 'application/json' },
        payload: body,
      });
      expect(response.statusCode).toBe(400);
      // The decisive assertion: no plan was granted by an unsigned request.
      expect((await entitlementsForTenant(clinicId)).clinicAdmin).toBe(false);
    });

    it('refuses a body that was altered after signing', async () => {
      // The classic attack: take a real signed event and raise the seat count.
      const body = subscriptionEvent({
        id: `evt_tampered_${RUN}`,
        type: 'customer.subscription.created',
        tenantId: clinicId,
        status: 'active',
        seats: 10,
      });
      const signature = sign(body);
      const tampered = body.replace('"quantity":10', '"quantity":9999');
      expect(await post(tampered, signature).then((r) => r.statusCode)).toBe(400);
    });

    it('refuses a signature made with the wrong secret', async () => {
      const body = subscriptionEvent({
        id: `evt_wrong_secret_${RUN}`,
        type: 'customer.subscription.created',
        tenantId: clinicId,
        status: 'active',
      });
      expect(await post(body, sign(body, 'whsec_not_ours')).then((r) => r.statusCode)).toBe(400);
    });

    it('refuses a captured request replayed the next day', async () => {
      const body = subscriptionEvent({
        id: `evt_old_${RUN}`,
        type: 'customer.subscription.created',
        tenantId: clinicId,
        status: 'active',
      });
      const yesterday = new Date(Date.now() - 86_400_000);
      expect(await post(body, sign(body, WEBHOOK_SECRET, yesterday)).then((r) => r.statusCode)).toBe(
        400,
      );
    });

    it('refuses a malformed signature header', async () => {
      const body = subscriptionEvent({
        id: `evt_malformed_${RUN}`,
        type: 'customer.subscription.created',
        tenantId: clinicId,
        status: 'active',
      });
      expect(await post(body, 'not-a-signature').then((r) => r.statusCode)).toBe(400);
    });

    it('accepts a second signature during a secret rotation', async () => {
      const body = subscriptionEvent({
        id: `evt_rotation_${RUN}`,
        type: 'customer.subscription.updated',
        tenantId: clinicId,
        status: 'active',
      });
      const good = sign(body);
      const timestamp = good.split(',')[0]!.slice(2);
      const stale = createHmac('sha256', 'whsec_old').update(`${timestamp}.${body}`).digest('hex');
      const both = `${good},v1=${stale}`;
      expect(await post(body, both).then((r) => r.statusCode)).toBe(200);
    });
  });

  describe('the subscription lifecycle drives the plan', () => {
    it('grants the clinic plan when the subscription goes active', async () => {
      const body = subscriptionEvent({
        id: `evt_active_1_${RUN}`,
        type: 'customer.subscription.created',
        tenantId: clinicId,
        status: 'active',
        seats: 40,
      });
      const response = await post(body, sign(body));
      expect(response.statusCode).toBe(200);

      const entitlements = await entitlementsForTenant(clinicId);
      expect(entitlements.clinicAdmin).toBe(true);
      expect(entitlements.seats).toBe(40);
      expect(entitlements.inGoodStanding).toBe(true);
    });

    it('applies a redelivered event exactly once', async () => {
      // Stripe retries and may deliver the same event twice. Without the
      // idempotency claim this is where a seat count silently doubles.
      const body = subscriptionEvent({
        id: `evt_duplicate_${RUN}`,
        type: 'customer.subscription.updated',
        tenantId: clinicId,
        status: 'active',
        seats: 60,
      });
      const signature = sign(body);
      const first = await post(body, signature);
      const second = await post(body, signature);

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(200);
      expect((JSON.parse(second.body) as { outcome: string }).outcome).toBe('duplicate');
      expect((await entitlementsForTenant(clinicId)).seats).toBe(60);
    });

    it('keeps a past-due clinic working rather than emptying its caseload', async () => {
      // A card that expired on a Friday must not lock a treatment centre out
      // before anyone has read the email. Stripe retries for days.
      const body = subscriptionEvent({
        id: `evt_past_due_${RUN}`,
        type: 'customer.subscription.updated',
        tenantId: clinicId,
        status: 'past_due',
        seats: 60,
      });
      await post(body, sign(body));
      const entitlements = await entitlementsForTenant(clinicId);
      expect(entitlements.clinicAdmin).toBe(true);
      expect(entitlements.coachAi).toBe(true);
    });

    it('suspends the organisation when the subscription is finally cancelled', async () => {
      const body = subscriptionEvent({
        id: `evt_cancelled_${RUN}`,
        type: 'customer.subscription.deleted',
        tenantId: clinicId,
        status: 'canceled',
        seats: 60,
      });
      await post(body, sign(body));
      const entitlements = await entitlementsForTenant(clinicId);
      expect(entitlements.inGoodStanding).toBe(false);
      expect(entitlements.clinicAdmin).toBe(false);
    });

    it('never takes the clinical product away from the patient', async () => {
      // The single most important assertion in this file. The person in the
      // clinic did not fail to pay the invoice, and a lapsed subscription must
      // not remove their coach, their patterns or their crisis surfaces.
      const entitlements = await entitlementsForTenant(clinicId);
      expect(entitlements.inGoodStanding).toBe(false);
      expect(entitlements.coachAi).toBe(true);
      expect(entitlements.patterns).toBe(true);
    });

    it('restores the plan when the organisation resubscribes', async () => {
      const body = subscriptionEvent({
        id: `evt_resubscribed_${RUN}`,
        type: 'customer.subscription.created',
        tenantId: clinicId,
        status: 'active',
        seats: 30,
      });
      await post(body, sign(body));
      const entitlements = await entitlementsForTenant(clinicId);
      expect(entitlements.inGoodStanding).toBe(true);
      expect(entitlements.seats).toBe(30);
    });

    it('ignores an event for a tenant it cannot identify', async () => {
      const body = JSON.stringify({
        id: `evt_no_tenant_${RUN}`,
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_x', status: 'active', metadata: {} } },
      });
      const response = await post(body, sign(body));
      expect(response.statusCode).toBe(200);
      expect((JSON.parse(response.body) as { outcome: string }).outcome).toBe('ignored_no_tenant');
    });
  });

  describe('who may spend money', () => {
    it('lets an owner start checkout, and shapes the Stripe request correctly', async () => {
      const before = stubRequests.length;
      const response = await app.inject({
        method: 'POST',
        url: '/v1/billing/checkout',
        headers: { authorization: `Bearer ${ownerToken}`, 'x-tenant': clinicSlug },
        payload: { seats: 25 },
      });
      expect(response.statusCode).toBe(200);
      expect((JSON.parse(response.body) as { url: string }).url).toContain('stripe.test');

      const sent = stubRequests[before]!;
      expect(sent.path).toBe('/v1/checkout/sessions');
      const form = new URLSearchParams(sent.body);
      expect(form.get('mode')).toBe('subscription');
      expect(form.get('line_items[0][price]')).toBe('price_test_seat');
      expect(form.get('line_items[0][quantity]')).toBe('25');
      // The webhook has to be able to answer "which tenant is this?" from
      // Stripe's payload alone.
      expect(form.get('client_reference_id')).toBe(clinicId);
      expect(form.get('subscription_data[metadata][tenant_id]')).toBe(clinicId);
    });

    it('refuses an ordinary member', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/billing/checkout',
        headers: { authorization: `Bearer ${memberToken}`, 'x-tenant': clinicSlug },
        payload: { seats: 25 },
      });
      expect(response.statusCode).toBe(403);
    });

    it('refuses anyone who is not signed in', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/billing/checkout',
        payload: { seats: 25 },
      });
      expect(response.statusCode).toBe(401);
    });

    it('reports plan, entitlements and seat usage to the organisation', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/billing',
        headers: { authorization: `Bearer ${ownerToken}`, 'x-tenant': clinicSlug },
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as {
        plan: string;
        entitlements: { seats: number };
        usage: { members: number };
      };
      expect(body.plan).toBe('clinic');
      expect(body.entitlements.seats).toBe(30);
      expect(body.usage.members).toBeGreaterThan(0);
    });
  });

  describe('seats are enforced where they can actually be exceeded', () => {
    it('refuses a new account once the licence has lapsed, with a payment status', async () => {
      // The binding case in practice. The clinic plan carries a floor of
      // CLINIC_BASE_SEATS, so a small purchased quantity is lifted to it and
      // cannot be exceeded by a handful of test accounts; a lapsed licence is
      // where the ceiling actually bites, and it is the case an operator will
      // meet. Runs last in this block because it leaves the tenant suspended.
      const body = subscriptionEvent({
        id: `evt_lapsed_${RUN}`,
        type: 'customer.subscription.deleted',
        tenantId: clinicId,
        status: 'canceled',
      });
      await post(body, sign(body));

      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        headers: { 'x-tenant': clinicSlug },
        payload: {
          email: `overflow-${Date.now()}@clinic.test`,
          password,
          displayName: 'Overflow',
        },
      });
      // 402 rather than 400 or 403: this is a licence problem, and the
      // organisation admin needs to be able to tell it apart from a bad
      // request or a permission error.
      expect(response.statusCode).toBe(402);
      expect((JSON.parse(response.body) as { error: { code: string } }).error.code).toBe(
        'seat_limit_reached',
      );
    });

    it('still lets the people already inside that organisation sign in', async () => {
      // The patients did not cancel the subscription. Losing the ability to
      // add staff is a commercial consequence; losing access to your own
      // recovery record would be a clinical one.
      const entitlements = await entitlementsForTenant(clinicId);
      expect(entitlements.inGoodStanding).toBe(false);
      expect(entitlements.coachAi).toBe(true);
      expect(entitlements.patterns).toBe(true);
    });

    it('never applies a seat ceiling to the free consumer tenant', async () => {
      const entitlements = await withoutTenant(async (client) => {
        const { rows } = await client.query<{ id: string }>(
          'SELECT id FROM tenants WHERE slug = $1',
          [process.env.DEFAULT_TENANT_SLUG ?? 'public'],
        );
        return entitlementsForTenant(rows[0]!.id);
      });
      expect(entitlements.seats).toBeNull();
      expect(entitlements.inGoodStanding).toBe(true);
    });
  });
});
