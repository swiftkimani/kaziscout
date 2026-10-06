import { describe, expect, it } from 'vitest';
import { migrate, openDb } from '../src/db/client.js';
import { JobRepository } from '../src/repositories/jobs.js';
import { AlertService } from '../src/services/alerts.js';
import type { ScanService } from '../src/services/scan.js';
import { ScanScheduler } from '../src/services/scheduler.js';

const NOW = new Date('2026-10-06T12:00:00Z');
const logger = { info: () => undefined, warn: () => undefined };

function seedJobs(scores: Record<string, number>): { jobs: JobRepository; ids: string[] } {
  const db = openDb(':memory:');
  migrate(db);
  const jobs = new JobRepository(db);
  const ids = Object.entries(scores).map(([title, score]) => {
    const { id } = jobs.upsert(
      {
        boardId: 'board',
        externalId: title,
        title,
        company: 'Acme',
        isRemote: false,
        url: `https://board.example/${title}`,
        summary: '',
      },
      NOW,
    );
    jobs.saveEvaluation(
      id,
      { score, evaluator: 'heuristic', verdict: '', strengths: [], gaps: [], matchedSkills: [] },
      NOW,
    );
    return id;
  });
  return { jobs, ids };
}

function recordingFetch(status = 200) {
  const bodies: { text: string; content: string; jobs: { title: string }[] }[] = [];
  const fetchImpl = ((_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)) as (typeof bodies)[number]);
    return Promise.resolve(new Response('ok', { status }));
  }) as typeof fetch;
  return { fetchImpl, bodies };
}

describe('AlertService', () => {
  it('posts only the new jobs at or above the minimum score, best first', async () => {
    const { jobs, ids } = seedJobs({ strong: 4.6, fair: 3.2, excellent: 4.9 });
    const { fetchImpl, bodies } = recordingFetch();
    const alerts = new AlertService({
      jobs,
      webhookUrl: 'https://hooks.example/abc',
      minScore: 4,
      logger,
      fetchImpl,
    });

    const reported = await alerts.notifyNewJobs(ids);

    expect(reported).toBe(2);
    expect(bodies[0]?.jobs.map((job) => job.title)).toEqual(['excellent', 'strong']);
    expect(bodies[0]?.text).toContain('KaziScout found 2 new strong matches');
    expect(bodies[0]?.content).toBe(bodies[0]?.text);
  });

  it('sends nothing when no new job is strong enough', async () => {
    const { jobs, ids } = seedJobs({ fair: 3.2 });
    const { fetchImpl, bodies } = recordingFetch();
    const alerts = new AlertService({
      jobs,
      webhookUrl: 'https://h.example',
      minScore: 4,
      logger,
      fetchImpl,
    });

    expect(await alerts.notifyNewJobs(ids)).toBe(0);
    expect(bodies).toEqual([]);
  });

  it('does not throw when the webhook is unreachable', async () => {
    const { jobs, ids } = seedJobs({ strong: 4.6 });
    const fetchImpl = (() => Promise.reject(new TypeError('fetch failed'))) as typeof fetch;
    const alerts = new AlertService({
      jobs,
      webhookUrl: 'https://h.example',
      minScore: 4,
      logger,
      fetchImpl,
    });

    await expect(alerts.notifyNewJobs(ids)).resolves.toBe(0);
  });
});

describe('ScanScheduler', () => {
  it('scans, then alerts on the jobs that scan found', async () => {
    const { jobs, ids } = seedJobs({ strong: 4.6 });
    const { fetchImpl, bodies } = recordingFetch();
    const scans = {
      scanAllCollectingNewJobs: () => Promise.resolve({ scans: [], newJobIds: ids }),
    } as unknown as ScanService;
    const scheduler = new ScanScheduler({
      scans,
      alerts: new AlertService({
        jobs,
        webhookUrl: 'https://h.example',
        minScore: 4,
        logger,
        fetchImpl,
      }),
      intervalMinutes: 60,
      logger,
    });

    await expect(scheduler.runOnce()).resolves.toEqual({ newJobs: 1, alerted: 1 });
    expect(bodies).toHaveLength(1);
  });

  it('does not start a second scan while one is still running', async () => {
    let release: () => void = () => undefined;
    let started = 0;
    const scans = {
      scanAllCollectingNewJobs: () => {
        started += 1;
        return new Promise((resolve) => {
          release = () => resolve({ scans: [], newJobIds: [] });
        });
      },
    } as unknown as ScanService;
    const scheduler = new ScanScheduler({ scans, intervalMinutes: 60, logger });

    const first = scheduler.runOnce();
    const second = await scheduler.runOnce();
    release();
    await first;

    expect(second).toBeUndefined();
    expect(started).toBe(1);
  });
});
