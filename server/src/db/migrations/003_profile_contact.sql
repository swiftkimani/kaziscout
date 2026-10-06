-- Application forms always ask for these, so the application pack needs them.
-- Empty by default: both are optional, and existing profiles stay valid.
ALTER TABLE profiles ADD COLUMN email TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN phone TEXT NOT NULL DEFAULT '';
