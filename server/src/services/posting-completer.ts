import { AppError } from '../errors.js';
import type { JobRepository } from '../repositories/jobs.js';
import type { EvaluationService } from './evaluation.js';
import type { MarkdownService } from './markdown.js';
import type { ScanLogger } from './scan.js';

// Without a description a job is scored on title, place and freshness alone, which tops out
// near 3.6. Anything from 3 up is a promising title worth one page fetch to score properly.
const WORTH_FETCHING_FROM = 3;
// Each fetch is a request to an employer's site, so one scan of one source fetches only a few.
const MAX_FETCHES_PER_SCAN = 5;

/**
 * Fills in the description of promising new jobs that arrived without one (Workday and
 * SmartRecruiters list only titles), then scores them again with the full text.
 */
export class PostingCompleter {
  constructor(
    private readonly deps: {
      jobs: JobRepository;
      markdown: MarkdownService;
      evaluation: EvaluationService;
      logger: ScanLogger;
    },
  ) {}

  /** Returns how many postings were fetched. A page that cannot be fetched is skipped. */
  async complete(jobIds: string[]): Promise<number> {
    const incomplete = jobIds
      .map((id) => this.deps.jobs.findById(id))
      .filter((job) => job !== undefined)
      .filter((job) => !job.descriptionMd && (job.score ?? 0) >= WORTH_FETCHING_FROM)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, MAX_FETCHES_PER_SCAN);

    let fetched = 0;
    for (const job of incomplete) {
      try {
        await this.deps.markdown.refreshJobDescription(job.id);
        await this.deps.evaluation.scoreNewJobs([job.id]);
        fetched += 1;
      } catch (error) {
        // One employer page being down must not fail the scan that found the job.
        if (!(error instanceof AppError)) throw error;
        this.deps.logger.warn({ jobId: job.id, reason: error.message }, 'posting not fetched');
      }
    }
    return fetched;
  }
}
