CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key text PRIMARY KEY,
  count integer NOT NULL CHECK (count > 0),
  reset_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS rate_limit_buckets_reset_idx ON rate_limit_buckets(reset_at);

DELETE FROM rate_limit_buckets WHERE reset_at < now() - interval '24 hours';
