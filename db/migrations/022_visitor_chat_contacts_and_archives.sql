ALTER TABLE visitor_chat_sessions
  ADD COLUMN IF NOT EXISTS visitor_email VARCHAR(254),
  ADD COLUMN IF NOT EXISTS visitor_email_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by TEXT;

CREATE INDEX IF NOT EXISTS visitor_chat_sessions_archive_idx
  ON visitor_chat_sessions (archived_at, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS visitor_chat_archive_events (
  id UUID PRIMARY KEY,
  visitor_session_id UUID NOT NULL REFERENCES visitor_chat_sessions(id) ON DELETE CASCADE,
  action VARCHAR(16) NOT NULL CHECK (action IN ('ARCHIVE', 'RESTORE', 'AUTO_RESTORE')),
  actor_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visitor_chat_archive_events_session_idx
  ON visitor_chat_archive_events (visitor_session_id, created_at DESC);
