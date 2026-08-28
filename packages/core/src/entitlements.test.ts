import { describe, expect, it } from 'vitest';
import {
  canAddSeat,
  CLINIC_BASE_SEATS,
  entitlementsFor,
  isNeverGated,
  isTenantPlan,
  NEVER_GATED,
  TENANT_PLANS,
  TRIAL_SEATS,
} from './entitlements.js';

describe('what a plan entitles a tenant to', () => {
  it('gives individuals everything, free, with no seat ceiling', () => {
    // The consumer tenant is shared by everyone who signs up alone. A limit
    // here would mean the product stops accepting people who need it.
    const free = entitlementsFor('standard');
    expect(free.seats).toBeNull();
    expect(free.coachAi).toBe(true);
    expect(free.patterns).toBe(true);
    expect(free.inGoodStanding).toBe(true);
  });

  it('gives a paying clinic its purchased seats, never fewer than the base', () => {
    expect(entitlementsFor('clinic', 100).seats).toBe(100);
    expect(entitlementsFor('clinic', 3).seats).toBe(CLINIC_BASE_SEATS);
    expect(entitlementsFor('clinic', null).seats).toBe(CLINIC_BASE_SEATS);
    expect(entitlementsFor('clinic').clinicAdmin).toBe(true);
  });

  it('gives a trialling organisation a small allowance', () => {
    expect(entitlementsFor('clinic_trial').seats).toBe(TRIAL_SEATS);
    expect(entitlementsFor('clinic_trial').inGoodStanding).toBe(true);
  });

  it('stops a suspended organisation from growing but never strips the patient', () => {
    // The person in the clinic did not fail to pay the invoice. Taking their
    // coach or their pattern history away because their treatment centre's
    // card expired would punish exactly the wrong party.
    const suspended = entitlementsFor('suspended');
    expect(suspended.seats).toBe(0);
    expect(suspended.clinicAdmin).toBe(false);
    expect(suspended.inGoodStanding).toBe(false);
    expect(suspended.coachAi).toBe(true);
    expect(suspended.patterns).toBe(true);
  });

  it('never lets any plan disable the clinical product itself', () => {
    for (const plan of TENANT_PLANS) {
      const e = entitlementsFor(plan);
      expect(e.coachAi, `${plan} disabled the coach`).toBe(true);
      expect(e.patterns, `${plan} disabled patterns`).toBe(true);
    }
  });
});

describe('the surfaces payment may never touch', () => {
  it('holds the crisis and data-rights surfaces', () => {
    for (const feature of ['crisis.resources', 'safety.triage', 'craving.flow', 'privacy.export', 'privacy.delete']) {
      expect(isNeverGated(feature), `${feature} must never be gated`).toBe(true);
    }
    expect(NEVER_GATED.length).toBeGreaterThanOrEqual(8);
  });

  it('does not accidentally exempt commercial features', () => {
    expect(isNeverGated('clinicAdmin')).toBe(false);
    expect(isNeverGated('seats')).toBe(false);
  });
});

describe('seat accounting', () => {
  it('lets an unlimited tenant keep admitting people', () => {
    expect(canAddSeat(entitlementsFor('standard'), 10_000)).toBe(true);
  });

  it('stops a clinic at its ceiling and not before', () => {
    const clinic = entitlementsFor('clinic', 30);
    expect(canAddSeat(clinic, 29)).toBe(true);
    expect(canAddSeat(clinic, 30)).toBe(false);
    expect(canAddSeat(clinic, 31)).toBe(false);
  });

  it('admits nobody new into a suspended tenant', () => {
    expect(canAddSeat(entitlementsFor('suspended'), 0)).toBe(false);
  });
});

describe('plan parsing', () => {
  it('accepts the known plans and rejects anything else', () => {
    // The plan arrives as free text from a database column; an unknown value
    // must not silently become a paid plan.
    expect(isTenantPlan('clinic')).toBe(true);
    expect(isTenantPlan('standard')).toBe(true);
    expect(isTenantPlan('enterprise')).toBe(false);
    expect(isTenantPlan('')).toBe(false);
  });
});
