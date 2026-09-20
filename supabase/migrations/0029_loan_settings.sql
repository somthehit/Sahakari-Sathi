-- =============================================================
-- 0029: Loan Settings (Module 6)
--   Loan Categories        — flat classification catalog (loan_products.category_id)
--   Collateral Types       — collateral/security catalog (loan_collaterals.collateral_type_id)
--   Guarantor Settings     — singular org config (count + coverage %)
--   EMI Schedule Settings  — singular org config (methods, day count, install day,
--                            rounding, non-working-day shift)
--   Interest Rate History  — time-series loan_product_interest_rates (§5):
--                            the product's interest_rate stays as a "current" snapshot;
--                            the history table records every effective_from/to rate.
--   Eligibility            — loan_product_eligible_member_types / _categories (Module 3 FKs)
--   loan_products          — + category_id, updated_by, defaults for product_type/
--                            interest_method (interest_method values were TS-enum only;
--                            no DB CHECK existed, so no constraint migration needed).
--
-- Admin-configurable, org-scoped, NOT hardcoded — confirm thresholds with the
-- org's auditor before enforcing them anywhere in origination.
-- =============================================================

-- ------------------------------------------------------------------
-- Loan Categories
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "loan_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "code" varchar(20) NOT NULL,
  "name" varchar(100) NOT NULL,
  "name_nepali" varchar(100),
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_system" boolean NOT NULL DEFAULT false,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "loan_categories_org_code_uniq" ON "loan_categories" ("organization_id", "code");
CREATE INDEX IF NOT EXISTS "loan_categories_org_active_idx" ON "loan_categories" ("organization_id", "is_active");

-- ------------------------------------------------------------------
-- Loan Collateral Types
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "loan_collateral_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "code" varchar(20) NOT NULL,
  "name" varchar(100) NOT NULL,
  "name_nepali" varchar(100),
  "description" text,
  "valuation_required" boolean NOT NULL DEFAULT true,
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_system" boolean NOT NULL DEFAULT false,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "loan_collateral_types_org_code_uniq" ON "loan_collateral_types" ("organization_id", "code");
CREATE INDEX IF NOT EXISTS "loan_collateral_types_org_active_idx" ON "loan_collateral_types" ("organization_id", "is_active");

-- ------------------------------------------------------------------
-- Guarantor Settings (single row per org)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "guarantor_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "min_guarantors" integer NOT NULL DEFAULT 1,
  "max_guarantors" integer,
  "required_coverage_percent" numeric(5,2) NOT NULL DEFAULT '0',
  "allow_member_guarantors" boolean NOT NULL DEFAULT true,
  "updated_by" uuid,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "guarantor_settings_org_uniq" ON "guarantor_settings" ("organization_id");

-- ------------------------------------------------------------------
-- EMI Schedule Settings (single row per org)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "emi_schedule_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "default_interest_method" text NOT NULL DEFAULT 'diminishing_emi',
  "enabled_methods" jsonb NOT NULL DEFAULT '["flat","diminishing_emi","diminishing_principal","daily_reducing","bullet"]',
  "day_count_convention" text NOT NULL DEFAULT '365',
  "installment_day_of_month" integer NOT NULL DEFAULT 1,
  "rounding_mode" text NOT NULL DEFAULT 'round',
  "shift_to_working_day" boolean NOT NULL DEFAULT true,
  "updated_by" uuid,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "emi_schedule_settings_org_uniq" ON "emi_schedule_settings" ("organization_id");

-- ------------------------------------------------------------------
-- Interest Rate History (time-series)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "loan_product_interest_rates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "loan_product_id" uuid NOT NULL REFERENCES "loan_products"("id") ON DELETE CASCADE,
  "rate" numeric(6,4) NOT NULL,
  "effective_from_bs" text NOT NULL,
  "effective_to_bs" text,
  "created_by" uuid,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "loan_prod_rate_org_product_idx" ON "loan_product_interest_rates" ("organization_id", "loan_product_id");

-- ------------------------------------------------------------------
-- Eligibility (Module 3 member types / member categories)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "loan_product_eligible_member_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "loan_product_id" uuid NOT NULL REFERENCES "loan_products"("id") ON DELETE CASCADE,
  "member_type_id" uuid NOT NULL REFERENCES "member_types"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "loan_prod_elig_type_uniq" ON "loan_product_eligible_member_types" ("organization_id", "loan_product_id", "member_type_id");
CREATE INDEX IF NOT EXISTS "loan_prod_elig_type_org_idx" ON "loan_product_eligible_member_types" ("organization_id", "loan_product_id");

CREATE TABLE IF NOT EXISTS "loan_product_eligible_member_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "loan_product_id" uuid NOT NULL REFERENCES "loan_products"("id") ON DELETE CASCADE,
  "member_category_id" uuid NOT NULL REFERENCES "member_categories"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "loan_prod_elig_cat_uniq" ON "loan_product_eligible_member_categories" ("organization_id", "loan_product_id", "member_category_id");
CREATE INDEX IF NOT EXISTS "loan_prod_elig_cat_org_idx" ON "loan_product_eligible_member_categories" ("organization_id", "loan_product_id");

-- ------------------------------------------------------------------
-- Existing table alterations
-- ------------------------------------------------------------------
ALTER TABLE "loan_products" ADD COLUMN IF NOT EXISTS "category_id" uuid REFERENCES "loan_categories"("id");
ALTER TABLE "loan_products" ADD COLUMN IF NOT EXISTS "updated_by" uuid;
ALTER TABLE "loan_products" ALTER COLUMN "product_type" SET DEFAULT 'general';
ALTER TABLE "loan_products" ALTER COLUMN "interest_method" SET DEFAULT 'diminishing_emi';

CREATE INDEX IF NOT EXISTS "loan_prod_org_category_idx" ON "loan_products" ("organization_id", "category_id");

ALTER TABLE "loan_collaterals" ADD COLUMN IF NOT EXISTS "collateral_type_id" uuid REFERENCES "loan_collateral_types"("id");
