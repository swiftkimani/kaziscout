import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { AiClient, GenerateRequest } from '../src/ai/client.js';
import { buildApp } from '../src/app.js';
import type { Board } from '../src/boards/registry.js';
import { loadConfig } from '../src/config.js';
import { migrate, openDb, type Db } from '../src/db/client.js';
import { UpstreamError } from '../src/errors.js';
import { toCalendar } from '../src/services/calendar.js';

const NOW = new Date('2026-10-06T12:00:00Z');
const FEED_URL = 'https://board.example/jobs/feed/';
const board: Board = {
  id: 'board',
  name: 'Board',
  url: 'https://board.example',
  countries: ['KE'],
  category: 'general',
  language: 'en',
  access: { type: 'rss', feedUrl: FEED_URL },
  status: 'live',
  checkedAt: '2026-10-06',
};
const profile = {
  fullName: 'Wanjiru Kamau',
  email: '',
  phone: '',
  headline: '',
  cvText: 'Five years as a React developer.',
  skills: ['React'],
  targetTitles: ['React Developer'],
  countries: ['KE'],
  isRemoteOk: true,
};
const feed = (titles: string[]) =>
  `<rss><channel>${titles.map((title, index) => `<item><title>${title}</title><link>https://board.example/${index}</link><description>React daily. Closing Date: October 20, 2026</description></item>`).join('')}</channel></rss>`;

/** Counts how often it is asked, and answers every request with the same assessment. */
class CountingAi implements AiClient {
  readonly model = 'counting-model';
  calls = 0;
  constructor(private readonly fail = false) {}
  generate<T>(request: GenerateRequest<T>): Promise<T> {
    this.calls += 1;
    if (this.fail) return Promise.reject(new UpstreamError('model is down'));
    return Promise.resolve(
      request.schema.parse({
        score: 4.7,
        verdict: 'Apply.',
        strengths: [],
        gaps: [],
        matchedSkills: [],
        pitch: '',
      }),
    );
  }
}

let db: Db | undefined;
let app: FastifyInstance | undefined;

async function start(
  env: Record<string, string>,
  ai?: AiClient,
  feedXml = feed([
    'React Developer at A',
    'React Developer at B',
    'React Developer at C',
    'Nurse at D',
  ]),
) {
  db = openDb(':memory:');
  migrate(db);
  app = await buildApp({
    config: loadConfig({ LOG_LEVEL: 'silent', ...env }),
    db,
    boards: [board],
    ai,
    now: () => NOW,
    resolveHost: () => Promise.resolve(['93.184.216.34']),
    fetchText: (url) =>
      url === FEED_URL
        ? Promise.resolve(feedXml)
        : Promise.reject(new UpstreamError(`No page at ${url}.`)),
  });
  await app.inject({ method: 'PUT', url: '/v1/profile', payload: profile });
  return app;
}

afterEach(async () => {
  await app?.close();
  db?.close();
  app = undefined;
  db = undefined;
});

describe('automatic AI assessment after a scan', () => {
  it('assesses only strong new matches, and no more than the daily limit', async () => {
    const ai = new CountingAi();
    const server = await start({ AI_AUTO_ASSESS_PER_DAY: '2' }, ai);

    await server.inject({ method: 'POST', url: '/v1/boards/board/scan' });
    const jobs = (await server.inject({ method: 'GET', url: '/v1/jobs?sort=score' })).json() as {
      data: { title: string; evaluation: { evaluator: string; model?: string } }[];
    };

    expect(ai.calls).toBe(2);
    expect(jobs.data.filter((job) => job.evaluation.evaluator === 'ai')).toHaveLength(2);
    expect(jobs.data.find((job) => job.title === 'Nurse')?.evaluation.evaluator).toBe('heuristic');
  });

  it('does nothing unless a daily limit is set', async () => {
    const ai = new CountingAi();
    const server = await start({}, ai);

    await server.inject({ method: 'POST', url: '/v1/boards/board/scan' });

    expect(ai.calls).toBe(0);
  });

  it('stops after the first failure when the model is down, and the scan still succeeds', async () => {
    const ai = new CountingAi(true);
    const server = await start({ AI_AUTO_ASSESS_PER_DAY: '5' }, ai);

    const scan = await server.inject({ method: 'POST', url: '/v1/boards/board/scan' });

    expect(scan.json()).toMatchObject({ data: { outcome: 'ok', jobsNew: 4 } });
    expect(ai.calls).toBe(1);
  });
});

describe('deadline calendar', () => {
  it('exports the closing dates of tracked jobs as all-day events', async () => {
    const server = await start({});
    await server.inject({ method: 'POST', url: '/v1/boards/board/scan' });
    const jobs = (await server.inject({ method: 'GET', url: '/v1/jobs?search=React' })).json() as {
      data: { id: string }[];
    };
    await server.inject({
      method: 'POST',
      url: '/v1/applications',
      payload: { jobId: jobs.data[0]?.id },
    });

    const response = await server.inject({ method: 'GET', url: '/v1/calendar.ics' });

    expect(response.headers['content-type']).toContain('text/calendar');
    expect(response.body).toContain('BEGIN:VCALENDAR\r\n');
    expect(response.body).toContain('DTSTART;VALUE=DATE:20261020');
    expect(response.body).toContain('DTEND;VALUE=DATE:20261021');
    expect(response.body.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  it('escapes commas and semicolons in titles', () => {
    const calendar = toCalendar(
      [
        {
          id: 'j1',
          boardId: 'b',
          title: 'Analyst, Data; Senior',
          isRemote: false,
          url: 'https://x.test/1',
          summary: '',
          closesAt: '2026-10-20T00:00:00.000Z',
          listedAt: '',
          firstSeenAt: '',
          isHidden: false,
        },
      ],
      NOW,
    );

    expect(calendar).toContain(String.raw`SUMMARY:Closes: Analyst\, Data\; Senior`);
  });
});

describe('feed finder', () => {
  it('reports the feeds that work at the usual addresses, with how fresh they are', async () => {
    const server = await start({});

    const response = await server.inject({
      method: 'POST',
      url: '/v1/sources/find-feed',
      payload: { url: 'https://board.example/about' },
    });

    expect(response.json()).toEqual({
      data: [{ url: FEED_URL, items: 4, sampleTitle: 'React Developer' }],
    });
  });
});

describe('light data mode', () => {
  it('does not fetch full postings after a scan', async () => {
    const titlesOnly =
      '<rss><channel><item><title>React Developer at A</title><link>https://board.example/0</link></item></channel></rss>';
    const server = await start({ LIGHT_DATA: 'true' }, undefined, titlesOnly);

    const scan = await server.inject({ method: 'POST', url: '/v1/boards/board/scan' });
    const jobs = (await server.inject({ method: 'GET', url: '/v1/jobs' })).json() as {
      data: { descriptionMd?: string }[];
    };

    expect(scan.json()).toMatchObject({ data: { outcome: 'ok' } });
    expect(jobs.data[0]?.descriptionMd).toBeUndefined();
  });
});
