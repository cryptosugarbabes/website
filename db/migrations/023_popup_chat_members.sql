ALTER TABLE visitor_chat_sessions
  ADD COLUMN IF NOT EXISTS member_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS member_linked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS visitor_chat_sessions_member_idx
  ON visitor_chat_sessions (member_user_id, last_seen_at DESC)
  WHERE member_user_id IS NOT NULL;
