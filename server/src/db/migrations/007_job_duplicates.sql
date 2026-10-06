-- The same role is often posted on more than one board. match_key is the normalised title and
-- company, and duplicate_of points a later copy at the first one seen, so lists show the role once.
ALTER TABLE jobs ADD COLUMN match_key TEXT;
ALTER TABLE jobs ADD COLUMN duplicate_of TEXT REFERENCES jobs (id) ON DELETE SET NULL;

CREATE INDEX jobs_match_key_idx ON jobs (match_key) WHERE match_key IS NOT NULL;
CREATE INDEX jobs_duplicate_of_idx ON jobs (duplicate_of) WHERE duplicate_of IS NOT NULL;
