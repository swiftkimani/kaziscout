-- Set when the person dismisses a job during triage. Hidden jobs stay stored, so a later scan
-- does not bring them back, but they leave every default list.
ALTER TABLE jobs ADD COLUMN hidden_at TEXT;
