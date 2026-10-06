import { readFileSync } from 'node:fs';
import { z } from 'zod';

const accessSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('rss'), feedUrl: z.url() }),
  z.object({
    type: z.literal('api'),
    provider: z.enum(['remotive', 'himalayas', 'remoteok']),
  }),
  // An employer's own openings, read from the public API of its applicant-tracking system.
  z.object({
    type: z.literal('ats'),
    provider: z.enum(['greenhouse', 'lever', 'ashby', 'smartrecruiters', 'workable']),
    slug: z.string().regex(/^[A-Za-z0-9._-]+$/),
  }),
  // Live board with no public feed: KaziScout links out to it and never scrapes it.
  z.object({ type: z.literal('listing') }),
]);

const boardSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  url: z.url(),
  // ISO country codes, or PAN for pan-African boards, or REMOTE for worldwide remote boards.
  countries: z.array(z.string().regex(/^([A-Z]{2}|PAN|REMOTE)$/)).min(1),
  category: z.enum([
    'general',
    'ngo',
    'tech',
    'remote',
    'government',
    'opportunities',
    'aggregator',
    'employer',
  ]),
  language: z.enum(['en', 'fr', 'pt', 'ar']),
  access: accessSchema,
  // live: answered our check. blocked: reachable in a browser but refuses automated checks.
  status: z.enum(['live', 'blocked', 'down']),
  checkedAt: z.iso.date(),
  note: z.string().optional(),
});

export type Board = z.infer<typeof boardSchema>;
export type BoardAccess = Board['access'];

export const REGISTRY_URL = new URL('../../data/boards.json', import.meta.url);

/** The registry file is the source of truth for boards; nothing about them lives in the database. */
export function loadBoards(source: URL = REGISTRY_URL): Board[] {
  const boards = z.array(boardSchema).parse(JSON.parse(readFileSync(source, 'utf8')));
  const ids = new Set<string>();
  for (const board of boards) {
    if (ids.has(board.id)) throw new Error(`Duplicate board id in registry: ${board.id}`);
    ids.add(board.id);
  }
  return boards;
}

export function isScannable(board: Board): boolean {
  return board.access.type !== 'listing' && board.status === 'live';
}
