import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Board } from '../src/boards/registry.js';
import {
  atsApiUrl,
  ashbyProvider,
  greenhouseProvider,
  leverProvider,
  smartRecruitersProvider,
  workableProvider,
} from '../src/providers/ats.js';
import {
  himalayasProvider,
  remoteOkProvider,
  remotiveProvider,
} from '../src/providers/remote-apis.js';
import { parseRss, splitTitle } from '../src/providers/rss.js';

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

const remoteBoard: Board = {
  id: 'remote',
  name: 'Remote',
  url: 'https://example.com',
  countries: ['REMOTE'],
  category: 'remote',
  language: 'en',
  access: { type: 'api', provider: 'remotive' },
  status: 'live',
  checkedAt: '2026-10-06',
};

describe('splitTitle', () => {
  it('separates the role from the company in "Role at Company" titles', () => {
    expect(splitTitle('Programme Officer at Christian Health Association of Kenya (CHAK)')).toEqual(
      {
        title: 'Programme Officer',
        company: 'Christian Health Association of Kenya (CHAK)',
      },
    );
  });

  it('removes the expiry date that Zimbabwean boards append', () => {
    expect(
      splitTitle('Deputy Representative, Harare, Zimbabwe, P4 - Expiry Date: 2026-10-07'),
    ).toEqual({ title: 'Deputy Representative, Harare, Zimbabwe, P4' });
  });

  it('separates the company from the role in "Company: Role" titles on remote boards', () => {
    expect(splitTitle('Proxify AB: Senior Backend Developer', 'company-colon-role')).toEqual({
      title: 'Senior Backend Developer',
      company: 'Proxify AB',
    });
  });
});

describe('parseRss', () => {
  it('reads a WordPress job feed with dates, links and full content', () => {
    const jobs = parseRss(fixture('wordpress-jobs.rss'), { isRemoteBoard: false });

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      title: 'Digital Video Editor | On Site',
      company: 'Solvo Global',
      url: 'https://jobwebkenya.com/jobs/digital-video-editor-site-solvo-global/',
      isRemote: false,
    });
    expect(jobs[0]?.postedAt?.toISOString()).toBe('2026-10-06T09:20:03.000Z');
    expect(jobs[0]?.bodyHtml).toContain('Solvo');
  });

  it('reads a plain feed that has no dates and decodes entities in titles', () => {
    const jobs = parseRss(fixture('plain-jobs.rss'), { isRemoteBoard: false });

    expect(jobs.map((job) => job.title)).toEqual([
      'Monitoring And Evaluation (M&E) Analyst',
      'Deputy Representative, Harare, Zimbabwe, P4',
    ]);
    expect(jobs[0]?.postedAt).toBeUndefined();
  });

  it('rejects a document that is not RSS', () => {
    expect(() => parseRss('<html><body>Blocked</body></html>', { isRemoteBoard: false })).toThrow(
      'not valid RSS',
    );
  });

  it('keeps the region restriction of a remote role as its location', () => {
    const item = (title: string, region: string) =>
      `<item><title>${title}</title><link>https://example.com/${title}</link><region>${region}</region></item>`;
    const xml = `<rss><channel>${item('a', 'USA Only')}${item('b', 'Anywhere in the World')}</channel></rss>`;

    expect(parseRss(xml, { isRemoteBoard: true }).map((job) => job.location)).toEqual([
      'USA Only',
      'Anywhere in the World',
    ]);
  });

  it('reads the place and remote status from a Teamtailor career feed', () => {
    const xml = `<rss xmlns:tt="https://teamtailor.com/locations"><channel>
      <item><title>Product Manager</title><link>https://careers.example.com/jobs/1</link>
        <remoteStatus>hybrid</remoteStatus>
        <tt:locations><tt:location><tt:city>Lagos</tt:city><tt:country>Nigeria</tt:country></tt:location></tt:locations></item>
      <item><title>Developer</title><link>https://careers.example.com/jobs/2</link>
        <remoteStatus>fully</remoteStatus><tt:locations></tt:locations></item>
    </channel></rss>`;

    expect(parseRss(xml, { isRemoteBoard: false })).toMatchObject([
      { title: 'Product Manager', location: 'Lagos, Nigeria', isRemote: false },
      { title: 'Developer', location: undefined, isRemote: true },
    ]);
  });
});

describe('remote API providers', () => {
  it('reads Remotive roles with their location restriction', async () => {
    const jobs = await remotiveProvider(remoteBoard, {
      fetchText: () => Promise.resolve(fixture('remotive.json')),
    });

    expect(jobs.map((job) => job.location)).toEqual(['Worldwide', 'Europe, USA, Canada, APAC']);
    expect(jobs[0]).toMatchObject({
      externalId: '1749306',
      title: 'Freelance Copywriter',
      location: 'Worldwide',
      isRemote: true,
    });
    expect(jobs[0]?.postedAt?.toISOString()).toBe('2026-10-02T20:01:00.000Z');
  });

  it('reads Himalayas roles with their location restriction', async () => {
    const jobs = await himalayasProvider(remoteBoard, {
      fetchText: () => Promise.resolve(fixture('himalayas.json')),
    });

    expect(jobs.map((job) => job.location)).toEqual(['Brazil', 'Brazil']);
    expect(jobs.every((job) => job.isRemote)).toBe(true);
  });

  it('skips the legal notice at the head of the Remote OK feed', async () => {
    const jobs = await remoteOkProvider(remoteBoard, {
      fetchText: () => Promise.resolve(fixture('remoteok.json')),
    });

    expect(jobs.map((job) => job.title)).toEqual([
      'Federal Business Development Director',
      'Head of Operations',
    ]);
  });

  it('reports a changed response format instead of returning nothing', async () => {
    await expect(
      remotiveProvider(remoteBoard, { fetchText: () => Promise.resolve('{"postings":[]}') }),
    ).rejects.toThrow('changed its response format');
  });
});

describe('employer career APIs', () => {
  const employer = (
    provider: 'greenhouse' | 'lever' | 'ashby' | 'smartrecruiters' | 'workable',
    countries: string[],
  ): Board => ({
    ...remoteBoard,
    id: 'employer',
    name: 'Example Employer',
    countries,
    category: 'employer',
    access: { type: 'ats', provider, slug: 'example' },
  });

  it('reads Greenhouse jobs and unescapes the description markup', async () => {
    const requested: string[] = [];
    const jobs = await greenhouseProvider(employer('greenhouse', ['PAN']), {
      fetchText: (url) => {
        requested.push(url);
        return Promise.resolve(fixture('greenhouse.json'));
      },
    });

    expect(requested).toEqual([
      'https://boards-api.greenhouse.io/v1/boards/example/jobs?content=true',
    ]);
    expect(jobs[0]).toMatchObject({
      externalId: '7649022',
      title: 'Agroforestry Innovations Specialist',
      company: 'Example Employer',
      location: 'Bauchi, Nigeria',
      isRemote: false,
    });
    expect(jobs[0]?.bodyHtml).toContain('<h3>About One Acre Fund</h3>');
  });

  it('reads Lever jobs with their place and remote status', async () => {
    const jobs = await leverProvider(employer('lever', ['REMOTE']), {
      fetchText: () => Promise.resolve(fixture('lever.json')),
    });

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      title: 'Analytics Platforms Architect',
      location: 'US',
      isRemote: true,
    });
  });

  it('reads SmartRecruiters postings and builds their public links', async () => {
    const jobs = await smartRecruitersProvider(employer('smartrecruiters', ['KE']), {
      fetchText: () => Promise.resolve(fixture('smartrecruiters.json')),
    });

    expect(jobs[0]).toMatchObject({
      title: 'Market Research & Business Intelligence Manager',
      company: 'BURN Manufacturing',
      location: 'Ruiru, Kiambu County, Kenya',
      url: 'https://jobs.smartrecruiters.com/BURNManufacturing/743999691495505',
      isRemote: false,
    });
  });

  it('reads Workable jobs with city and country', async () => {
    const jobs = await workableProvider(employer('workable', ['NG']), {
      fetchText: () => Promise.resolve(fixture('workable.json')),
    });

    expect(jobs[0]).toMatchObject({
      externalId: '82E249C10F',
      title: 'Data Analyst - Credit',
      location: 'Lagos, Nigeria',
      url: 'https://apply.workable.com/j/82E249C10F',
    });
  });

  it('reads Ashby jobs and adds the country from the postal address', async () => {
    const jobs = await ashbyProvider(employer('ashby', ['REMOTE']), {
      fetchText: () => Promise.resolve(fixture('ashby.json')),
    });

    expect(jobs[0]).toMatchObject({
      title: 'Sales Executive - Epe 2',
      location: 'Lagos, Nigeria',
      isRemote: false,
    });
    expect(jobs[0]?.postedAt?.toISOString()).toBe('2026-09-21T11:54:41.419Z');
  });
});

describe('atsApiUrl', () => {
  it.each([
    ['greenhouse', 'https://boards-api.greenhouse.io/v1/boards/acme/jobs'],
    ['lever', 'https://api.lever.co/v0/postings/acme?mode=json'],
    ['ashby', 'https://api.ashbyhq.com/posting-api/job-board/acme'],
    ['smartrecruiters', 'https://api.smartrecruiters.com/v1/companies/acme/postings?limit=1'],
    ['workable', 'https://apply.workable.com/api/v1/widget/accounts/acme'],
  ] as const)('builds the %s address the board verifier checks', (provider, url) => {
    const board: Board = { ...remoteBoard, access: { type: 'ats', provider, slug: 'acme' } };

    expect(atsApiUrl(board)).toBe(url);
  });
});
