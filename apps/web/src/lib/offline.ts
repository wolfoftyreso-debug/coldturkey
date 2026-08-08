import { TEN_MINUTE_PROTOCOL, URGE_SURFING_SCRIPT, TOOLBOX } from '@cleat/core';
import { translate, type Locale } from '@cleat/i18n';

/**
 * The offline survival kit.
 *
 * The craving flow is the one part of this product that must work when nothing
 * else does. Someone in a basement at 2am with one bar of signal is not an edge
 * case — it is close to the median case for the moment this screen exists for.
 *
 * So everything Reset needs is written to localStorage on every successful load
 * and read back when the network fails: the ten-minute protocol, urge surfing,
 * the tools, the person's own why statement, and the phone numbers of the people
 * they said they would call.
 *
 * The protocol and the tools come from `@cleat/core`, which is bundled into the
 * page — those need no network even on a cold start. Only the personal parts
 * have to be cached.
 */
const KEY = 'cleat.offline.v1';

export interface OfflineKit {
  savedAt: string;
  whyStatement: string | null;
  supportContacts: { id: string; name: string; phone: string | null; isPrimary: boolean }[];
  /** Localised emergency numbers for the person's country. */
  resources: { key: string; label: string; contact: string }[];
  locale: Locale;
}

export function saveOfflineKit(kit: Omit<OfflineKit, 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...kit, savedAt: new Date().toISOString() }));
  } catch {
    // A full or disabled localStorage must never break the live flow.
  }
}

export function loadOfflineKit(): OfflineKit | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OfflineKit) : null;
  } catch {
    return null;
  }
}

export function clearOfflineKit(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}

/**
 * Build the same shape the `/v1/craving/plan` endpoint returns, entirely on the
 * device. The tool selection is simplified — no phase or history — because the
 * point is to be useful, not to be identical.
 */
export function offlineCravingPlan(
  locale: Locale,
  intensity: number,
  kit: OfflineKit | null,
): {
  leaveFirst: boolean;
  callFirst: { name: string; phone: string | null } | null;
  delayMinutes: number;
  tools: { id: string; label: string }[];
  protocol: string[];
  urgeSurfing: string[];
  whyStatement: string | null;
  followUp: string;
  offline: true;
} {
  const lowEffortFirst = TOOLBOX.filter((tool) => tool.category === 'acute' && tool.lowEffort);
  const contacts = kit?.supportContacts ?? [];
  const primary = contacts.find((c) => c.isPrimary) ?? contacts[0] ?? null;

  return {
    leaveFirst: false,
    callFirst: primary ? { name: primary.name, phone: primary.phone } : null,
    // Same rule as the server: the stronger the craving, the shorter the
    // commitment, because a promise you break costs you self-trust.
    delayMinutes: intensity >= 9 ? 5 : intensity >= 7 ? 10 : 20,
    tools: lowEffortFirst.slice(0, 4).map((tool) => ({
      id: tool.id,
      label: translate(locale, `tool.${tool.id}`),
    })),
    protocol: TEN_MINUTE_PROTOCOL.map((key) => translate(locale, key)),
    urgeSurfing: URGE_SURFING_SCRIPT.map((key) => translate(locale, key)),
    whyStatement: kit?.whyStatement ?? null,
    followUp: translate(locale, 'craving.followup.what_happened_before'),
    offline: true,
  };
}

/** Cravings logged with no network, replayed when it comes back. */
const QUEUE_KEY = 'cleat.queue.v1';

export interface QueuedCraving {
  intensity: number;
  feeling: string;
  location: string;
  outcome: 'resisted' | 'used' | 'unknown';
  occurredAt: string;
}

export function queueCraving(entry: QueuedCraving): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as QueuedCraving[];
    existing.push(entry);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(existing.slice(-50)));
  } catch {
    // Losing a queued log is survivable; breaking the screen is not.
  }
}

export function takeQueuedCravings(): QueuedCraving[] {
  if (typeof window === 'undefined') return [];
  try {
    const existing = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as QueuedCraving[];
    localStorage.removeItem(QUEUE_KEY);
    return existing;
  } catch {
    return [];
  }
}
