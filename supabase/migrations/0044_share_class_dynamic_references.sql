-- =============================================================
-- 0044: Add share_type + target_member_type columns to share_classes
--   These columns were defined in the Drizzle schema but never
--   created via a migration. The table was originally created
--   in 0025 without them.
-- =============================================================

ALTER TABLE "share_classes"
  ADD COLUMN IF NOT EXISTS "share_type" text NOT NULL DEFAULT 'ORDINARY';

ALTER TABLE "share_classes"
  ADD COLUMN IF NOT EXISTS "target_member_type" text NOT NULL DEFAULT 'ALL';
