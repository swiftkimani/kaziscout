import { createHash } from 'node:crypto';
import type { Db } from '../db/client.js';
import type { Evaluation } from '../scoring/types.js';

export interface Job {
  id: string;
  boardId: string;
  title: string;
  company?: string;
  location?: string;
  countryCode?: string;
  isRemote: boolean;
  url: string;
  summary: string;
  descriptionMd?: string;
  postedAt?: string;
  listedAt: string;
  firstSeenAt: string;
  score?: number;
  evaluation?: Evaluation;
  evaluatedAt?: string;
}

export interface NewJob {
  boardId: string;
  externalId: string;
  title: string;
  company?: string;
  location?: string;
  countryCode?: string;
  isRemote: boolean;
  url: string;
  summary: string;
  descriptionMd?: string;
  postedAt?: Date;
}

export interface JobFilter {
  search?: string;
  boardId?: string;
  countryCode?: string;
  isRemote?: boolean;
  minScore?: number;
  sort: 'newest' | 'score';
  limit: number;
  cursor?: string;
}

export interface JobPage {
  data: Job[];
  nextCursor: string | null;
}

const JOB_COLUMNS = `id, board_id, title, company, location, country_code, is_remote, url, summary,
  description_md, posted_at, listed_at, first_seen_at, score, evaluation_json, evaluated_at`;

type Row = Record<string, unknown>;

function optional(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function toJob(row: Row): Job {
  const evaluationJson = optional(row.evaluation_json);
  return {
    id: String(row.id),
    boardId: String(row.board_id),
    title: String(row.title),
    company: optional(row.company),
    location: optional(row.location),
    countryCode: optional(row.country_code),
    isRemote: row.is_remote === 1,
    url: String(row.url),
    summary: String(row.summary),
    descriptionMd: optional(row.description_md),
    postedAt: optional(row.posted_at),
    listedAt: String(row.listed_at),
    firstSeenAt: String(row.first_seen_at),
    score: typeof row.score === 'number' ? row.score : undefined,
    evaluation: evaluationJson ? (JSON.parse(evaluationJson) as Evaluation) : undefined,
    evaluatedAt: optional(row.evaluated_at),
  };
}

/** Stable id for a posting, so re-scanning a board updates rows instead of duplicating them. */
export function jobId(boardId: string, externalId: string): string {
  return createHash('sha256').update(`${boardId}\n${externalId}`).digest('hex').slice(0, 20);
}

function encodeCursor(sortValue: string | number, id: string): string {
  return Buffer.from(JSON.stringify([sortValue, id])).toString('base64url');
}

function decodeCursor(cursor: string): [string | number, string] | undefined {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!Array.isArray(parsed) || parsed.length !== 2) return undefined;
    const [sortValue, id] = parsed as unknown[];
    const isSortValue = typeof sortValue === 'string' || typeof sortValue === 'number';
    return isSortValue && typeof id === 'string' ? [sortValue, id] : undefined;
  } catch {
    return undefined;
  }
}

export class JobRepository {
  constructor(private readonly db: Db) {}

  /** Inserts a posting or refreshes one seen before. Returns true when the posting is new. */
  upsert(job: NewJob, now: Date): { id: string; isNew: boolean } {
    const id = jobId(job.boardId, job.externalId);
    const seenAt = now.toISOString();
    const postedAt = job.postedAt?.toISOString() ?? null;
    const existing = this.db.prepare('SELECT 1 FROM jobs WHERE id = ?').get(id);
    this.db
      .prepare(
        `INSERT INTO jobs (id, board_id, external_id, title, company, location, country_code,
           is_remote, url, summary, description_md, posted_at, first_seen_at, last_seen_at, listed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           title = excluded.title, company = excluded.company, location = excluded.location,
           country_code = excluded.country_code, is_remote = excluded.is_remote,
           url = excluded.url, summary = excluded.summary,
           description_md = COALESCE(excluded.description_md, jobs.description_md),
           last_seen_at = excluded.last_seen_at`,
      )
      .run(
        id,
        job.boardId,
        job.externalId,
        job.title,
        job.company ?? null,
        job.location ?? null,
        job.countryCode ?? null,
        job.isRemote ? 1 : 0,
        job.url,
        job.summary,
        job.descriptionMd ?? null,
        postedAt,
        seenAt,
        seenAt,
        postedAt ?? seenAt,
      );
    return { id, isNew: existing === undefined };
  }

  findById(id: string): Job | undefined {
    const row = this.db.prepare(`SELECT ${JOB_COLUMNS} FROM jobs WHERE id = ?`).get(id);
    return row ? toJob(row) : undefined;
  }

  /** Keyset-paginated listing; the cursor carries the sort value and id of the last row. */
  list(filter: JobFilter): JobPage {
    const where: string[] = [];
    const params: (string | number)[] = [];
    const sortColumn = filter.sort === 'score' ? 'COALESCE(score, 0)' : 'listed_at';

    if (filter.search) {
      where.push("(title LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\')");
      const pattern = `%${filter.search.replace(/[\\%_]/g, '\\$&')}%`;
      params.push(pattern, pattern);
    }
    if (filter.boardId) {
      where.push('board_id = ?');
      params.push(filter.boardId);
    }
    if (filter.countryCode) {
      where.push('country_code = ?');
      params.push(filter.countryCode);
    }
    if (filter.isRemote !== undefined) {
      where.push('is_remote = ?');
      params.push(filter.isRemote ? 1 : 0);
    }
    if (filter.minScore !== undefined) {
      where.push('score >= ?');
      params.push(filter.minScore);
    }
    const cursor = filter.cursor ? decodeCursor(filter.cursor) : undefined;
    if (cursor) {
      where.push(`(${sortColumn}, id) < (?, ?)`);
      params.push(...cursor);
    }

    const rows = this.db
      .prepare(
        `SELECT ${JOB_COLUMNS}, ${sortColumn} AS sort_value FROM jobs
         ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY ${sortColumn} DESC, id DESC LIMIT ?`,
      )
      .all(...params, filter.limit + 1);

    const page = rows.slice(0, filter.limit);
    const last = page.at(-1);
    const hasMore = rows.length > filter.limit && last !== undefined;
    return {
      data: page.map(toJob),
      nextCursor: hasMore
        ? encodeCursor(last.sort_value as string | number, String(last.id))
        : null,
    };
  }

  /** Ids of every job, in batches, for re-scoring after the profile changes. */
  listIds(afterId: string, limit: number): string[] {
    return this.db
      .prepare('SELECT id FROM jobs WHERE id > ? ORDER BY id LIMIT ?')
      .all(afterId, limit)
      .map((row) => String(row.id));
  }

  saveEvaluation(id: string, evaluation: Evaluation, now: Date): void {
    this.db
      .prepare('UPDATE jobs SET score = ?, evaluation_json = ?, evaluated_at = ? WHERE id = ?')
      .run(evaluation.score, JSON.stringify(evaluation), now.toISOString(), id);
  }

  saveDescription(id: string, markdown: string): void {
    this.db.prepare('UPDATE jobs SET description_md = ? WHERE id = ?').run(markdown, id);
  }

  countByBoard(): Map<string, number> {
    const rows = this.db.prepare('SELECT board_id, COUNT(*) AS total FROM jobs GROUP BY board_id');
    return new Map(rows.all().map((row) => [String(row.board_id), Number(row.total)]));
  }
}
