import { z } from 'zod';
import { UpstreamError } from '../errors.js';
import {
  assessmentSchema,
  describeJob,
  describeProfile,
  INSTRUCTIONS,
  JSON_FORMAT_INSTRUCTIONS,
  toEvaluation,
} from './assessment.js';
import type { Evaluation, JobEvaluator, Profile, ScorableJob } from './types.js';

// Local models on a laptop can take minutes on a long posting.
const TIMEOUT_MS = 180_000;

const completionSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
});

/** Pulls the JSON object out of a reply that may be wrapped in a code fence or prose. */
function extractJson(reply: string): unknown {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end <= start) return undefined;
  try {
    return JSON.parse(reply.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

/**
 * Asks any model served over the OpenAI chat-completions protocol for an assessment. That covers
 * OpenAI, Gemini, DeepSeek, Groq, Mistral and OpenRouter, and local servers such as Ollama and
 * LM Studio. The reply is validated here because not every server enforces a JSON schema.
 */
export class OpenAiCompatibleEvaluator implements JobEvaluator {
  private readonly endpoint: string;

  constructor(
    private readonly options: {
      baseUrl: string;
      model: string;
      /** Local servers such as Ollama need none. */
      apiKey?: string;
      fetchImpl?: typeof fetch;
    },
  ) {
    this.endpoint = `${options.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  }

  async evaluate(job: ScorableJob, profile: Profile): Promise<Evaluation> {
    const { model, apiKey, fetchImpl = fetch } = this.options;
    const host = new URL(this.endpoint).host;

    let response: Response;
    try {
      response = await fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `${INSTRUCTIONS}\n\n${JSON_FORMAT_INSTRUCTIONS}\n\n${describeProfile(profile)}`,
            },
            { role: 'user', content: describeJob(job) },
          ],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new UpstreamError(`Couldn't reach the AI model at ${host}.`, { reason });
    }

    if (response.status === 401 || response.status === 403) {
      throw new UpstreamError(`The AI provider at ${host} rejected the API key. Check AI_API_KEY.`);
    }
    if (response.status === 429) {
      throw new UpstreamError('The AI provider is rate limiting requests. Try again in a minute.');
    }
    if (!response.ok) {
      throw new UpstreamError(`The AI provider at ${host} returned HTTP ${response.status}.`);
    }

    const completion = completionSchema.safeParse(await response.json().catch(() => undefined));
    const reply = completion.success ? completion.data.choices[0]?.message.content : undefined;
    const assessment = assessmentSchema.safeParse(reply ? extractJson(reply) : undefined);
    if (!assessment.success) {
      throw new UpstreamError(
        `${model} returned an assessment that could not be read. A larger model may do better.`,
      );
    }
    return toEvaluation(assessment.data, model);
  }
}
