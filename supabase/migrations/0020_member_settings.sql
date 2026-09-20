-- =============================================================
-- 0020: Member Settings (Module 3)
-- Seven org-scoped lookup/catalog tables:
--   member_types, member_categories, occupations, education_levels,
--   nominee_types, relationship_types, member_statuses
-- member_types carries three extra financial fields.
-- Code is stored UPPERCASE, unique per (organization_id, code).
-- =============================================================

-- ---- 1. Member Types (extended financial fields) -------------------------
CREATE TABLE IF NOT EXISTS "member_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "code" varchar(20) NOT NULL,
  "name" varchar(100) NOT NULL,
  "name_nepali" varchar(100),
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  "min_share_units" integer DEFAULT 0 NOT NULL,
  "entrance_fee" numeric(12, 2) DEFAULT '0.00' NOT NULL,
  "share_value_per_unit" numeric(12, 2) DEFAULT '0.00' NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "member_types_org_code_uniq" ON "member_types" ("organization_id", "code");
CREATE INDEX IF NOT EXISTS "member_types_org_active_idx" ON "member_types" ("organization_id", "is_active");

-- ---- 2. Member Categories -------------------------------------------------
CREATE TABLE IF NOT EXISTS "member_categories" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "member_categories_org_code_uniq" ON "member_categories" ("organization_id", "code");
CREATE INDEX IF NOT EXISTS "member_categories_org_active_idx" ON "member_categories" ("organization_id", "is_active");

-- ---- 3. Occupations -------------------------------------------------------
CREATE TABLE IF NOT EXISTS "occupations" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "occupations_org_code_uniq" ON "occupations" ("organization_id", "code");
CREATE INDEX IF NOT EXISTS "occupations_org_active_idx" ON "occupations" ("organization_id", "is_active");

-- ---- 4. Education Levels --------------------------------------------------
CREATE TABLE IF NOT EXISTS "education_levels" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "education_levels_org_code_uniq" ON "education_levels" ("organization_id", "code");
CREATE INDEX IF NOT EXISTS "education_levels_org_active_idx" ON "education_levels" ("organization_id", "is_active");

-- ---- 5. Nominee Types -----------------------------------------------------
CREATE TABLE IF NOT EXISTS "nominee_types" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "nominee_types_org_code_uniq" ON "nominee_types" ("organization_id", "code");
CREATE INDEX IF NOT EXISTS "nominee_types_org_active_idx" ON "nominee_types" ("organization_id", "is_active");

-- ---- 6. Relationship Types ------------------------------------------------
CREATE TABLE IF NOT EXISTS "relationship_types" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "relationship_types_org_code_uniq" ON "relationship_types" ("organization_id", "code");
CREATE INDEX IF NOT EXISTS "relationship_types_org_active_idx" ON "relationship_types" ("organization_id", "is_active");

-- ---- 7. Member Statuses ---------------------------------------------------
CREATE TABLE IF NOT EXISTS "member_statuses" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "member_statuses_org_code_uniq" ON "member_statuses" ("organization_id", "code");
CREATE INDEX IF NOT EXISTS "member_statuses_org_active_idx" ON "member_statuses" ("organization_id", "is_active");
