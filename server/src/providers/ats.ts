import { z } from 'zod';
import { isOpenToAfrica } from '../boards/countries.js';
import type { Board } from '../boards/registry.js';
import { UpstreamError } from '../errors.js';
import type { Provider, RawJob } from './types.js';

/**
 * Readers for three applicant-tracking systems that publish each employer's openings through a
 * public, no-login JSON API. One reader covers every employer on that system, in any country.
 */

const REMOTE_WORDS = /\b(remote|home[- ]based|work from home|anywhere|worldwide)\b/i;

function parseJson<T>(body: string, schema: z.ZodType<T>, source: string): T {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new UpstreamError(`${source} did not return JSON.`);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new UpstreamError(`${source} changed its response format.`, {
      issues: z.prettifyError(parsed.error),
    });
  }
  return parsed.data;
}

function slugOf(board: Board): string {
  if (board.access.type !== 'ats') throw new Error(`${board.id} is not an employer board`);
  return encodeURIComponent(board.access.slug);
}

/**
 * Employers marked REMOTE hire in many countries, so only their roles open to someone in Africa
 * are kept. Employers tied to African countries keep every role.
 */
function keepForBoard(board: Board, jobs: RawJob[]): RawJob[] {
  if (!board.countries.includes('REMOTE')) return jobs;
  return jobs.filter((job) => isOpenToAfrica(job.location));
}

/** Greenhouse sends the description as HTML with its markup entity-escaped. */
function unescapeHtml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

const greenhouseSchema = z.object({
  jobs: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      absolute_url: z.url(),
      location: z.object({ name: z.string() }).nullish(),
      first_published: z.string().nullish(),
      updated_at: z.string().nullish(),
      content: z.string().default(''),
    }),
  ),
});

export const greenhouseProvider: Provider = async (board, { fetchText }) => {
  const body = await fetchText(
    `https://boards-api.greenhouse.io/v1/boards/${slugOf(board)}/jobs?content=true`,
    { accept: 'application/json' },
  );
  const jobs = parseJson(body, greenhouseSchema, 'Greenhouse').jobs.map((job): RawJob => {
    const location = job.location?.name.trim() || undefined;
    const published = job.first_published ?? job.updated_at;
    return {
      externalId: String(job.id),
      title: job.title.trim(),
      company: board.name,
      location,
      url: job.absolute_url,
      bodyHtml: unescapeHtml(job.content),
      postedAt: published ? new Date(published) : undefined,
      isRemote: REMOTE_WORDS.test(location ?? ''),
    };
  });
  return keepForBoard(board, jobs);
};

const leverSchema = z.array(
  z.object({
    id: z.string(),
    text: z.string(),
    hostedUrl: z.url(),
    createdAt: z.number().optional(),
    workplaceType: z.string().optional(),
    categories: z.object({ location: z.string().optional() }).default({}),
    description: z.string().default(''),
    additional: z.string().default(''),
  }),
);

export const leverProvider: Provider = async (board, { fetchText }) => {
  const body = await fetchText(`https://api.lever.co/v0/postings/${slugOf(board)}?mode=json`, {
    accept: 'application/json',
  });
  const jobs = parseJson(body, leverSchema, 'Lever').map((job): RawJob => {
    const location = job.categories.location?.trim() || undefined;
    return {
      externalId: job.id,
      title: job.text.trim(),
      company: board.name,
      location,
      url: job.hostedUrl,
      bodyHtml: `${job.description}\n${job.additional}`,
      postedAt: job.createdAt === undefined ? undefined : new Date(job.createdAt),
      isRemote: job.workplaceType === 'remote' || REMOTE_WORDS.test(location ?? ''),
    };
  });
  return keepForBoard(board, jobs);
};

const ashbySchema = z.object({
  jobs: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      jobUrl: z.url(),
      location: z.string().nullish(),
      isRemote: z.boolean().nullish(),
      isListed: z.boolean().default(true),
      publishedAt: z.string().nullish(),
      descriptionHtml: z.string().default(''),
      address: z
        .object({
          postalAddress: z.object({ addressCountry: z.string().nullish() }).nullish(),
        })
        .nullish(),
    }),
  ),
});

export const ashbyProvider: Provider = async (board, { fetchText }) => {
  const body = await fetchText(`https://api.ashbyhq.com/posting-api/job-board/${slugOf(board)}`, {
    accept: 'application/json',
  });
  const jobs = parseJson(body, ashbySchema, 'Ashby')
    .jobs.filter((job) => job.isListed)
    .map((job): RawJob => {
      // Ashby often gives only a city, so the country from the postal address is appended.
      const country = job.address?.postalAddress?.addressCountry;
      const place = [job.location, country].filter((part) => part?.trim()).join(', ');
      return {
        externalId: job.id,
        title: job.title.trim(),
        company: board.name,
        location: place || undefined,
        url: job.jobUrl,
        bodyHtml: job.descriptionHtml,
        postedAt: job.publishedAt ? new Date(job.publishedAt) : undefined,
        isRemote: job.isRemote === true,
      };
    });
  return keepForBoard(board, jobs);
};

/** The public API address for an employer board, used by the board verifier. */
export function atsApiUrl(board: Board): string {
  if (board.access.type !== 'ats') throw new Error(`${board.id} is not an employer board`);
  const slug = encodeURIComponent(board.access.slug);
  if (board.access.provider === 'greenhouse') {
    return `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;
  }
  if (board.access.provider === 'lever')
    return `https://api.lever.co/v0/postings/${slug}?mode=json`;
  return `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
}
