import type { JobRepository } from '../repositories/jobs.js';
import type { ScanLogger } from './scan.js';

const TIMEOUT_MS = 10_000;
// A webhook message listing hundreds of jobs is noise; the rest are in the app.
const MAX_JOBS_PER_ALERT = 10;

/**
 * Posts newly found strong matches to a webhook the owner configured. The body carries both
 * `text` and `content`, so it is accepted as-is by Slack-style and Discord-style webhooks and
 * by automation tools that read JSON.
 */
export class AlertService {
  constructor(
    private readonly deps: {
      jobs: JobRepository;
      webhookUrl: string;
      minScore: number;
      logger: ScanLogger;
      fetchImpl?: typeof fetch;
    },
  ) {}

  /** Sends one alert for the given new jobs. Returns how many jobs it reported. */
  async notifyNewJobs(jobIds: string[]): Promise<number> {
    const matches = jobIds
      .map((id) => this.deps.jobs.findById(id))
      .filter((job) => job !== undefined)
      .filter((job) => (job.score ?? 0) >= this.deps.minScore)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    if (matches.length === 0) return 0;

    const listed = matches.slice(0, MAX_JOBS_PER_ALERT);
    const lines = listed.map(
      (job) =>
        `${job.score?.toFixed(1)} · ${job.title}${job.company ? ` at ${job.company}` : ''} · ${job.url}`,
    );
    const heading = `KaziScout found ${matches.length} new strong ${matches.length === 1 ? 'match' : 'matches'}`;
    const text = [heading, ...lines].join('\n');

    try {
      const response = await (this.deps.fetchImpl ?? fetch)(this.deps.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text,
          content: text,
          jobs: listed.map(({ id, title, company, location, score, url }) => ({
            id,
            title,
            company,
            location,
            score,
            url,
          })),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        this.deps.logger.warn({ status: response.status }, 'alert webhook rejected the message');
        return 0;
      }
    } catch (error) {
      // An unreachable webhook must never fail the scan that found the jobs.
      const reason = error instanceof Error ? error.message : String(error);
      this.deps.logger.warn({ reason }, 'alert webhook could not be reached');
      return 0;
    }
    this.deps.logger.info({ jobs: matches.length }, 'alert sent');
    return matches.length;
  }
}
