import type { Board } from '../boards/registry.js';
import type { Application, ApplicationRepository } from '../repositories/applications.js';
import type { BoardScanRepository } from '../repositories/board-scans.js';
import type { Job, JobRepository } from '../repositories/jobs.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// "New" covers two days so a brief sent each morning never misses a job found the evening before.
const NEW_WINDOW_MS = 2 * DAY_MS;
const CLOSING_WINDOW_MS = 3 * DAY_MS;
const FOLLOW_UP_AFTER_MS = 7 * DAY_MS;
const STRONG_SCORE = 4;
const FAIR_SCORE = 3.5;
const LIST_LIMIT = 8;

export interface Today {
  /** Strong matches first seen in the last two days. */
  newStrong: Job[];
  /** Fair matches and saved jobs whose applications close within three days. */
  closingSoon: Job[];
  /** Applications sent a week or more ago with no change since. */
  followUps: Application[];
  /** Sources whose most recent scan failed. */
  failedSources: { id: string; name: string; errorMessage: string }[];
}

/** Answers "what should I do today?" from what is already stored. Reads only; changes nothing. */
export class TodayService {
  constructor(
    private readonly deps: {
      jobs: JobRepository;
      applications: ApplicationRepository;
      scans: BoardScanRepository;
      boards: () => Board[];
      now?: () => Date;
    },
  ) {}

  get(): Today {
    const now = this.deps.now?.() ?? new Date();
    const names = new Map(this.deps.boards().map((board) => [board.id, board.name]));
    return {
      newStrong: this.deps.jobs.listNewStrong(
        new Date(now.getTime() - NEW_WINDOW_MS),
        STRONG_SCORE,
        LIST_LIMIT,
      ),
      closingSoon: this.deps.jobs.listClosingSoon(
        now,
        new Date(now.getTime() + CLOSING_WINDOW_MS),
        FAIR_SCORE,
        LIST_LIMIT,
      ),
      followUps: this.deps.applications.listAwaitingReply(
        new Date(now.getTime() - FOLLOW_UP_AFTER_MS),
        LIST_LIMIT,
      ),
      failedSources: [...this.deps.scans.latestByBoard().values()]
        .filter((scan) => scan.outcome === 'error')
        .map((scan) => ({
          id: scan.boardId,
          name: names.get(scan.boardId) ?? scan.boardId,
          errorMessage: scan.errorMessage ?? 'The scan failed.',
        })),
    };
  }
}

/** The day's lists as plain text, for a webhook message or a terminal. Empty lists are left out. */
export function formatBrief(today: Today): string {
  const sections: string[] = [];
  if (today.newStrong.length > 0) {
    sections.push(
      [
        'New strong matches',
        ...today.newStrong.map(
          (job) =>
            `  ${job.score?.toFixed(1)} · ${job.title}${job.company ? ` at ${job.company}` : ''} · ${job.url}`,
        ),
      ].join('\n'),
    );
  }
  if (today.closingSoon.length > 0) {
    sections.push(
      [
        'Closing within three days',
        ...today.closingSoon.map(
          (job) =>
            `  ${job.closesAt?.slice(0, 10)} · ${job.title}${job.company ? ` at ${job.company}` : ''} · ${job.url}`,
        ),
      ].join('\n'),
    );
  }
  if (today.followUps.length > 0) {
    sections.push(
      [
        'No reply for a week: consider following up',
        ...today.followUps.map(
          (item) => `  ${item.job.title}${item.job.company ? ` at ${item.job.company}` : ''}`,
        ),
      ].join('\n'),
    );
  }
  if (today.failedSources.length > 0) {
    sections.push(
      `Sources that failed last scan: ${today.failedSources.map((source) => source.name).join(', ')}`,
    );
  }
  return sections.length > 0 ? sections.join('\n\n') : 'Nothing needs you today.';
}
