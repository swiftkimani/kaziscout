import { detectEmployerFromLink, toFollowedBoard } from '../boards/employer-link.js';
import type { Board } from '../boards/registry.js';
import { NotFoundError, ValidationError } from '../errors.js';
import type { BoardScan } from '../repositories/board-scans.js';
import type { FollowedSourceRepository } from '../repositories/followed-sources.js';
import type { ScanService } from './scan.js';

/**
 * Every source KaziScout knows: the registry shipped with the code, plus employers the person
 * follows. Everything that needs "the boards" asks here, so a followed employer is scanned,
 * listed and named like any other.
 */
export class SourceCatalog {
  constructor(
    private readonly registry: Board[],
    private readonly followed: FollowedSourceRepository,
  ) {}

  all(): Board[] {
    return [...this.registry, ...this.followed.list()];
  }

  isFollowed(id: string): boolean {
    return this.followed.list().some((board) => board.id === id);
  }

  /** The source that already reads an employer the same way, if there is one. */
  findByAccess(access: Board['access']): Board | undefined {
    const wanted = JSON.stringify(access);
    return this.all().find((board) => JSON.stringify(board.access) === wanted);
  }

  /** The employer behind a job link, if it is one KaziScout could follow and does not already. */
  suggestFor(link: string): { name: string; link: string } | undefined {
    const detected = detectEmployerFromLink(link);
    if (!detected || this.findByAccess(detected.access)) return undefined;
    return { name: detected.name, link };
  }
}

export class SourceService {
  constructor(
    private readonly deps: {
      catalog: SourceCatalog;
      followed: FollowedSourceRepository;
      scans: ScanService;
      now?: () => Date;
    },
  ) {}

  /**
   * Follows the employer behind a job link. The employer is scanned straight away, and kept only
   * if that scan works, so a mistyped or private careers page is never left in the list.
   */
  async follow(link: string): Promise<{ board: Board; scan: BoardScan }> {
    const detected = detectEmployerFromLink(link);
    if (!detected) {
      throw new ValidationError(
        "That link isn't from a hiring system KaziScout can follow. It reads Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Workday, Recruitee and Teamtailor.",
      );
    }
    const existing = this.deps.catalog.findByAccess(detected.access);
    if (existing) {
      // Following it again would scan the employer twice and store every job twice.
      throw new ValidationError(`You already get ${existing.name}'s openings.`);
    }
    const now = this.deps.now?.() ?? new Date();
    const board = toFollowedBoard(detected, now.toISOString().slice(0, 10));
    this.deps.followed.add(board, now);
    const scan = await this.deps.scans.scanBoard(board.id);
    if (scan.outcome === 'error') {
      this.deps.followed.remove(board.id);
      throw new ValidationError(
        `Couldn't read ${board.name}'s openings, so it was not followed. ${scan.errorMessage ?? ''}`.trim(),
      );
    }
    return { board, scan };
  }

  unfollow(id: string): void {
    if (!this.deps.followed.remove(id)) throw new NotFoundError('That followed employer');
  }
}
