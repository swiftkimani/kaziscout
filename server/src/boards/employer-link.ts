import type { Board, BoardAccess } from './registry.js';

export interface DetectedEmployer {
  /** Stable id for the followed source, such as "followed-greenhouse-acme". */
  id: string;
  /** A readable guess at the employer's name, from the address. */
  name: string;
  /** The employer's careers page. */
  url: string;
  access: BoardAccess;
}

function prettify(slug: string): string {
  return slug
    .replace(/[-_.]+/g, ' ')
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
    .trim();
}

function employer(
  provider: string,
  slug: string,
  url: string,
  access: BoardAccess,
): DetectedEmployer {
  const safe = slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return { id: `followed-${provider}-${safe}`, name: prettify(slug), url, access };
}

/**
 * Recognises a job link that belongs to a hiring system KaziScout can read, and works out how to
 * read that employer's other openings. Returns undefined for any other address.
 */
export function detectEmployerFromLink(link: string): DetectedEmployer | undefined {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return undefined;
  }
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);
  const [first] = segments;
  const ats = (
    provider: 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'smartrecruiters' | 'recruitee',
    slug: string,
    careers: string,
  ) => employer(provider, slug, careers, { type: 'ats', provider, slug });

  if ((host === 'boards.greenhouse.io' || host === 'job-boards.greenhouse.io') && first) {
    return ats('greenhouse', first, `https://${host}/${first}`);
  }
  if (host === 'jobs.lever.co' && first)
    return ats('lever', first, `https://jobs.lever.co/${first}`);
  if (host === 'jobs.ashbyhq.com' && first) {
    return ats('ashby', decodeURIComponent(first), `https://jobs.ashbyhq.com/${first}`);
  }
  // apply.workable.com/j/<code> is a short link with no employer in it.
  if (host === 'apply.workable.com' && first && first !== 'j') {
    return ats('workable', first, `https://apply.workable.com/${first}`);
  }
  if (host === 'jobs.smartrecruiters.com' && first) {
    return ats('smartrecruiters', first, `https://jobs.smartrecruiters.com/${first}`);
  }
  const recruitee = /^([a-z0-9-]+)\.recruitee\.com$/.exec(host)?.[1];
  if (recruitee) return ats('recruitee', recruitee, `https://${host}`);

  const teamtailor = /^([a-z0-9-]+)\.teamtailor\.com$/.exec(host)?.[1];
  if (teamtailor) {
    return employer('teamtailor', teamtailor, `https://${host}/jobs`, {
      type: 'rss',
      feedUrl: `https://${host}/jobs.rss`,
    });
  }
  const workdayTenant = /^([a-z0-9-]+)\.wd\d+\.myworkdayjobs\.com$/.exec(host)?.[1];
  if (workdayTenant) {
    // The site name comes before "/job/", after an optional locale such as "en-US".
    const site = segments.find(
      (segment) => segment !== 'job' && !/^[a-z]{2}-[A-Z]{2}$/.test(segment),
    );
    if (site && /^[A-Za-z0-9_-]+$/.test(site)) {
      return employer('workday', workdayTenant, `https://${host}/${site}`, {
        type: 'workday',
        host,
        tenant: workdayTenant,
        site,
      });
    }
  }
  return undefined;
}

/** A followed employer as a board. Its roles can be anywhere, so each is scored on its place. */
export function toFollowedBoard(detected: DetectedEmployer, checkedAt: string): Board {
  return {
    id: detected.id,
    name: detected.name,
    url: detected.url,
    countries: ['REMOTE'],
    category: 'employer',
    language: 'en',
    access: detected.access,
    status: 'live',
    checkedAt,
    note: 'An employer you chose to follow.',
  };
}
