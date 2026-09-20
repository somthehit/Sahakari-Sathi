-- =============================================================
-- 0032: Accounting Settings (SETUPS → Accounting Settings)
--
-- 1) chart_of_accounts gains the accounting-behavior columns the
--    posting engine now reads (allow_posting, normal_balance, etc.).
-- 2) New config catalogs: voucher_types, voucher_type_counters,
--    cost_centers, journal_templates, journal_template_entries,
--    financial_periods, banks, bank_accounts, cash_counters,
--    payment_methods, system_account_mappings.
-- 3) Seeds the four engine-native voucher types (Receipt/Payment/
--    Journal/Contra) for every existing org (is_system = true,
--    editable but not deletable).
--
-- All adds are idempotent / safe to re-run.
-- =============================================================

-- ── 1. Chart of Accounts behavior columns ──────────────────────────────────
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "name_nepali" text;
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "normal_balance" text NOT NULL DEFAULT 'debit';
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "allow_posting" boolean NOT NULL DEFAULT true;
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "is_control_account" boolean NOT NULL DEFAULT false;
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "cash_bank_account" boolean NOT NULL DEFAULT false;
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "reconciliation_required" boolean NOT NULL DEFAULT false;
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "cost_center_required" boolean NOT NULL DEFAULT false;
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "display_order" integer NOT NULL DEFAULT 0;

-- ── 2. Voucher Types ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "voucher_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "code" varchar(20) NOT NULL,
  "name" varchar(100) NOT NULL,
  "name_nepali" varchar(100),
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_system" boolean NOT NULL DEFAULT false,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "category" text NOT NULL DEFAULT 'Journal',
  "prefix" varchar(8) NOT NULL DEFAULT 'JV',
  "numbering_rule" text NOT NULL DEFAULT 'fiscal_year',
  "padding" integer NOT NULL DEFAULT 6,
  "default_debit_account_id" uuid REFERENCES "chart_of_accounts" ("id"),
  "default_credit_account_id" uuid REFERENCES "chart_of_accounts" ("id"),
  "requires_approval" boolean NOT NULL DEFAULT false,
  "requires_narration" boolean NOT NULL DEFAULT true,
  "requires_cost_center" boolean NOT NULL DEFAULT false,
  "requires_reference" boolean NOT NULL DEFAULT false,
  "is_branch_scoped" boolean NOT NULL DEFAULT false,
  "allow_backdate" boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX IF NOT EXISTS "voucher_types_org_code_uniq" ON "voucher_types" ("organization_id", "code");
CREATE INDEX IF NOT EXISTS "voucher_types_org_cat_idx" ON "voucher_types" ("organization_id", "category");

CREATE TABLE IF NOT EXISTS "voucher_type_counters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "voucher_type_id" uuid NOT NULL REFERENCES "voucher_types" ("id") ON DELETE CASCADE,
  "fiscal_year_code" varchar(20) NOT NULL,
  "next_seq" bigint NOT NULL DEFAULT 1,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "voucher_type_counter_uniq" ON "voucher_type_counters" ("organization_id", "voucher_type_id", "fiscal_year_code");

-- ── 3. Cost Centers ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "cost_centers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "code" varchar(20) NOT NULL,
  "name" varchar(100) NOT NULL,
  "name_nepali" varchar(100),
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_system" boolean NOT NULL DEFAULT false,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "parent_id" uuid,
  "branch_id" uuid REFERENCES "branches" ("id"),
  "manager_id" uuid,
  "manager_name" varchar(100)
);
CREATE UNIQUE INDEX IF NOT EXISTS "cost_centers_org_code_uniq" ON "cost_centers" ("organization_id", "code");
CREATE INDEX IF NOT EXISTS "cost_centers_org_branch_idx" ON "cost_centers" ("organization_id", "branch_id");

-- ── 4. Journal Templates ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "journal_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "code" varchar(20) NOT NULL,
  "name" varchar(100) NOT NULL,
  "name_nepali" varchar(100),
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_system" boolean NOT NULL DEFAULT false,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "voucher_type_id" uuid REFERENCES "voucher_types" ("id"),
  "narration_template" text,
  "frequency" text NOT NULL DEFAULT 'manual',
  "branch_id" uuid REFERENCES "branches" ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "journal_templates_org_code_uniq" ON "journal_templates" ("organization_id", "code");
CREATE INDEX IF NOT EXISTS "journal_templates_org_branch_idx" ON "journal_templates" ("organization_id", "branch_id");

CREATE TABLE IF NOT EXISTS "journal_template_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "template_id" uuid NOT NULL REFERENCES "journal_templates" ("id") ON DELETE CASCADE,
  "account_id" uuid NOT NULL REFERENCES "chart_of_accounts" ("id"),
  "account_code" varchar(20) NOT NULL,
  "account_name" varchar(100) NOT NULL,
  "entry_type" text NOT NULL,
  "amount_type" text NOT NULL DEFAULT 'amount',
  "amount" numeric(15, 2) NOT NULL DEFAULT '0',
  "cost_center_id" uuid REFERENCES "cost_centers" ("id"),
  "description" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "jt_entry_org_template_idx" ON "journal_template_entries" ("organization_id", "template_id");
CREATE INDEX IF NOT EXISTS "jt_entry_org_account_idx" ON "journal_template_entries" ("organization_id", "account_id");

-- ── 5. Financial Periods ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "financial_periods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "code" varchar(20) NOT NULL,
  "name" varchar(100) NOT NULL,
  "name_nepali" varchar(100),
  "fiscal_year_id" uuid REFERENCES "fiscal_years" ("id"),
  "fiscal_year_code" varchar(20) NOT NULL,
  "start_date_bs" varchar(10) NOT NULL,
  "end_date_bs" varchar(10) NOT NULL,
  "start_date_ad" varchar(10) NOT NULL,
  "end_date_ad" varchar(10) NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "is_current" boolean NOT NULL DEFAULT false,
  "closed_at" timestamptz,
  "closed_by" varchar(100),
  "locked_at" timestamptz,
  "locked_by" varchar(100),
  "reason" text,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "financial_periods_org_code_uniq" ON "financial_periods" ("organization_id", "code");
CREATE INDEX IF NOT EXISTS "financial_periods_org_fy_idx" ON "financial_periods" ("organization_id", "fiscal_year_id");
CREATE INDEX IF NOT EXISTS "financial_periods_org_status_idx" ON "financial_periods" ("organization_id", "status");

-- ── 6. Banks ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "banks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "code" varchar(20) NOT NULL,
  "name" varchar(100) NOT NULL,
  "name_nepali" varchar(100),
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_system" boolean NOT NULL DEFAULT false,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "swift_code" varchar(20),
  "short_name" varchar(50)
);
CREATE UNIQUE INDEX IF NOT EXISTS "banks_org_code_uniq" ON "banks" ("organization_id", "code");
CREATE INDEX IF NOT EXISTS "banks_org_active_idx" ON "banks" ("organization_id", "is_active");

-- ── 7. Bank Accounts ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "bank_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "bank_id" uuid NOT NULL REFERENCES "banks" ("id"),
  "account_name" varchar(100) NOT NULL,
  "account_number" varchar(50) NOT NULL,
  "branch_id" uuid REFERENCES "branches" ("id"),
  "currency" varchar(3) NOT NULL DEFAULT 'NPR',
  "gl_account_id" uuid REFERENCES "chart_of_accounts" ("id"),
  "account_type" text NOT NULL DEFAULT 'Current',
  "opening_balance" numeric(18, 2) NOT NULL DEFAULT '0',
  "opening_date_bs" varchar(10),
  "is_primary" boolean NOT NULL DEFAULT false,
  "reconciliation_enabled" boolean NOT NULL DEFAULT false,
  "last_reconciled_date_bs" varchar(10),
  "is_active" boolean NOT NULL DEFAULT true,
  "is_system" boolean NOT NULL DEFAULT false,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "bank_accounts_org_no_uniq" ON "bank_accounts" ("organization_id", "account_number");
CREATE INDEX IF NOT EXISTS "bank_accounts_org_bank_idx" ON "bank_accounts" ("organization_id", "bank_id");
CREATE INDEX IF NOT EXISTS "bank_accounts_org_branch_idx" ON "bank_accounts" ("organization_id", "branch_id");

-- ── 8. Cash Counters ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "cash_counters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "code" varchar(20) NOT NULL,
  "name" varchar(100) NOT NULL,
  "name_nepali" varchar(100),
  "branch_id" uuid NOT NULL REFERENCES "branches" ("id"),
  "assigned_user_id" uuid,
  "gl_cash_account_id" uuid REFERENCES "chart_of_accounts" ("id"),
  "opening_balance" numeric(18, 2) NOT NULL DEFAULT '0',
  "max_cash_limit" numeric(18, 2),
  "is_active" boolean NOT NULL DEFAULT true,
  "is_system" boolean NOT NULL DEFAULT false,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "cash_counters_org_branch_code_uniq" ON "cash_counters" ("organization_id", "branch_id", "code");
CREATE INDEX IF NOT EXISTS "cash_counters_org_branch_idx" ON "cash_counters" ("organization_id", "branch_id");

-- ── 9. Payment Methods ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "payment_methods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "code" varchar(20) NOT NULL,
  "name" varchar(100) NOT NULL,
  "name_nepali" varchar(100),
  "description" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_system" boolean NOT NULL DEFAULT false,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "type" text NOT NULL DEFAULT 'Other',
  "requires_reference" boolean NOT NULL DEFAULT false,
  "requires_bank" boolean NOT NULL DEFAULT false,
  "requires_cheque_number" boolean NOT NULL DEFAULT false,
  "requires_transaction_id" boolean NOT NULL DEFAULT false,
  "gl_account_id" uuid REFERENCES "chart_of_accounts" ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "payment_methods_org_code_uniq" ON "payment_methods" ("organization_id", "code");
CREATE INDEX IF NOT EXISTS "payment_methods_org_type_idx" ON "payment_methods" ("organization_id", "type");

-- ── 10. System Account Mappings ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "system_account_mappings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "mapping_key" text NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "chart_of_accounts" ("id"),
  "description" text,
  "updated_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "sys_map_org_key_uniq" ON "system_account_mappings" ("organization_id", "mapping_key");
CREATE INDEX IF NOT EXISTS "sys_map_org_account_idx" ON "system_account_mappings" ("organization_id", "account_id");

-- ── 11. Seed engine-native voucher types for every org (idempotent) ────────
INSERT INTO "voucher_types" ("organization_id", "code", "name", "name_nepali", "description", "is_active", "sort_order", "is_system", "category", "prefix", "numbering_rule", "padding")
SELECT o.id, d.code, d.name, d.name_nepali, d.description, true, d.sort_order, true, d.category, d.prefix, 'fiscal_year', 6
FROM "organizations" o
CROSS JOIN (
  VALUES
    ('RECEIPT',  'Receipt',  'जम्मा रसिद', 'Cash/bank receipt voucher',       1, 'Receipt', 'RC'),
    ('PAYMENT',  'Payment',  'भुक्तानी',   'Cash/bank payment voucher',       2, 'Payment', 'PV'),
    ('JOURNAL',  'Journal',  'जर्नल',      'General journal adjustment',       3, 'Journal', 'JV'),
    ('CONTRA',   'Contra',   'कन्ट्रा',     'Cash-to-bank / bank-to-cash',     4, 'Contra',  'CV')
) AS d(code, name, name_nepali, description, sort_order, category, prefix)
ON CONFLICT ("organization_id", "code") DO NOTHING;
