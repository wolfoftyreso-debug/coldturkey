import { describe, expect, it } from 'vitest';
import { assessPhase, shouldShowLongHorizon } from './phases.js';
import type { QuitPlan, RecoverySnapshot } from './types.js';

const DAY = 86_400_000;
const NOW = new Date(2026, 2, 20, 12, 0, 0);

function planStartedDaysAgo(days: number): QuitPlan {
  return {
    id: 'q1',
    substance: 'alcohol',
    startedAt: new Date(NOW.getTime() - days * DAY),
    baselineUnitsPerDay: 6,
    unitCostMinor: 3000,
    currency: 'SEK',
    minutesPerUnit: 45,
    status: 'active',
  };
}

function snapshot(quit: QuitPlan | null, relapses: RecoverySnapshot['relapses'] = []): RecoverySnapshot {
  return {
    profile: { phase: 'decision', timezone: 'Europe/Stockholm', country: 'SE' },
    quit,
    relapses,
    checkIns: [],
    cravings: [],
    supportContacts: [],
  };
}

describe('assessPhase', () => {
  it('respects the self-declared phase before there is a plan', () => {
    const result = assessPhase(snapshot(null), NOW);
    expect(result.phase).toBe('decision');
    expect(result.reasonKey).toBe('phase.reason.no_active_plan');
  });

  it('puts a person on day zero for the first 24 hours', () => {
    const result = assessPhase(snapshot(planStartedDaysAgo(0.5)), NOW);
    expect(result.phase).toBe('day_zero');
    expect(result.horizon).toBe('minutes');
  });

  it('moves to the acute phase after the first day', () => {
    expect(assessPhase(snapshot(planStartedDaysAgo(3)), NOW).phase).toBe('acute');
  });

  it('moves to stabilization after two weeks', () => {
    expect(assessPhase(snapshot(planStartedDaysAgo(30)), NOW).phase).toBe('stabilization');
  });

  it('moves to identity work after three months', () => {
    expect(assessPhase(snapshot(planStartedDaysAgo(120)), NOW).phase).toBe('identity');
  });

  it('reaches relapse prevention after a year', () => {
    expect(assessPhase(snapshot(planStartedDaysAgo(400)), NOW).phase).toBe('relapse_prevention');
  });

  it('brings someone back to acute support right after a relapse, whatever they had achieved', () => {
    const result = assessPhase(
      snapshot(planStartedDaysAgo(400), [
        { id: 'r1', quitId: 'q1', occurredAt: new Date(NOW.getTime() - 2 * DAY) },
      ]),
      NOW,
    );
    // Not because they lost progress — because that is where the useful help is.
    expect(result.phase).toBe('acute');
  });

  it('gives every phase something concrete to focus on', () => {
    for (const days of [0.2, 3, 30, 120, 400]) {
      const result = assessPhase(snapshot(planStartedDaysAgo(days)), NOW);
      expect(result.focusKeys.length).toBeGreaterThan(0);
    }
  });
});

describe('shouldShowLongHorizon', () => {
  it('hides five-year goals from someone in the first hours', () => {
    expect(shouldShowLongHorizon('day_zero')).toBe(false);
    expect(shouldShowLongHorizon('acute')).toBe(false);
  });

  it('shows them once there is room to think', () => {
    expect(shouldShowLongHorizon('stabilization')).toBe(true);
    expect(shouldShowLongHorizon('identity')).toBe(true);
  });
});
