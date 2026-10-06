import { buildApp } from './app.js';
import { loadBoards } from './boards/registry.js';
import { loadConfig } from './config.js';
import { migrate, openDb } from './db/client.js';

const config = loadConfig();
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
