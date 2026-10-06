import type { z } from 'zod';
import type { Config } from '../config.js';
import { ClaudeClient } from './claude-client.js';
import { OpenAiCompatibleClient } from './openai-compatible-client.js';

export interface GenerateRequest<T> {
  /** The reply must match this schema; the client validates it whichever model answered. */
  schema: z.ZodType<T>;
  /** The schema spelled out in words, for models that cannot be given a schema directly. */
  formatHint: string;
  /** What the model is asked to do. */
  instructions: string;
  /** Long context that stays the same across requests, such as the person's profile. */
  context: string;
  /** The part that changes per request, such as one job posting. */
  input: string;
}

/** One structured request to whichever AI model is configured. */
export interface AiClient {
  /** Model name, shown in the UI next to anything the model wrote. */
  readonly model: string;
  generate<T>(request: GenerateRequest<T>): Promise<T>;
}

const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5';

/**
 * Chooses the AI client from configuration, or returns undefined when none is configured.
 * AI_BASE_URL selects any OpenAI-compatible server; otherwise ANTHROPIC_API_KEY selects Claude.
 */
export function createAiClient(config: Config): AiClient | undefined {
  if (config.AI_BASE_URL) {
    if (!config.AI_MODEL) {
      throw new Error('AI_BASE_URL is set, so AI_MODEL must name the model to use.');
    }
    return new OpenAiCompatibleClient({
      baseUrl: config.AI_BASE_URL,
      model: config.AI_MODEL,
      apiKey: config.AI_API_KEY,
    });
  }
  if (config.ANTHROPIC_API_KEY) {
    return new ClaudeClient(config.ANTHROPIC_API_KEY, config.AI_MODEL ?? DEFAULT_CLAUDE_MODEL);
  }
  return undefined;
}
