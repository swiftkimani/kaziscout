-- When a posting stops taking applications, where the source or the posting text says so.
-- Nullable: most postings state no deadline.
ALTER TABLE jobs ADD COLUMN closes_at TEXT;

CREATE INDEX jobs_closes_at_idx ON jobs (closes_at) WHERE closes_at IS NOT NULL;
