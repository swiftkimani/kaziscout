import { buildApp } from './app.js';
import { loadBoards } from './boards/registry.js';
import { runCli } from './cli.js';
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

const exitCode = await runCli(process.argv.slice(2), app, {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
});
await app.close();
db.close();
process.exitCode = exitCode;
