import { readFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Board } from '../src/boards/registry.js';
import { runCli } from '../src/cli.js';
import { loadConfig } from '../src/config.js';
import { migrate, openDb, type Db } from '../src/db/client.js';

const feedXml = readFileSync(new URL('./fixtures/wordpress-jobs.rss', import.meta.url), 'utf8');
const boards: Board[] = [
  {
    id: 'jobwebkenya',
    name: 'Jobweb Kenya',
    url: 'https://jobwebkenya.com',
    countries: ['KE'],
    category: 'general',
    language: 'en',
    access: { type: 'rss', feedUrl: 'https://jobwebkenya.com/jobs/feed/' },
    status: 'live',
    checkedAt: '2026-10-06',
  },
  {
    id: 'fuzu',
    name: 'Fuzu',
    url: 'https://www.fuzu.com',
    countries: ['KE'],
    category: 'general',
    language: 'en',
    access: { type: 'listing' },
    status: 'blocked',
    checkedAt: '2026-10-06',
  },
];

let db: Db;
let app: FastifyInstance;

async function kazi(...argv: string[]): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCli(argv, app, { out: (l) => out.push(l), err: (l) => err.push(l) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

async function firstJobId(): Promise<string> {
  const listing = await kazi('jobs', '--search', 'Video');
  return /([0-9a-f]{20})$/m.exec(listing.out)?.[1] ?? '';
}

beforeEach(async () => {
  db = openDb(':memory:');
  migrate(db);
  app = await buildApp({
    config: loadConfig({ LOG_LEVEL: 'silent' }),
    db,
    boards,
    now: () => new Date('2026-10-06T12:00:00Z'),
    resolveHost: () => Promise.resolve(['93.184.216.34']),
    fetchText: (url) =>
      Promise.resolve(
        url.endsWith('/feed/') ? feedXml : '<html><body><h1>Converted page</h1></body></html>',
      ),
  });
});

afterEach(async () => {
  await app.close();
  db.close();
});

describe('kazi', () => {
  it('prints help when run with no command', async () => {
    const result = await kazi();

    expect(result.code).toBe(0);
    expect(result.out).toContain('Usage: ./kazi <command>');
  });

  it('scans every source and totals what it found', async () => {
    const result = await kazi('scan');

    expect(result.out).toMatch(/jobwebkenya\s+2 jobs\s+2 new/);
    expect(result.out).toContain('2 new jobs from 1 sources.');
  });

  it('says what to do when there are no jobs yet', async () => {
    const result = await kazi('jobs');

    expect(result.out).toContain('Run "./kazi scan" first');
  });

  it('lists jobs with their ids, then shows one with its link and description', async () => {
    await kazi('scan');

    const listing = await kazi('jobs', '--country', 'KE', '--limit', '5');
    expect(listing.out).toContain('Digital Video Editor | On Site');
    expect(listing.out).toContain('Solvo Global');

    const shown = await kazi('show', await firstJobId());
    expect(shown.out).toContain('Digital Video Editor | On Site — Solvo Global');
    expect(shown.out).toContain(
      'https://jobwebkenya.com/jobs/digital-video-editor-site-solvo-global/',
    );
    expect(shown.out).toContain('Not scored yet');
  });

  it('creates a profile from the terminal, which scores the jobs already scanned', async () => {
    await kazi('scan');

    const created = await kazi(
      'profile',
      '--name',
      'Wanjiru Kamau',
      '--roles',
      'Digital Video Editor, Animator',
      '--skills',
      'Video,Editing',
      '--countries',
      'KE',
    );
    const listing = await kazi('jobs', '--min', '4');
    const changed = await kazi('profile', '--onsite-only');

    expect(created.out).toContain('Profile saved. 2 jobs re-scored.');
    expect(created.out).toContain('Roles:     Digital Video Editor, Animator');
    expect(listing.out).toContain('Digital Video Editor | On Site');
    expect(changed.out).toContain('Countries: KE');
    expect(changed.out).not.toContain('open to remote');
    expect(changed.out).toContain('Wanjiru Kamau');
  });

  it('explains a profile it cannot save', async () => {
    const result = await kazi('profile', '--headline', 'No name given');

    expect(result.code).toBe(1);
    expect(result.err).toContain('not valid');
  });

  it('saves a job to the tracker and lists it', async () => {
    await kazi('scan');
    const id = await firstJobId();

    expect((await kazi('track', id)).out).toBe('Saved to your tracker.');
    expect((await kazi('tracker')).out).toContain('Digital Video Editor | On Site');
  });

  it('lists sources and can narrow to the scanned ones', async () => {
    const all = await kazi('boards');
    const scanned = await kazi('boards', '--scanned');

    expect(all.out).toContain('2 sources, 1 scanned automatically.');
    expect(scanned.out).not.toContain('Fuzu');
  });

  it('converts a page to Markdown', async () => {
    const result = await kazi('md', 'https://example.com/job');

    expect(result.out).toBe('# Converted page');
  });

  it('reports a problem on stderr with a non-zero exit code', async () => {
    const missingArgument = await kazi('show');
    const unknownJob = await kazi('show', 'nope');
    const unknownCommand = await kazi('dance');

    expect(missingArgument).toMatchObject({
      code: 1,
      err: 'This command needs a job id. Run "./kazi help".',
    });
    expect(unknownJob).toMatchObject({ code: 1, err: 'That job was not found.' });
    expect(unknownCommand.err).toContain('Unknown command "dance"');
  });
});
