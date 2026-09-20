-- Migration: 0036_audit_deletion_logs.sql
-- Immutable, append-only trail for HARD deletes (Members / Savings Accounts).
--
-- Every hard delete archives a full JSON snapshot of the deleted entity and
-- its linked financial records BEFORE the rows are removed, inside the same
-- transaction. Once written, a row is IMMUTABLE:
--   - ON DELETE ... DO INSTEAD NOTHING   → cannot be removed
--   - ON UPDATE ... DO INSTEAD NOTHING   → cannot be altered
-- RULES fire before triggers regardless of client (app, SQL editor, pgAdmin),
-- so this holds at the database level, not just in application code.

CREATE TABLE IF NOT EXISTS "public"."audit_deletion_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "public"."organizations"("id") ON DELETE CASCADE,
  "entity_type" text NOT NULL CHECK ("entity_type" IN ('MEMBER', 'SAVINGS_ACCOUNT', 'USER')),
  "entity_id" uuid NOT NULL,
  "entity_code" text,
  "deleted_by_user_id" uuid NOT NULL,
  "deleted_by_user_name" text NOT NULL,
  "deleted_by_user_role" text,
  "deletion_reason" text NOT NULL,
  "snapshot_data" jsonb NOT NULL,
  "ip_address" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "audit_deletion_org_entity_idx"
  ON "public"."audit_deletion_logs" ("organization_id", "entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "audit_deletion_org_date_idx"
  ON "public"."audit_deletion_logs" ("organization_id", "created_at");

-- Immutability rules: no deletes, no updates. Insert-only.
CREATE RULE "no_delete_audit_deletion_logs" AS ON DELETE TO "public"."audit_deletion_logs"
  DO INSTEAD NOTHING;
CREATE RULE "no_update_audit_deletion_logs" AS ON UPDATE TO "public"."audit_deletion_logs"
  DO INSTEAD NOTHING;
