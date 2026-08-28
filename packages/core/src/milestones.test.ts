import { describe, expect, it } from 'vitest';
import { computeMilestones, nextDayMilestone } from './milestones.js';

describe('computeMilestones', () => {
  it('marks early nicotine milestones as reached within the first day', () => {
    // Explicitly a smoker: an unanswered intake question now yields only the
    // claims that hold whichever way the nicotine arrived.
    const m = computeMilestones('nicotine', 25, 'smoked');
    const keys = m.reached.map((x) => x.key);
    expect(keys).toContain('milestone.nicotine.min20');
    expect(keys).toContain('milestone.nicotine.h12');
    expect(m.next?.key).toBe('milestone.nicotine.h48');
  });

  it('reports progress toward the next milestone', () => {
    const m = computeMilestones('nicotine', 30, 'smoked');
    // Between the 24h and 48h markers: (30-24)/(48-24) = 0.25
    expect(m.progressToNext).toBeCloseTo(0.25, 5);
  });

  it('has something to show in the first hours — the moment it matters most', () => {
    expect(computeMilestones('nicotine', 1, 'smoked').reached.length).toBeGreaterThan(0);
  });

  it('reports no next milestone once every one is passed', () => {
    // Past fifteen years, which is where the nicotine ladder now ends.
    const m = computeMilestones('nicotine', 200_000, 'smoked');
    expect(m.next).toBeNull();
    expect(m.progressToNext).toBe(1);
  });

  it('gives an empty reached list at hour zero', () => {
    const m = computeMilestones('alcohol', 0);
    expect(m.reached).toHaveLength(0);
    expect(m.next?.key).toBe('milestone.alcohol.h12');
    expect(m.next?.hoursRemaining).toBe(12);
  });

  it('uses substance-specific timelines', () => {
    expect(computeMilestones('gambling', 100).next?.key).toBe('milestone.gambling.week2');
    expect(computeMilestones('opioids', 100).next?.key).toBe('milestone.opioids.week1');
  });
});

describe('nextDayMilestone', () => {
  it('finds the next round number people actually count', () => {
    expect(nextDayMilestone(0)).toBe(1);
    expect(nextDayMilestone(5)).toBe(7);
    expect(nextDayMilestone(30)).toBe(60);
  });

  it('returns null past the last defined milestone', () => {
    expect(nextDayMilestone(5000)).toBeNull();
  });
});
