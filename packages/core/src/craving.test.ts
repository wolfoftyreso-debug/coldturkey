import { describe, expect, it } from 'vitest';
import { buildCravingPlan, suggestedDelayMinutes, TEN_MINUTE_PROTOCOL } from './craving.js';
import type { SupportContact } from './types.js';

const contacts: SupportContact[] = [
  { id: 'c1', name: 'Sara', relation: 'sister', isPrimary: false },
  { id: 'c2', name: 'Jonas', relation: 'friend', isPrimary: true },
];

describe('buildCravingPlan', () => {
  it('leads with leaving when the person is around people who are using', () => {
    const plan = buildCravingPlan({
      feeling: 'social_pressure',
      location: 'with_users',
      intensity: 7,
      supportContacts: contacts,
      hasWhyStatement: true,
    });
    expect(plan.leaveFirst).toBe(true);
    expect(plan.tools[0]?.id).toBe('leave_the_situation');
  });

  it('offers only low-effort tools at high intensity', () => {
    const plan = buildCravingPlan({
      feeling: 'panic',
      location: 'home',
      intensity: 9,
      supportContacts: [],
      hasWhyStatement: false,
    });
    expect(plan.tools.length).toBeGreaterThan(0);
    expect(plan.tools.every((t) => t.lowEffort)).toBe(true);
  });

  it('never offers more than four things to choose between', () => {
    const plan = buildCravingPlan({
      feeling: 'craving',
      location: 'home',
      intensity: 3,
      supportContacts: contacts,
      hasWhyStatement: true,
    });
    expect(plan.tools.length).toBeLessThanOrEqual(4);
  });

  it('does not repeat a tool', () => {
    const plan = buildCravingPlan({
      feeling: 'craving',
      location: 'alone',
      intensity: 5,
      supportContacts: [],
      hasWhyStatement: true,
    });
    const ids = plan.tools.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('picks the primary support contact to call first', () => {
    const plan = buildCravingPlan({
      feeling: 'loneliness',
      location: 'alone',
      intensity: 6,
      supportContacts: contacts,
      hasWhyStatement: false,
    });
    expect(plan.callFirst?.name).toBe('Jonas');
  });

  it('falls back to the first contact when none is marked primary', () => {
    const plan = buildCravingPlan({
      feeling: 'loneliness',
      location: 'alone',
      intensity: 6,
      supportContacts: [contacts[0]!],
      hasWhyStatement: false,
    });
    expect(plan.callFirst?.name).toBe('Sara');
  });

  it('handles having nobody to call without breaking', () => {
    const plan = buildCravingPlan({
      feeling: 'loneliness',
      location: 'alone',
      intensity: 6,
      supportContacts: [],
      hasWhyStatement: false,
    });
    expect(plan.callFirst).toBeNull();
    expect(plan.tools.length).toBeGreaterThan(0);
  });

  it('always ends by asking what happened just before the craving', () => {
    const plan = buildCravingPlan({
      feeling: 'stress',
      location: 'work',
      intensity: 4,
      supportContacts: [],
      hasWhyStatement: false,
    });
    expect(plan.followUpKey).toBe('craving.followup.what_happened_before');
  });
});

describe('suggestedDelayMinutes', () => {
  it('asks for a shorter commitment when the craving is strongest', () => {
    expect(suggestedDelayMinutes(10)).toBe(5);
    expect(suggestedDelayMinutes(8)).toBe(10);
    expect(suggestedDelayMinutes(5)).toBe(20);
    expect(suggestedDelayMinutes(1)).toBe(30);
  });

  it('never asks for a delay someone in crisis cannot keep', () => {
    expect(suggestedDelayMinutes(9)).toBeLessThanOrEqual(10);
  });
});

describe('TEN_MINUTE_PROTOCOL', () => {
  it('has all ten steps in order, starting by stopping the decision', () => {
    expect(TEN_MINUTE_PROTOCOL).toHaveLength(10);
    expect(TEN_MINUTE_PROTOCOL[0]).toBe('protocol.stop_the_decision');
    expect(TEN_MINUTE_PROTOCOL[9]).toBe('protocol.come_back');
  });
});
