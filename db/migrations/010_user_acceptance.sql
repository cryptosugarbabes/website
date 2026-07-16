ALTER TABLE users
  ADD COLUMN IF NOT EXISTS adult_attested_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version varchar(32),
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_version varchar(32);

CREATE INDEX IF NOT EXISTS users_acceptance_pending_idx
  ON users(created_at DESC)
  WHERE adult_attested_at IS NULL
     OR terms_accepted_at IS NULL
     OR privacy_accepted_at IS NULL;
