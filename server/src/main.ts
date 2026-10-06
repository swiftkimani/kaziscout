import { buildApp } from './app.js';
import { loadBoards } from './boards/registry.js';
import { loadConfig } from './config.js';
import { migrate, openDb } from './db/client.js';

const config = loadConfig();

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);
if (!LOOPBACK_HOSTS.has(config.HOST) && !config.ACCESS_TOKEN) {
  // Without a token anyone who can reach the port could read the CV and run scans.
  throw new Error(
    `Refusing to listen on ${config.HOST} without ACCESS_TOKEN. Set ACCESS_TOKEN (16+ characters) or use HOST=127.0.0.1.`,
  );
}

const db = openDb(config.DATABASE_PATH);
migrate(db);

const app = await buildApp({ config, db, boards: loadBoards() });

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  db.close();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ port: config.PORT, host: config.HOST });
