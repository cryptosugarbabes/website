ALTER TABLE profile_media
  ADD COLUMN IF NOT EXISTS paid_likes bigint NOT NULL DEFAULT 0;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS boost_amount_usdc numeric(20, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS boosted_at timestamptz,
  ADD COLUMN IF NOT EXISTS body_ciphertext text,
  ADD COLUMN IF NOT EXISTS body_iv varchar(32),
  ADD COLUMN IF NOT EXISTS body_tag varchar(32),
  ADD COLUMN IF NOT EXISTS body_hash varchar(64);

ALTER TABLE payment_quotes
  ADD COLUMN IF NOT EXISTS message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS media_id uuid REFERENCES profile_media(id) ON DELETE SET NULL;

ALTER TABLE support_events
  ADD COLUMN IF NOT EXISTS message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS media_id uuid REFERENCES profile_media(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS payment_quotes_message_idx ON payment_quotes(message_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_quotes_media_idx ON payment_quotes(media_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_events_message_idx ON support_events(message_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_events_media_idx ON support_events(media_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_body_hash_idx ON messages(sender_user_id, body_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_user_id, blocked_user_id),
  CHECK (blocker_user_id <> blocked_user_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON user_blocks(blocked_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS safety_reports (
  id uuid PRIMARY KEY,
  reporter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reported_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('HARASSMENT', 'SPAM', 'SCAM', 'EXTORTION', 'UNDERAGE', 'TRAFFICKING', 'IMPERSONATION', 'OTHER')),
  details varchar(1500) NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED')),
  admin_note varchar(1500),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS safety_reports_status_idx ON safety_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS safety_reports_reported_idx ON safety_reports(reported_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS auth_challenges (
  nonce varchar(64) PRIMARY KEY,
  wallet_chain text NOT NULL CHECK (wallet_chain IN ('evm', 'solana')),
  wallet_address text NOT NULL,
  message_hash varchar(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_challenges_expiry_idx ON auth_challenges(expires_at);
