import type { Db } from '../db/client.js';

export interface BoardScan {
  boardId: string;
  startedAt: string;
  durationMs: number;
  outcome: 'ok' | 'error';
  jobsFound: number;
  jobsNew: number;
  errorMessage?: string;
}

export class BoardScanRepository {
  constructor(private readonly db: Db) {}

  record(scan: BoardScan): void {
    this.db
      .prepare(
        `INSERT INTO board_scans (board_id, started_at, duration_ms, outcome, jobs_found, jobs_new,
           error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        scan.boardId,
        scan.startedAt,
        scan.durationMs,
        scan.outcome,
        scan.jobsFound,
        scan.jobsNew,
        scan.errorMessage ?? null,
      );
  }

  /** The most recent scan of each board that has been scanned at least once. */
  latestByBoard(): Map<string, BoardScan> {
    const rows = this.db
      .prepare(
        `SELECT board_id, started_at, duration_ms, outcome, jobs_found, jobs_new, error_message
         FROM board_scans s
         WHERE id = (SELECT MAX(id) FROM board_scans WHERE board_id = s.board_id)`,
      )
      .all();
    return new Map(
      rows.map((row) => [
        String(row.board_id),
        {
          boardId: String(row.board_id),
          startedAt: String(row.started_at),
          durationMs: Number(row.duration_ms),
          outcome: row.outcome === 'ok' ? 'ok' : 'error',
          jobsFound: Number(row.jobs_found),
          jobsNew: Number(row.jobs_new),
          errorMessage: typeof row.error_message === 'string' ? row.error_message : undefined,
        },
      ]),
    );
  }
}
