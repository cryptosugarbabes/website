ALTER TABLE users ALTER COLUMN wallet_address DROP NOT NULL;
ALTER TABLE users ALTER COLUMN wallet_chain DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (email) WHERE email IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_identity_present_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_identity_present_check
      CHECK (
        email IS NOT NULL
        OR (wallet_address IS NOT NULL AND wallet_chain IS NOT NULL)
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS email_auth_challenges (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_auth_challenges_email_idx
  ON email_auth_challenges (email, created_at DESC);
