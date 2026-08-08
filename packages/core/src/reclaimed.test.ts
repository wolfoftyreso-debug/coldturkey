import { describe, expect, it } from 'vitest';
import { computeReclaimed, splitMinutes } from './reclaimed.js';
import type { QuitPlan } from './types.js';

const DAY = 86_400_000;
const NOW = new Date(2026, 2, 20, 12, 0, 0);

const smoker: QuitPlan = {
  id: 'q1',
  substance: 'nicotine',
  startedAt: new Date(NOW.getTime() - 10 * DAY),
  baselineUnitsPerDay: 20,
  unitCostMinor: 250, // 2.50 per cigarette
  currency: 'SEK',
  minutesPerUnit: 7,
  status: 'active',
};

describe('computeReclaimed', () => {
  it('totals money and time over the current streak', () => {
    const r = computeReclaimed(smoker, 10 * DAY, NOW);
    expect(r.soFar.units).toBe(200);
    expect(r.soFar.moneyMinor).toBe(50_000); // 500.00 SEK
    expect(r.soFar.minutes).toBe(1400);
  });

  it('caps the weekly and monthly views at the streak length', () => {
    const r = computeReclaimed(smoker, 3 * DAY, NOW);
    expect(r.thisWeek.units).toBe(60);
    expect(r.thisMonth.units).toBe(60);
  });

  it('counts only the elapsed part of today', () => {
    const r = computeReclaimed(smoker, 10 * DAY, NOW);
    // Noon local time is half a day in.
    expect(r.today.units).toBeCloseTo(10, 5);
  });

  it('never counts more of today than the streak itself', () => {
    const r = computeReclaimed(smoker, 2 * 3_600_000, NOW);
    expect(r.today.units).toBeLessThanOrEqual(r.soFar.units);
  });

  it('projects a year and five years at the baseline rate', () => {
    const r = computeReclaimed(smoker, 10 * DAY, NOW);
    expect(r.projectedYear1.moneyMinor).toBe(365 * 20 * 250);
    expect(r.projectedYear5.moneyMinor).toBe(5 * 365 * 20 * 250);
  });

  it('returns zeros for a streak that just restarted', () => {
    const r = computeReclaimed(smoker, 0, NOW);
    expect(r.soFar.moneyMinor).toBe(0);
    expect(r.soFar.minutes).toBe(0);
  });

  it('carries the plan currency through', () => {
    expect(computeReclaimed(smoker, DAY, NOW).currency).toBe('SEK');
  });
});

describe('splitMinutes', () => {
  it('splits into hours and minutes', () => {
    expect(splitMinutes(1400)).toEqual({ hours: 23, minutes: 20 });
    expect(splitMinutes(59)).toEqual({ hours: 0, minutes: 59 });
    expect(splitMinutes(0)).toEqual({ hours: 0, minutes: 0 });
  });
});
