import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { UpstreamError } from '../errors.js';
import {
  assessmentSchema,
  describeJob,
  describeProfile,
  INSTRUCTIONS,
  toEvaluation,
} from './assessment.js';
import type { Evaluation, JobEvaluator, Profile, ScorableJob } from './types.js';

/** Asks Claude for a written assessment. The profile is sent as a cached system block. */
export class ClaudeEvaluator implements JobEvaluator {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async evaluate(job: ScorableJob, profile: Profile): Promise<Evaluation> {
    let response;
    try {
      response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium', format: zodOutputFormat(assessmentSchema) },
        // The instructions and profile are identical across jobs, so they are cached as a prefix.
        system: [
          { type: 'text', text: INSTRUCTIONS },
          { type: 'text', text: describeProfile(profile), cache_control: { type: 'ephemeral' } },
        ],
        messages: [{ role: 'user', content: describeJob(job) }],
      });
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) {
        throw new UpstreamError('Claude rejected the API key. Check ANTHROPIC_API_KEY.');
      }
      if (error instanceof Anthropic.RateLimitError) {
        throw new UpstreamError('Claude is rate limiting requests. Try again in a minute.');
      }
      if (error instanceof Anthropic.APIError) {
        throw new UpstreamError(`Claude returned an error (HTTP ${error.status ?? 'unknown'}).`);
      }
      throw error;
    }

    if (response.stop_reason === 'refusal') {
      throw new UpstreamError('Claude declined to assess this posting.');
    }
    const assessment = response.parsed_output;
    if (!assessment) {
      throw new UpstreamError('Claude returned an assessment that could not be read.');
    }
    return toEvaluation(assessment, this.model);
  }
}
