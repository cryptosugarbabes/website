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
