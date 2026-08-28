import type { Client } from 'pg';
import { entitlementsFor, isTenantPlan, type Entitlements, type TenantPlan } from '@cleat/core';
import { withTenant, withoutTenant } from '../db/pool.js';

/**
 * Commercial state, and the one place it is turned into entitlements.
 *
 * Every function that touches `tenant_billing` or `billing_events` runs inside
 * the tenant's own context, because both tables are row-level secured like
 * everything else carrying a `tenant_id` (migration 009). The webhook handler
 * has no session, but it does resolve the tenant from Stripe's payload before
 * it writes, which is all the context that rule needs.
 */

export interface TenantBilling {
  tenant_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_status: string | null;
  seats: number;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
}

export async function loadBilling(client: Client, tenantId: string): Promise<TenantBilling | null> {
  const { rows } = await client.query<TenantBilling>(
    `SELECT tenant_id, stripe_customer_id, stripe_subscription_id, stripe_status,
            seats, current_period_end, cancel_at_period_end
       FROM tenant_billing WHERE tenant_id = $1`,
    [tenantId],
  );
  return rows[0] ?? null;
}

/**
 * Resolve what a tenant may do, right now.
 *
 * The plan on `tenants` is the single source product code reads, and billing is
 * the only writer. Anything unrecognised falls back to the free individual
 * plan rather than to a paid one: an unknown value in that column must never
 * be a way to obtain a subscription.
 */
export async function entitlementsForTenant(tenantId: string): Promise<Entitlements> {
  // `tenants` is not tenant-scoped and `tenant_billing` is, so the plan is read
  // without a context and the seat count within one.
  const raw = await withoutTenant(async (client) => {
    const { rows } = await client.query<{ plan: string }>('SELECT plan FROM tenants WHERE id = $1', [
      tenantId,
    ]);
    return rows[0]?.plan ?? 'standard';
  });
  const plan: TenantPlan = isTenantPlan(raw) ? raw : 'standard';
  const billing = await withTenant(tenantId, (client) => loadBilling(client, tenantId));
  return entitlementsFor(plan, billing?.seats ?? null);
}

/** How many member accounts the tenant currently holds. */
export async function countMembers(client: Client, tenantId: string): Promise<number> {
  const { rows } = await client.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM users WHERE tenant_id = $1',
    [tenantId],
  );
  return Number(rows[0]?.count ?? '0');
}

export async function upsertCustomer(
  client: Client,
  tenantId: string,
  customerId: string,
): Promise<void> {
  await client.query(
    `INSERT INTO tenant_billing (tenant_id, stripe_customer_id)
     VALUES ($1, $2)
     ON CONFLICT (tenant_id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id,
                                            updated_at = now()`,
    [tenantId, customerId],
  );
}

/**
 * Write the subscription state and the plan it implies, in one transaction.
 *
 * Plan and subscription must never disagree: a tenant marked `clinic` whose
 * subscription row says `canceled` is a tenant getting a paid product for
 * free, and the opposite is a paying customer locked out. They are written
 * together or not at all.
 */
export async function applySubscription(
  client: Client,
  input: {
    tenantId: string;
    customerId: string | null;
    subscriptionId: string;
    status: string;
    seats: number;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  },
): Promise<TenantPlan> {
  const plan = planForStripeStatus(input.status);
  // No transaction of its own: the caller runs inside `withTenant`, which is
  // already a transaction, and nesting a second BEGIN here would commit the
  // subscription write independently of the idempotency claim that guards it.
  await client.query(
      `INSERT INTO tenant_billing (tenant_id, stripe_customer_id, stripe_subscription_id,
                                   stripe_status, seats, current_period_end, cancel_at_period_end)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tenant_id) DO UPDATE SET
         stripe_customer_id     = coalesce(EXCLUDED.stripe_customer_id, tenant_billing.stripe_customer_id),
         stripe_subscription_id = EXCLUDED.stripe_subscription_id,
         stripe_status          = EXCLUDED.stripe_status,
         seats                  = EXCLUDED.seats,
         current_period_end     = EXCLUDED.current_period_end,
         cancel_at_period_end   = EXCLUDED.cancel_at_period_end,
         updated_at             = now()`,
      [
        input.tenantId,
        input.customerId,
        input.subscriptionId,
        input.status,
        input.seats,
        input.currentPeriodEnd,
        input.cancelAtPeriodEnd,
    ],
  );
  await client.query('UPDATE tenants SET plan = $1 WHERE id = $2', [plan, input.tenantId]);
  return plan;
}

/**
 * Stripe's subscription status, mapped to what the product should allow.
 *
 * `past_due` deliberately keeps the clinic working. A card that expired on a
 * Friday should not empty a treatment centre's caseload before anyone has read
 * the email — Stripe retries for days, and the honest response to a failing
 * payment is a warning, not a lockout. Only a definitively dead subscription
 * suspends, and even then every existing patient keeps the clinical product.
 */
export function planForStripeStatus(status: string): TenantPlan {
  switch (status) {
    case 'active':
    case 'past_due':
      return 'clinic';
    case 'trialing':
      return 'clinic_trial';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'suspended';
    case 'incomplete':
      // Checkout started, payment not settled. Nothing granted yet.
      return 'clinic_trial';
    default:
      // An unrecognised status must not silently grant a paid plan.
      return 'suspended';
  }
}

/**
 * Record that an event was handled, refusing a replay.
 *
 * Returns false when Stripe has sent this event id before. Stripe explicitly
 * retries and may deliver duplicates, so an endpoint that is not idempotent
 * will double a seat count or re-grant a cancelled plan on redelivery.
 */
export async function claimEvent(
  client: Client,
  input: { id: string; type: string; tenantId: string; outcome: string },
): Promise<boolean> {
  const { rowCount } = await client.query(
    `INSERT INTO billing_events (stripe_event_id, type, tenant_id, outcome)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (stripe_event_id) DO NOTHING`,
    [input.id, input.type, input.tenantId, input.outcome],
  );
  return (rowCount ?? 0) > 0;
}
