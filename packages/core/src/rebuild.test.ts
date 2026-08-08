import { describe, expect, it } from 'vitest';
import {
  availableDomains,
  LIFE_DOMAINS,
  rebuildProgress,
  suggestNextDomain,
  type DomainProgress,
} from './rebuild.js';
import type { CheckIn, QuitPlan, RecoverySnapshot } from './types.js';

const DAY = 86_400_000;
const NOW = new Date(2026, 2, 20, 12, 0, 0);

const quit: QuitPlan = {
  id: 'q1',
  substance: 'alcohol',
  startedAt: new Date(NOW.getTime() - 40 * DAY),
  baselineUnitsPerDay: 6,
  unitCostMinor: 3000,
  currency: 'SEK',
  minutesPerUnit: 45,
  status: 'active',
};

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function morning(daysAgo: number, sleepQuality: number): CheckIn {
  const at = new Date(NOW.getTime() - daysAgo * DAY);
  return {
    id: `ci-${daysAgo}`,
    kind: 'morning',
    day: dayKey(at),
    createdAt: at,
    sleepQuality,
    stress: 5,
    mood: 5,
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

describe('availableDomains', () => {
  it('offers only the survivable basics in the acute phase', () => {
    const ids = availableDomains('acute').map((d) => d.id);
    expect(ids).toContain('sleep');
    expect(ids).toContain('health');
    expect(ids).toContain('home');
    // Nobody on day two is working on their career or their identity, and
    // putting it in front of them just adds a failure to a hard day.
    expect(ids).not.toContain('work');
    expect(ids).not.toContain('identity');
  });

  it('opens up the middle tier at stabilization', () => {
    const ids = availableDomains('stabilization').map((d) => d.id);
    expect(ids).toContain('work');
    expect(ids).toContain('money');
    expect(ids).toContain('relationships');
    expect(ids).not.toContain('identity');
  });

  it('offers everything once identity work is realistic', () => {
    expect(availableDomains('identity')).toHaveLength(LIFE_DOMAINS.length);
    expect(availableDomains('relapse_prevention')).toHaveLength(LIFE_DOMAINS.length);
  });

  it('treats the pre-quit phases as acute-equivalent', () => {
    expect(availableDomains('day_zero').map((d) => d.id)).not.toContain('work');
    expect(availableDomains('insight').map((d) => d.id)).not.toContain('identity');
  });
});

describe('suggestNextDomain', () => {
  it('suggests exactly one thing, never a list', () => {
    const result = suggestNextDomain(snapshot(), [], 'stabilization', NOW);
    expect(result).not.toBeNull();
    expect(result?.domain).toBeDefined();
  });

  it('follows the evidence when sleep has been bad repeatedly', () => {
    const result = suggestNextDomain(
      snapshot({ checkIns: [morning(1, 2), morning(2, 3), morning(3, 2), morning(4, 8)] }),
      [],
      'stabilization',
      NOW,
    );
    expect(result?.domain.id).toBe('sleep');
    expect(result?.reasonKey).toBe('rebuild.reason.sleep_evidence');
  });

  it('does not re-suggest a domain the person already has steady', () => {
    const progress: DomainProgress[] = [{ id: 'sleep', status: 'steady' }];
    const result = suggestNextDomain(
      snapshot({ checkIns: [morning(1, 2), morning(2, 2), morning(3, 2)] }),
      progress,
      'stabilization',
      NOW,
    );
    expect(result?.domain.id).not.toBe('sleep');
  });

  it('never suggests something the phase has not unlocked', () => {
    const progress: DomainProgress[] = [
      { id: 'sleep', status: 'steady' },
      { id: 'health', status: 'steady' },
      { id: 'home', status: 'steady' },
    ];
    const result = suggestNextDomain(snapshot(), progress, 'acute', NOW);
    // Everything acute-available is steady, so there is nothing honest to offer.
    expect(result).toBeNull();
  });

  it('falls back to the heaviest unfinished domain', () => {
    const result = suggestNextDomain(snapshot(), [], 'identity', NOW);
    expect(result?.reasonKey).toBe('rebuild.reason.default');
    expect(result?.domain.id).toBe('sleep');
  });
});

describe('rebuildProgress', () => {
  it('counts rather than scores', () => {
    const progress: DomainProgress[] = [
      { id: 'sleep', status: 'steady' },
      { id: 'money', status: 'working' },
    ];
    const result = rebuildProgress(progress);
    expect(result.steady).toBe(1);
    expect(result.working).toBe(1);
    expect(result.untouched).toBe(LIFE_DOMAINS.length - 2);
    expect(result.total).toBe(LIFE_DOMAINS.length);
    // Deliberately no percentage: the rebuild is not a completion bar.
    expect(result).not.toHaveProperty('percent');
  });

  it('handles an empty slate', () => {
    expect(rebuildProgress([]).untouched).toBe(LIFE_DOMAINS.length);
  });
});
