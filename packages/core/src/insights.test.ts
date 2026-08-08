import { describe, expect, it } from 'vitest';
import { findInsights } from './insights.js';
import type { CheckIn, CravingLog, RecoverySnapshot } from './types.js';

const DAY = 86_400_000;
const NOW = new Date(2026, 2, 20, 12, 0, 0);

function at(daysAgo: number, hour: number): Date {
  const d = new Date(NOW.getTime() - daysAgo * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function craving(overrides: Partial<CravingLog> & { occurredAt: Date }): CravingLog {
  return {
    id: `cr-${overrides.occurredAt.getTime()}-${overrides.intensity ?? 5}`,
    intensity: 5,
    feeling: 'craving',
    location: 'home',
    outcome: 'resisted',
    ...overrides,
  };
}

function snapshot(cravings: CravingLog[], checkIns: CheckIn[] = []): RecoverySnapshot {
  return {
    profile: { phase: 'stabilization', timezone: 'Europe/Stockholm', country: 'SE' },
    quit: null,
    relapses: [],
    checkIns,
    cravings,
    supportContacts: [],
  };
}

describe('findInsights', () => {
  it('says nothing at all when there is not enough data', () => {
    const insights = findInsights(snapshot([craving({ occurredAt: at(1, 20) })]), { now: NOW });
    expect(insights).toHaveLength(0);
  });

  it('spots a time-of-day pattern', () => {
    const cravings = [2, 3, 4, 5, 6].map((d) => craving({ occurredAt: at(d, 21) }));
    const ids = findInsights(snapshot(cravings), { now: NOW }).map((i) => i.id);
    expect(ids).toContain('time_of_day');
  });

  it('spots the most common trigger and quotes it back', () => {
    const cravings = [2, 3, 4, 5].map((d) =>
      craving({ occurredAt: at(d, 18), trigger: 'Bråk hemma' }),
    );
    const trigger = findInsights(snapshot(cravings), { now: NOW }).find(
      (i) => i.id === 'trigger',
    );
    expect(trigger?.message.params?.trigger).toBe('bråk hemma');
    expect(trigger?.evidence).toBe(4);
  });

  it('links poor sleep to stronger cravings', () => {
    const checkIns: CheckIn[] = [];
    const cravings: CravingLog[] = [];
    // Four bad nights followed by strong cravings...
    for (const d of [2, 3, 4, 5]) {
      const day = at(d, 8);
      checkIns.push({
        id: `ci-${d}`,
        kind: 'morning',
        day: dayKey(day),
        createdAt: day,
        sleepQuality: 2,
        stress: 5,
      });
      cravings.push(craving({ occurredAt: at(d, 19), intensity: 9 }));
    }
    // ...and three good nights followed by mild ones.
    for (const d of [8, 9, 10]) {
      const day = at(d, 8);
      checkIns.push({
        id: `ci-${d}`,
        kind: 'morning',
        day: dayKey(day),
        createdAt: day,
        sleepQuality: 9,
        stress: 3,
      });
      cravings.push(craving({ occurredAt: at(d, 19), intensity: 3 }));
    }

    const sleep = findInsights(snapshot(cravings, checkIns), { now: NOW }).find(
      (i) => i.id === 'sleep',
    );
    expect(sleep).toBeDefined();
    expect(sleep?.suggestedToolId).toBe('sleep_routine');
    expect(Number(sleep?.message.params?.delta)).toBeGreaterThan(1.5);
  });

  it('names what has actually worked, not only what goes wrong', () => {
    const cravings = [2, 3, 4, 5].map((d) =>
      craving({ occurredAt: at(d, 20), outcome: 'resisted', actionTaken: 'Ringde Jonas' }),
    );
    const works = findInsights(snapshot(cravings), { now: NOW }).find(
      (i) => i.id === 'what_works',
    );
    expect(works?.message.params?.action).toBe('ringde jonas');
    expect(works?.message.params?.count).toBe(4);
  });

  it('ignores data outside the window', () => {
    const cravings = [40, 41, 42, 43].map((d) => craving({ occurredAt: at(d, 21) }));
    expect(findInsights(snapshot(cravings), { now: NOW })).toHaveLength(0);
  });

  it('respects the limit so the home screen stays quiet', () => {
    const cravings = Array.from({ length: 12 }, (_, i) =>
      craving({ occurredAt: at(i + 1, 21), trigger: 'stress', actionTaken: 'gick ut' }),
    );
    expect(findInsights(snapshot(cravings), { now: NOW, limit: 2 })).toHaveLength(2);
  });

  it('attaches evidence counts so the user can audit every claim', () => {
    const cravings = [2, 3, 4, 5, 6].map((d) => craving({ occurredAt: at(d, 21) }));
    for (const insight of findInsights(snapshot(cravings), { now: NOW })) {
      expect(insight.evidence).toBeGreaterThanOrEqual(4);
    }
  });
});
