-- =============================================================
-- 0028: Configurable dividend rule fields + share pledge flag
--   Dividend Rules: per-fiscal-year config (config-only, no engine):
--     fiscal_year, approval_status, distribution_mode, minimum_holding_period_months
--   Share Types: is_pledgeable (collateral eligibility for future
--     share-backed loans). All fields are admin-configurable, NOT
--     hardcoded constants — confirm regulatory thresholds with the
--     org's auditor before applying them anywhere.
-- =============================================================
ALTER TABLE "dividend_rules" ADD COLUMN IF NOT EXISTS "fiscal_year" varchar(20);
ALTER TABLE "dividend_rules" ADD COLUMN IF NOT EXISTS "approval_status" text DEFAULT 'draft' NOT NULL;
ALTER TABLE "dividend_rules" ADD COLUMN IF NOT EXISTS "distribution_mode" text DEFAULT 'cash' NOT NULL;
ALTER TABLE "dividend_rules" ADD COLUMN IF NOT EXISTS "minimum_holding_period_months" integer DEFAULT 0 NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dividend_rules_approval_status_check') THEN
    ALTER TABLE "dividend_rules" ADD CONSTRAINT "dividend_rules_approval_status_check" CHECK ("approval_status" IN ('draft', 'approved'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dividend_rules_distribution_mode_check') THEN
    ALTER TABLE "dividend_rules" ADD CONSTRAINT "dividend_rules_distribution_mode_check" CHECK ("distribution_mode" IN ('cash', 'bonus_share', 'member_choice'));
  END IF;
END $$;

ALTER TABLE "share_types" ADD COLUMN IF NOT EXISTS "is_pledgeable" boolean DEFAULT true NOT NULL;
