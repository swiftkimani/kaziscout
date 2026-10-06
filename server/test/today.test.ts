import { describe, expect, it } from 'vitest';
import type { Board } from '../src/boards/registry.js';
import { migrate, openDb } from '../src/db/client.js';
import { findClosingDate } from '../src/providers/closing-date.js';
import { ApplicationRepository } from '../src/repositories/applications.js';
import { BoardScanRepository } from '../src/repositories/board-scans.js';
import { JobRepository } from '../src/repositories/jobs.js';
import { AlertService } from '../src/services/alerts.js';
import { BriefScheduler, millisecondsUntil } from '../src/services/brief-scheduler.js';
import { formatBrief, TodayService } from '../src/services/today.js';

const NOW = new Date('2026-10-06T09:00:00Z');
const daysFromNow = (days: number) => new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
const logger = { info: () => undefined, warn: () => undefined };
const board: Board = {
  id: 'board',
  name: 'Example Board',
  url: 'https://board.example',
  countries: ['KE'],
  category: 'general',
  language: 'en',
  access: { type: 'listing' },
  status: 'live',
  checkedAt: '2026-10-06',
};

function setUp() {
  const db = openDb(':memory:');
  migrate(db);
  const jobs = new JobRepository(db);
  const applications = new ApplicationRepository(db);
  const scans = new BoardScanRepository(db);
  const add = (title: string, options: { score: number; seen?: Date; closesAt?: Date }) => {
    const { id } = jobs.upsert(
      {
        boardId: 'board',
        externalId: title,
        title,
        company: 'Acme',
        isRemote: false,
        url: `https://board.example/${title}`,
        summary: '',
        closesAt: options.closesAt,
      },
      options.seen ?? NOW,
    );
    jobs.saveEvaluation(
      id,
      {
        score: options.score,
        evaluator: 'heuristic',
        verdict: '',
        strengths: [],
        gaps: [],
        matchedSkills: [],
      },
      NOW,
    );
    return id;
  };
  const today = new TodayService({
    jobs,
    applications,
    scans,
    boards: () => [board],
    now: () => NOW,
  });
  return { jobs, applications, scans, add, today };
}

describe('findClosingDate', () => {
  it.each([
    ['Closing Date: October 26, 2026', '2026-10-26'],
    ['**Closing Date :** October 26, 2026', '2026-10-26'],
    ['Apply Before: 10/19/2026, 03:37 PM', '2026-10-19'],
    ['Senior Analyst - Expiry Date: 2026-10-19', '2026-10-19'],
    ['Deadline: 3rd November 2026.', '2026-11-03'],
    ['Applications close on 30 Sep 2026', '2026-09-30'],
  ])('reads "%s"', (text, day) => {
    expect(findClosingDate(text)?.toISOString().slice(0, 10)).toBe(day);
  });

  it.each([
    ['a date that could be day/month or month/day', 'Deadline: 05/06/2026'],
    ['an impossible date', 'Closing date: 31 February 2026'],
    ['text with no deadline', 'We are hiring a data analyst in Nairobi.'],
  ])('leaves %s unread', (_label, text) => {
    expect(findClosingDate(text)).toBeUndefined();
  });
});

describe('TodayService', () => {
  it('lists new strong matches, best first, and leaves out weak or older ones', () => {
    const { add, today } = setUp();
    add('strong', { score: 4.2 });
    add('excellent', { score: 4.9 });
    add('weak', { score: 2.5 });
    add('old-strong', { score: 4.8, seen: daysFromNow(-5) });

    expect(today.get().newStrong.map((job) => job.title)).toEqual(['excellent', 'strong']);
  });

  it('lists fair matches and saved jobs that close within three days, soonest first', () => {
    const { add, applications, today } = setUp();
    add('fair-closing-in-2-days', { score: 3.6, closesAt: daysFromNow(2) });
    add('fair-closing-tomorrow', { score: 3.6, closesAt: daysFromNow(1) });
    add('fair-closing-next-week', { score: 3.6, closesAt: daysFromNow(8) });
    add('weak-closing-tomorrow', { score: 2, closesAt: daysFromNow(1) });
    add('already-closed', { score: 4.5, closesAt: daysFromNow(-1) });
    applications.create(add('weak-but-saved', { score: 2, closesAt: daysFromNow(2.5) }), NOW);

    expect(today.get().closingSoon.map((job) => job.title)).toEqual([
      'fair-closing-tomorrow',
      'fair-closing-in-2-days',
      'weak-but-saved',
    ]);
  });

  it('lists applications sent a week ago with no change, and sources whose last scan failed', () => {
    const { add, applications, scans, today } = setUp();
    const stale = applications.create(add('stale', { score: 4 }), daysFromNow(-9));
    applications.update(stale, { status: 'applied' }, daysFromNow(-8));
    const recent = applications.create(add('recent', { score: 4 }), daysFromNow(-2));
    applications.update(recent, { status: 'applied' }, daysFromNow(-2));
    scans.record({
      boardId: 'board',
      startedAt: NOW.toISOString(),
      durationMs: 5,
      outcome: 'error',
      jobsFound: 0,
      jobsNew: 0,
      errorMessage: "Couldn't reach board.example.",
    });

    const result = today.get();

    expect(result.followUps.map((item) => item.job.title)).toEqual(['stale']);
    expect(result.failedSources).toEqual([
      { id: 'board', name: 'Example Board', errorMessage: "Couldn't reach board.example." },
    ]);
  });
});

describe('formatBrief', () => {
  it('writes each list that has something in it', () => {
    const { add, today } = setUp();
    add('excellent', { score: 4.9, closesAt: daysFromNow(1) });

    const brief = formatBrief(today.get());

    expect(brief).toContain(
      'New strong matches\n  4.9 · excellent at Acme · https://board.example/excellent',
    );
    expect(brief).toContain('Closing within three days\n  2026-10-07 · excellent at Acme');
    expect(brief).not.toContain('follow');
  });

  it('says so plainly when there is nothing to do', () => {
    expect(formatBrief(setUp().today.get())).toBe('Nothing needs you today.');
  });
});

describe('BriefScheduler', () => {
  it('works out the wait until the next send time, today or tomorrow', () => {
    const at = (hours: number, minutes: number) => new Date(2026, 9, 6, hours, minutes);

    expect(millisecondsUntil('07:30', at(6, 30))).toBe(60 * 60 * 1000);
    expect(millisecondsUntil('07:30', at(7, 30))).toBe(24 * 60 * 60 * 1000);
    expect(millisecondsUntil('07:30', at(8, 30))).toBe(23 * 60 * 60 * 1000);
  });

  it("sends the day's brief to the webhook", async () => {
    const { add, jobs, today } = setUp();
    add('excellent', { score: 4.9 });
    const bodies: { text: string }[] = [];
    const fetchImpl = ((_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)) as { text: string });
      return Promise.resolve(new Response('ok'));
    }) as typeof fetch;
    const alerts = new AlertService({
      jobs,
      webhookUrl: 'https://h.example',
      minScore: 4,
      logger,
      fetchImpl,
    });

    const sent = await new BriefScheduler({ today, alerts, time: '07:30', logger }).sendNow();

    expect(sent).toBe(true);
    expect(bodies[0]?.text).toContain('KaziScout: your morning brief');
    expect(bodies[0]?.text).toContain('4.9 · excellent at Acme');
  });
});
