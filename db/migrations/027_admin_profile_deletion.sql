ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_reason varchar(500);

CREATE INDEX IF NOT EXISTS profiles_deleted_at_idx
  ON profiles(deleted_at)
  WHERE deleted_at IS NOT NULL;
