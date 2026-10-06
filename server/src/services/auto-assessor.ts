import { AppError } from '../errors.js';
import type { JobRepository } from '../repositories/jobs.js';
import type { EvaluationService } from './evaluation.js';
import type { ScanLogger } from './scan.js';

// Only jobs the keyword score already rates strong are worth a model's time.
const WORTH_ASSESSING_FROM = 4;

/**
 * The second stage of scoring: after a scan, has the AI model assess the new jobs the keyword
 * score rates strong, within a daily limit the owner sets. Everything else keeps its keyword
 * score, so a scan of thousands of jobs costs a handful of model calls.
 */
export class AutoAssessor {
  constructor(
    private readonly deps: {
      jobs: JobRepository;
      evaluation: EvaluationService;
      perDay: number;
      logger: ScanLogger;
      now?: () => Date;
    },
  ) {}

  /** Returns how many jobs the model assessed. */
  async assess(jobIds: string[]): Promise<number> {
    const now = this.deps.now?.() ?? new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const remaining = this.deps.perDay - this.deps.jobs.countAiAssessedSince(startOfDay);
    if (remaining <= 0) return 0;

    const strong = jobIds
      .map((id) => this.deps.jobs.findById(id))
      .filter((job) => job !== undefined)
      .filter(
        (job) => (job.score ?? 0) >= WORTH_ASSESSING_FROM && job.evaluation?.evaluator !== 'ai',
      )
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, remaining);

    let assessed = 0;
    for (const job of strong) {
      try {
        await this.deps.evaluation.evaluate(job.id, 'ai');
        assessed += 1;
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        // A model that is down will fail for every job, so stop rather than retry each one.
        this.deps.logger.warn({ reason: error.message }, 'automatic assessment stopped');
        break;
      }
    }
    return assessed;
  }
}
