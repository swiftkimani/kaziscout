import { NotFoundError } from '../errors.js';
import type { MarkdownPage, PageConverter } from '../extract/converters.js';
import { assertPublicHttpUrl, type ResolveHost } from '../extract/safe-url.js';
import type { JobRepository } from '../repositories/jobs.js';

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
}
