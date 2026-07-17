CREATE TABLE IF NOT EXISTS visitor_chat_sessions (
  id UUID PRIMARY KEY,
  status VARCHAR(16) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  page_path VARCHAR(500) NOT NULL DEFAULT '/',
  ip_hash VARCHAR(64) NOT NULL,
  user_agent VARCHAR(500),
  presence_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visitor_chat_sessions_recent_idx
  ON visitor_chat_sessions (last_seen_at DESC);

CREATE INDEX IF NOT EXISTS visitor_chat_sessions_ip_idx
  ON visitor_chat_sessions (ip_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS visitor_chat_messages (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES visitor_chat_sessions(id) ON DELETE CASCADE,
  sender VARCHAR(16) NOT NULL CHECK (sender IN ('VISITOR', 'ADMIN')),
  body VARCHAR(800) NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 800),
  body_ciphertext TEXT,
  body_iv VARCHAR(64),
  body_tag VARCHAR(64),
  admin_actor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visitor_chat_messages_session_idx
  ON visitor_chat_messages (session_id, created_at);

CREATE TABLE IF NOT EXISTS visitor_chat_telegram_links (
  telegram_chat_id BIGINT NOT NULL,
  bot_message_id BIGINT NOT NULL,
  visitor_session_id UUID NOT NULL REFERENCES visitor_chat_sessions(id) ON DELETE CASCADE,
  source_message_id UUID REFERENCES visitor_chat_messages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (telegram_chat_id, bot_message_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS visitor_chat_telegram_source_unique
  ON visitor_chat_telegram_links (source_message_id)
  WHERE source_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS visitor_telegram_webhook_updates (
  update_id BIGINT PRIMARY KEY,
  telegram_chat_id BIGINT NOT NULL,
  telegram_message_id BIGINT NOT NULL,
  visitor_message_id UUID NOT NULL UNIQUE REFERENCES visitor_chat_messages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (telegram_chat_id, telegram_message_id)
);

CREATE TABLE IF NOT EXISTS visitor_chat_admin_views (
  id UUID PRIMARY KEY,
  visitor_session_id UUID NOT NULL REFERENCES visitor_chat_sessions(id) ON DELETE CASCADE,
  actor_email TEXT NOT NULL,
  reason VARCHAR(500) NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visitor_chat_admin_views_session_idx
  ON visitor_chat_admin_views (visitor_session_id, viewed_at DESC);
