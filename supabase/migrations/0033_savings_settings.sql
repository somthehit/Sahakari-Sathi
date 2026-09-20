-- =============================================================
-- 0033: Savings A/C Settings (SETUPS → Savings A/C Settings)
--
-- Reuses the existing canonical product table savings_products and
-- extends it with the Account Product configuration model:
--   eligibility / KYC / opening rules
--   deposit & withdrawal limits / controls
--   minimum balance penalty rules
--   dormancy / closure rules
--   charges & fees
--   cheque facility
--   accounting (GL) mapping
--   account numbering prefix
--
-- Adds:
--   savings_interest_rates       — time-series rate history per product
--   savings_cheque_books         — cheque book issuance per savings account
--   savings_cheque_leaves        — per-leaf lifecycle (Available/Issued/Used/…)
--   savings_provisioning_queue   — non-fatal auto-opening audit/retry queue
--   organization_profiles.default_saving_product_id (org-wide default product)
--
-- Architectural decisions:
--  * savings_products is the SINGLE canonical financial source for savings
--    product config — do NOT create a parallel account_products table.
--  * GL mapping columns are plain uuid FKs enforced in this migration only
--    (mirrors shareSettings: avoids circular module imports in Drizzle).
--  * Every new table is scoped to organization_id for multi-tenancy.
--  * Status/type values are stored as text with CHECK constraints; Drizzle
--    declares them as pgEnum-backed text columns (same pattern as savings).
-- =============================================================

-- ---- 1. Extend savings_products with the Account Product config ------------
ALTER TABLE "savings_products"
  ADD COLUMN IF NOT EXISTS "name_nepali" varchar(100),
  ADD COLUMN IF NOT EXISTS "is_system" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "created_by" uuid,
  ADD COLUMN IF NOT EXISTS "updated_by" uuid,
  -- Classification
  ADD COLUMN IF NOT EXISTS "product_category" text,
  ADD COLUMN IF NOT EXISTS "account_no_prefix" varchar(10) DEFAULT 'SAV' NOT NULL,
  -- Interest / rate config
  ADD COLUMN IF NOT EXISTS "interest_calculation_method" text DEFAULT 'min_monthly_balance' NOT NULL,
  ADD COLUMN IF NOT EXISTS "interest_effective_date" text,
  -- Eligibility
  ADD COLUMN IF NOT EXISTS "eligible_member_type_ids" jsonb DEFAULT '[]' NOT NULL,
  ADD COLUMN IF NOT EXISTS "min_age" integer,
  ADD COLUMN IF NOT EXISTS "max_age" integer,
  -- KYC requirements
  ADD COLUMN IF NOT EXISTS "requires_kyc_verified" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "requires_nominee" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "requires_photo" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "requires_signature" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "requires_documents" boolean DEFAULT true NOT NULL,
  -- Opening rules (min_deposit = minimum opening deposit, min_balance = minimum to maintain)
  ADD COLUMN IF NOT EXISTS "max_balance" numeric(15, 2),
  ADD COLUMN IF NOT EXISTS "opening_deposit_required" boolean DEFAULT true NOT NULL,
  -- Deposit rules
  ADD COLUMN IF NOT EXISTS "deposit_mode_cash" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "deposit_mode_bank" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "deposit_mode_transfer" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "deposit_mode_agent" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "daily_deposit_limit" numeric(15, 2),
  ADD COLUMN IF NOT EXISTS "monthly_deposit_limit" numeric(15, 2),
  ADD COLUMN IF NOT EXISTS "backdate_deposit_allowed" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "deposit_requires_approval" boolean DEFAULT false NOT NULL,
  -- Withdrawal rules
  ADD COLUMN IF NOT EXISTS "withdrawal_mode_cash" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "withdrawal_mode_transfer" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "min_withdrawal" numeric(15, 2),
  ADD COLUMN IF NOT EXISTS "max_withdrawal" numeric(15, 2),
  ADD COLUMN IF NOT EXISTS "daily_withdrawal_limit" numeric(15, 2),
  ADD COLUMN IF NOT EXISTS "monthly_withdrawal_limit" numeric(15, 2),
  ADD COLUMN IF NOT EXISTS "minimum_balance_after_withdrawal" numeric(15, 2),
  ADD COLUMN IF NOT EXISTS "withdrawal_requires_approval" boolean DEFAULT false NOT NULL,
  -- Minimum balance penalty rules
  ADD COLUMN IF NOT EXISTS "min_balance_grace_days" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "min_balance_penalty_percent" numeric(6, 4) DEFAULT '0.0000' NOT NULL,
  ADD COLUMN IF NOT EXISTS "min_balance_penalty_amount" numeric(15, 2) DEFAULT '0.00' NOT NULL,
  ADD COLUMN IF NOT EXISTS "min_balance_penalty_frequency" text DEFAULT 'Monthly' NOT NULL,
  ADD COLUMN IF NOT EXISTS "min_balance_waiver_allowed" boolean DEFAULT false NOT NULL,
  -- Dormancy rules
  ADD COLUMN IF NOT EXISTS "inactive_after_months" integer DEFAULT 3 NOT NULL,
  ADD COLUMN IF NOT EXISTS "dormant_after_months" integer DEFAULT 6 NOT NULL,
  ADD COLUMN IF NOT EXISTS "notify_before_dormancy_days" integer DEFAULT 30 NOT NULL,
  ADD COLUMN IF NOT EXISTS "reactivation_required" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "reactivation_approval_required" boolean DEFAULT false NOT NULL,
  -- Closure rules
  ADD COLUMN IF NOT EXISTS "closure_allowed" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "minimum_balance_before_closure" numeric(15, 2) DEFAULT '0.00' NOT NULL,
  ADD COLUMN IF NOT EXISTS "closure_requires_approval" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "closure_fee" numeric(15, 2) DEFAULT '0.00' NOT NULL,
  -- Charges & fees
  ADD COLUMN IF NOT EXISTS "opening_fee" numeric(15, 2) DEFAULT '0.00' NOT NULL,
  ADD COLUMN IF NOT EXISTS "monthly_maintenance_fee" numeric(15, 2) DEFAULT '0.00' NOT NULL,
  ADD COLUMN IF NOT EXISTS "withdrawal_fee" numeric(15, 2) DEFAULT '0.00' NOT NULL,
  ADD COLUMN IF NOT EXISTS "cheque_book_fee" numeric(15, 2) DEFAULT '0.00' NOT NULL,
  ADD COLUMN IF NOT EXISTS "cheque_leaf_fee" numeric(15, 2) DEFAULT '0.00' NOT NULL,
  ADD COLUMN IF NOT EXISTS "stop_payment_fee" numeric(15, 2) DEFAULT '0.00' NOT NULL,
  ADD COLUMN IF NOT EXISTS "cheque_return_fee" numeric(15, 2) DEFAULT '0.00' NOT NULL,
  ADD COLUMN IF NOT EXISTS "passbook_fee" numeric(15, 2) DEFAULT '0.00' NOT NULL,
  ADD COLUMN IF NOT EXISTS "statement_fee" numeric(15, 2) DEFAULT '0.00' NOT NULL,
  -- Cheque facility
  ADD COLUMN IF NOT EXISTS "cheque_enabled" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "cheque_default_leaves" integer DEFAULT 25 NOT NULL,
  ADD COLUMN IF NOT EXISTS "cheque_max_books" integer DEFAULT 1 NOT NULL,
  -- Accounting (GL) mapping — FK enforced here only (avoids Drizzle circular imports).
  ADD COLUMN IF NOT EXISTS "gl_liability_account_id" uuid REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "gl_interest_expense_account_id" uuid REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "gl_interest_payable_account_id" uuid REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "gl_fee_income_account_id" uuid REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "gl_penalty_income_account_id" uuid REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "gl_cheque_income_account_id" uuid REFERENCES "chart_of_accounts"("id") ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'savings_products_interest_method_check') THEN
    ALTER TABLE "savings_products" ADD CONSTRAINT "savings_products_interest_method_check"
      CHECK ("interest_calculation_method" IN ('min_monthly_balance', 'daily_product', 'quarterly_min_balance', 'simple', 'compound'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'savings_products_penalty_freq_check') THEN
    ALTER TABLE "savings_products" ADD CONSTRAINT "savings_products_penalty_freq_check"
      CHECK ("min_balance_penalty_frequency" IN ('Daily', 'Monthly', 'Quarterly', 'Half_Yearly', 'Annually'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "savings_prod_org_active_idx" ON "savings_products" ("organization_id", "is_active");
CREATE INDEX IF NOT EXISTS "savings_prod_org_category_idx" ON "savings_products" ("organization_id", "product_category");

-- ---- 1b. Provenance on savings_accounts (auto vs manual opening) ------------
ALTER TABLE "savings_accounts"
  ADD COLUMN IF NOT EXISTS "opened_via" text DEFAULT 'manual' NOT NULL
  CHECK ("opened_via" IN ('auto', 'manual'));
CREATE INDEX IF NOT EXISTS "savings_accounts_org_opened_via_idx" ON "savings_accounts" ("organization_id", "opened_via");

-- ---- 2. Savings Interest Rates (time-series rate history per product) -------
CREATE TABLE IF NOT EXISTS "savings_interest_rates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "savings_product_id" uuid NOT NULL REFERENCES "savings_products"("id") ON DELETE CASCADE,
  "rate" numeric(6, 4) DEFAULT '0.0000' NOT NULL,
  "effective_from_bs" text NOT NULL,
  "effective_to_bs" text,
  "created_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "savings_interest_rates_org_prod_from_uniq" ON "savings_interest_rates" ("organization_id", "savings_product_id", "effective_from_bs");
CREATE INDEX IF NOT EXISTS "savings_interest_rates_org_prod_idx" ON "savings_interest_rates" ("organization_id", "savings_product_id");

-- ---- 3. Cheque Books --------------------------------------------------------
CREATE TABLE IF NOT EXISTS "savings_cheque_books" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "account_id" uuid NOT NULL REFERENCES "savings_accounts"("id") ON DELETE CASCADE,
  "account_no" text NOT NULL,
  "book_no" text NOT NULL,
  "first_leaf_no" integer NOT NULL,
  "leaf_count" integer DEFAULT 25 NOT NULL,
  "issue_date_bs" text NOT NULL,
  "issue_date_ad" text NOT NULL,
  "issued_by_id" uuid,
  "status" text DEFAULT 'Issued' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'savings_cheque_books_status_check') THEN
    ALTER TABLE "savings_cheque_books" ADD CONSTRAINT "savings_cheque_books_status_check"
      CHECK ("status" IN ('Issued', 'Completed', 'Cancelled'));
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "savings_cheque_books_org_book_no_uniq" ON "savings_cheque_books" ("organization_id", "book_no");
CREATE INDEX IF NOT EXISTS "savings_cheque_books_org_account_idx" ON "savings_cheque_books" ("organization_id", "account_id");

-- ---- 4. Cheque Leaves -------------------------------------------------------
CREATE TABLE IF NOT EXISTS "savings_cheque_leaves" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "book_id" uuid NOT NULL REFERENCES "savings_cheque_books"("id") ON DELETE CASCADE,
  "leaf_no" integer NOT NULL,
  "status" text DEFAULT 'Available' NOT NULL,
  "used_by_txn_id" uuid,
  "stopped_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'savings_cheque_leaves_status_check') THEN
    ALTER TABLE "savings_cheque_leaves" ADD CONSTRAINT "savings_cheque_leaves_status_check"
      CHECK ("status" IN ('Available', 'Issued', 'Used', 'Cancelled', 'Stopped'));
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "savings_cheque_leaves_org_book_leaf_uniq" ON "savings_cheque_leaves" ("organization_id", "book_id", "leaf_no");
CREATE INDEX IF NOT EXISTS "savings_cheque_leaves_org_book_idx" ON "savings_cheque_leaves" ("organization_id", "book_id");

-- ---- 5. Org default saving product ------------------------------------------
ALTER TABLE "organization_profiles" ADD COLUMN IF NOT EXISTS "default_saving_product_id" uuid REFERENCES "savings_products"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "organization_profiles_default_saving_product_idx" ON "organization_profiles" ("default_saving_product_id");

-- ---- 6. Savings provisioning queue (non-fatal auto-opening audit trail) -----
CREATE TABLE IF NOT EXISTS "savings_provisioning_queue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "member_id" uuid NOT NULL REFERENCES "members"("id") ON DELETE cascade,
  "member_no" text NOT NULL,
  "savings_product_id" uuid NOT NULL REFERENCES "savings_products"("id") ON DELETE SET NULL,
  "status" text DEFAULT 'Pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "error_message" text,
  "opened_account_id" uuid,
  "opened_voucher_no" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "resolved_at" timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS "savings_provisioning_queue_org_member_product_uniq" ON "savings_provisioning_queue" ("organization_id", "member_id", "savings_product_id");
CREATE INDEX IF NOT EXISTS "savings_provisioning_queue_org_status_idx" ON "savings_provisioning_queue" ("organization_id", "status");