ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_type text;

UPDATE users u
SET account_type = 'CREATOR'
WHERE account_type IS NULL
  AND EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = u.id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_account_type_check') THEN
    ALTER TABLE users
      ADD CONSTRAINT users_account_type_check
      CHECK (account_type IS NULL OR account_type IN ('CREATOR', 'CUSTOMER')) NOT VALID;
    ALTER TABLE users VALIDATE CONSTRAINT users_account_type_check;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS customer_profiles (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name varchar(80) NOT NULL,
  bio varchar(300) NOT NULL DEFAULT '',
  generosity_points bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, profile_id)
);

CREATE INDEX IF NOT EXISTS favorites_profile_idx ON favorites(profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY,
  customer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_user_id, creator_profile_id)
);

CREATE INDEX IF NOT EXISTS conversations_creator_idx ON conversations(creator_profile_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS conversations_customer_idx ON conversations(customer_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body varchar(800) NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 800),
  status text NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT', 'READ', 'MODERATED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS messages_sender_idx ON messages(sender_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_quotes (
  id uuid PRIMARY KEY,
  buyer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('PAID_LIKE', 'GIFT', 'MESSAGE_BOOST')),
  network text NOT NULL CHECK (network IN ('BASE', 'SOLANA')),
  gross_amount_usdc numeric(20, 6) NOT NULL CHECK (gross_amount_usdc > 0),
  creator_amount_usdc numeric(20, 6) NOT NULL CHECK (creator_amount_usdc >= 0),
  platform_amount_usdc numeric(20, 6) NOT NULL CHECK (platform_amount_usdc >= 0),
  status text NOT NULL DEFAULT 'QUOTED' CHECK (status IN ('QUOTED', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'EXPIRED')),
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_quotes_buyer_idx ON payment_quotes(buyer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_quotes_creator_idx ON payment_quotes(creator_profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_transactions (
  quote_id uuid NOT NULL REFERENCES payment_quotes(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('CREATOR', 'PLATFORM', 'ATOMIC')),
  transaction_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (quote_id, purpose)
);

CREATE TABLE IF NOT EXISTS support_events (
  id uuid PRIMARY KEY,
  quote_id uuid NOT NULL UNIQUE REFERENCES payment_quotes(id) ON DELETE RESTRICT,
  supporter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  creator_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('PAID_LIKE', 'GIFT', 'MESSAGE_BOOST')),
  gross_amount_usdc numeric(20, 6) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_events_creator_idx ON support_events(creator_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_events_supporter_idx ON support_events(supporter_user_id, created_at DESC);
