-- Migration: 0035_unique_active_member_savings_product.sql
-- Enforces the business rule: a member may hold ONLY ONE Active savings
-- account per savings product. The partial unique index only constrains
-- rows WHERE status = 'Active', so Dormant / Closed / Matured accounts
-- never block opening a fresh account for the same product.
--
-- NOTE: This index will fail to apply if pre-existing data ALREADY violates
-- the rule (e.g. the same member has two Active accounts for one product).
-- De-duplicate such rows first (close/deactivate the extras), then re-run.

CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_member_savings_product"
ON "public"."savings_accounts" ("organization_id", "member_id", "savings_product_id")
WHERE "status" = 'Active';
