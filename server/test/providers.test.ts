import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Board } from '../src/boards/registry.js';
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

  it('drops remote roles restricted to regions outside Africa', () => {
    const item = (title: string, region: string) =>
      `<item><title>${title}</title><link>https://example.com/${title}</link><region>${region}</region></item>`;
    const xml = `<rss><channel>${item('a', 'USA Only')}${item('b', 'Anywhere in the World')}</channel></rss>`;

    expect(parseRss(xml, { isRemoteBoard: true }).map((job) => job.title)).toEqual(['b']);
  });
});

describe('remote API providers', () => {
  it('keeps only Remotive roles open worldwide or to Africa', async () => {
    const jobs = await remotiveProvider(remoteBoard, {
      fetchText: () => Promise.resolve(fixture('remotive.json')),
    });

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      externalId: '1749306',
      title: 'Freelance Copywriter',
      location: 'Worldwide',
      isRemote: true,
    });
    expect(jobs[0]?.postedAt?.toISOString()).toBe('2026-10-02T20:01:00.000Z');
  });

  it('keeps Himalayas roles restricted to African countries and drops the rest', async () => {
    const feed = JSON.parse(fixture('himalayas.json')) as {
      jobs: { locationRestrictions: string[] }[];
    };
    feed.jobs[1]!.locationRestrictions = ['Kenya', 'Nigeria'];

    const jobs = await himalayasProvider(remoteBoard, {
      fetchText: () => Promise.resolve(JSON.stringify(feed)),
    });

    expect(jobs.map((job) => job.location)).toEqual(['Kenya, Nigeria']);
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
