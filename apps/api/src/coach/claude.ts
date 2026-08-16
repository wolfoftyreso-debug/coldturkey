import Anthropic from '@anthropic-ai/sdk';
import { loadConfig } from '../config.js';
import { identityFor, MODE_BUDGET, type CoachMode } from './prompt.js';

let client: Anthropic | null = null;

export function coachEnabled(): boolean {
  return Boolean(loadConfig().ANTHROPIC_API_KEY);
}

function getClient(): Anthropic {
  if (!client) {
    const config = loadConfig();
    if (!config.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured');
    client = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  }
  return client;
}

export interface CoachTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface CoachReply {
  text: string;
  /** True when the model declined; the caller falls back to the local coach. */
  refused: boolean;
  usage?: { inputTokens: number; outputTokens: number };
}

/**
 * Ask Claude for a coaching reply.
 *
 * The system prompt is sent as two blocks: the stable identity with a cache
 * breakpoint, then the per-request context. Everything before the breakpoint is
 * byte-identical across users, so the expensive part of the prompt is read from
 * cache rather than re-processed on every craving at 2am.
 */
export async function askCoach(
  contextBlock: string,
  history: CoachTurn[],
  mode: CoachMode,
): Promise<CoachReply> {
  const config = loadConfig();
  const budget = MODE_BUDGET[mode];

  const response = await getClient().messages.create({
    model: config.COACH_MODEL,
    max_tokens: budget.maxTokens,
    thinking: { type: 'adaptive' },
    output_config: { effort: budget.effort },
    system: [
      // Two byte-stable identities, one per audience, each caching on its own
      // breakpoint. Cleat Nära speaks to somebody who is not the person using,
      // and the recovery prompt addresses them in nearly every line.
      { type: 'text', text: identityFor(mode), cache_control: { type: 'ephemeral' } },
      { type: 'text', text: contextBlock },
    ],
    messages: history.map((turn) => ({ role: turn.role, content: turn.content })),
  });

  // Always check `stop_reason` before reading content: a refusal returns HTTP
  // 200 with an empty or partial content array, and indexing content[0] blindly
  // would throw in exactly the situation where the user most needs an answer.
  if (response.stop_reason === 'refusal') {
    return { text: '', refused: true };
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  return {
    text,
    refused: text.length === 0,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}
