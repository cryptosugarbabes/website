CREATE TABLE IF NOT EXISTS admin_message_alert_settings (
  monitored_user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_message_alert_audit (
  id UUID PRIMARY KEY,
  monitored_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_email TEXT NOT NULL,
  enabled BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DELETE FROM messages WHERE is_automated = TRUE;

DROP INDEX IF EXISTS messages_automation_source_unique;

ALTER TABLE messages
  DROP COLUMN IF EXISTS automation_source_message_id,
  DROP COLUMN IF EXISTS automation_rule_label,
  DROP COLUMN IF EXISTS automation_matched,
  DROP COLUMN IF EXISTS is_automated;

DROP TABLE IF EXISTS admin_bot_audit;
DROP TABLE IF EXISTS creator_bot_rules;
DROP TABLE IF EXISTS creator_bot_settings;
