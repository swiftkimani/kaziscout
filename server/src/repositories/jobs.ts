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
  closesAt?: string;
  listedAt: string;
  firstSeenAt: string;
  score?: number;
  evaluation?: Evaluation;
  evaluatedAt?: string;
  /** True once the person has dismissed the job. */
  isHidden: boolean;
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
  closesAt?: Date;
}

export interface JobFilter {
  search?: string;
  boardId?: string;
  countryCode?: string;
  isRemote?: boolean;
  minScore?: number;
  /** 'visible' (the default) leaves hidden jobs out; 'hidden' lists only those. */
  visibility?: 'visible' | 'hidden';
  /** Leave out jobs already in the tracker, for triage. */
  untrackedOnly?: boolean;
  sort: 'newest' | 'score';
  limit: number;
  cursor?: string;
}

export interface JobPage {
  data: Job[];
  nextCursor: string | null;
}

const JOB_COLUMNS = `id, board_id, title, company, location, country_code, is_remote, url, summary,
  description_md, posted_at, closes_at, listed_at, first_seen_at, score, evaluation_json, evaluated_at, hidden_at`;

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
    closesAt: optional(row.closes_at),
    listedAt: String(row.listed_at),
    firstSeenAt: String(row.first_seen_at),
    score: typeof row.score === 'number' ? row.score : undefined,
    evaluation: evaluationJson ? (JSON.parse(evaluationJson) as Evaluation) : undefined,
    evaluatedAt: optional(row.evaluated_at),
    isHidden: row.hidden_at !== null,
  };
}

/**
 * A key that is equal for two postings of the same role: the title and company with case,
 * punctuation and spacing removed. Undefined without a company, because a bare title such as
 * "Accountant" is shared by unrelated jobs.
 */
export function matchKey(title: string, company: string | undefined): string | undefined {
  const squash = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const employer = squash(company ?? '');
  return employer ? `${squash(title)}|${employer}` : undefined;
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
           is_remote, url, summary, description_md, posted_at, first_seen_at, last_seen_at, listed_at,
           closes_at, match_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           title = excluded.title, company = excluded.company, location = excluded.location,
           country_code = excluded.country_code, is_remote = excluded.is_remote,
           url = excluded.url, summary = excluded.summary,
           description_md = COALESCE(excluded.description_md, jobs.description_md),
           closes_at = COALESCE(excluded.closes_at, jobs.closes_at),
           match_key = excluded.match_key,
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
        job.closesAt?.toISOString() ?? null,
        matchKey(job.title, job.company) ?? null,
      );
    return { id, isNew: existing === undefined };
  }

  findById(id: string): Job | undefined {
    const row = this.db.prepare(`SELECT ${JOB_COLUMNS} FROM jobs WHERE id = ?`).get(id);
    return row ? toJob(row) : undefined;
  }

  /** Keyset-paginated listing; the cursor carries the sort value and id of the last row. */
  list(filter: JobFilter): JobPage {
    const where: string[] = [
      filter.visibility === 'hidden' ? 'hidden_at IS NOT NULL' : 'hidden_at IS NULL',
      // A role posted on several boards is listed once, as the copy seen first.
      'duplicate_of IS NULL',
    ];
    const params: (string | number)[] = [];
    if (filter.untrackedOnly) where.push('id NOT IN (SELECT job_id FROM applications)');
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

  /**
   * Points each of the given jobs at an earlier posting of the same role on another board, when
   * there is one. Returns how many were marked as duplicates.
   */
  markDuplicates(jobIds: string[]): number {
    const findOriginal = this.db.prepare(
      `SELECT o.id FROM jobs j JOIN jobs o
         ON o.match_key = j.match_key AND o.id <> j.id AND o.board_id <> j.board_id
        AND o.duplicate_of IS NULL
       WHERE j.id = ? AND j.match_key IS NOT NULL AND j.duplicate_of IS NULL
       ORDER BY o.first_seen_at, o.id LIMIT 1`,
    );
    const mark = this.db.prepare('UPDATE jobs SET duplicate_of = ? WHERE id = ?');
    let marked = 0;
    for (const id of jobIds) {
      const original = findOriginal.get(id);
      if (!original) continue;
      mark.run(String(original.id), id);
      marked += 1;
    }
    return marked;
  }

  /** The other boards carrying the same role as this job. */
  listCopiesOf(id: string): { boardId: string; url: string }[] {
    return this.db
      .prepare('SELECT board_id, url FROM jobs WHERE duplicate_of = ? ORDER BY board_id')
      .all(id)
      .map((row) => ({ boardId: String(row.board_id), url: String(row.url) }));
  }

  /** Hides or restores a job. Returns false when there is no such job. */
  setHidden(id: string, isHidden: boolean, now: Date): boolean {
    return (
      this.db
        .prepare('UPDATE jobs SET hidden_at = ? WHERE id = ?')
        .run(isHidden ? now.toISOString() : null, id).changes > 0
    );
  }

  saveDescription(id: string, markdown: string): void {
    this.db.prepare('UPDATE jobs SET description_md = ? WHERE id = ?').run(markdown, id);
  }

  /** Strong matches first seen since `since`, best first. */
  listNewStrong(since: Date, minScore: number, limit: number): Job[] {
    return this.db
      .prepare(
        `SELECT ${JOB_COLUMNS} FROM jobs
         WHERE first_seen_at >= ? AND score >= ? AND hidden_at IS NULL AND duplicate_of IS NULL
         ORDER BY score DESC, id DESC LIMIT ?`,
      )
      .all(since.toISOString(), minScore, limit)
      .map(toJob);
  }

  /** Jobs closing between two moments that are worth acting on: a fair match, or already tracked. */
  listClosingSoon(from: Date, until: Date, minScore: number, limit: number): Job[] {
    return this.db
      .prepare(
        `SELECT ${JOB_COLUMNS} FROM jobs
         WHERE closes_at >= ? AND closes_at <= ? AND hidden_at IS NULL AND duplicate_of IS NULL
           AND (score >= ? OR id IN (SELECT job_id FROM applications WHERE status = 'saved'))
         ORDER BY closes_at, id LIMIT ?`,
      )
      .all(from.toISOString(), until.toISOString(), minScore, limit)
      .map(toJob);
  }

  /** Visible jobs scoring from `min` up to but not including `max`, best first. */
  listScoredBetween(min: number, max: number, limit: number): Job[] {
    return this.db
      .prepare(
        `SELECT ${JOB_COLUMNS} FROM jobs
         WHERE score >= ? AND score < ? AND hidden_at IS NULL AND duplicate_of IS NULL
         ORDER BY score DESC, id DESC LIMIT ?`,
      )
      .all(min, max, limit)
      .map(toJob);
  }

  listCountryCodes(): string[] {
    return this.db
      .prepare('SELECT DISTINCT country_code FROM jobs WHERE country_code IS NOT NULL')
      .all()
      .map((row) => String(row.country_code));
  }

  countByBoard(): Map<string, number> {
    const rows = this.db.prepare('SELECT board_id, COUNT(*) AS total FROM jobs GROUP BY board_id');
    return new Map(rows.all().map((row) => [String(row.board_id), Number(row.total)]));
  }
}
