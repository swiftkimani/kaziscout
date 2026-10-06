import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { detectEmployerFromLink } from '../src/boards/employer-link.js';
import { loadConfig } from '../src/config.js';
import { migrate, openDb, type Db } from '../src/db/client.js';
import { UpstreamError } from '../src/errors.js';

describe('detectEmployerFromLink', () => {
  it.each([
    [
      'https://job-boards.greenhouse.io/mozilla/jobs/8204384',
      { type: 'ats', provider: 'greenhouse', slug: 'mozilla' },
    ],
    [
      'https://boards.greenhouse.io/oneacrefund/jobs/1',
      { type: 'ats', provider: 'greenhouse', slug: 'oneacrefund' },
    ],
    ['https://jobs.lever.co/tala/848e6f75', { type: 'ats', provider: 'lever', slug: 'tala' }],
    [
      'https://jobs.ashbyhq.com/m-kopa/280abdf4/application',
      { type: 'ats', provider: 'ashby', slug: 'm-kopa' },
    ],
    [
      'https://apply.workable.com/kuda/j/82E249C10F/',
      { type: 'ats', provider: 'workable', slug: 'kuda' },
    ],
    [
      'https://jobs.smartrecruiters.com/BURNManufacturing/743999691495505',
      { type: 'ats', provider: 'smartrecruiters', slug: 'BURNManufacturing' },
    ],
    [
      'https://timedoctor.recruitee.com/o/account-manager',
      { type: 'ats', provider: 'recruitee', slug: 'timedoctor' },
    ],
    [
      'https://paystack.teamtailor.com/jobs/8434292-pm',
      { type: 'rss', feedUrl: 'https://paystack.teamtailor.com/jobs.rss' },
    ],
    [
      'https://absa.wd3.myworkdayjobs.com/en-US/ABSAcareersite/job/Sandton/Product-Owner_R-1',
      {
        type: 'workday',
        host: 'absa.wd3.myworkdayjobs.com',
        tenant: 'absa',
        site: 'ABSAcareersite',
      },
    ],
  ])('recognises %s', (link, access) => {
    expect(detectEmployerFromLink(link)?.access).toEqual(access);
  });

  it('gives the employer a readable name and a stable id', () => {
    expect(detectEmployerFromLink('https://jobs.ashbyhq.com/m-kopa/abc')).toMatchObject({
      id: 'followed-ashby-m-kopa',
      name: 'M Kopa',
      url: 'https://jobs.ashbyhq.com/m-kopa',
    });
  });

  it.each([
    [
      'a board KaziScout cannot follow',
      'https://www.brightermonday.co.ke/listings/sales-rep-m0rg8g',
    ],
    ['a Workable short link with no employer in it', 'https://apply.workable.com/j/82E249C10F'],
    ['text that is not a link', 'not a link'],
  ])('does not recognise %s', (_label, link) => {
    expect(detectEmployerFromLink(link)).toBeUndefined();
  });
});

describe('following an employer', () => {
  const NOW = new Date('2026-10-06T12:00:00Z');
  const greenhouseJobs = JSON.stringify({
    jobs: [
      {
        id: 1,
        title: 'Data Engineer',
        absolute_url: 'https://job-boards.greenhouse.io/acme/jobs/1',
        location: { name: 'Nairobi, Kenya' },
        content: '',
      },
    ],
  });
  let db: Db;
  let app: FastifyInstance;

  beforeEach(async () => {
    db = openDb(':memory:');
    migrate(db);
    app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent' }),
      db,
      boards: [],
      now: () => NOW,
      resolveHost: () => Promise.resolve(['93.184.216.34']),
      fetchText: (url) => {
        if (url === 'https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true') {
          return Promise.resolve(greenhouseJobs);
        }
        if (url.startsWith('https://boards-api.greenhouse.io/')) {
          return Promise.reject(
            new UpstreamError('boards-api.greenhouse.io answered with HTTP 404.'),
          );
        }
        return Promise.resolve(
          '<html><title>Data Engineer</title><body><h1>Data Engineer</h1></body></html>',
        );
      },
    });
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('suggests following the employer when a job is added from its hiring system', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/jobs',
      payload: { url: 'https://job-boards.greenhouse.io/acme/jobs/1' },
    });

    expect(response.json()).toMatchObject({
      suggestedSource: { name: 'Acme', link: 'https://job-boards.greenhouse.io/acme/jobs/1' },
    });
  });

  it('follows the employer, scans it at once, and scans it again with every source', async () => {
    const followed = await app.inject({
      method: 'POST',
      url: '/v1/sources',
      payload: { url: 'https://job-boards.greenhouse.io/acme/jobs/1' },
    });
    const boards = (await app.inject({ method: 'GET', url: '/v1/boards' })).json() as {
      data: { id: string; name: string; isFollowed: boolean; jobCount: number }[];
    };
    const again = await app.inject({ method: 'POST', url: '/v1/scans' });
    const suggestion = await app.inject({
      method: 'POST',
      url: '/v1/jobs',
      payload: { url: 'https://job-boards.greenhouse.io/acme/jobs/2' },
    });

    expect(followed.statusCode).toBe(201);
    expect(followed.json()).toMatchObject({
      data: {
        board: { id: 'followed-greenhouse-acme', name: 'Acme' },
        scan: { jobsFound: 1, jobsNew: 1 },
      },
    });
    expect(boards.data).toEqual([
      expect.objectContaining({ id: 'followed-greenhouse-acme', isFollowed: true, jobCount: 1 }),
    ]);
    expect(again.json()).toMatchObject({
      data: [{ boardId: 'followed-greenhouse-acme', outcome: 'ok' }],
    });
    expect((suggestion.json() as { suggestedSource: unknown }).suggestedSource).toBeNull();
  });

  it('refuses to follow an employer it already reads, so jobs are not stored twice', async () => {
    const link = 'https://job-boards.greenhouse.io/acme/jobs/1';
    await app.inject({ method: 'POST', url: '/v1/sources', payload: { url: link } });

    const again = await app.inject({ method: 'POST', url: '/v1/sources', payload: { url: link } });
    const boards = (await app.inject({ method: 'GET', url: '/v1/boards' })).json() as {
      data: unknown[];
    };

    expect(again.statusCode).toBe(400);
    expect((again.json() as { error: { message: string } }).error.message).toBe(
      "You already get Acme's openings.",
    );
    expect(boards.data).toHaveLength(1);
  });

  it('does not keep an employer whose openings cannot be read', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/sources',
      payload: { url: 'https://job-boards.greenhouse.io/no-such-employer/jobs/1' },
    });
    const boards = (await app.inject({ method: 'GET', url: '/v1/boards' })).json() as {
      data: unknown[];
    };

    expect(response.statusCode).toBe(400);
    expect((response.json() as { error: { message: string } }).error.message).toContain(
      "Couldn't read No Such Employer's openings, so it was not followed.",
    );
    expect(boards.data).toEqual([]);
  });

  it('explains which hiring systems can be followed when given another link', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/sources',
      payload: { url: 'https://www.brightermonday.co.ke/listings/x' },
    });

    expect(response.statusCode).toBe(400);
    expect((response.json() as { error: { message: string } }).error.message).toContain(
      "isn't from a hiring system KaziScout can follow",
    );
  });

  it('unfollows an employer and keeps the jobs already found', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/sources',
      payload: { url: 'https://job-boards.greenhouse.io/acme/jobs/1' },
    });

    const removed = await app.inject({
      method: 'DELETE',
      url: '/v1/sources/followed-greenhouse-acme',
    });
    const missing = await app.inject({
      method: 'DELETE',
      url: '/v1/sources/followed-greenhouse-acme',
    });
    const jobs = (await app.inject({ method: 'GET', url: '/v1/jobs' })).json() as {
      data: unknown[];
    };

    expect(removed.statusCode).toBe(204);
    expect(missing.statusCode).toBe(404);
    expect(jobs.data).toHaveLength(1);
  });
});
