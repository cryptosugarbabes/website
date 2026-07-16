DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'moderation_reviewed_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN moderation_reviewed_at timestamptz;
    UPDATE profiles
    SET moderation_reviewed_at = reviewed_at
    WHERE review_status IN ('APPROVED', 'REJECTED') AND reviewed_at IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profile_media' AND column_name = 'moderation_reviewed_at'
  ) THEN
    ALTER TABLE profile_media ADD COLUMN moderation_reviewed_at timestamptz;
    UPDATE profile_media SET moderation_reviewed_at = now() WHERE is_approved = TRUE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE name = '009_auto_publish_existing_pending') THEN
    UPDATE profile_media AS media
    SET is_approved = TRUE,
        moderation_reviewed_at = NULL
    FROM profiles AS profile
    WHERE media.profile_id = profile.id
      AND profile.review_status = 'PENDING_REVIEW';

    UPDATE profiles
    SET review_status = 'APPROVED',
        rejection_reason = NULL,
        reviewed_at = now(),
        moderation_reviewed_at = NULL,
        updated_at = now()
    WHERE review_status = 'PENDING_REVIEW';

    INSERT INTO schema_migrations (name) VALUES ('009_auto_publish_existing_pending');
  END IF;
END $$;
