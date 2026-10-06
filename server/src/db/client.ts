import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

export type Db = DatabaseSync;

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

/** Opens the SQLite database, creating its folder if needed. Use ':memory:' in tests. */
export function openDb(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  return db;
}

/** Applies every migration that has not run yet, in filename order. Returns the ones applied. */
export function migrate(db: Db): string[] {
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL) STRICT',
  );
  const applied = new Set(
    db
      .prepare('SELECT name FROM schema_migrations')
      .all()
      .map((row) => String(row.name)),
  );
  const pending = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql') && !applied.has(name))
    .sort();

  for (const name of pending) {
    const sql = readFileSync(join(migrationsDir, name), 'utf8');
    runInTransaction(db, () => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(
        name,
        new Date().toISOString(),
      );
    });
  }
  return pending;
}

/** Runs `work` inside a transaction, rolling back if it throws. */
export function runInTransaction<T>(db: Db, work: () => T): T {
  db.exec('BEGIN');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
