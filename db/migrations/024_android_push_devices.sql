CREATE TABLE IF NOT EXISTS app_push_devices (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('ANDROID')),
  app_version varchar(40) NOT NULL,
  enabled boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_push_devices_user_idx
  ON app_push_devices(user_id, enabled, last_seen_at DESC);
