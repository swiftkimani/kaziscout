import { loadConfig } from '../config.js';
import { migrate, openDb } from './client.js';

const config = loadConfig();
const db = openDb(config.DATABASE_PATH);
const applied = migrate(db);
db.close();

process.stdout.write(
  applied.length > 0
    ? `Applied ${applied.length} migration(s): ${applied.join(', ')}\n`
    : 'Database is already up to date.\n',
);
