import { parseArgs } from 'node:util';
import type { FastifyInstance } from 'fastify';

/** Where the CLI writes; tests pass their own to capture output. */
export interface CliIo {
  out: (line: string) => void;
  err: (line: string) => void;
}

const HELP = `KaziScout in the terminal

Usage: ./kazi <command> [options]

  scan [board-id]        Scan every source, or one board
  jobs                   List jobs, best fit first
      --search <text>    Match title or company
      --country <code>   Two-letter country code, for example KE
      --remote           Remote roles only
      --min <score>      Lowest score to show, 1 to 5
      --newest           Sort by date instead of fit
      --limit <n>        How many to show (default 15)
  show <job-id>          One job: fit, reasons, link, description
  pack <job-id>          The application pack for a job
  track <job-id>         Save a job to the tracker
  tracker                What you are tracking, by status
  boards                 Sources and their status
      --scanned          Only the ones scanned automatically
  md <url>               Convert a web page to Markdown
  profile                Show the saved profile, or change it with any of:
      --name <text>      --headline <text>   --email <address>   --phone <number>
      --roles <a,b>      Job titles you want, comma separated
      --skills <a,b>     Skills, comma separated
      --countries <a,b>  Country codes you can work in, for example KE,UG
      --onsite-only      Not open to remote work
  help                   Show this help

Run the web app with: pnpm start`;

interface ApiJob {
  id: string;
  title: string;
  company?: string;
  location?: string;
  countryCode?: string;
  isRemote: boolean;
  url: string;
  score?: number;
  descriptionMd?: string;
  summary: string;
  evaluation?: {
    verdict: string;
    strengths: string[];
    gaps: string[];
    evaluator: string;
    model?: string;
  };
}

interface ApiProfile {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  cvText: string;
  skills: string[];
  targetTitles: string[];
  countries: string[];
  isRemoteOk: boolean;
}

const EMPTY_PROFILE: ApiProfile = {
  fullName: '',
  headline: '',
  email: '',
  phone: '',
  cvText: '',
  skills: [],
  targetTitles: [],
  countries: [],
  isRemoteOk: true,
};

class CliError extends Error {}

function clip(text: string, width: number): string {
  return text.length <= width ? text.padEnd(width) : `${text.slice(0, width - 1)}…`;
}

function score(value: number | undefined): string {
  return value === undefined ? ' – ' : value.toFixed(1);
}

function place(job: ApiJob): string {
  if (job.isRemote) return job.location ? `Remote · ${job.location}` : 'Remote';
  return job.location ?? job.countryCode ?? '';
}

/**
 * Runs one CLI command against the app in-process, through the same routes the web UI calls, so
 * the terminal and the browser can never disagree. Returns the process exit code.
 */
export async function runCli(argv: string[], app: FastifyInstance, io: CliIo): Promise<number> {
  const call = async <T>(
    method: 'GET' | 'POST' | 'PUT',
    url: string,
    payload?: object,
  ): Promise<T> => {
    const response = await app.inject({ method, url, payload });
    const body = response.json<{ data?: T; error?: { message: string } } & T>();
    if (response.statusCode >= 400)
      throw new CliError(body.error?.message ?? `HTTP ${response.statusCode}`);
    return body;
  };

  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      search: { type: 'string' },
      country: { type: 'string' },
      remote: { type: 'boolean', default: false },
      min: { type: 'string' },
      newest: { type: 'boolean', default: false },
      limit: { type: 'string', default: '15' },
      scanned: { type: 'boolean', default: false },
      name: { type: 'string' },
      headline: { type: 'string' },
      email: { type: 'string' },
      phone: { type: 'string' },
      roles: { type: 'string' },
      skills: { type: 'string' },
      countries: { type: 'string' },
      'onsite-only': { type: 'boolean' },
    },
  });
  const [command = 'help', argument] = positionals;
  const need = (what: string): string => {
    if (!argument) throw new CliError(`This command needs ${what}. Run "./kazi help".`);
    return argument;
  };

  try {
    switch (command) {
      case 'help':
        io.out(HELP);
        return 0;

      case 'scan': {
        interface Scan {
          boardId: string;
          outcome: string;
          jobsFound: number;
          jobsNew: number;
          errorMessage?: string;
        }
        io.out(
          argument ? `Scanning ${argument}…` : 'Scanning every source. This takes about a minute…',
        );
        const scans = argument
          ? [
              (
                await call<{ data: Scan }>(
                  'POST',
                  `/v1/boards/${encodeURIComponent(argument)}/scan`,
                )
              ).data,
            ]
          : (await call<{ data: Scan[] }>('POST', '/v1/scans')).data;
        for (const scan of scans) {
          io.out(
            scan.outcome === 'ok'
              ? `  ${clip(scan.boardId, 28)} ${String(scan.jobsFound).padStart(4)} jobs  ${String(scan.jobsNew).padStart(4)} new`
              : `  ${clip(scan.boardId, 28)} failed: ${scan.errorMessage ?? 'unknown error'}`,
          );
        }
        const added = scans.reduce((total, scan) => total + scan.jobsNew, 0);
        const failed = scans.filter((scan) => scan.outcome !== 'ok').length;
        io.out(
          `\n${added} new jobs from ${scans.length - failed} sources${failed ? `; ${failed} did not answer` : ''}.`,
        );
        return 0;
      }

      case 'jobs': {
        const query = new URLSearchParams({
          sort: values.newest ? 'newest' : 'score',
          limit: values.limit,
        });
        if (values.search) query.set('search', values.search);
        if (values.country) query.set('country', values.country);
        if (values.remote) query.set('remote', 'true');
        if (values.min) query.set('minScore', values.min);
        const { data } = await call<{ data: ApiJob[] }>('GET', `/v1/jobs?${query.toString()}`);
        if (data.length === 0) {
          io.out('No jobs match. Run "./kazi scan" first, or loosen the filters.');
          return 0;
        }
        io.out(
          `${'FIT'.padEnd(4)} ${'TITLE'.padEnd(44)} ${'COMPANY'.padEnd(20)} ${'PLACE'.padEnd(24)} ID`,
        );
        for (const job of data) {
          io.out(
            `${score(job.score).padEnd(4)} ${clip(job.title, 44)} ${clip(job.company ?? '', 20)} ${clip(place(job), 24)} ${job.id}`,
          );
        }
        io.out(`\n${data.length} shown. See one with: ./kazi show <ID>`);
        return 0;
      }

      case 'show': {
        const { data: job } = await call<{ data: ApiJob }>(
          'GET',
          `/v1/jobs/${encodeURIComponent(need('a job id'))}`,
        );
        io.out(`${job.title}${job.company ? ` — ${job.company}` : ''}`);
        io.out(`${place(job) || 'Location not stated'}  ·  ${job.url}`);
        if (job.evaluation) {
          const by =
            job.evaluation.evaluator === 'ai'
              ? `assessed by ${job.evaluation.model ?? 'AI'}`
              : 'keyword score';
          io.out(`\nFit ${score(job.score)} of 5 (${by}): ${job.evaluation.verdict}`);
          for (const item of job.evaluation.strengths) io.out(`  + ${item}`);
          for (const item of job.evaluation.gaps) io.out(`  - ${item}`);
        } else {
          io.out(
            '\nNot scored yet. Create a profile to score jobs: ./kazi profile --name "Your Name" …',
          );
        }
        io.out(`\n${job.descriptionMd ?? job.summary}`);
        return 0;
      }

      case 'pack': {
        const { data } = await call<{ data: { pack: string } }>(
          'GET',
          `/v1/jobs/${encodeURIComponent(need('a job id'))}/application-pack`,
        );
        io.out(data.pack);
        return 0;
      }

      case 'track': {
        await call('POST', '/v1/applications', { jobId: need('a job id') });
        io.out('Saved to your tracker.');
        return 0;
      }

      case 'tracker': {
        interface Tracked {
          status: string;
          job: { title: string; company?: string; score?: number };
          jobId: string;
        }
        const { data } = await call<{ data: Tracked[] }>('GET', '/v1/applications');
        if (data.length === 0) {
          io.out('Nothing tracked yet. Save a job with: ./kazi track <ID>');
          return 0;
        }
        for (const item of data) {
          io.out(
            `${clip(item.status, 10)} ${score(item.job.score)}  ${clip(item.job.title, 44)} ${clip(item.job.company ?? '', 20)} ${item.jobId}`,
          );
        }
        return 0;
      }

      case 'boards': {
        interface ApiBoard {
          id: string;
          name: string;
          countries: string[];
          status: string;
          isScannable: boolean;
          jobCount: number;
        }
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
        io.out(
          `\n${shown.length} sources, ${shown.filter((board) => board.isScannable).length} scanned automatically.`,
        );
        return 0;
      }

      case 'md': {
        const { data } = await call<{ data: { markdown: string } }>('POST', '/v1/extract', {
          url: need('a web address'),
        });
        io.out(data.markdown);
        return 0;
      }

      case 'profile': {
        const list = (text: string) =>
          text
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
        const changes: Partial<ApiProfile> = {
          ...(values.name !== undefined && { fullName: values.name }),
          ...(values.headline !== undefined && { headline: values.headline }),
          ...(values.email !== undefined && { email: values.email }),
          ...(values.phone !== undefined && { phone: values.phone }),
          ...(values.roles !== undefined && { targetTitles: list(values.roles) }),
          ...(values.skills !== undefined && { skills: list(values.skills) }),
          ...(values.countries !== undefined && { countries: list(values.countries) }),
          ...(values['onsite-only'] !== undefined && { isRemoteOk: !values['onsite-only'] }),
        };
        let { data } = await call<{ data: ApiProfile | null }>('GET', '/v1/profile');
        if (Object.keys(changes).length > 0) {
          const saved = await call<{ data: ApiProfile; rescored: number }>('PUT', '/v1/profile', {
            ...EMPTY_PROFILE,
            ...data,
            ...changes,
          });
          data = saved.data;
          io.out(`Profile saved. ${saved.rescored} jobs re-scored.\n`);
        }
        if (!data) {
          io.out(
            'No profile yet. Create one with: ./kazi profile --name "Your Name" --roles "Job Title" --skills "A,B" --countries KE',
          );
          return 0;
        }
        io.out(`${data.fullName}${data.headline ? ` — ${data.headline}` : ''}`);
        io.out(
          `Contact:   ${[data.email, data.phone].filter(Boolean).join(' · ') || 'none given'}`,
        );
        io.out(`Roles:     ${data.targetTitles.join(', ') || 'none'}`);
        io.out(`Skills:    ${data.skills.join(', ') || 'none'}`);
        io.out(
          `Countries: ${data.countries.join(', ') || 'none'}${data.isRemoteOk ? ' · open to remote' : ''}`,
        );
        return 0;
      }

      default:
        throw new CliError(`Unknown command "${command}". Run "./kazi help".`);
    }
  } catch (error) {
    if (!(error instanceof CliError)) throw error;
    io.err(error.message);
    return 1;
  }
}
