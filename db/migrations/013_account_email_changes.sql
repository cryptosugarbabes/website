CREATE TABLE IF NOT EXISTS account_email_challenges (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_email_challenges_user_idx
  ON account_email_challenges (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS account_email_challenges_expiry_idx
  ON account_email_challenges (expires_at)
  WHERE consumed_at IS NULL;
