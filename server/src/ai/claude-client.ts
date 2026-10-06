import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { UpstreamError } from '../errors.js';
import type { AiClient, GenerateRequest } from './client.js';

/** Claude through the Anthropic API, with schema-constrained output. */
export class ClaudeClient implements AiClient {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async generate<T>(request: GenerateRequest<T>): Promise<T> {
    let response;
    try {
      response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium', format: zodOutputFormat(request.schema) },
        // Instructions and context repeat across requests, so they are cached as a prefix.
        system: [
          { type: 'text', text: request.instructions },
          { type: 'text', text: request.context, cache_control: { type: 'ephemeral' } },
        ],
        messages: [{ role: 'user', content: request.input }],
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
      throw new UpstreamError('Claude declined this request.');
    }
    if (!response.parsed_output) {
      throw new UpstreamError('Claude returned a reply that could not be read.');
    }
    return response.parsed_output;
  }
}
