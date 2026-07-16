ALTER TABLE profile_media
  ADD COLUMN IF NOT EXISTS focal_x smallint NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS focal_y smallint NOT NULL DEFAULT 50;

UPDATE profile_media
SET focal_x = LEAST(100, GREATEST(0, focal_x)),
    focal_y = LEAST(100, GREATEST(0, focal_y));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profile_media_focal_x_range'
  ) THEN
    ALTER TABLE profile_media
      ADD CONSTRAINT profile_media_focal_x_range CHECK (focal_x BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profile_media_focal_y_range'
  ) THEN
    ALTER TABLE profile_media
      ADD CONSTRAINT profile_media_focal_y_range CHECK (focal_y BETWEEN 0 AND 100);
  END IF;
END $$;
