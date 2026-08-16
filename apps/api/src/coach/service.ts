import {
  assessPhase,
  buildCravingPlan,
  computeIndicators,
  computeStreak,
  counterKey,
  detectNegotiation,
  detoxWarning,
  emergencyResources,
  findInsights,
  hoursSinceLastUse,
  mantrasForCraving,
  suggestedDelayMinutes,
  triage,
  type RecoverySnapshot,
  type SafetyResource,
} from '@cleat/core';
import { localizeInsightParams, translate, type Locale } from '@cleat/i18n';
import { askCoach, coachEnabled, type CoachTurn } from './claude.js';
import { buildContextBlock, buildSupporterContext, type CoachMode } from './prompt.js';

export interface CoachRequest {
  snapshot: RecoverySnapshot;
  displayName: string;
  locale: Locale;
  message: string;
  /** Client-declared mode. The craving button knows more than any classifier. */
  mode?: CoachMode;
  /** Answer to "are you in immediate danger?" when the craving flow asked it. */
  immediateDanger?: boolean;
  history: CoachTurn[];
  now: Date;
}

export interface CoachResponse {
  text: string;
  mode: CoachMode;
  safetyLevel: string;
  safetyCategories: string[];
  resources: SafetyResource[];
  negotiation: { detected: boolean; types: string[] };
  /** True when the answer came from the local coach rather than the model. */
  local: boolean;
  /** Set when safety rules stopped the message reaching the model at all. */
  bypassedCoach: boolean;
}

/**
 * The coaching pipeline.
 *
 * The order is the point. Safety triage is deterministic and runs first; an
 * emergency short-circuits before the language model is ever contacted. No
 * model, however good, gets the chance to try coaching someone through an
 * overdose.
 */
export async function coach(request: CoachRequest): Promise<CoachResponse> {
  const { snapshot, locale, message, now } = request;
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(locale, key, params);

  const hoursSince = snapshot.quit
    ? hoursSinceLastUse(snapshot.quit, snapshot.relapses, now)
    : null;

  const safety = triage({
    text: message,
    immediateDanger: request.immediateDanger,
    substance: snapshot.quit?.substance ?? null,
    hoursSinceLastUse: hoursSince,
    country: snapshot.profile.country,
    locale,
  });

  const negotiation = detectNegotiation(message);
  const mode = request.mode ?? inferMode(message, safety.level);

  // --- Hard stop: emergencies never reach the model -------------------------
  if (safety.bypassCoach) {
    return {
      text: [t('safety.emergency'), t('safety.notAlone'), t('safety.stayHere')].join('\n\n'),
      mode,
      safetyLevel: safety.level,
      safetyCategories: safety.categories,
      resources: safety.resources,
      negotiation: { detected: negotiation.detected, types: negotiation.matches.map((m) => m.type) },
      local: true,
      bypassedCoach: true,
    };
  }

  const base = {
    mode,
    safetyLevel: safety.level,
    safetyCategories: safety.categories,
    resources: safety.resources,
    negotiation: { detected: negotiation.detected, types: negotiation.matches.map((m) => m.type) },
    bypassedCoach: false,
  };

  if (!coachEnabled()) {
    return { ...base, text: localCoach(request, safety.level, negotiation.matches.map((m) => m.type), safety.askDirectly), local: true };
  }

  try {
    // Cleat Nära gets a context of its own. The block below is a set of facts
    // about the account holder's *own* addiction — streak, substance, why
    // statement, triggers — and a relative has none of them. Worse, a relative
    // who also has their own quit plan would have it injected into a
    // conversation about somebody else.
    const contextBlock = mode === 'supporter'
      ? buildSupporterContext({
          locale,
          displayName: request.displayName,
          safetyLevel: safety.level,
          safetyCategories: safety.categories,
        })
      : buildContextBlock({
        locale,
        displayName: request.displayName,
        phase: assessPhase(snapshot, now).phase,
        substance: snapshot.quit?.substance ?? null,
        streakDays: snapshot.quit ? computeStreak(snapshot.quit, snapshot.relapses, now).currentDays : null,
        longestStreakDays: snapshot.quit
          ? computeStreak(snapshot.quit, snapshot.relapses, now).longestDays
          : null,
        totalDaysInRecovery: snapshot.quit
          ? computeStreak(snapshot.quit, snapshot.relapses, now).totalDaysInRecovery
          : null,
        restarts: snapshot.quit ? computeStreak(snapshot.quit, snapshot.relapses, now).restarts : 0,
        whyStatement: snapshot.profile.whyStatement ?? null,
        supportContactNames: snapshot.supportContacts.map((c) => c.name),
        topTriggers: topTriggers(snapshot),
        whatHasWorked: whatHasWorked(snapshot, now),
        indicators: computeIndicators(snapshot, now).indicators,
        safetyLevel: safety.level,
        safetyCategories: safety.categories,
        negotiationTypes: negotiation.matches.map((m) => m.type),
        mode,
        detoxWarningRequired: snapshot.quit
          ? detoxWarning(snapshot.quit.substance).required
          : false,
      });

    const history: CoachTurn[] = [...request.history, { role: 'user', content: message }];
    const reply = await askCoach(contextBlock, history, mode);

    if (reply.refused || reply.text.length === 0) {
      return { ...base, text: localCoach(request, safety.level, base.negotiation.types, safety.askDirectly), local: true };
    }

    // An urgent safety level is appended, not delegated. The model is asked to
    // handle it well; the app guarantees the words appear either way. The
    // direct question is guaranteed the same way and leads, because a goodbye
    // should be answered before anything else in the reply — relying on the
    // model to have noticed is exactly the delegation this layer exists to
    // prevent.
    const text = [
      safety.askDirectly ? t('safety.askDirectly') : '',
      reply.text,
      safety.level === 'urgent' ? t('safety.urgent') : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    return { ...base, text, local: false };
  } catch {
    // Network trouble, rate limits, an outage: the person in front of the screen
    // still gets a useful answer, because the tools do not need the model.
    return { ...base, text: localCoach(request, safety.level, base.negotiation.types, safety.askDirectly), local: true };
  }
}

/**
 * The local coach.
 *
 * Runs when there is no API key configured, when the model declines, and when
 * the network is down. It is not a stub — the ten-minute protocol, the craving
 * plan and the negotiation counters are the parts of the product that matter
 * most at 2am, and none of them require a language model.
 */
export function localCoach(
  request: CoachRequest,
  safetyLevel: string,
  negotiationTypes: string[],
  askDirectly = false,
): string {
  const { snapshot, locale, now } = request;
  const t = (key: string, params?: Record<string, string | number>) =>
    translate(locale, key, params);

  const parts: string[] = [];

  if (safetyLevel === 'urgent') {
    parts.push(t('safety.urgent'));
  }

  // Ambiguous finality goes first and it goes before everything else. Somebody
  // who wrote "tack för allt" and meant goodbye should not have to read a
  // craving tip before anyone asks. And when they meant they finished a
  // project, one direct question costs a sentence.
  if (askDirectly) {
    parts.push(t('safety.askDirectly'));
  }

  // Before the negotiation branch, and the ordering is the point. A relative
  // writing "he says he'll only have one more" trips the same detector, and the
  // counter it produces is addressed to whoever is doing the negotiating. Aimed
  // at the exhausted partner quoting it, that reads as the app telling them
  // their own brain is bargaining with them.
  if ((request.mode ?? 'general') === 'supporter') {
    parts.push(t('near.talkGreeting'));
    parts.push(t('near.talkNotAboutThem'));
    parts.push(t('near.topic.you_did_not_cause_it.body'));
    return parts.filter(Boolean).join('\n\n');
  }

  if (negotiationTypes.length > 0) {
    parts.push(t('negotiation.detected'));
    const first = negotiationTypes[0]!;
    parts.push(t(counterKey(first as never)));
    parts.push(t('negotiation.question'));
    return parts.filter(Boolean).join('\n\n');
  }

  const mode = request.mode ?? 'general';

  if (mode === 'relapse') {
    parts.push(t('relapse.opening'));
    parts.push(t('relapse.continuity'));
    parts.push(t('relapse.safety.are_you_safe'));
    return parts.filter(Boolean).join('\n\n');
  }

  if (mode === 'acute') {
    const intensity = 7;
    const plan = buildCravingPlan({
      feeling: 'craving',
      location: 'other',
      intensity,
      supportContacts: snapshot.supportContacts,
      hasWhyStatement: Boolean(snapshot.profile.whyStatement),
    });
    parts.push(t('mantra.tenMinutes'));
    if (plan.leaveFirst) parts.push(t('craving.leaveFirst'));
    parts.push(t('craving.delay', { minutes: suggestedDelayMinutes(intensity) }));
    if (plan.callFirst) parts.push(t('craving.callFirst', { name: plan.callFirst.name }));
    const first = plan.tools[0];
    if (first) parts.push(t(`tool.${first.id}`));
    parts.push(t(mantrasForCraving()[0]!));
    parts.push(t('craving.followup.what_happened_before'));
    return parts.filter(Boolean).join('\n\n');
  }

  const phase = assessPhase(snapshot, now).phase;
  const greetingKey = `coach.greeting.${phase}`;
  const greeting = t(greetingKey);
  parts.push(greeting === greetingKey ? t('coach.greeting.default') : greeting);

  const insights = findInsights(snapshot, { now, limit: 1 });
  const insight = insights[0];
  if (insight) {
    // Insight params carry raw enum values ("afternoon", a weekday number) that
    // need their own key namespace. Without this the local coach says "dina sug
    // kommer oftast afternoon" — an English word in a Swedish sentence, in the
    // one place the product is claiming to know something about the person.
    parts.push(t(insight.message.key, localizeInsightParams(locale, insight.message.params)));
  }

  parts.push(t('coach.offline'));
  return parts.filter(Boolean).join('\n\n');
}

/**
 * Infer the conversation mode from the message when the client did not declare
 * one. The client's declaration always wins: the craving button knows the person
 * is in an acute state more reliably than any keyword match.
 */
function inferMode(message: string, safetyLevel: string): CoachMode {
  if (safetyLevel === 'urgent') return 'acute';
  const lower = message.toLowerCase();
  if (/(sug|craving|vill anv|want to use|vill dricka|vill ta)/.test(lower)) return 'acute';
  if (/(återfall|aterfall|relapse|jag drack|jag tog|messed up|trampade fel)/.test(lower)) {
    return 'relapse';
  }
  if (message.length > 400) return 'deep';
  return 'general';
}

function topTriggers(snapshot: RecoverySnapshot): string[] {
  const counts = new Map<string, number>();
  for (const craving of snapshot.cravings) {
    const trigger = craving.trigger?.trim();
    if (!trigger) continue;
    counts.set(trigger, (counts.get(trigger) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, count]) => `${label} (${count}×)`);
}

function whatHasWorked(snapshot: RecoverySnapshot, now: Date): string[] {
  return findInsights(snapshot, { now, limit: 3 })
    .filter((i) => i.id === 'what_works')
    .map((i) => String(i.message.params?.action ?? ''))
    .filter(Boolean);
}

export { emergencyResources };
