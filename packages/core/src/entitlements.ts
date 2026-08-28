/**
 * What a tenant is commercially allowed to do.
 *
 * Cleat's business model is deliberately lopsided: an individual person in
 * recovery never pays and never meets a paywall. Money comes from organisations
 * — clinics, treatment centres, occupational health — who get their own tenant,
 * their own isolated data, and a seat count.
 *
 * This module exists so that Stripe never leaks into product code. Nothing in
 * the app asks "is the subscription active?"; it asks "does this tenant have
 * this entitlement?", and the answer is computed here from a plan that billing
 * keeps up to date. Scattering `plan === 'clinic'` through the codebase is how
 * a payment bug becomes a product bug.
 */
export type TenantPlan =
  /** The shared consumer tenant, and any tenant not being billed. Free, full. */
  | 'standard'
  /** A paying organisation. */
  | 'clinic'
  /** An organisation evaluating, before any card exists. */
  | 'clinic_trial'
  /** A paying organisation whose payment has definitively failed. */
  | 'suspended';

export const TENANT_PLANS: TenantPlan[] = ['standard', 'clinic', 'clinic_trial', 'suspended'];

export function isTenantPlan(value: string): value is TenantPlan {
  return (TENANT_PLANS as string[]).includes(value);
}

/**
 * Everything the product can gate. Deliberately small: an entitlement that
 * gates nothing real is a lie with a config file.
 */
export interface Entitlements {
  /** Maximum member accounts in this tenant. `null` means no limit. */
  seats: number | null;
  /** The language-model coach. Clinics can also switch this off themselves. */
  coachAi: boolean;
  /** The pattern engine and the seven indicators. */
  patterns: boolean;
  /** Clinic-level administration of the tenant. */
  clinicAdmin: boolean;
  /** Whether the tenant is in good standing commercially. */
  inGoodStanding: boolean;
}

/**
 * The surfaces that are never, under any circumstances, gated by payment.
 *
 * A lapsed invoice must not be able to take away the crisis numbers, the
 * craving engine, the relapse flow or a person's right to their own data. This
 * is not a courtesy — it is the difference between a recovery product and a
 * hostage situation, and it is the reason `entitlementsFor` returns the same
 * answer for these no matter what the plan says.
 */
export const NEVER_GATED = [
  'crisis.resources',
  'safety.triage',
  'craving.flow',
  'relapse.flow',
  'supporter.surface',
  'privacy.export',
  'privacy.delete',
  'account.recovery',
] as const;

export type UngatedFeature = (typeof NEVER_GATED)[number];

export function isNeverGated(feature: string): feature is UngatedFeature {
  return (NEVER_GATED as readonly string[]).includes(feature);
}

/** Seats included in the base clinic plan before extra seats are purchased. */
export const CLINIC_BASE_SEATS = 25;
/** Seats a trialling organisation may use while evaluating. */
export const TRIAL_SEATS = 5;

/**
 * Map a plan to what it may do.
 *
 * `purchasedSeats` comes from the subscription quantity when there is one; the
 * base allowance applies when there is not.
 */
export function entitlementsFor(plan: TenantPlan, purchasedSeats?: number | null): Entitlements {
  switch (plan) {
    case 'standard':
      // Individuals. Everything, free, forever — and no seat ceiling, because
      // the consumer tenant is shared by every person who signs up alone.
      return { seats: null, coachAi: true, patterns: true, clinicAdmin: false, inGoodStanding: true };

    case 'clinic':
      return {
        seats: Math.max(CLINIC_BASE_SEATS, purchasedSeats ?? 0),
        coachAi: true,
        patterns: true,
        clinicAdmin: true,
        inGoodStanding: true,
      };

    case 'clinic_trial':
      return {
        seats: TRIAL_SEATS,
        coachAi: true,
        patterns: true,
        clinicAdmin: true,
        inGoodStanding: true,
      };

    case 'suspended':
      // Payment has failed for good. The organisation loses administration and
      // the ability to add people — but every existing person keeps the whole
      // clinical product, because the patient is not the party who failed to
      // pay and must never be the one punished for it.
      return {
        seats: 0,
        coachAi: true,
        patterns: true,
        clinicAdmin: false,
        inGoodStanding: false,
      };
  }
}

/** Whether one more member can be admitted to a tenant that already has this many. */
export function canAddSeat(entitlements: Entitlements, currentMembers: number): boolean {
  return entitlements.seats === null || currentMembers < entitlements.seats;
}
