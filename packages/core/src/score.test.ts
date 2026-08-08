import { describe, expect, it } from 'vitest';
import { computeIndicators, indicator } from './score.js';
import type { CheckIn, CravingLog, QuitPlan, RecoverySnapshot } from './types.js';

const DAY = 86_400_000;
const NOW = new Date(2026, 2, 20, 12, 0, 0);

const quit: QuitPlan = {
  id: 'q1',
  substance: 'alcohol',
  startedAt: new Date(NOW.getTime() - 60 * DAY),
  baselineUnitsPerDay: 6,
  unitCostMinor: 3000,
  currency: 'SEK',
  minutesPerUnit: 45,
  status: 'active',
};

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function checkIn(daysAgo: number, kind: 'morning' | 'evening', values: Partial<CheckIn> = {}): CheckIn {
  const at = new Date(NOW.getTime() - daysAgo * DAY);
  return {
    id: `ci-${daysAgo}-${kind}`,
    kind,
    day: dayKey(at),
    createdAt: at,
    mood: 6,
    sleepQuality: 7,
    stress: 4,
    cravingIntensity: 3,
    ...values,
  };
}

function craving(daysAgo: number, intensity: number, outcome: CravingLog['outcome']): CravingLog {
  return {
    id: `cr-${daysAgo}-${intensity}`,
    occurredAt: new Date(NOW.getTime() - daysAgo * DAY),
    intensity,
    feeling: 'craving',
    location: 'home',
    outcome,
  };
}

function snapshot(overrides: Partial<RecoverySnapshot> = {}): RecoverySnapshot {
  return {
    profile: { phase: 'stabilization', timezone: 'Europe/Stockholm', country: 'SE' },
    quit,
    relapses: [],
    checkIns: [],
    cravings: [],
    supportContacts: [],
    ...overrides,
  };
}

describe('computeIndicators', () => {
  it('produces seven separate indicators and no aggregate score', () => {
    const set = computeIndicators(snapshot(), NOW);
    expect(set.indicators).toHaveLength(7);
    expect(set.indicators.map((i) => i.key).sort()).toEqual([
      'connection',
      'craving_control',
      'purpose',
      'risk',
      'routine',
      'self_trust',
      'stability',
    ]);
    // Guards the product decision: recovery is not a single percentage.
    expect(set).not.toHaveProperty('overall');
    expect(set).not.toHaveProperty('total');
  });

  it('marks risk as an indicator where lower is better', () => {
    const set = computeIndicators(snapshot(), NOW);
    expect(indicator(set, 'risk')?.higherIsBetter).toBe(false);
    expect(indicator(set, 'stability')?.higherIsBetter).toBe(true);
  });

  it('returns null rather than inventing a value when there is no data', () => {
    const set = computeIndicators(snapshot(), NOW);
    expect(indicator(set, 'stability')?.value).toBeNull();
    expect(indicator(set, 'stability')?.confidence).toBe('none');
  });

  it('rates stability higher for good sleep and low stress', () => {
    const good = computeIndicators(
      snapshot({
        checkIns: [0, 1, 2, 3, 4].map((d) =>
          checkIn(d, 'morning', { sleepQuality: 9, stress: 2, mood: 8 }),
        ),
      }),
      NOW,
    );
    const bad = computeIndicators(
      snapshot({
        checkIns: [0, 1, 2, 3, 4].map((d) =>
          checkIn(d, 'morning', { sleepQuality: 2, stress: 9, mood: 3 }),
        ),
      }),
      NOW,
    );
    expect(indicator(good, 'stability')!.value!).toBeGreaterThan(
      indicator(bad, 'stability')!.value!,
    );
  });

  it('weights resisting a strong craving more than resisting a weak one', () => {
    const strong = computeIndicators(
      snapshot({
        cravings: [craving(1, 9, 'resisted'), craving(2, 2, 'used')],
      }),
      NOW,
    );
    const weak = computeIndicators(
      snapshot({
        cravings: [craving(1, 2, 'resisted'), craving(2, 9, 'used')],
      }),
      NOW,
    );
    expect(indicator(strong, 'craving_control')!.value!).toBeGreaterThan(
      indicator(weak, 'craving_control')!.value!,
    );
  });

  it('scores routine from how many check-ins were actually done', () => {
    const set = computeIndicators(
      snapshot({
        checkIns: [0, 1, 2, 3, 4, 5, 6].flatMap((d) => [
          checkIn(d, 'morning'),
          checkIn(d, 'evening'),
        ]),
      }),
      NOW,
    );
    // 14 of an expected 28 over the window.
    expect(indicator(set, 'routine')?.value).toBe(50);
  });

  it('treats going quiet as a risk signal, not as neutral', () => {
    const quiet = computeIndicators(
      snapshot({ cravings: [craving(1, 5, 'resisted')] }),
      NOW,
    );
    expect(indicator(quiet, 'risk')!.value!).toBeGreaterThan(0);
  });

  it('raises risk after a recent relapse', () => {
    const base = snapshot({ checkIns: [checkIn(1, 'morning')], cravings: [craving(1, 5, 'resisted')] });
    const withRelapse = computeIndicators(
      {
        ...base,
        relapses: [{ id: 'r1', quitId: 'q1', occurredAt: new Date(NOW.getTime() - 2 * DAY) }],
      },
      NOW,
    );
    const without = computeIndicators(base, NOW);
    expect(indicator(withRelapse, 'risk')!.value!).toBeGreaterThan(
      indicator(without, 'risk')!.value!,
    );
  });

  it('rewards having a why statement and future-self answers under purpose', () => {
    const set = computeIndicators(
      snapshot({
        profile: {
          phase: 'stabilization',
          timezone: 'Europe/Stockholm',
          country: 'SE',
          whyStatement: 'Jag vill kunna vara närvarande med min son.',
          futureSelf: { days30: 'Sova hela nätter', days90: 'Tillbaka på jobbet' },
        },
      }),
      NOW,
    );
    expect(indicator(set, 'purpose')!.value!).toBeGreaterThanOrEqual(60);
  });

  it('reports confidence honestly from the sample size', () => {
    const thin = computeIndicators(snapshot({ checkIns: [checkIn(1, 'morning')] }), NOW);
    const thick = computeIndicators(
      snapshot({ checkIns: Array.from({ length: 20 }, (_, i) => checkIn(i % 14, 'morning')) }),
      NOW,
    );
    expect(indicator(thin, 'stability')?.confidence).toBe('low');
    expect(indicator(thick, 'stability')?.confidence).toBe('high');
  });

  it('reports an unknown trend when there is no previous window to compare with', () => {
    const set = computeIndicators(snapshot({ checkIns: [checkIn(1, 'morning')] }), NOW);
    expect(indicator(set, 'stability')?.trend).toBe('unknown');
  });

  it('keeps every value inside 0–100', () => {
    const set = computeIndicators(
      snapshot({
        checkIns: [checkIn(1, 'morning', { sleepQuality: 10, stress: 0, mood: 10 })],
        cravings: [craving(1, 10, 'resisted')],
        supportContacts: [
          { id: 'c1', name: 'A', relation: 'friend', isPrimary: true },
          { id: 'c2', name: 'B', relation: 'friend', isPrimary: false },
          { id: 'c3', name: 'C', relation: 'friend', isPrimary: false },
          { id: 'c4', name: 'D', relation: 'friend', isPrimary: false },
        ],
      }),
      NOW,
    );
    for (const i of set.indicators) {
      if (i.value != null) {
        expect(i.value).toBeGreaterThanOrEqual(0);
        expect(i.value).toBeLessThanOrEqual(100);
      }
    }
  });
});
