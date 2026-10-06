import { createInterface } from 'node:readline/promises';
import { buildApp } from './app.js';
import { loadBoards } from './boards/registry.js';
import { runCli } from './cli/run.js';
import { loadConfig } from './config.js';
import { migrate, openDb } from './db/client.js';

// Settings are optional, so a missing .env is normal and not worth a warning on every command.
try {
  process.loadEnvFile('../.env');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

// The terminal shows results, not request logs. The access token guards the network port,
// which the CLI never opens, so it is not applied to these in-process calls.
const config = loadConfig({
  ...process.env,
  LOG_LEVEL: 'silent',
  ACCESS_TOKEN: '',
  SCAN_INTERVAL_MINUTES: '0',
});
const db = openDb(config.DATABASE_PATH);
migrate(db);
const app = await buildApp({ config, db, boards: loadBoards() });

// Questions are only asked when a person is at the keyboard; scripts and AI tools get a list.
const prompt = process.stdin.isTTY
  ? createInterface({ input: process.stdin, output: process.stdout })
  : undefined;

const exitCode = await runCli(process.argv.slice(2), app, {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
  ask: prompt ? (question) => prompt.question(question) : undefined,
});
prompt?.close();
await app.close();
db.close();
process.exitCode = exitCode;
