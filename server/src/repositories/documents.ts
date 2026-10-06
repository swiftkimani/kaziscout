import type { Db } from '../db/client.js';

export interface ApplicationDocuments {
  jobId: string;
  coverLetterMd: string;
  cvMd: string;
  model: string;
  createdAt: string;
}

export class DocumentRepository {
  constructor(private readonly db: Db) {}

  findByJobId(jobId: string): ApplicationDocuments | undefined {
    const row = this.db
      .prepare(
        `SELECT job_id, cover_letter_md, cv_md, model, created_at
         FROM application_documents WHERE job_id = ?`,
      )
      .get(jobId);
    if (!row) return undefined;
    return {
      jobId: String(row.job_id),
      coverLetterMd: String(row.cover_letter_md),
      cvMd: String(row.cv_md),
      model: String(row.model),
      createdAt: String(row.created_at),
    };
  }

  /** Stores the documents for a job, replacing any written earlier. */
  save(documents: Omit<ApplicationDocuments, 'createdAt'>, now: Date): void {
    this.db
      .prepare(
        `INSERT INTO application_documents (job_id, cover_letter_md, cv_md, model, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (job_id) DO UPDATE SET
           cover_letter_md = excluded.cover_letter_md, cv_md = excluded.cv_md,
           model = excluded.model, created_at = excluded.created_at`,
      )
      .run(
        documents.jobId,
        documents.coverLetterMd,
        documents.cvMd,
        documents.model,
        now.toISOString(),
      );
  }
}
