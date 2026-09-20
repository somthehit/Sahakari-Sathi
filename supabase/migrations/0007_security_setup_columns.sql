-- First-Time Security Setup persistence
-- Marks whether a user completed the one-time security setup wizard
-- (mobile verification + security questions) so it never appears again.
-- Also tracks password-changed and first-login completed flags.
-- All new columns are nullable or carry safe defaults so existing rows remain valid.

ALTER TABLE org_users
  ADD COLUMN IF NOT EXISTS security_setup_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS security_setup_completed_at timestamp,
  ADD COLUMN IF NOT EXISTS mobile_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mobile_number varchar(20),
  ADD COLUMN IF NOT EXISTS security_questions_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS password_changed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_login_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS temporary_password boolean NOT NULL DEFAULT false;

-- Backfill: users who already completed security setup (security_score is 100)
-- must NOT see the wizard again.
UPDATE org_users
SET security_setup_completed = true,
    security_setup_completed_at = COALESCE(security_setup_completed_at, NOW()),
    mobile_verified = true,
    security_questions_completed = true,
    first_login_completed = true
WHERE security_score >= 100;

-- Backfill: users who already changed their temporary password
UPDATE org_users
SET password_changed = true
WHERE requires_password_change = false;

-- Backfill: mirror the temporary-password flag
UPDATE org_users
SET temporary_password = true
WHERE is_temporary_password = true;
