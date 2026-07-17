CREATE TABLE IF NOT EXISTS forum_moderation_audit (
  id UUID PRIMARY KEY,
  topic_id UUID REFERENCES forum_topics(id) ON DELETE SET NULL,
  post_id UUID REFERENCES forum_posts(id) ON DELETE SET NULL,
  action VARCHAR(32) NOT NULL CHECK (action IN (
    'PIN_TOPIC',
    'UNPIN_TOPIC',
    'LOCK_TOPIC',
    'UNLOCK_TOPIC',
    'HIDE_TOPIC',
    'RESTORE_TOPIC',
    'HIDE_POST',
    'RESTORE_POST'
  )),
  reason VARCHAR(500),
  actor_email VARCHAR(320) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forum_moderation_audit_created_idx
  ON forum_moderation_audit (created_at DESC);

CREATE INDEX IF NOT EXISTS forum_moderation_audit_topic_idx
  ON forum_moderation_audit (topic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS forum_moderation_audit_post_idx
  ON forum_moderation_audit (post_id, created_at DESC);
