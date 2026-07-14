CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  wallet_address text NOT NULL,
  wallet_chain text NOT NULL CHECK (wallet_chain IN ('evm', 'solana')),
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wallet_chain, wallet_address)
);

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name varchar(80) NOT NULL,
  declared_age integer NOT NULL CHECK (declared_age BETWEEN 18 AND 99),
  city varchar(100) NOT NULL,
  country varchar(100) NOT NULL,
  headline varchar(90) NOT NULL,
  bio varchar(500) NOT NULL,
  interests text[] NOT NULL DEFAULT '{}',
  review_status text NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (review_status IN ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  rejection_reason text,
  reviewed_at timestamptz,
  messages_sent bigint NOT NULL DEFAULT 0,
  messages_received bigint NOT NULL DEFAULT 0,
  photo_likes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile_media (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  storage_key text NOT NULL UNIQUE,
  mime_type text NOT NULL DEFAULT 'image/webp',
  byte_size integer NOT NULL,
  is_approved boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_review_status_idx ON profiles(review_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS profile_media_profile_idx ON profile_media(profile_id, sort_order);

CREATE TABLE IF NOT EXISTS moderation_audit (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
