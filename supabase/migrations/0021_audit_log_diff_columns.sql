-- =============================================================
-- 0021: audit_logs old/new JSONB diff columns
-- The drizzle schema (src/db/schema/operations.ts) selects/writes
-- old_value + new_value for structured field-level audit diffs.
-- 0003_lethal_selene.sql declared these ALTERs but they were never
-- applied to the live DB, so master-data SELECTs and writeAuditLog
-- inserts failed against audit_logs.
-- =============================================================

ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "old_value" jsonb,
  ADD COLUMN IF NOT EXISTS "new_value" jsonb;
