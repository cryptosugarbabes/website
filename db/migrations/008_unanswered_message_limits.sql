ALTER TABLE payment_quotes
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL;

ALTER TABLE payment_quotes DROP CONSTRAINT IF EXISTS payment_quotes_kind_check;
ALTER TABLE payment_quotes
  ADD CONSTRAINT payment_quotes_kind_check
  CHECK (kind IN ('PAID_LIKE', 'GIFT', 'MESSAGE_BOOST', 'MESSAGE_UNLOCK'));

CREATE INDEX IF NOT EXISTS payment_quotes_conversation_idx
  ON payment_quotes(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS message_unlocks (
  id uuid PRIMARY KEY,
  quote_id uuid NOT NULL UNIQUE REFERENCES payment_quotes(id) ON DELETE RESTRICT,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  used_message_id uuid UNIQUE REFERENCES messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS message_unlocks_sender_week_idx
  ON message_unlocks(conversation_id, sender_user_id, created_at DESC);

