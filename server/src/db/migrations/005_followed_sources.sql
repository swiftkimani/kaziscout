-- Purpose: employers a person chose to follow, on top of the registry shipped in boards.json.
-- The registry is shared and reviewed in the repository; these rows are one person's additions.
-- Expected size: tens of rows. Read on every scan and board listing; written when following.
CREATE TABLE followed_sources (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  url          TEXT NOT NULL,
  access_json  TEXT NOT NULL,
  created_at   TEXT NOT NULL
) STRICT;
