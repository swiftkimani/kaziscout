-- Purpose: the cover letter and tailored CV an AI model wrote for one job (one set per job).
-- Kept apart from applications because documents can exist before a job is saved to the tracker.
CREATE TABLE application_documents (
  job_id           TEXT PRIMARY KEY REFERENCES jobs (id) ON DELETE CASCADE,
  cover_letter_md  TEXT NOT NULL,
  cv_md            TEXT NOT NULL,
  model            TEXT NOT NULL,
  created_at       TEXT NOT NULL
) STRICT;
