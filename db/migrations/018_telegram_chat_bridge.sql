CREATE TABLE IF NOT EXISTS telegram_message_links (
  telegram_chat_id BIGINT NOT NULL,
  bot_message_id BIGINT NOT NULL,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  website_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (telegram_chat_id, bot_message_id),
  UNIQUE (source_message_id)
);

CREATE INDEX IF NOT EXISTS telegram_message_links_conversation_idx
  ON telegram_message_links (conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS telegram_webhook_updates (
  update_id BIGINT PRIMARY KEY,
  telegram_chat_id BIGINT NOT NULL,
  telegram_message_id BIGINT NOT NULL,
  site_message_id UUID NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (telegram_chat_id, telegram_message_id)
);

CREATE TABLE IF NOT EXISTS telegram_access_sessions (
  telegram_chat_id BIGINT PRIMARY KEY,
  authenticated_at TIMESTAMPTZ NOT NULL DEFAULT to_timestamp(0),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT to_timestamp(0),
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
