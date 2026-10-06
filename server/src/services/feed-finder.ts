import { AppError } from '../errors.js';
import { assertPublicHttpUrl, type ResolveHost } from '../extract/safe-url.js';
import type { FetchText } from '../providers/http.js';
import { parseRss } from '../providers/rss.js';

// Where job boards usually publish a feed, most specific first.
const CANDIDATE_PATHS = [
  '/jobs/feed/',
  '/?feed=job_feed',
  '/jobs.rss',
  '/feed/',
  '/rss',
  '/feed.xml',
  '/rss.xml',
];

export interface FoundFeed {
  url: string;
  items: number;
  /** Date of the newest item, when the feed gives dates. */
  newest?: string;
  sampleTitle?: string;
}

/**
 * Looks for a public RSS feed on a job board by trying the usual addresses. This is how a board
 * moves from "link-out" to "scanned": find a working feed, then add it to the registry.
 */
export class FeedFinder {
  constructor(private readonly deps: { fetchText: FetchText; resolveHost?: ResolveHost }) {}

  async find(address: string): Promise<FoundFeed[]> {
    const site = await assertPublicHttpUrl(address, this.deps.resolveHost);
    const found: FoundFeed[] = [];
    for (const path of CANDIDATE_PATHS) {
      const url = new URL(path, site.origin).href;
      try {
        const jobs = parseRss(
          await this.deps.fetchText(url, {
            accept: 'application/rss+xml, application/xml, text/xml',
          }),
          { isRemoteBoard: false },
        );
        if (jobs.length === 0) continue;
        const dates = jobs.flatMap((job) => (job.postedAt ? [job.postedAt.getTime()] : []));
        found.push({
          url,
          items: jobs.length,
          newest: dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : undefined,
          sampleTitle: jobs[0]?.title,
        });
      } catch (error) {
        // Most candidate addresses do not exist on any given site; that is the expected case.
        if (!(error instanceof AppError)) throw error;
      }
    }
    return found;
  }
}
