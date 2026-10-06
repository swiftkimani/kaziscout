import { z } from 'zod';
import type { Board } from '../boards/registry.js';
import { UpstreamError } from '../errors.js';
import type { Provider, RawJob } from './types.js';

/**
 * Readers for three applicant-tracking systems that publish each employer's openings through a
 * public, no-login JSON API. One reader covers every employer on that system, in any country.
 * Roles are stored wherever they are; scoring decides whether a place suits the person.
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
  return jobs;
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
  return jobs;
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
  return jobs;
};

const smartRecruitersSchema = z.object({
  content: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      releasedDate: z.string().nullish(),
      company: z.object({ identifier: z.string(), name: z.string() }),
      location: z
        .object({ fullLocation: z.string().nullish(), remote: z.boolean().nullish() })
        .nullish(),
    }),
  ),
});

/** SmartRecruiters lists postings without descriptions; "Fetch full posting" fills them in. */
export const smartRecruitersProvider: Provider = async (board, { fetchText }) => {
  const body = await fetchText(
    `https://api.smartrecruiters.com/v1/companies/${slugOf(board)}/postings?limit=100`,
    { accept: 'application/json' },
  );
  return parseJson(body, smartRecruitersSchema, 'SmartRecruiters').content.map((job): RawJob => ({
    externalId: job.id,
    title: job.name.trim(),
    company: job.company.name,
    location: job.location?.fullLocation?.trim() || undefined,
    url: `https://jobs.smartrecruiters.com/${encodeURIComponent(job.company.identifier)}/${job.id}`,
    bodyHtml: '',
    postedAt: job.releasedDate ? new Date(job.releasedDate) : undefined,
    isRemote: job.location?.remote === true,
  }));
};

const workableSchema = z.object({
  jobs: z.array(
    z.object({
      shortcode: z.string(),
      title: z.string(),
      url: z.url(),
      telecommuting: z.boolean().nullish(),
      published_on: z.string().nullish(),
      city: z.string().nullish(),
      country: z.string().nullish(),
      description: z.string().default(''),
    }),
  ),
});

export const workableProvider: Provider = async (board, { fetchText }) => {
  const body = await fetchText(
    `https://apply.workable.com/api/v1/widget/accounts/${slugOf(board)}?details=true`,
    { accept: 'application/json' },
  );
  return parseJson(body, workableSchema, 'Workable').jobs.map((job): RawJob => ({
    externalId: job.shortcode,
    title: job.title.trim(),
    company: board.name,
    location: [job.city, job.country].filter((part) => part?.trim()).join(', ') || undefined,
    url: job.url,
    bodyHtml: job.description,
    postedAt: job.published_on ? new Date(job.published_on) : undefined,
    isRemote: job.telecommuting === true,
  }));
};

const recruiteeSchema = z.object({
  offers: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      careers_url: z.url(),
      status: z.string().default('published'),
      location: z.string().nullish(),
      country: z.string().nullish(),
      remote: z.boolean().nullish(),
      published_at: z.string().nullish(),
      company_name: z.string().nullish(),
      description: z.string().nullish(),
      requirements: z.string().nullish(),
    }),
  ),
});

export const recruiteeProvider: Provider = async (board, { fetchText }) => {
  const body = await fetchText(`https://${slugOf(board)}.recruitee.com/api/offers/`, {
    accept: 'application/json',
  });
  return parseJson(body, recruiteeSchema, 'Recruitee')
    .offers.filter((offer) => offer.status === 'published')
    .map((offer): RawJob => {
      const isRemote = offer.remote === true;
      // For a remote role the country is the restriction; for an on-site one it is the place.
      const place = isRemote ? offer.country : [offer.location, offer.country].join(', ');
      return {
        externalId: String(offer.id),
        title: offer.title.trim(),
        company: offer.company_name ?? board.name,
        location: place?.trim() || undefined,
        url: offer.careers_url,
        bodyHtml: `${offer.description ?? ''}\n${offer.requirements ?? ''}`,
        // Recruitee writes "2026-09-24 11:51:18 UTC".
        postedAt: offer.published_at
          ? new Date(offer.published_at.replace(' UTC', 'Z').replace(' ', 'T'))
          : undefined,
        isRemote,
      };
    });
};

const workdaySchema = z.object({
  jobPostings: z.array(
    z.object({
      title: z.string(),
      externalPath: z.string().startsWith('/'),
      locationsText: z.string().nullish(),
      postedOn: z.string().nullish(),
      remoteType: z.string().nullish(),
    }),
  ),
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** Workday gives only relative dates: "Posted Today", "Posted 3 Days Ago", "Posted 30+ Days Ago". */
export function parseWorkdayPostedOn(
  postedOn: string | null | undefined,
  now: Date,
): Date | undefined {
  const text = postedOn?.toLowerCase() ?? '';
  if (text.includes('today')) return now;
  if (text.includes('yesterday')) return new Date(now.getTime() - DAY_MS);
  const days = /(\d+)\+? days? ago/.exec(text)?.[1];
  return days ? new Date(now.getTime() - Number(days) * DAY_MS) : undefined;
}

/**
 * Workday's job list is a search endpoint that takes a POST and returns 20 postings a page,
 * without descriptions. Only the first page is read, which is the 20 newest.
 */
export const workdayProvider: Provider = async (board, { fetchText, now }) => {
  if (board.access.type !== 'workday') throw new Error(`${board.id} is not a Workday board`);
  const { host, tenant, site } = board.access;
  const body = await fetchText(`https://${host}/wday/cxs/${tenant}/${site}/jobs`, {
    accept: 'application/json',
    postJson: { appliedFacets: {}, limit: 20, offset: 0, searchText: '' },
  });
  const scannedAt = now?.() ?? new Date();
  return parseJson(body, workdaySchema, 'Workday').jobPostings.map((job): RawJob => ({
    // The path ends in the requisition id and is stable for the life of the posting.
    externalId: job.externalPath,
    title: job.title.replace(/\s+/g, ' ').trim(),
    company: board.name,
    location: job.locationsText?.trim() || undefined,
    url: `https://${host}/${site}${job.externalPath}`,
    bodyHtml: '',
    postedAt: parseWorkdayPostedOn(job.postedOn, scannedAt),
    isRemote: job.remoteType?.toLowerCase() === 'remote',
  }));
};

/** The public API address for an employer board, used by the board verifier. */
export function atsApiUrl(board: Board): string {
  if (board.access.type !== 'ats') throw new Error(`${board.id} is not an employer board`);
  const slug = encodeURIComponent(board.access.slug);
  switch (board.access.provider) {
    case 'greenhouse':
      return `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;
    case 'lever':
      return `https://api.lever.co/v0/postings/${slug}?mode=json`;
    case 'ashby':
      return `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
    case 'smartrecruiters':
      return `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=1`;
    case 'workable':
      return `https://apply.workable.com/api/v1/widget/accounts/${slug}`;
    case 'recruitee':
      return `https://${slug}.recruitee.com/api/offers/`;
  }
}
