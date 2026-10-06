import type { Board, BoardAccess } from '../boards/registry.js';
import type { Db } from '../db/client.js';

export class FollowedSourceRepository {
  constructor(private readonly db: Db) {}

  list(): Board[] {
    return this.db
      .prepare('SELECT id, name, url, access_json, created_at FROM followed_sources ORDER BY name')
      .all()
      .map((row) => ({
        id: String(row.id),
        name: String(row.name),
        url: String(row.url),
        countries: ['REMOTE'],
        category: 'employer' as const,
        language: 'en' as const,
        access: JSON.parse(String(row.access_json)) as BoardAccess,
        status: 'live' as const,
        checkedAt: String(row.created_at).slice(0, 10),
        note: 'An employer you chose to follow.',
      }));
  }

  /** Saves a followed employer. Following the same one twice changes nothing. */
  add(board: Board, now: Date): void {
    this.db
      .prepare(
        `INSERT INTO followed_sources (id, name, url, access_json, created_at)
         VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
      )
      .run(board.id, board.name, board.url, JSON.stringify(board.access), now.toISOString());
  }

  remove(id: string): boolean {
    return this.db.prepare('DELETE FROM followed_sources WHERE id = ?').run(id).changes > 0;
  }
}
