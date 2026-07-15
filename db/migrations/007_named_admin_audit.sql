ALTER TABLE moderation_audit
  ADD COLUMN IF NOT EXISTS actor_email text;

ALTER TABLE admin_user_audit
  ADD COLUMN IF NOT EXISTS actor_email text;

ALTER TABLE safety_reports
  ADD COLUMN IF NOT EXISTS reviewed_by text;
