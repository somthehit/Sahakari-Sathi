-- =============================================================
-- 0030: Loan Products — align catalog columns with baseColumns
-- The 0029 migration added loan_products.category_id + updated_by
-- but not the shared catalog columns (name_nepali, sort_order,
-- is_system, created_by) that LoanSettingController writes via
-- the baseColumns factory. Add them idempotently.
-- =============================================================

ALTER TABLE "loan_products" ADD COLUMN IF NOT EXISTS "name_nepali" varchar(100);
ALTER TABLE "loan_products" ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0;
ALTER TABLE "loan_products" ADD COLUMN IF NOT EXISTS "is_system" boolean NOT NULL DEFAULT false;
ALTER TABLE "loan_products" ADD COLUMN IF NOT EXISTS "created_by" uuid;

CREATE INDEX IF NOT EXISTS "loan_prod_org_active_idx" ON "loan_products" ("organization_id", "is_active");
