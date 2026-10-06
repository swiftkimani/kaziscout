-- Purpose: one row per job posting discovered on a board, plus its latest evaluation.
CREATE TABLE jobs (
  id              TEXT PRIMARY KEY,
  board_id        TEXT NOT NULL,
  external_id     TEXT NOT NULL,
  title           TEXT NOT NULL,
  company         TEXT,
  location        TEXT,
  country_code    TEXT,
  is_remote       INTEGER NOT NULL DEFAULT 0 CHECK (is_remote IN (0, 1)),
  url             TEXT NOT NULL,
  summary         TEXT NOT NULL DEFAULT '',
  description_md  TEXT,
  posted_at       TEXT,
  first_seen_at   TEXT NOT NULL,
  last_seen_at    TEXT NOT NULL,
  -- listed_at is posted_at when the board gives one, otherwise first_seen_at; it is the sort key.
  listed_at       TEXT NOT NULL,
  score           REAL CHECK (score IS NULL OR (score >= 1 AND score <= 5)),
  evaluation_json TEXT,
  evaluated_at    TEXT,
  UNIQUE (board_id, external_id)
) STRICT;

CREATE INDEX jobs_listed_at_idx ON jobs (listed_at DESC, id DESC);
CREATE INDEX jobs_score_idx ON jobs (score DESC, id DESC);
CREATE INDEX jobs_board_id_idx ON jobs (board_id);
CREATE INDEX jobs_country_code_idx ON jobs (country_code);

-- Purpose: the user's progress on a job they chose to pursue (one per job).
CREATE TABLE applications (
  id          INTEGER PRIMARY KEY,
  job_id      TEXT NOT NULL UNIQUE REFERENCES jobs (id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'saved'
              CHECK (status IN ('saved', 'applied', 'interview', 'offer', 'rejected', 'withdrawn')),
  notes       TEXT NOT NULL DEFAULT '',
  applied_at  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
) STRICT;

CREATE INDEX applications_status_idx ON applications (status);

-- Purpose: the single job-seeker profile that jobs are scored against.
CREATE TABLE profiles (
  id                  INTEGER PRIMARY KEY CHECK (id = 1),
  full_name           TEXT NOT NULL DEFAULT '',
  headline            TEXT NOT NULL DEFAULT '',
  cv_text             TEXT NOT NULL DEFAULT '',
  skills_json         TEXT NOT NULL DEFAULT '[]',
  target_titles_json  TEXT NOT NULL DEFAULT '[]',
  countries_json      TEXT NOT NULL DEFAULT '[]',
  is_remote_ok        INTEGER NOT NULL DEFAULT 1 CHECK (is_remote_ok IN (0, 1)),
  updated_at          TEXT NOT NULL
) STRICT;

-- Purpose: history of board scans, so the UI can show when a board last worked and why it failed.
CREATE TABLE board_scans (
  id             INTEGER PRIMARY KEY,
  board_id       TEXT NOT NULL,
  started_at     TEXT NOT NULL,
  duration_ms    INTEGER NOT NULL,
  outcome        TEXT NOT NULL CHECK (outcome IN ('ok', 'error')),
  jobs_found     INTEGER NOT NULL DEFAULT 0,
  jobs_new       INTEGER NOT NULL DEFAULT 0,
  error_message  TEXT
) STRICT;

CREATE INDEX board_scans_board_id_idx ON board_scans (board_id, started_at DESC);
