import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { entitlementsFor, isTenantPlan, type TenantPlan } from '@cleat/core';
import { loadConfig } from '../config.js';
import { withoutTenant, withTenant } from '../db/pool.js';
import { writeAudit } from '../db/repository.js';
import { badRequest, forbidden } from '../lib/errors.js';
import { authenticate, currentUser } from '../plugins/auth.js';
import {
  applySubscription,
  claimEvent,
  countMembers,
  loadBilling,
  upsertCustomer,
} from '../billing/repository.js';
import {
  createCheckoutSession,
  createPortalSession,
  stripeEnabled,
  StripeError,
  verifyWebhook,
} from '../billing/stripe.js';

/**
 * The commercial surface.
 *
 * Cleat sells to organisations, never to the person in recovery. Every route
 * here is therefore about a *tenant*, and none of them can gate a clinical
 * feature — see `NEVER_GATED` in `@cleat/core`. An API with no Stripe keys
 * configured is a completely valid deployment: individuals use everything, and
 * only the organisation checkout stops being offered.
 */
export async function billingRoutes(app: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------- webhook --
  // Registered before the auth hook below, because Stripe does not carry a
  // session. Its authentication is the signature, which is stronger.
  app.post('/v1/billing/webhook', async (request, reply) => {
    const config = loadConfig();
    if (!config.STRIPE_WEBHOOK_SECRET) {
      // Refuse rather than accept unverified commercial instructions.
      throw badRequest('billing_not_configured', 'Billing is not configured');
    }

    const raw = request.rawBody;
    const signature = request.headers['stripe-signature'];
    if (!raw || typeof signature !== 'string') {
      throw badRequest('invalid_signature', 'Missing signature or body');
    }

    let event;
    try {
      event = verifyWebhook(raw, signature, config.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      // Logged, because a stream of these means either a misconfigured secret
      // or somebody trying to grant themselves a plan.
      request.log.warn(
        { err: error instanceof Error ? error.message : 'unknown' },
        'stripe webhook rejected',
      );
      throw badRequest('invalid_signature', 'Signature verification failed');
    }

    const object = event.data.object;
    const tenantId = tenantIdFrom(object);

    if (!tenantId) {
      // Nothing to attribute it to, so nothing to do and nothing to record.
      // Logged rather than stored: the ledger is tenant-scoped, and an event
      // we ignore is idempotent by nature — replaying it changes nothing.
      request.log.info({ type: event.type, id: event.id }, 'stripe event without a tenant');
      return reply.send({ received: true, outcome: 'ignored_no_tenant' });
    }

    // One transaction for the claim, the state change and the audit row. If
    // applying fails, the claim rolls back with it, so Stripe's retry can
    // succeed rather than being swallowed as a duplicate of an event that
    // never actually took effect.
    const handled = await withTenant(tenantId, async (client) => {
      const fresh = await claimEvent(client, {
        id: event.id,
        type: event.type,
        tenantId,
        outcome: event.type,
      });
      if (!fresh) return 'duplicate';

      switch (event.type) {
        case 'checkout.session.completed': {
          const customer = asString(object.customer);
          if (customer) await upsertCustomer(client, tenantId, customer);
          // The subscription itself arrives in its own event, which carries the
          // authoritative status. Nothing is granted from the redirect.
          return 'customer_linked';
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const status =
            event.type === 'customer.subscription.deleted'
              ? 'canceled'
              : (asString(object.status) ?? 'incomplete');
          const plan = await applySubscription(client, {
            tenantId,
            customerId: asString(object.customer),
            subscriptionId: asString(object.id) ?? '',
            status,
            seats: seatsFrom(object),
            currentPeriodEnd: epochToDate(object.current_period_end),
            cancelAtPeriodEnd: object.cancel_at_period_end === true,
          });
          await writeAudit(client, {
            tenantId,
            userId: null,
            action: 'billing.subscription_synced',
            meta: { status, plan, event: event.type },
          });
          return `plan_${plan}`;
        }

        case 'invoice.payment_failed':
          // Not a downgrade on its own: Stripe retries for days and moves the
          // subscription to past_due, which the subscription event carries.
          return 'noted_payment_failed';

        default:
          return 'ignored_unhandled_type';
      }
    });

    // Always 200 on a verified event, including duplicates and types we do not
    // act on. A non-2xx makes Stripe retry forever over something that is not
    // an error.
    return reply.send({ received: true, outcome: handled });
  });

  // Everything below needs a signed-in user.
  app.register(async (scoped) => {
    scoped.addHook('preHandler', authenticate);

    /** What this tenant may do, and how much of it is used. */
    scoped.get('/v1/billing', async (request) => {
      const user = currentUser(request);
      return withoutTenant(async (client) => {
        const { rows } = await client.query<{ plan: string; slug: string; name: string }>(
          'SELECT plan, slug, name FROM tenants WHERE id = $1',
          [user.tenant_id],
        );
        const raw = rows[0]?.plan ?? 'standard';
        const plan: TenantPlan = isTenantPlan(raw) ? raw : 'standard';
        const billing = await withTenant(user.tenant_id, (scoped) =>
          loadBilling(scoped, user.tenant_id),
        );
        const entitlements = entitlementsFor(plan, billing?.seats ?? null);
        // Counted inside the tenant's own context: `users` is row-level
        // secured, so a count taken without one correctly returns zero.
        const members = await withTenant(user.tenant_id, (scopedClient) =>
          countMembers(scopedClient, user.tenant_id),
        );

        return {
          plan,
          organisation: { slug: rows[0]?.slug ?? '', name: rows[0]?.name ?? '' },
          entitlements,
          usage: { members, seats: entitlements.seats },
          subscription: billing
            ? {
                status: billing.stripe_status,
                seats: billing.seats,
                currentPeriodEnd: billing.current_period_end,
                cancelAtPeriodEnd: billing.cancel_at_period_end,
              }
            : null,
          // So the client knows whether to offer the organisation upgrade at
          // all, rather than sending people to a checkout that cannot exist.
          available: stripeEnabled(),
        };
      });
    });

    /**
     * Start an organisation subscription.
     *
     * Owners and admins only, and never for the shared consumer tenant: the
     * individuals in it must not be able to put each other on a bill.
     */
    scoped.post('/v1/billing/checkout', async (request) => {
      const user = currentUser(request);
      const config = loadConfig();
      if (!stripeEnabled() || !config.STRIPE_PRICE_CLINIC_SEAT) {
        throw badRequest('billing_not_configured', 'Billing is not configured');
      }
      if (user.role !== 'owner' && user.role !== 'admin') {
        throw forbidden('Only an organisation owner or admin can start a subscription');
      }
      const body = z.object({ seats: z.number().int().min(1).max(10_000) }).parse(request.body ?? {});

      return withoutTenant(async (client) => {
        const { rows } = await client.query<{ slug: string }>(
          'SELECT slug FROM tenants WHERE id = $1',
          [user.tenant_id],
        );
        const slug = rows[0]?.slug;
        if (!slug) throw badRequest('unknown_tenant', 'Tenant not found');
        if (slug === config.DEFAULT_TENANT_SLUG) {
          throw forbidden('The shared consumer tenant is free and cannot be subscribed');
        }

        const billing = await withTenant(user.tenant_id, (scoped) =>
          loadBilling(scoped, user.tenant_id),
        );
        const base = config.PUBLIC_WEB_URL.replace(/\/+$/, '');
        try {
          const session = await createCheckoutSession({
            tenantId: user.tenant_id,
            tenantSlug: slug,
            seats: body.seats,
            customerId: billing?.stripe_customer_id,
            customerEmail: user.email,
            successUrl: `${base}/organisation/klart?session={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${base}/organisation`,
          });
          await withTenant(user.tenant_id, (scoped) =>
            writeAudit(scoped, {
              tenantId: user.tenant_id,
              userId: user.id,
              action: 'billing.checkout_started',
              meta: { seats: body.seats },
            }),
          );
          return { url: session.url };
        } catch (error) {
          if (error instanceof StripeError) {
            request.log.error({ status: error.status }, 'stripe checkout failed');
            throw badRequest('billing_unavailable', 'Could not start checkout right now');
          }
          throw error;
        }
      });
    });

    /** The Stripe-hosted portal: change card, seats, or cancel. */
    scoped.post('/v1/billing/portal', async (request) => {
      const user = currentUser(request);
      if (user.role !== 'owner' && user.role !== 'admin') {
        throw forbidden('Only an organisation owner or admin can manage billing');
      }
      const config = loadConfig();
      const billing = await withTenant(user.tenant_id, (scoped) =>
        loadBilling(scoped, user.tenant_id),
      );
      if (!billing?.stripe_customer_id) {
        throw badRequest('no_subscription', 'This organisation has no subscription yet');
      }
      const session = await createPortalSession({
        customerId: billing.stripe_customer_id,
        returnUrl: `${config.PUBLIC_WEB_URL.replace(/\/+$/, '')}/organisation`,
      });
      return { url: session.url };
    });
  });
}

/** Stripe puts our tenant id in metadata, and on a session in client_reference_id. */
function tenantIdFrom(object: Record<string, unknown>): string | null {
  const metadata = object.metadata;
  if (metadata && typeof metadata === 'object') {
    const value = (metadata as Record<string, unknown>).tenant_id;
    if (typeof value === 'string' && value.length > 0) return value;
  }
  const reference = object.client_reference_id;
  return typeof reference === 'string' && reference.length > 0 ? reference : null;
}

function seatsFrom(object: Record<string, unknown>): number {
  const items = object.items;
  if (items && typeof items === 'object') {
    const data = (items as { data?: unknown }).data;
    if (Array.isArray(data) && data.length > 0) {
      const quantity = (data[0] as { quantity?: unknown }).quantity;
      if (typeof quantity === 'number' && Number.isFinite(quantity)) return quantity;
    }
  }
  const quantity = object.quantity;
  return typeof quantity === 'number' ? quantity : 0;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function epochToDate(value: unknown): Date | null {
  return typeof value === 'number' && Number.isFinite(value) ? new Date(value * 1000) : null;
}
