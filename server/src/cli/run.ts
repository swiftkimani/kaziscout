import { parseArgs } from 'node:util';
import type { FastifyInstance } from 'fastify';
import { CLI_OPTIONS, CliError, type CliContext, type CliIo, type Command } from './context.js';
import { cv } from './cv-command.js';
import { HELP } from './help.js';
import { add, assess, jobs, pack, show, track, tracker } from './job-commands.js';
import { profile } from './profile-commands.js';
import { boards, markdown, scan } from './source-commands.js';

const COMMANDS: Readonly<Record<string, Command>> = {
  help: ({ io }) => Promise.resolve(io.out(HELP)),
  scan,
  jobs,
  add,
  show,
  assess,
  pack,
  track,
  tracker,
  boards,
  md: markdown,
  profile,
  cv,
};

/**
 * Runs one CLI command against the app in-process, through the same routes the web UI calls, so
 * the terminal and the browser can never disagree. Returns the process exit code.
 */
export async function runCli(argv: string[], app: FastifyInstance, io: CliIo): Promise<number> {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: CLI_OPTIONS,
  });
  const [name = 'help', argument] = positionals;

  const context: CliContext = {
    io,
    values,
    argument,
    need: (what) => {
      if (!argument) throw new CliError(`This command needs ${what}. Run "./kazi help".`);
      return argument;
    },
    call: async <T>(method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) => {
      const response = await app.inject({ method, url, payload });
      const body = response.json<T & { error?: { message: string } }>();
      if (response.statusCode >= 400) {
        throw new CliError(body.error?.message ?? `HTTP ${response.statusCode}`);
      }
      return body;
    },
  };

  try {
    const command = COMMANDS[name];
    if (!command) throw new CliError(`Unknown command "${name}". Run "./kazi help".`);
    await command(context);
    return 0;
  } catch (error) {
    // Anything that is not a message for the person is a bug and must surface as one.
    if (!(error instanceof CliError)) throw error;
    io.err(error.message);
    return 1;
  }
}
