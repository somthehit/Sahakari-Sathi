-- =============================================================
-- 0031: Guarantor Type Management
-- 1) guarantor_types — org-scoped, admin-configurable catalog of
--    guarantor types (NOT hardcoded in the UI).
-- 2) loan_product_guarantor_rules — per-Loan-Product rules: which
--    guarantor types are permitted and the min/max count + coverage
--    % that apply to each type. Falls back to org-wide
--    guarantor_settings when a type has no product rule.
-- 3) Seeds the seven default guarantor types for every existing org
--    (idempotent — a unique index on (organization_id, code) guards
--    against re-insertion).
-- =============================================================

CREATE TABLE IF NOT EXISTS "guarantor_types" (
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
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "guarantor_types_org_code_uniq" ON "guarantor_types" ("organization_id", "code");
CREATE INDEX IF NOT EXISTS "guarantor_types_org_active_idx" ON "guarantor_types" ("organization_id", "is_active");

CREATE TABLE IF NOT EXISTS "loan_product_guarantor_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "loan_product_id" uuid NOT NULL REFERENCES "loan_products" ("id") ON DELETE CASCADE,
  "guarantor_type_id" uuid NOT NULL REFERENCES "guarantor_types" ("id") ON DELETE CASCADE,
  "min_count" integer NOT NULL DEFAULT 1,
  "max_count" integer,
  "coverage_percent" numeric(5, 2) NOT NULL DEFAULT '0',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "loan_prod_guarantor_rule_uniq" ON "loan_product_guarantor_rules" ("organization_id", "loan_product_id", "guarantor_type_id");
CREATE INDEX IF NOT EXISTS "loan_prod_guarantor_rule_org_idx" ON "loan_product_guarantor_rules" ("organization_id", "loan_product_id");

-- Seed default guarantor types for every existing organization.
-- Keyed on (organization_id, code) so this is safe to re-run and so
-- per-org edits are never clobbered.
INSERT INTO "guarantor_types" ("organization_id", "code", "name", "name_nepali", "description", "is_active", "sort_order", "is_system")
SELECT o.id, d.code, d.name, d.name_nepali, d.description, true, d.sort_order, true
FROM "organizations" o
CROSS JOIN (
  VALUES
    ('MEMBER',    'Cooperative Member',    'सहकारी सदस्य',        'Existing member of the cooperative', 10),
    ('INDIVIDUAL','Non-Member Individual', 'गैर-सदस्य व्यक्ति',     'Individual who is not a member',      20),
    ('STAFF',     'Staff / Employee',      'कर्मचारी',             'Cooperative staff or employee',       30),
    ('BOARD',     'Board Member',          'सञ्चालक सदस्य',        'Member of the board of directors',    40),
    ('INSTITUTION','Institutional / Organization', 'संस्थागत',     'Institution or organization',         50),
    ('COMPANY',   'Company / Business',    'कम्पनी / व्यवसाय',      'Company or business entity',          60),
    ('CUSTOM',    'Custom Guarantor',      'अन्य जमानतदार',         'Any other custom guarantor type',     70)
) AS d(code, name, name_nepali, description, sort_order)
ON CONFLICT ("organization_id", "code") DO NOTHING;
