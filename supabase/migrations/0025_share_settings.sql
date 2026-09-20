-- =============================================================
-- 0025: Share Settings (SETUPS → Share Settings)
--   share_classes            — lookup catalog (Class A/B/P …)
--   share_schemes            — CANONICAL share product/pricing source
--   dividend_rules           — dividend withholding / bonus parameters
--   share_certificate_formats— printable certificate template config
--   share_provisioning_queue — non-fatal auto-opening audit/retry queue
-- Plus:
--   organization_profiles.default_share_scheme_id (org-wide default scheme)
--   share_holdings.share_scheme_id + opened_via (auto-opening provenance)
--   share_transactions.share_scheme_id
--
-- Architectural decision: Share Scheme is the canonical financial source
-- for share product/pricing/opening config. Member Types keep their
-- min_share_units / entrance_fee / share_value_per_unit columns for
-- eligibility/display only and are NOT the source of truth for pricing.
-- =============================================================

-- ---- 1. Share Classes -----------------------------------------------------
CREATE TABLE IF NOT EXISTS "share_classes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "code" varchar(20) NOT NULL,
  "name" varchar(100) NOT NULL,
  "name_nepali" varchar(100),
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "share_classes_org_code_uniq" ON "share_classes" ("organization_id", "code");
CREATE INDEX IF NOT EXISTS "share_classes_org_active_idx" ON "share_classes" ("organization_id", "is_active");

-- ---- 2. Share Schemes (canonical product / pricing / opening config) -------
CREATE TABLE IF NOT EXISTS "share_schemes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "code" varchar(20) NOT NULL,
  "name" varchar(100) NOT NULL,
  "name_nepali" varchar(100),
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  -- Class designation (Class A/B/P …), nullable until classified.
  "share_class_id" uuid REFERENCES "share_classes"("id") ON DELETE SET NULL,
  -- Existing share product this scheme prices (keeps terminology stable).
  "share_type_id" uuid REFERENCES "share_types"("id") ON DELETE SET NULL,
  -- Canonical pricing (source of truth for member registration / issue).
  "share_value_per_unit" numeric(12, 2) DEFAULT '0.00' NOT NULL,
  "min_open_units" integer DEFAULT 1 NOT NULL,
  "max_units" integer,
  "is_transferable" boolean DEFAULT true NOT NULL,
  "dividend_rate" numeric(6, 4) DEFAULT '0.0000' NOT NULL,
  -- Optional opening deposit override; when 0 the opening amount is computed
  -- as min_open_units × share_value_per_unit (shown to the user, not enforced).
  "min_opening_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "share_schemes_org_code_uniq" ON "share_schemes" ("organization_id", "code");
CREATE INDEX IF NOT EXISTS "share_schemes_org_active_idx" ON "share_schemes" ("organization_id", "is_active");
CREATE INDEX IF NOT EXISTS "share_schemes_org_class_idx" ON "share_schemes" ("organization_id", "share_class_id");

-- ---- 3. Dividend Rules ----------------------------------------------------
CREATE TABLE IF NOT EXISTS "dividend_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "code" varchar(20) NOT NULL,
  "name" varchar(100) NOT NULL,
  "name_nepali" varchar(100),
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  "tax_withholding_percent" numeric(6, 2) DEFAULT '5.00' NOT NULL,
  "target_dividend_percent" numeric(6, 2) DEFAULT '12.50' NOT NULL,
  "bonus_share_ratio" varchar(20) DEFAULT '1:10' NOT NULL,
  "dividend_policy" text,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "dividend_rules_org_code_uniq" ON "dividend_rules" ("organization_id", "code");
CREATE INDEX IF NOT EXISTS "dividend_rules_org_active_idx" ON "dividend_rules" ("organization_id", "is_active");

-- ---- 4. Share Certificate Formats -----------------------------------------
CREATE TABLE IF NOT EXISTS "share_certificate_formats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "code" varchar(20) NOT NULL,
  "name" varchar(100) NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "certificate_prefix" varchar(10) DEFAULT 'SC-' NOT NULL,
  "starting_number" integer DEFAULT 1 NOT NULL,
  "include_logo" boolean DEFAULT true NOT NULL,
  "header_text" text,
  "footer_text" text,
  "fields_json" text,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "share_certificate_formats_org_code_uniq" ON "share_certificate_formats" ("organization_id", "code");
CREATE INDEX IF NOT EXISTS "share_certificate_formats_org_active_idx" ON "share_certificate_formats" ("organization_id", "is_active");

-- ---- 5. Org default share scheme (FK added after table creation) ----------
ALTER TABLE "organization_profiles" ADD COLUMN IF NOT EXISTS "default_share_scheme_id" uuid REFERENCES "share_schemes"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "organization_profiles_default_scheme_idx" ON "organization_profiles" ("default_share_scheme_id");

-- ---- 6. Auto-opening provenance on existing share tables -------------------
ALTER TABLE "share_holdings" ADD COLUMN IF NOT EXISTS "share_scheme_id" uuid REFERENCES "share_schemes"("id") ON DELETE SET NULL;
ALTER TABLE "share_holdings" ADD COLUMN IF NOT EXISTS "opened_via" text DEFAULT 'manual' NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'share_holdings_opened_via_check'
  ) THEN
    ALTER TABLE "share_holdings" ADD CONSTRAINT "share_holdings_opened_via_check" CHECK ("opened_via" IN ('auto', 'manual'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "share_holding_org_scheme_idx" ON "share_holdings" ("organization_id", "share_scheme_id");

ALTER TABLE "share_transactions" ADD COLUMN IF NOT EXISTS "share_scheme_id" uuid REFERENCES "share_schemes"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "share_txn_org_scheme_idx" ON "share_transactions" ("organization_id", "share_scheme_id");

-- ---- 7. Share provisioning queue (non-fatal auto-opening audit trail) ------
CREATE TABLE IF NOT EXISTS "share_provisioning_queue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "member_id" uuid NOT NULL REFERENCES "members"("id") ON DELETE cascade,
  "member_no" text NOT NULL,
  "share_scheme_id" uuid NOT NULL REFERENCES "share_schemes"("id") ON DELETE SET NULL,
  "share_type_id" uuid,
  "status" text DEFAULT 'Pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "error_message" text,
  "opened_holding_id" uuid,
  "opened_voucher_no" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "resolved_at" timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS "share_provisioning_queue_org_member_scheme_uniq" ON "share_provisioning_queue" ("organization_id", "member_id", "share_scheme_id");
CREATE INDEX IF NOT EXISTS "share_provisioning_queue_org_status_idx" ON "share_provisioning_queue" ("organization_id", "status");
