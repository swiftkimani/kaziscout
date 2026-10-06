import { formatBrief, type Today } from '../services/today.js';
import { clip, type Command } from './context.js';

interface Scan {
  boardId: string;
  outcome: string;
  jobsFound: number;
  jobsNew: number;
  errorMessage?: string;
}

export const scan: Command = async ({ io, argument, call }) => {
  io.out(argument ? `Scanning ${argument}…` : 'Scanning every source. This takes about a minute…');
  const scans = argument
    ? [(await call<{ data: Scan }>('POST', `/v1/boards/${encodeURIComponent(argument)}/scan`)).data]
    : (await call<{ data: Scan[] }>('POST', '/v1/scans')).data;

  for (const result of scans) {
    io.out(
      result.outcome === 'ok'
        ? `  ${clip(result.boardId, 28)} ${String(result.jobsFound).padStart(4)} jobs  ${String(result.jobsNew).padStart(4)} new`
        : `  ${clip(result.boardId, 28)} failed: ${result.errorMessage ?? 'unknown error'}`,
    );
  }
  const added = scans.reduce((total, result) => total + result.jobsNew, 0);
  const failed = scans.filter((result) => result.outcome !== 'ok').length;
  io.out(
    `\n${added} new jobs from ${scans.length - failed} sources${failed ? `; ${failed} did not answer` : ''}.`,
  );
};

interface ApiBoard {
  id: string;
  name: string;
  countries: string[];
  status: string;
  isScannable: boolean;
  jobCount: number;
}

export const boards: Command = async ({ io, values, call }) => {
  const { data } = await call<{ data: ApiBoard[] }>('GET', '/v1/boards');
  const shown = values.scanned ? data.filter((board) => board.isScannable) : data;
  io.out(
    `${'SOURCE'.padEnd(32)} ${'COVERAGE'.padEnd(18)} ${'ACCESS'.padEnd(9)} ${'STATUS'.padEnd(8)} JOBS  ID`,
  );
  for (const board of shown) {
    io.out(
      `${clip(board.name, 32)} ${clip(board.countries.join(','), 18)} ${(board.isScannable ? 'scanned' : 'link-out').padEnd(9)} ${board.status.padEnd(8)} ${String(board.jobCount).padStart(4)}  ${board.id}`,
    );
  }
  const scanned = shown.filter((board) => board.isScannable).length;
  io.out(`\n${shown.length} sources, ${scanned} scanned automatically.`);
};

/** The day's short lists: what is new, what is closing, what needs a follow-up. */
export const today: Command = async ({ io, call }) => {
  const { data } = await call<{ data: Today }>('GET', '/v1/today');
  io.out(formatBrief(data));
};

export const markdown: Command = async ({ io, need, call }) => {
  const { data } = await call<{ data: { markdown: string } }>('POST', '/v1/extract', {
    url: need('a web address'),
  });
  io.out(data.markdown);
};
