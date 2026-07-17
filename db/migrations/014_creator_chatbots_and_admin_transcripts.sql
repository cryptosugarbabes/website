ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS is_automated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS automation_source_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS automation_rule_label VARCHAR(80),
  ADD COLUMN IF NOT EXISTS automation_matched BOOLEAN;

CREATE UNIQUE INDEX IF NOT EXISTS messages_automation_source_unique
  ON messages (automation_source_message_id)
  WHERE automation_source_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS creator_bot_settings (
  creator_user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  disclosure_label VARCHAR(80) NOT NULL DEFAULT 'Automated assistant',
  fallback_response VARCHAR(800) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS creator_bot_rules (
  id UUID PRIMARY KEY,
  creator_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(80) NOT NULL,
  match_phrases TEXT[] NOT NULL,
  response VARCHAR(800) NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_bot_rules_creator_priority_idx
  ON creator_bot_rules (creator_user_id, priority, created_at);

CREATE TABLE IF NOT EXISTS admin_conversation_views (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  actor_email TEXT NOT NULL,
  reason VARCHAR(500) NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_conversation_views_conversation_idx
  ON admin_conversation_views (conversation_id, viewed_at DESC);

CREATE TABLE IF NOT EXISTS admin_bot_audit (
  id UUID PRIMARY KEY,
  creator_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_email TEXT NOT NULL,
  enabled BOOLEAN NOT NULL,
  rule_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_bot_audit_created_idx
  ON admin_bot_audit (created_at DESC);
