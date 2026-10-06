import { COUNTRIES, detectCountry } from '../boards/countries.js';
import { type Board, isScannable } from '../boards/registry.js';
import { runInTransaction, type Db } from '../db/client.js';
import { AppError, NotFoundError, ValidationError } from '../errors.js';
import { fragmentToMarkdown, htmlToText } from '../extract/html-to-markdown.js';
import { findClosingDate } from '../providers/closing-date.js';
import { providerFor } from '../providers/index.js';
import type { ProviderContext, RawJob } from '../providers/types.js';
import type { BoardScan, BoardScanRepository } from '../repositories/board-scans.js';
import type { JobRepository, NewJob } from '../repositories/jobs.js';
import type { EvaluationService } from './evaluation.js';
import type { PostingCompleter } from './posting-completer.js';

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

/** Some employers write the country as a bracketed ISO code: "Absa Headquarters (KE)". */
function countryFromCode(location: string | undefined): string | undefined {
  const code = /\(([A-Z]{2})\)/.exec(location ?? '')?.[1];
  return code && code in COUNTRIES ? code : undefined;
}

/** Turns a posting as the board published it into the shape KaziScout stores. */
export function normaliseJob(board: Board, raw: RawJob): NewJob {
  const text = htmlToText(raw.bodyHtml);
  const [onlyCountry] = board.countries;
  const isNationalBoard =
    board.countries.length === 1 && onlyCountry !== 'PAN' && onlyCountry !== 'REMOTE';
  // The location field is short and reliable enough to match any country in the world. Titles
  // and descriptions are searched for African countries only, where a false match is unlikely.
  const countryCode = raw.isRemote
    ? undefined
    : isNationalBoard
      ? onlyCountry
      : (countryFromCode(raw.location) ??
        detectCountry(raw.location ?? '', 'world') ??
        detectCountry(`${raw.title} ${text.slice(0, 600)}`));

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
    closesAt: raw.closesAt ?? findClosingDate(text),
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
      /** Asked on every scan, so an employer followed a moment ago is included. */
      boards: () => Board[];
      jobs: JobRepository;
      scans: BoardScanRepository;
      evaluation: EvaluationService;
      /** Fetches full postings for promising jobs that arrive without a description. */
      completer?: PostingCompleter;
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
    return (await this.scanOne(boardId)).scan;
  }

  private async scanOne(boardId: string): Promise<{ scan: BoardScan; newIds: string[] }> {
    const board = this.deps.boards().find((candidate) => candidate.id === boardId);
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
    let newIds: string[] = [];
    try {
      const rawJobs = await provider(board, this.deps.providerContext);
      newIds = runInTransaction(this.deps.db, () =>
        rawJobs
          .map((raw) => this.deps.jobs.upsert(normaliseJob(board, raw), startedAt))
          .filter((result) => result.isNew)
          .map((result) => result.id),
      );
      this.deps.jobs.markDuplicates(newIds);
      await this.deps.evaluation.scoreNewJobs(newIds);
      await this.deps.completer?.complete(newIds);
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
    return { scan, newIds };
  }

  /** Scans every board that has a public feed. */
  async scanAll(): Promise<BoardScan[]> {
    return (await this.scanAllCollectingNewJobs()).scans;
  }

  /** Scans every board and also returns the ids of jobs seen for the first time. */
  async scanAllCollectingNewJobs(): Promise<{ scans: BoardScan[]; newJobIds: string[] }> {
    const scans: BoardScan[] = [];
    const newJobIds: string[] = [];
    await runWithConcurrency(
      this.deps.boards().filter(isScannable),
      BOARD_CONCURRENCY,
      async (board) => {
        const result = await this.scanOne(board.id);
        scans.push(result.scan);
        newJobIds.push(...result.newIds);
      },
    );
    return { scans: scans.sort((a, b) => a.boardId.localeCompare(b.boardId)), newJobIds };
  }
}
