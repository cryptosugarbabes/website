CREATE TABLE IF NOT EXISTS product_events (
  id uuid PRIMARY KEY,
  event_name varchar(40) NOT NULL CHECK (event_name IN ('PAGE_VIEW', 'SIGN_IN_OPENED', 'PROFILE_VIEWED')),
  page_path varchar(300) NOT NULL DEFAULT '/',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_events_name_created_idx
  ON product_events (event_name, created_at DESC);

CREATE TABLE IF NOT EXISTS application_errors (
  id uuid PRIMARY KEY,
  scope varchar(160) NOT NULL,
  error_hash char(64) NOT NULL,
  message varchar(500) NOT NULL,
  occurrences bigint NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, error_hash)
);

CREATE INDEX IF NOT EXISTS application_errors_last_seen_idx
  ON application_errors (last_seen_at DESC);
