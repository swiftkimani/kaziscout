import type { Db } from '../db/client.js';
import type { Profile } from '../scoring/types.js';

function parseList(value: unknown): string[] {
  const parsed: unknown = JSON.parse(String(value));
  return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
}

export class ProfileRepository {
  constructor(private readonly db: Db) {}

  /** Returns the saved profile, or undefined before the user has filled one in. */
  get(): (Profile & { updatedAt: string }) | undefined {
    const row = this.db
      .prepare(
        `SELECT full_name, email, phone, headline, cv_text, skills_json, target_titles_json, countries_json,
                is_remote_ok, updated_at
         FROM profiles WHERE id = 1`,
      )
      .get();
    if (!row) return undefined;
    return {
      fullName: String(row.full_name),
      email: String(row.email),
      phone: String(row.phone),
      headline: String(row.headline),
      cvText: String(row.cv_text),
      skills: parseList(row.skills_json),
      targetTitles: parseList(row.target_titles_json),
      countries: parseList(row.countries_json),
      isRemoteOk: row.is_remote_ok === 1,
      updatedAt: String(row.updated_at),
    };
  }

  save(profile: Profile, now: Date): void {
    this.db
      .prepare(
        `INSERT INTO profiles (id, full_name, email, phone, headline, cv_text, skills_json,
           target_titles_json, countries_json, is_remote_ok, updated_at)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           full_name = excluded.full_name, email = excluded.email, phone = excluded.phone,
           headline = excluded.headline,
           cv_text = excluded.cv_text, skills_json = excluded.skills_json,
           target_titles_json = excluded.target_titles_json,
           countries_json = excluded.countries_json, is_remote_ok = excluded.is_remote_ok,
           updated_at = excluded.updated_at`,
      )
      .run(
        profile.fullName,
        profile.email,
        profile.phone,
        profile.headline,
        profile.cvText,
        JSON.stringify(profile.skills),
        JSON.stringify(profile.targetTitles),
        JSON.stringify(profile.countries),
        profile.isRemoteOk ? 1 : 0,
        now.toISOString(),
      );
  }
}
