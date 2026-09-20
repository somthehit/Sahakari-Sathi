-- =============================================================
-- 0017: Branch scope — active branch context per org user
-- Adds org_users.active_branch_id (no FK — mirrors branch_id,
-- which deliberately avoids a branches <-> auth schema cycle).
-- =============================================================

ALTER TABLE org_users
  ADD COLUMN IF NOT EXISTS active_branch_id uuid;
