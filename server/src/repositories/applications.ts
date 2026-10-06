import type { Db } from '../db/client.js';

export const APPLICATION_STATUSES = [
  'saved',
  'applied',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface Application {
  id: number;
  jobId: string;
  status: ApplicationStatus;
  notes: string;
  appliedAt?: string;
  createdAt: string;
  updatedAt: string;
  job: { title: string; company?: string; url: string; boardId: string; score?: number };
}

const SELECT_APPLICATION = `
  SELECT a.id, a.job_id, a.status, a.notes, a.applied_at, a.created_at, a.updated_at,
         j.title, j.company, j.url, j.board_id, j.score
  FROM applications a JOIN jobs j ON j.id = a.job_id`;

function toApplication(row: Record<string, unknown>): Application {
  return {
    id: Number(row.id),
    jobId: String(row.job_id),
    status: row.status as ApplicationStatus,
    notes: String(row.notes),
    appliedAt: typeof row.applied_at === 'string' ? row.applied_at : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    job: {
      title: String(row.title),
      company: typeof row.company === 'string' ? row.company : undefined,
      url: String(row.url),
      boardId: String(row.board_id),
      score: typeof row.score === 'number' ? row.score : undefined,
    },
  };
}

export class ApplicationRepository {
  constructor(private readonly db: Db) {}

  /** A person tracks tens of applications, not thousands, so the tracker loads them in one page. */
  list(limit: number): Application[] {
    return this.db
      .prepare(`${SELECT_APPLICATION} ORDER BY a.updated_at DESC LIMIT ?`)
      .all(limit)
      .map(toApplication);
  }

  /** Applications sent but not touched since `before`: candidates for a follow-up. */
  listAwaitingReply(before: Date, limit: number): Application[] {
    return this.db
      .prepare(
        `${SELECT_APPLICATION} WHERE a.status = 'applied' AND a.updated_at <= ?
         ORDER BY a.updated_at LIMIT ?`,
      )
      .all(before.toISOString(), limit)
      .map(toApplication);
  }

  findById(id: number): Application | undefined {
    const row = this.db.prepare(`${SELECT_APPLICATION} WHERE a.id = ?`).get(id);
    return row ? toApplication(row) : undefined;
  }

  findByJobId(jobId: string): Application | undefined {
    const row = this.db.prepare(`${SELECT_APPLICATION} WHERE a.job_id = ?`).get(jobId);
    return row ? toApplication(row) : undefined;
  }

  create(jobId: string, now: Date): number {
    const timestamp = now.toISOString();
    const result = this.db
      .prepare('INSERT INTO applications (job_id, created_at, updated_at) VALUES (?, ?, ?)')
      .run(jobId, timestamp, timestamp);
    return Number(result.lastInsertRowid);
  }

  update(
    id: number,
    changes: { status?: ApplicationStatus; notes?: string; appliedAt?: string },
    now: Date,
  ): void {
    this.db
      .prepare(
        `UPDATE applications SET
           status = COALESCE(?, status), notes = COALESCE(?, notes),
           applied_at = COALESCE(?, applied_at), updated_at = ?
         WHERE id = ?`,
      )
      .run(
        changes.status ?? null,
        changes.notes ?? null,
        changes.appliedAt ?? null,
        now.toISOString(),
        id,
      );
  }

  delete(id: number): boolean {
    return this.db.prepare('DELETE FROM applications WHERE id = ?').run(id).changes > 0;
  }
}
