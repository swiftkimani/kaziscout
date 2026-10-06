import { NotFoundError } from '../errors.js';
import type { MarkdownPage, PageConverter } from '../extract/converters.js';
import { assertPublicHttpUrl, type ResolveHost } from '../extract/safe-url.js';
import type { Job, JobRepository } from '../repositories/jobs.js';

/** Source id for jobs a person adds by pasting a link, rather than ones found by a scan. */
export const MANUAL_BOARD_ID = 'manual';

export class MarkdownService {
  constructor(
    private readonly deps: {
      converter: PageConverter;
      jobs: JobRepository;
      resolveHost?: ResolveHost;
    },
  ) {}

  get converterName(): MarkdownPage['converter'] {
    return this.deps.converter.name;
  }

  /** Converts any public web page to Markdown. */
  async convert(address: string): Promise<MarkdownPage> {
    const url = await assertPublicHttpUrl(address, this.deps.resolveHost);
    return this.deps.converter.convert(url);
  }

  /** Fetches a job's full posting page and stores it as the job's Markdown description. */
  async refreshJobDescription(jobId: string): Promise<MarkdownPage> {
    const job = this.deps.jobs.findById(jobId);
    if (!job) throw new NotFoundError('That job');
    const page = await this.convert(job.url);
    this.deps.jobs.saveDescription(jobId, page.markdown);
    return page;
  }

  /**
   * Adds a job the person found themselves, from the posting's address. The page is converted
   * to Markdown and stored under the "manual" source; adding the same address again updates it.
   */
  async addJobFromUrl(address: string, now: Date): Promise<Job> {
    const page = await this.convert(address);
    const fallbackTitle = new URL(page.url).hostname;
    const { id } = this.deps.jobs.upsert(
      {
        boardId: MANUAL_BOARD_ID,
        externalId: page.url,
        title: (page.title ?? fallbackTitle).slice(0, 200),
        isRemote: false,
        url: page.url,
        summary: page.markdown
          .replace(/[#*_>`[\]]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 320),
        descriptionMd: page.markdown,
      },
      now,
    );
    const job = this.deps.jobs.findById(id);
    if (!job) throw new Error(`job ${id} vanished after being added`);
    return job;
  }
}
