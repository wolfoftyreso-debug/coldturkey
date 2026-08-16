import {
  emergencyResources,
  TEN_MINUTE_PROTOCOL,
  TOOLBOX,
  URGE_SURFING_SCRIPT,
} from '@cleat/core';
import { translate, type Locale } from '@cleat/i18n';
import type { CoachResponse, CravingPlan } from './api';

/**
 * What the craving flow does when the network does not answer.
 *
 * A phone in a basement at 2am with one bar is not an edge case for this
 * screen — it is close to the median case for the moment it exists for. The
 * protocol, the urge-surfing script, the tools and the emergency numbers are
 * all constants compiled into the app, so none of them need a server.
 *
 * Unlike the web client there is no cached personal kit here: the why statement
 * and the support contacts are not stored on the device. That is a deliberate
 * limit rather than an oversight — `expo-secure-store` is the only storage in
 * this app that is not readable by anything that gets at the filesystem, and it
 * is a small key-value store meant for tokens, not a place to keep somebody's
 * recovery record. So the offline plan is the general one, and it says so.
 */
export function offlineCravingPlan(
  locale: Locale,
  intensity: number,
): CravingPlan & { offline: true } {
  const lowEffortFirst = TOOLBOX.filter((tool) => tool.category === 'acute' && tool.lowEffort);

  return {
    leaveFirst: false,
    callFirst: null,
    // Same rule as the server: the stronger the craving, the shorter the
    // commitment, because a promise you break costs you self-trust.
    delayMinutes: intensity >= 9 ? 5 : intensity >= 7 ? 10 : 20,
    tools: lowEffortFirst.slice(0, 4).map((tool) => ({
      id: tool.id,
      label: translate(locale, `tool.${tool.id}`),
    })),
    protocol: TEN_MINUTE_PROTOCOL.map((key) => translate(locale, key)),
    urgeSurfing: URGE_SURFING_SCRIPT.map((key) => translate(locale, key)),
    whyStatement: null,
    followUp: translate(locale, 'craving.followup.what_happened_before'),
    offline: true,
  };
}

/**
 * The emergency answer, composed on the device.
 *
 * "Yes, somebody is in immediate danger" was a network call and nothing else.
 * When it failed the screen still moved on — to "help you can call now" above
 * an empty box. The wording below is the same three sentences the coach
 * composes server-side, in the same order, so the offline answer is not a
 * lesser one.
 */
export function offlineEmergency(locale: Locale, country: string | undefined): CoachResponse {
  return {
    reply: [
      translate(locale, 'safety.emergency'),
      translate(locale, 'safety.notAlone'),
      translate(locale, 'safety.stayHere'),
    ].join('\n\n'),
    safety: {
      level: 'emergency',
      bypassedCoach: true,
      resources: emergencyResources(country, 'emergency').map((resource) => ({
        key: resource.key,
        contact: resource.contact,
        label: translate(locale, resource.key),
      })),
    },
    negotiation: { detected: false, types: [] },
    source: 'local',
  };
}
