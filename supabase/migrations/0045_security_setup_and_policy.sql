-- 0045: Security setup persistence + organization security policy
-- ---------------------------------------------------------------------
-- Two related gaps are closed here.
--
-- 1. security_questions / user_security_answers were declared in the Drizzle
--    schema (src/db/schema/auth.ts) but NEVER created by any migration, so the
--    Security Setup Wizard had nowhere to write. It collected a mobile number
--    and two question/answer pairs, discarded the answers, and still set
--    org_users.security_questions_completed = true and security_score = 100.
--    Account recovery via security questions could therefore never work, and
--    the DB actively claimed otherwise. Both tables are created here and the
--    false completion flag is corrected below.
--
-- 2. organization_security_settings — the org-wide password / session /
--    access policy edited on SETUPS -> Admin -> Security. Previously the whole
--    form was component useState with a toast-only save, so nothing was
--    persisted or enforced anywhere.
--
--    Enforcement status of each column is recorded in its comment. Columns
--    marked NOT ENFORCED are stored for the operator's intent but are not yet
--    applied at runtime, because doing so requires infrastructure that does
--    not exist in this codebase (an OTP delivery channel for 2FA) or would
--    risk locking a tenant out of its own installation (IP allow-listing
--    behind a proxy, where req.ip is the proxy address unless TRUST_PROXY is
--    configured). The UI labels them accordingly rather than implying they are
--    active.
--
-- Additive and idempotent: safe to re-run.
-- ---------------------------------------------------------------------

-- =====================================================================
-- 1. Security questions (global catalogue + per-org additions)
-- =====================================================================
CREATE TABLE IF NOT EXISTS security_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL organization_id = global question offered to every tenant.
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_questions_org
  ON security_questions (organization_id);

-- One row per (org, question) so re-running the seed cannot duplicate the
-- catalogue. A partial unique index handles the global rows, whose
-- organization_id is NULL and therefore not covered by a plain UNIQUE.
CREATE UNIQUE INDEX IF NOT EXISTS uq_security_questions_global
  ON security_questions (question_text)
  WHERE organization_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_security_questions_org
  ON security_questions (organization_id, question_text)
  WHERE organization_id IS NOT NULL;

-- Seed the global catalogue. These are the six questions that were previously
-- hardcoded in the wizard component (SECURITY_QUESTIONS), moved server-side so
-- an answer row can reference a real question_id.
INSERT INTO security_questions (organization_id, question_text)
VALUES
  (NULL, 'What was the name of your first pet?'),
  (NULL, 'In what city were you born?'),
  (NULL, 'What is your mother''s maiden name?'),
  (NULL, 'What high school did you attend?'),
  (NULL, 'What was the make of your first car?'),
  (NULL, 'What is your favorite book?')
ON CONFLICT DO NOTHING;

-- =====================================================================
-- 2. User security answers
-- =====================================================================
-- encrypted_answer holds a salted scrypt digest in the form
--   scrypt$<N>$<r>$<p>$<saltHex>$<digestHex>
-- Answers are verified, never displayed, so a one-way KDF is correct here;
-- the column name is retained from the original schema declaration.
CREATE TABLE IF NOT EXISTS user_security_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES org_users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES security_questions(id) ON DELETE CASCADE,
  encrypted_answer text NOT NULL,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_security_answers_user
  ON user_security_answers (user_id);

-- A user answers any given question at most once.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_security_answers_user_question
  ON user_security_answers (user_id, question_id);

-- Correct the false claim described in the header: any user flagged as having
-- completed security questions but with zero stored answers had those answers
-- silently dropped. Clearing the flag makes the DB honest. It does NOT force
-- the whole wizard again -- security_setup_completed is left untouched, so
-- these users are not re-gated on login; the questions step is simply no
-- longer recorded as done.
UPDATE org_users u
SET security_questions_completed = false,
    -- security_score was hardcoded to 100 by the same code path; drop the
    -- questions component (25 points) so the score reflects reality.
    security_score = GREATEST(0, LEAST(u.security_score, 100) - 25),
    updated_at = NOW()
WHERE u.security_questions_completed = true
  AND NOT EXISTS (
    SELECT 1 FROM user_security_answers a WHERE a.user_id = u.id
  );

-- =====================================================================
-- 3. Organization security policy
-- =====================================================================
CREATE TABLE IF NOT EXISTS organization_security_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,

  -- Password policy: ENFORCED in AuthController.changePassword.
  min_password_length integer NOT NULL DEFAULT 8,
  require_special_char boolean NOT NULL DEFAULT true,
  require_number boolean NOT NULL DEFAULT true,
  require_uppercase boolean NOT NULL DEFAULT true,
  require_lowercase boolean NOT NULL DEFAULT true,
  -- 0 = passwords never expire. ENFORCED: sets org_users.password_expires_at
  -- on password change.
  password_expiry_days integer NOT NULL DEFAULT 90,

  -- Session policy: ENFORCED client-side as an idle timeout.
  -- 0 = no idle timeout.
  session_timeout_minutes integer NOT NULL DEFAULT 15,

  -- NOT ENFORCED (stored intent only): no OTP/TOTP delivery channel exists in
  -- this codebase, so turning this on cannot gate a login. Enforcing it would
  -- lock every user out.
  enforce_2fa boolean NOT NULL DEFAULT false,

  -- NOT ENFORCED (stored intent only): behind a proxy req.ip is the proxy
  -- address unless TRUST_PROXY is set, so an allow-list check would either
  -- pass everything or lock the tenant out of its own installation.
  ip_whitelist text,
  ip_whitelist_enabled boolean NOT NULL DEFAULT false,

  updated_by uuid,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_security_settings_org
  ON organization_security_settings (organization_id);
