-- =============================================================
-- 0019: Workflow & Approvals (Module 2)
-- approval_levels, approval_matrix, role_approval_limits
-- All org-scoped (organization_id from verified JWT at runtime).
-- =============================================================

CREATE TABLE IF NOT EXISTS "approval_levels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "level_no" integer NOT NULL,
  "role_key" text NOT NULL,
  "role_label" text NOT NULL,
  "min_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
  "max_amount" numeric(15, 2),
  "scope" text DEFAULT '' NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "approval_levels_org_no_uniq" ON "approval_levels" ("organization_id", "level_no");
CREATE INDEX IF NOT EXISTS "approval_levels_org_idx" ON "approval_levels" ("organization_id");

CREATE TABLE IF NOT EXISTS "approval_matrix" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "request_type" text NOT NULL,
  "threshold_min" numeric(15, 2) DEFAULT '0' NOT NULL,
  "threshold_max" numeric(15, 2),
  "signatory1_role" text NOT NULL,
  "signatory2_role" text,
  "sms_notify" boolean DEFAULT false NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "description" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "approval_matrix_org_type_idx" ON "approval_matrix" ("organization_id", "request_type");

CREATE TABLE IF NOT EXISTS "role_approval_limits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE cascade,
  "module_key" text NOT NULL,
  "min_amount" numeric(15, 2),
  "max_amount" numeric(15, 2),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "role_approval_limits_role_module_uniq" ON "role_approval_limits" ("role_id", "module_key");
CREATE INDEX IF NOT EXISTS "role_approval_limits_org_idx" ON "role_approval_limits" ("organization_id");
