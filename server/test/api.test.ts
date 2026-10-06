import { readFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Board } from '../src/boards/registry.js';
import type { AiClient, GenerateRequest } from '../src/ai/client.js';
import { loadBoards } from '../src/boards/registry.js';
import { loadConfig } from '../src/config.js';
import { migrate, openDb, type Db } from '../src/db/client.js';
import { UpstreamError } from '../src/errors.js';
import type { DesktopAssistant } from '../src/services/apply.js';

const NOW = new Date('2026-10-06T12:00:00Z');
const FEED_URL = 'https://jobwebkenya.com/jobs/feed/';
const feedXml = readFileSync(new URL('./fixtures/wordpress-jobs.rss', import.meta.url), 'utf8');

const boards: Board[] = [
  {
    id: 'jobwebkenya',
    name: 'Jobweb Kenya',
    url: 'https://jobwebkenya.com',
    countries: ['KE'],
    category: 'general',
    language: 'en',
    access: { type: 'rss', feedUrl: FEED_URL },
    status: 'live',
    checkedAt: '2026-10-06',
  },
  {
    id: 'broken',
    name: 'Broken Board',
    url: 'https://broken.example',
    countries: ['KE'],
    category: 'general',
    language: 'en',
    access: { type: 'rss', feedUrl: 'https://broken.example/feed/' },
    status: 'live',
    checkedAt: '2026-10-06',
  },
  {
    id: 'linkout',
    name: 'Link-out Board',
    url: 'https://linkout.example',
    countries: ['KE'],
    category: 'general',
    language: 'en',
    access: { type: 'listing' },
    status: 'live',
    checkedAt: '2026-10-06',
  },
];

const profile = {
  fullName: 'Wanjiru Kamau',
  headline: 'Video editor',
  cvText: 'Five years editing digital video.',
  skills: ['Video', 'Editing'],
  targetTitles: ['Digital Video Editor'],
  countries: ['KE'],
  isRemoteOk: true,
};

class FakeDesktop implements DesktopAssistant {
  clipboard = '';
  copyToClipboard(text: string): Promise<void> {
    this.clipboard = text;
    return Promise.resolve();
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
}

/** Stands in for a model: records what it was asked and replies with fixed documents. */
class FakeAi implements AiClient {
  readonly model = 'fake-model';
  requests: GenerateRequest<unknown>[] = [];
  generate<T>(request: GenerateRequest<T>): Promise<T> {
    this.requests.push(request);
    return Promise.resolve(
      request.schema.parse({
        coverLetter: 'Dear hiring team at Solvo Global,',
        tailoredCv: '# Wanjiru Kamau',
      }),
    );
  }
}

let db: Db;
let app: FastifyInstance;
let desktop: FakeDesktop;
let ai: FakeAi;

beforeEach(async () => {
  db = openDb(':memory:');
  migrate(db);
  desktop = new FakeDesktop();
  ai = new FakeAi();
  app = await buildApp({
    config: loadConfig({ LOG_LEVEL: 'silent' }),
    db,
    boards,
    desktop,
    ai,
    now: () => NOW,
    resolveHost: () => Promise.resolve(['93.184.216.34']),
    fetchText: (url) => {
      if (url === FEED_URL) return Promise.resolve(feedXml);
      if (url.startsWith('https://jobwebkenya.com/jobs/')) {
        return Promise.resolve(
          '<html><title>Posting</title><body><h1>Full posting</h1></body></html>',
        );
      }
      return Promise.reject(new UpstreamError(`Couldn't reach ${new URL(url).host}.`));
    },
  });
});

afterEach(async () => {
  await app.close();
  db.close();
});

async function scanAndGetFirstJobId(): Promise<string> {
  await app.inject({ method: 'POST', url: '/v1/boards/jobwebkenya/scan' });
  const list = await app.inject({ method: 'GET', url: '/v1/jobs?search=Video' });
  return (list.json() as { data: { id: string }[] }).data[0]!.id;
}

describe('scanning', () => {
  it('stores the postings from a board feed and reports how many were new', async () => {
    const first = await app.inject({ method: 'POST', url: '/v1/boards/jobwebkenya/scan' });
    const second = await app.inject({ method: 'POST', url: '/v1/boards/jobwebkenya/scan' });

    expect(first.json()).toMatchObject({ data: { outcome: 'ok', jobsFound: 2, jobsNew: 2 } });
    expect(second.json()).toMatchObject({ data: { outcome: 'ok', jobsFound: 2, jobsNew: 0 } });

    const jobs = (await app.inject({ method: 'GET', url: '/v1/jobs' })).json() as {
      data: { title: string; countryCode: string; descriptionMd: string }[];
    };
    expect(jobs.data).toHaveLength(2);
    expect(jobs.data[0]).toMatchObject({
      title: 'Digital Video Editor | On Site',
      countryCode: 'KE',
    });
    expect(jobs.data[0]?.descriptionMd).toContain('Solvo');
  });

  it('records a failing board without failing the whole scan', async () => {
    const response = await app.inject({ method: 'POST', url: '/v1/scans' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: [
        { boardId: 'broken', outcome: 'error', errorMessage: "Couldn't reach broken.example." },
        { boardId: 'jobwebkenya', outcome: 'ok', jobsNew: 2 },
      ],
    });

    const boardList = (await app.inject({ method: 'GET', url: '/v1/boards' })).json() as {
      data: { id: string; jobCount: number; lastScan: { outcome: string } | null }[];
    };
    expect(boardList.data.find((board) => board.id === 'broken')?.lastScan?.outcome).toBe('error');
    expect(boardList.data.find((board) => board.id === 'jobwebkenya')?.jobCount).toBe(2);
    expect(boardList.data.find((board) => board.id === 'linkout')?.lastScan).toBeNull();
  });

  it('refuses to scan a board that has no public feed', async () => {
    const response = await app.inject({ method: 'POST', url: '/v1/boards/linkout/scan' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
  });
});

describe('job listing', () => {
  it('pages through jobs with a cursor without repeating any', async () => {
    await app.inject({ method: 'POST', url: '/v1/boards/jobwebkenya/scan' });

    const pageOne = (await app.inject({ method: 'GET', url: '/v1/jobs?limit=1' })).json() as {
      data: { id: string }[];
      next_cursor: string;
    };
    const pageTwo = (
      await app.inject({ method: 'GET', url: `/v1/jobs?limit=1&cursor=${pageOne.next_cursor}` })
    ).json() as { data: { id: string }[]; next_cursor: string | null };

    expect(pageOne.data).toHaveLength(1);
    expect(pageTwo.data).toHaveLength(1);
    expect(pageTwo.data[0]?.id).not.toBe(pageOne.data[0]?.id);
    expect(pageTwo.next_cursor).toBeNull();
  });

  it('rejects an invalid filter with the field named', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/jobs?country=XX' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: 'VALIDATION_FAILED', details: { fields: { country: expect.any(Array) } } },
    });
  });
});

describe('profile and scoring', () => {
  it('scores existing jobs when the profile is saved, and new jobs as they are scanned', async () => {
    await app.inject({ method: 'POST', url: '/v1/boards/jobwebkenya/scan' });

    const saved = await app.inject({ method: 'PUT', url: '/v1/profile', payload: profile });
    expect(saved.json()).toMatchObject({ data: { fullName: 'Wanjiru Kamau' }, rescored: 2 });

    const ranked = (await app.inject({ method: 'GET', url: '/v1/jobs?sort=score' })).json() as {
      data: { title: string; score: number; evaluation: { evaluator: string } }[];
    };
    expect(ranked.data[0]?.title).toBe('Digital Video Editor | On Site');
    expect(ranked.data[0]?.score).toBeGreaterThan(ranked.data[1]?.score ?? 5);
    expect(ranked.data[0]?.evaluation.evaluator).toBe('heuristic');

    const strongOnly = (await app.inject({ method: 'GET', url: '/v1/jobs?minScore=4' })).json() as {
      data: unknown[];
    };
    expect(strongOnly.data).toHaveLength(1);
  });

  it('asks for a profile before evaluating', async () => {
    const jobId = await scanAndGetFirstJobId();

    const response = await app.inject({ method: 'POST', url: `/v1/jobs/${jobId}/evaluate` });

    expect(response.statusCode).toBe(400);
    expect((response.json() as { error: { message: string } }).error.message).toContain(
      'Fill in your profile first',
    );
  });

  it('says how to enable AI assessment when no model is configured', async () => {
    await app.close();
    app = await buildApp({
      config: loadConfig({ LOG_LEVEL: 'silent' }),
      db,
      boards,
      now: () => NOW,
      fetchText: () => Promise.resolve(feedXml),
    });
    const jobId = await scanAndGetFirstJobId();
    await app.inject({ method: 'PUT', url: '/v1/profile', payload: profile });

    const response = await app.inject({
      method: 'POST',
      url: `/v1/jobs/${jobId}/evaluate`,
      payload: { evaluator: 'ai' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: { code: 'NOT_CONFIGURED' } });
  });

  it('rejects a profile without a name', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/v1/profile',
      payload: { ...profile, fullName: ' ' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { details: { fields: { fullName: ['Enter your name'] } } },
    });
  });
});

describe('application tracker', () => {
  it('saves a job once, moves it through statuses and stamps the apply date', async () => {
    const jobId = await scanAndGetFirstJobId();

    const created = await app.inject({
      method: 'POST',
      url: '/v1/applications',
      payload: { jobId },
    });
    const repeated = await app.inject({
      method: 'POST',
      url: '/v1/applications',
      payload: { jobId },
    });
    const { id } = (created.json() as { data: { id: number } }).data;

    expect(created.statusCode).toBe(201);
    expect(created.headers.location).toBe(`/v1/applications/${id}`);
    expect(repeated.statusCode).toBe(200);
    expect((repeated.json() as { data: { id: number } }).data.id).toBe(id);

    const applied = await app.inject({
      method: 'PATCH',
      url: `/v1/applications/${id}`,
      payload: { status: 'applied', notes: 'Sent CV' },
    });
    expect(applied.json()).toMatchObject({
      data: { status: 'applied', notes: 'Sent CV', appliedAt: NOW.toISOString() },
    });

    const deleted = await app.inject({ method: 'DELETE', url: `/v1/applications/${id}` });
    const list = await app.inject({ method: 'GET', url: '/v1/applications' });
    expect(deleted.statusCode).toBe(204);
    expect(list.json()).toEqual({ data: [] });
  });

  it('rejects a status that is not part of the workflow', async () => {
    const jobId = await scanAndGetFirstJobId();
    const created = await app.inject({
      method: 'POST',
      url: '/v1/applications',
      payload: { jobId },
    });
    const { id } = (created.json() as { data: { id: number } }).data;

    const response = await app.inject({
      method: 'PATCH',
      url: `/v1/applications/${id}`,
      payload: { status: 'hired' },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('page to Markdown', () => {
  it('converts a public page', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/extract',
      payload: { url: 'https://jobwebkenya.com/jobs/some-posting/' },
    });

    expect(response.json()).toMatchObject({
      data: { title: 'Posting', markdown: '# Full posting', converter: 'local' },
    });
  });

  it('refuses to fetch an address on the local network', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/extract',
      payload: { url: 'http://127.0.0.1:8787/v1/profile' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'UNSAFE_URL' } });
  });

  it("replaces a job's description with its full posting page", async () => {
    const jobId = await scanAndGetFirstJobId();

    await app.inject({ method: 'POST', url: `/v1/jobs/${jobId}/markdown` });
    const job = (await app.inject({ method: 'GET', url: `/v1/jobs/${jobId}` })).json() as {
      data: { descriptionMd: string };
    };

    expect(job.data.descriptionMd).toBe('# Full posting');
  });
});

describe('application documents', () => {
  it('writes a cover letter and tailored CV from the CV and the posting, and keeps them', async () => {
    const jobId = await scanAndGetFirstJobId();
    await app.inject({ method: 'PUT', url: '/v1/profile', payload: profile });

    const before = await app.inject({ method: 'GET', url: `/v1/jobs/${jobId}/documents` });
    const written = await app.inject({ method: 'POST', url: `/v1/jobs/${jobId}/documents` });
    const after = await app.inject({ method: 'GET', url: `/v1/jobs/${jobId}/documents` });

    expect(before.json()).toEqual({ data: null });
    expect(written.json()).toMatchObject({
      data: {
        coverLetterMd: 'Dear hiring team at Solvo Global,',
        cvMd: '# Wanjiru Kamau',
        model: 'fake-model',
        createdAt: NOW.toISOString(),
      },
    });
    expect(after.json()).toEqual(written.json());
    expect(ai.requests[0]?.context).toContain('Five years editing digital video.');
    expect(ai.requests[0]?.input).toContain('Digital Video Editor');
    expect(ai.requests[0]?.instructions).toContain('reword, never invent');
  });

  it('asks for a CV before writing anything', async () => {
    const jobId = await scanAndGetFirstJobId();
    await app.inject({ method: 'PUT', url: '/v1/profile', payload: { ...profile, cvText: '' } });

    const response = await app.inject({ method: 'POST', url: `/v1/jobs/${jobId}/documents` });

    expect(response.statusCode).toBe(400);
    expect((response.json() as { error: { message: string } }).error.message).toContain(
      'Paste your CV into your profile first',
    );
    expect(ai.requests).toEqual([]);
  });
});

describe('desktop assist', () => {
  it('copies the application pack and saves the job to the tracker', async () => {
    const jobId = await scanAndGetFirstJobId();
    await app.inject({ method: 'PUT', url: '/v1/profile', payload: profile });

    const response = await app.inject({ method: 'POST', url: `/v1/jobs/${jobId}/assist` });

    expect(response.statusCode).toBe(200);
    expect(desktop.clipboard).toContain(
      'APPLICATION PACK: Digital Video Editor | On Site at Solvo Global',
    );
    expect(desktop.clipboard).toContain('Name: Wanjiru Kamau');
    expect(desktop.clipboard).toContain('Skills to lead with: Video');
    const tracker = (await app.inject({ method: 'GET', url: '/v1/applications' })).json() as {
      data: { jobId: string; status: string }[];
    };
    expect(tracker.data).toMatchObject([{ jobId, status: 'saved' }]);
  });
});

describe('errors', () => {
  it('answers unknown jobs with the standard error envelope', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/jobs/nope' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'That job was not found.',
        details: {},
        request_id: expect.any(String),
      },
    });
  });
});

describe('board registry', () => {
  it('ships a valid registry with unique ids and at least one scannable board per region', () => {
    const registry = loadBoards();
    const scannable = registry.filter((board) => board.access.type !== 'listing');

    expect(registry.length).toBeGreaterThan(90);
    for (const country of ['KE', 'NG', 'GH', 'ZW', 'ZM', 'MW', 'BW']) {
      expect(scannable.some((board) => board.countries.includes(country))).toBe(true);
    }
  });
});
