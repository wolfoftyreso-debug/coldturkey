import type { CravingFeeling, CravingLocation, SupportContact } from './types.js';
import { TOOLBOX, type RecoveryTool } from './toolbox.js';

/**
 * The Craving Engine — what happens when someone presses "I want to use".
 *
 * The goal of this flow is not to win recovery. It is to get to the next safe
 * decision. So the interface stays almost empty, the questions are few, and the
 * answer is always something to *do*, never something to read.
 */
export type CravingStep = 'safety' | 'feeling' | 'location' | 'coach';

export const CRAVING_STEPS: CravingStep[] = ['safety', 'feeling', 'location', 'coach'];

export const CRAVING_FEELINGS: CravingFeeling[] = [
  'craving',
  'panic',
  'loneliness',
  'anger',
  'stress',
  'boredom',
  'grief',
  'pain',
  'social_pressure',
  'other',
];

export const CRAVING_LOCATIONS: CravingLocation[] = [
  'home',
  'work',
  'party',
  'with_users',
  'alone',
  'in_transit',
  'other',
];

/**
 * The ten-minute protocol. Numbered because in an acute craving a person needs
 * a sequence, not options — but the app never requires all ten. Getting through
 * step 2 and step 7 is a win.
 */
export const TEN_MINUTE_PROTOCOL = [
  'protocol.stop_the_decision',
  'protocol.move_away_from_trigger',
  'protocol.say_out_loud',
  'protocol.contact_a_person',
  'protocol.water_and_body',
  'protocol.change_environment',
  'protocol.wait_ten_minutes',
  'protocol.name_what_you_need',
  'protocol.do_the_alternative',
  'protocol.come_back',
] as const;

/**
 * Urge surfing. The point is explicitly not to make the craving stop — it is to
 * change the person's relationship to it while it passes on its own.
 */
export const URGE_SURFING_SCRIPT = [
  'surf.dont_fight',
  'surf.observe',
  'surf.signal_not_order',
  'surf.notice_it_change',
  'surf.nothing_to_do',
  'surf.it_peaks_and_falls',
] as const;

export interface CravingContext {
  feeling: CravingFeeling;
  location: CravingLocation;
  /** 0–10. Above 8 the app drops to lowest-effort tools only. */
  intensity: number;
  supportContacts: SupportContact[];
  hasWhyStatement: boolean;
}

export interface CravingPlan {
  /** Ordered tools, best fit first. Never more than four — a list is a burden. */
  tools: RecoveryTool[];
  /** Whether to lead with calling a specific person, and who. */
  callFirst: SupportContact | null;
  /** Translation key for the one question the coach asks after the plan. */
  followUpKey: string;
  /** True when the situation calls for physically leaving before anything else. */
  leaveFirst: boolean;
}

/**
 * Tools that map to a specific feeling. These are additive on top of the always
 * available acute set — the feeling narrows the choice, it does not replace it.
 */
const FEELING_TOOLS: Record<CravingFeeling, string[]> = {
  craving: ['urge_surfing', 'delay_10_minutes', 'read_my_why'],
  panic: ['slow_breathing', 'grounding_54321', 'cold_water'],
  loneliness: ['call_someone', 'contact_trusted_person', 'tell_someone_today'],
  anger: ['move_your_body', 'leave_the_situation', 'slow_breathing'],
  stress: ['slow_breathing', 'move_your_body', 'design_the_evening'],
  boredom: ['do_something_you_like', 'move_your_body', 'schedule_the_day'],
  grief: ['contact_trusted_person', 'grounding_54321', 'do_something_you_like'],
  pain: ['drink_water_eat', 'slow_breathing', 'book_professional'],
  social_pressure: ['leave_the_situation', 'call_someone', 'change_environment'],
  other: ['delay_10_minutes', 'grounding_54321', 'call_someone'],
};

/** Locations where the single most useful action is to physically be elsewhere. */
const LEAVE_FIRST_LOCATIONS: CravingLocation[] = ['party', 'with_users'];

const LOCATION_TOOLS: Record<CravingLocation, string[]> = {
  home: ['remove_the_trigger', 'change_environment', 'move_your_body'],
  work: ['change_environment', 'slow_breathing', 'drink_water_eat'],
  party: ['leave_the_situation', 'call_someone', 'change_environment'],
  with_users: ['leave_the_situation', 'call_someone', 'remove_the_trigger'],
  alone: ['call_someone', 'change_environment', 'do_something_you_like'],
  in_transit: ['slow_breathing', 'call_someone', 'delay_10_minutes'],
  other: ['change_environment', 'delay_10_minutes', 'call_someone'],
};

const BY_ID = new Map(TOOLBOX.map((t) => [t.id, t]));

/**
 * Build the smallest useful plan for this exact moment.
 *
 * At high intensity the plan is filtered to low-effort tools only: someone at 9
 * out of 10 cannot run a decisional balance exercise, and offering one is a way
 * of losing them.
 */
export function buildCravingPlan(context: CravingContext): CravingPlan {
  const leaveFirst = LEAVE_FIRST_LOCATIONS.includes(context.location);
  const highIntensity = context.intensity >= 8;

  const candidateIds: string[] = [];
  if (leaveFirst) candidateIds.push('leave_the_situation');
  candidateIds.push(
    ...(LOCATION_TOOLS[context.location] ?? []),
    ...(FEELING_TOOLS[context.feeling] ?? []),
    'delay_10_minutes',
    'urge_surfing',
  );
  if (context.hasWhyStatement) candidateIds.push('read_my_why');

  const seen = new Set<string>();
  const tools: RecoveryTool[] = [];
  for (const id of candidateIds) {
    if (seen.has(id)) continue;
    const found = BY_ID.get(id);
    if (!found) continue;
    if (highIntensity && !found.lowEffort) continue;
    seen.add(id);
    tools.push(found);
    if (tools.length === 4) break;
  }

  const callFirst =
    context.supportContacts.find((c) => c.isPrimary) ?? context.supportContacts[0] ?? null;

  return {
    tools,
    callFirst,
    leaveFirst,
    // The coach's job after the plan is one question, not a lecture: what
    // happened just before the craving arrived?
    followUpKey: 'craving.followup.what_happened_before',
  };
}

/**
 * How long the app should suggest waiting before revisiting the decision.
 * Stronger cravings get a shorter first commitment — ten minutes is achievable,
 * an hour is not, and a promise the person breaks costs them self-trust.
 */
export function suggestedDelayMinutes(intensity: number): number {
  if (intensity >= 9) return 5;
  if (intensity >= 7) return 10;
  if (intensity >= 4) return 20;
  return 30;
}
