DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'support_events'
      AND column_name = 'recipient_seen_at'
  ) THEN
    ALTER TABLE support_events ADD COLUMN recipient_seen_at timestamptz;
    UPDATE support_events SET recipient_seen_at = created_at;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS support_events_unseen_recipient_idx
  ON support_events(creator_profile_id, created_at DESC)
  WHERE recipient_seen_at IS NULL;
