ALTER TABLE users
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspension_reason varchar(500),
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;

UPDATE users SET status = 'ACTIVE' WHERE status IS NULL OR status NOT IN ('ACTIVE', 'SUSPENDED');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check') THEN
    ALTER TABLE users
      ADD CONSTRAINT users_status_check
      CHECK (status IN ('ACTIVE', 'SUSPENDED')) NOT VALID;
    ALTER TABLE users VALIDATE CONSTRAINT users_status_check;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_status_idx ON users(status, created_at DESC);
CREATE INDEX IF NOT EXISTS users_deletion_requested_idx
  ON users(deletion_requested_at DESC)
  WHERE deletion_requested_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS admin_user_audit (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('SUSPEND', 'RESTORE', 'NOTE_DELETION_REQUEST', 'CLEAR_DELETION_REQUEST')),
  note varchar(1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_user_audit_created_idx ON admin_user_audit(created_at DESC);

DELETE FROM email_auth_challenges
WHERE expires_at < now() - interval '24 hours';
