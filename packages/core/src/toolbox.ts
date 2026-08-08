/**
 * The Recovery Toolbox — the set of concrete things a person can actually do.
 *
 * Every tool is a verb. Nothing in here is "reflect on your journey"; each entry
 * is something you can start within the next sixty seconds.
 */
export type ToolCategory = 'acute' | 'cognitive' | 'behavioural' | 'social' | 'life';

export interface RecoveryTool {
  id: string;
  category: ToolCategory;
  /** Roughly how long it takes, in minutes. Used to pick tools that fit the moment. */
  minutes: number;
  /**
   * Tools that work even when the person can barely think. Shown first in the
   * acute craving flow, where the interface has to stay almost empty.
   */
  lowEffort: boolean;
}

export const TOOLBOX: RecoveryTool[] = [
  // Acute — for the ten minutes that decide the day.
  { id: 'delay_10_minutes', category: 'acute', minutes: 10, lowEffort: true },
  { id: 'change_environment', category: 'acute', minutes: 2, lowEffort: true },
  { id: 'call_someone', category: 'acute', minutes: 5, lowEffort: true },
  { id: 'urge_surfing', category: 'acute', minutes: 10, lowEffort: true },
  { id: 'grounding_54321', category: 'acute', minutes: 3, lowEffort: true },
  { id: 'slow_breathing', category: 'acute', minutes: 3, lowEffort: true },
  { id: 'drink_water_eat', category: 'acute', minutes: 5, lowEffort: true },
  { id: 'move_your_body', category: 'acute', minutes: 10, lowEffort: true },
  { id: 'remove_the_trigger', category: 'acute', minutes: 5, lowEffort: true },
  { id: 'cold_water', category: 'acute', minutes: 2, lowEffort: true },
  { id: 'leave_the_situation', category: 'acute', minutes: 5, lowEffort: true },

  // Cognitive — for when there is enough room to think.
  { id: 'name_the_negotiation', category: 'cognitive', minutes: 5, lowEffort: false },
  { id: 'play_the_tape_forward', category: 'cognitive', minutes: 5, lowEffort: false },
  { id: 'read_my_why', category: 'cognitive', minutes: 3, lowEffort: true },
  { id: 'decisional_balance', category: 'cognitive', minutes: 15, lowEffort: false },
  { id: 'challenge_the_thought', category: 'cognitive', minutes: 10, lowEffort: false },
  { id: 'reframe', category: 'cognitive', minutes: 10, lowEffort: false },

  // Behavioural — changing the system around the behaviour.
  { id: 'implementation_intention', category: 'behavioural', minutes: 10, lowEffort: false },
  { id: 'habit_replacement', category: 'behavioural', minutes: 15, lowEffort: false },
  { id: 'design_the_evening', category: 'behavioural', minutes: 15, lowEffort: false },
  { id: 'reward_substitution', category: 'behavioural', minutes: 10, lowEffort: false },
  { id: 'schedule_the_day', category: 'behavioural', minutes: 15, lowEffort: false },
  { id: 'block_access', category: 'behavioural', minutes: 20, lowEffort: false },

  // Social — recovery is not a solo project.
  { id: 'contact_trusted_person', category: 'social', minutes: 10, lowEffort: true },
  { id: 'peer_support', category: 'social', minutes: 60, lowEffort: false },
  { id: 'book_professional', category: 'social', minutes: 20, lowEffort: false },
  { id: 'tell_someone_today', category: 'social', minutes: 10, lowEffort: false },

  // Life — the part that makes staying stopped possible.
  { id: 'sleep_routine', category: 'life', minutes: 30, lowEffort: false },
  { id: 'exercise', category: 'life', minutes: 30, lowEffort: false },
  { id: 'money_plan', category: 'life', minutes: 30, lowEffort: false },
  { id: 'work_next_step', category: 'life', minutes: 30, lowEffort: false },
  { id: 'repair_a_relationship', category: 'life', minutes: 30, lowEffort: false },
  { id: 'do_something_you_like', category: 'life', minutes: 45, lowEffort: false },
];

const BY_ID = new Map(TOOLBOX.map((tool) => [tool.id, tool]));

export function tool(id: string): RecoveryTool | undefined {
  return BY_ID.get(id);
}

export function toolsByCategory(category: ToolCategory): RecoveryTool[] {
  return TOOLBOX.filter((t) => t.category === category);
}
