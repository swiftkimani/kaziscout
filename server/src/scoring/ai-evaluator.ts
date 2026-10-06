import type { Config } from '../config.js';
import { ClaudeEvaluator } from './claude.js';
import { OpenAiCompatibleEvaluator } from './openai-compatible.js';
import type { JobEvaluator } from './types.js';

const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5';

export interface AiEvaluator {
  evaluator: JobEvaluator;
  /** Model name shown in the UI next to each assessment. */
  model: string;
}

/**
 * Chooses the AI evaluator from configuration, or returns undefined when none is configured.
 * AI_BASE_URL selects any OpenAI-compatible server; otherwise ANTHROPIC_API_KEY selects Claude.
 */
export function createAiEvaluator(config: Config): AiEvaluator | undefined {
  if (config.AI_BASE_URL) {
    if (!config.AI_MODEL) {
      throw new Error('AI_BASE_URL is set, so AI_MODEL must name the model to use.');
    }
    return {
      model: config.AI_MODEL,
      evaluator: new OpenAiCompatibleEvaluator({
        baseUrl: config.AI_BASE_URL,
        model: config.AI_MODEL,
        apiKey: config.AI_API_KEY,
      }),
    };
  }
  if (config.ANTHROPIC_API_KEY) {
    const model = config.AI_MODEL ?? DEFAULT_CLAUDE_MODEL;
    return { model, evaluator: new ClaudeEvaluator(config.ANTHROPIC_API_KEY, model) };
  }
  return undefined;
}
