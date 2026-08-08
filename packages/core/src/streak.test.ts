import { describe, expect, it } from 'vitest';
import { computeStreak, hoursSinceLastUse } from './streak.js';
import type { QuitPlan, RelapseEvent } from './types.js';

const DAY = 86_400_000;
const NOW = new Date(2026, 2, 20, 12, 0, 0);

function plan(daysAgo: number): QuitPlan {
  return {
    id: 'q1',
    substance: 'alcohol',
    startedAt: new Date(NOW.getTime() - daysAgo * DAY),
    baselineUnitsPerDay: 6,
    unitCostMinor: 3000,
    currency: 'SEK',
    minutesPerUnit: 45,
    status: 'active',
  };
}

function relapse(daysAgo: number, id = `r${daysAgo}`): RelapseEvent {
  return { id, quitId: 'q1', occurredAt: new Date(NOW.getTime() - daysAgo * DAY) };
}

describe('computeStreak', () => {
  it('counts from the start when there are no relapses', () => {
    const s = computeStreak(plan(10), [], NOW);
    expect(s.currentDays).toBe(10);
    expect(s.longestDays).toBe(10);
    expect(s.restarts).toBe(0);
    expect(s.isPersonalRecord).toBe(true);
  });

  it('restarts the current streak at the last relapse but keeps the longest', () => {
    const s = computeStreak(plan(10), [relapse(3)], NOW);
    expect(s.currentDays).toBe(3);
    expect(s.longestDays).toBe(7);
    expect(s.restarts).toBe(1);
    expect(s.isPersonalRecord).toBe(false);
  });

  it('never resets total days in recovery — the earlier work still counts', () => {
    const s = computeStreak(plan(100), [relapse(40), relapse(10)], NOW);
    expect(s.totalDaysInRecovery).toBe(100);
    expect(s.currentDays).toBe(10);
    expect(s.longestDays).toBe(60);
    expect(s.restarts).toBe(2);
  });

  it('recognises a new personal record', () => {
    const s = computeStreak(plan(30), [relapse(25)], NOW);
    expect(s.currentDays).toBe(25);
    expect(s.isPersonalRecord).toBe(true);
  });

  it('handles unsorted relapse input', () => {
    const ordered = computeStreak(plan(50), [relapse(10), relapse(30)], NOW);
    const shuffled = computeStreak(plan(50), [relapse(30), relapse(10)], NOW);
    expect(shuffled).toEqual(ordered);
  });

  it('ignores relapses recorded before the plan started', () => {
    const s = computeStreak(plan(5), [relapse(50)], NOW);
    expect(s.currentDays).toBe(5);
    expect(s.restarts).toBe(0);
  });

  it('reports zero rather than a negative streak for a future start date', () => {
    const s = computeStreak(plan(-2), [], NOW);
    expect(s.currentMs).toBe(0);
  });
});

describe('hoursSinceLastUse', () => {
  it('measures from the most recent relapse', () => {
    expect(hoursSinceLastUse(plan(10), [relapse(2)], NOW)).toBeCloseTo(48, 5);
  });

  it('measures from the plan start when clean throughout', () => {
    expect(hoursSinceLastUse(plan(1), [], NOW)).toBeCloseTo(24, 5);
  });
});
