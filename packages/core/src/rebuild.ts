import type { RecoverySnapshot } from './types.js';
import { computeIndicators } from './score.js';

/**
 * Rebuild my life — the fifth mode, and the one the product is actually about.
 *
 * Stopping is the beginning. This is the part that means a person does not have
 * to start again: the domains of a life that either hold someone up or quietly
 * push them back toward using.
 *
 * The structure follows SAMHSA's four dimensions of recovery — health, home,
 * purpose, community — broken into domains people recognise, in entirely secular
 * language.
 */
export type LifeDomainId =
  | 'health'
  | 'sleep'
  | 'relationships'
  | 'money'
  | 'work'
  | 'exercise'
  | 'social'
  | 'home'
  | 'identity'
  | 'purpose';

export type RecoveryDimension = 'health' | 'home' | 'purpose' | 'community';

export interface LifeDomain {
  id: LifeDomainId;
  dimension: RecoveryDimension;
  /**
   * Roughly how strongly this domain feeds back into relapse risk. Used only for
   * ordering suggestions, never shown as a number — nobody needs to be told
   * their relationships score 0.8.
   */
  weight: number;
  /** Phases where this domain is realistic to work on at all. */
  availableFrom: 'acute' | 'stabilization' | 'identity';
}

export const LIFE_DOMAINS: LifeDomain[] = [
  // Sleep first, deliberately. It is the single largest modifiable input to
  // craving intensity, and it is the one people most often treat as untouchable.
  { id: 'sleep', dimension: 'health', weight: 1.0, availableFrom: 'acute' },
  { id: 'health', dimension: 'health', weight: 0.8, availableFrom: 'acute' },
  { id: 'home', dimension: 'home', weight: 0.9, availableFrom: 'acute' },
  { id: 'money', dimension: 'home', weight: 0.75, availableFrom: 'stabilization' },
  { id: 'social', dimension: 'community', weight: 0.85, availableFrom: 'stabilization' },
  { id: 'relationships', dimension: 'community', weight: 0.8, availableFrom: 'stabilization' },
  { id: 'work', dimension: 'purpose', weight: 0.7, availableFrom: 'stabilization' },
  { id: 'exercise', dimension: 'health', weight: 0.6, availableFrom: 'stabilization' },
  { id: 'identity', dimension: 'purpose', weight: 0.7, availableFrom: 'identity' },
  { id: 'purpose', dimension: 'purpose', weight: 0.75, availableFrom: 'identity' },
];

export type DomainStatus = 'untouched' | 'working' | 'steady';

export interface DomainProgress {
  id: LifeDomainId;
  status: DomainStatus;
  /** Free-text note in the person's own words. */
  note?: string | null;
  updatedAt?: Date | null;
}

export interface RebuildSuggestion {
  domain: LifeDomain;
  /** Why this one, as a translation key. */
  reasonKey: string;
}

const PHASE_RANK: Record<LifeDomain['availableFrom'], number> = {
  acute: 0,
  stabilization: 1,
  identity: 2,
};

/**
 * Which domains it is honest to offer someone right now.
 *
 * A person on day two cannot work on their career, and putting it in front of
 * them is a way of adding failure to a day that has enough. Sleep, health and a
 * safe place to be are available from the start; everything else waits.
 */
export function availableDomains(
  phase: 'insight' | 'decision' | 'preparation' | 'day_zero' | 'acute' | 'stabilization' | 'identity' | 'relapse_prevention',
): LifeDomain[] {
  const rank =
    phase === 'day_zero' || phase === 'acute' || phase === 'insight' || phase === 'decision' || phase === 'preparation'
      ? 0
      : phase === 'stabilization'
        ? 1
        : 2;
  return LIFE_DOMAINS.filter((d) => PHASE_RANK[d.availableFrom] <= rank);
}

/**
 * Suggest exactly one domain to work on.
 *
 * One, not a ranked list of ten. A person rebuilding a life after addiction is
 * already looking at everything that is broken; the product's job is to point at
 * the next thing, not to itemise the damage.
 */
export function suggestNextDomain(
  snapshot: RecoverySnapshot,
  progress: DomainProgress[],
  phase: Parameters<typeof availableDomains>[0],
  now: Date,
): RebuildSuggestion | null {
  const available = availableDomains(phase);
  if (available.length === 0) return null;

  const byId = new Map(progress.map((p) => [p.id, p]));
  const indicators = computeIndicators(snapshot, now);
  const stability = indicators.indicators.find((i) => i.key === 'stability');
  const connection = indicators.indicators.find((i) => i.key === 'connection');

  // Evidence from the person's own data outranks the default ordering: poor
  // sleep and thin connection are the two that most reliably show up before a
  // relapse, so if either is visibly weak, that is the suggestion.
  const poorSleep = snapshot.checkIns
    .filter((c) => c.kind === 'morning' && typeof c.sleepQuality === 'number')
    .slice(-7)
    .filter((c) => (c.sleepQuality ?? 10) <= 4).length;

  if (poorSleep >= 3) {
    const sleep = available.find((d) => d.id === 'sleep');
    if (sleep && byId.get('sleep')?.status !== 'steady') {
      return { domain: sleep, reasonKey: 'rebuild.reason.sleep_evidence' };
    }
  }

  if (
    connection?.value != null &&
    connection.value < 40 &&
    connection.confidence !== 'none'
  ) {
    const social = available.find((d) => d.id === 'social');
    if (social && byId.get('social')?.status !== 'steady') {
      return { domain: social, reasonKey: 'rebuild.reason.connection_low' };
    }
  }

  if (stability?.value != null && stability.value < 40) {
    const health = available.find((d) => d.id === 'health');
    if (health && byId.get('health')?.status !== 'steady') {
      return { domain: health, reasonKey: 'rebuild.reason.stability_low' };
    }
  }

  // Otherwise: the heaviest domain not yet steady.
  const candidate = [...available]
    .filter((d) => byId.get(d.id)?.status !== 'steady')
    .sort((a, b) => b.weight - a.weight)[0];

  return candidate ? { domain: candidate, reasonKey: 'rebuild.reason.default' } : null;
}

/** How much of the rebuild is under way. Reported as counts, never as a score. */
export function rebuildProgress(progress: DomainProgress[]): {
  steady: number;
  working: number;
  untouched: number;
  total: number;
} {
  const byId = new Map(progress.map((p) => [p.id, p.status]));
  let steady = 0;
  let working = 0;
  for (const domain of LIFE_DOMAINS) {
    const status = byId.get(domain.id) ?? 'untouched';
    if (status === 'steady') steady += 1;
    else if (status === 'working') working += 1;
  }
  return {
    steady,
    working,
    untouched: LIFE_DOMAINS.length - steady - working,
    total: LIFE_DOMAINS.length,
  };
}
