import type { AiClient } from '../ai/client.js';
import {
  assessmentSchema,
  describeJob,
  describeProfile,
  INSTRUCTIONS,
  JSON_FORMAT_INSTRUCTIONS,
  toEvaluation,
} from './assessment.js';
import type { Evaluation, JobEvaluator, Profile, ScorableJob } from './types.js';

/** Asks the configured AI model for a written assessment of one job. */
export class AiJobEvaluator implements JobEvaluator {
  constructor(private readonly client: AiClient) {}

  async evaluate(job: ScorableJob, profile: Profile): Promise<Evaluation> {
    const assessment = await this.client.generate({
      schema: assessmentSchema,
      formatHint: JSON_FORMAT_INSTRUCTIONS,
      instructions: INSTRUCTIONS,
      context: describeProfile(profile),
      input: describeJob(job),
    });
    return toEvaluation(assessment, this.client.model);
  }
}
