import { detectCountry } from '../boards/countries.js';
import { type Board, isScannable } from '../boards/registry.js';
import { runInTransaction, type Db } from '../db/client.js';
import { AppError, NotFoundError, ValidationError } from '../errors.js';
import { fragmentToMarkdown, htmlToText } from '../extract/html-to-markdown.js';
import { providerFor } from '../providers/index.js';
import type { ProviderContext, RawJob } from '../providers/types.js';
import type { BoardScan, BoardScanRepository } from '../repositories/board-scans.js';
import type { JobRepository, NewJob } from '../repositories/jobs.js';
import type { EvaluationService } from './evaluation.js';

const SUMMARY_LENGTH = 320;
// Boards are independent sites, so a few can be read at once without burdening any one of them.
const BOARD_CONCURRENCY = 4;

export interface ScanLogger {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
}

function summarise(text: string): string {
  if (text.length <= SUMMARY_LENGTH) return text;
  return `${text.slice(0, SUMMARY_LENGTH).replace(/\s+\S*$/, '')}…`;
}

/** Turns a posting as the board published it into the shape KaziScout stores. */
export function normaliseJob(board: Board, raw: RawJob): NewJob {
  const text = htmlToText(raw.bodyHtml);
  const [onlyCountry] = board.countries;
  const isNationalBoard =
    board.countries.length === 1 && onlyCountry !== 'PAN' && onlyCountry !== 'REMOTE';
  const countryCode = raw.isRemote
    ? undefined
    : isNationalBoard
      ? onlyCountry
      : detectCountry(`${raw.location ?? ''} ${raw.title} ${text.slice(0, 600)}`);

  return {
    boardId: board.id,
    externalId: raw.externalId,
    title: raw.title,
    company: raw.company,
    location: raw.location,
    countryCode,
    isRemote: raw.isRemote,
    url: raw.url,
    summary: summarise(text),
    descriptionMd: fragmentToMarkdown(raw.bodyHtml) || undefined,
    postedAt: raw.postedAt,
  };
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      await work(item);
    }
  });
  await Promise.all(workers);
}

export class ScanService {
  constructor(
    private readonly deps: {
      db: Db;
      boards: Board[];
      jobs: JobRepository;
      scans: BoardScanRepository;
      evaluation: EvaluationService;
      providerContext: ProviderContext;
      logger: ScanLogger;
      now?: () => Date;
    },
  ) {}

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }

  /** Scans one board. A failing board is recorded and reported, never thrown. */
  async scanBoard(boardId: string): Promise<BoardScan> {
    const board = this.deps.boards.find((candidate) => candidate.id === boardId);
    if (!board) throw new NotFoundError('That board');
    const provider = providerFor(board);
    if (!provider || !isScannable(board)) {
      throw new ValidationError(
        `${board.name} has no public feed, so it can't be scanned. Open it in your browser.`,
      );
    }

    const startedAt = this.now();
    const started = performance.now();
    let scan: BoardScan;
    try {
      const rawJobs = await provider(board, this.deps.providerContext);
      const newIds = runInTransaction(this.deps.db, () =>
        rawJobs
          .map((raw) => this.deps.jobs.upsert(normaliseJob(board, raw), startedAt))
          .filter((result) => result.isNew)
          .map((result) => result.id),
      );
      await this.deps.evaluation.scoreNewJobs(newIds);
      scan = {
        boardId,
        startedAt: startedAt.toISOString(),
        durationMs: Math.round(performance.now() - started),
        outcome: 'ok',
        jobsFound: rawJobs.length,
        jobsNew: newIds.length,
      };
      this.deps.logger.info({ ...scan }, 'board scanned');
    } catch (error) {
      // Only expected failures (network, format, config) are a board problem; bugs must surface.
      if (!(error instanceof AppError)) throw error;
      scan = {
        boardId,
        startedAt: startedAt.toISOString(),
        durationMs: Math.round(performance.now() - started),
        outcome: 'error',
        jobsFound: 0,
        jobsNew: 0,
        errorMessage: error.message,
      };
      this.deps.logger.warn({ ...scan, details: error.details }, 'board scan failed');
    }
    this.deps.scans.record(scan);
    return scan;
  }

  /** Scans every board that has a public feed. */
  async scanAll(): Promise<BoardScan[]> {
    const results: BoardScan[] = [];
    await runWithConcurrency(
      this.deps.boards.filter(isScannable),
      BOARD_CONCURRENCY,
      async (board) => {
        results.push(await this.scanBoard(board.id));
      },
    );
    return results.sort((a, b) => a.boardId.localeCompare(b.boardId));
  }
}
