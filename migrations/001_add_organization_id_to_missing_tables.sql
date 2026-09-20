-- Migration: Add organizationId to tables missing multi-tenancy support
-- Priority: CRITICAL - Fixes multi-tenancy for 6 tables

-- 1. member_family - Add organizationId
ALTER TABLE "member_family" 
ADD COLUMN IF NOT EXISTS "organization_id" text;

-- Backfill from member
UPDATE "member_family" mf
SET "organization_id" = m."organization_id"
FROM "members" m
WHERE mf."member_id" = m."id" AND mf."organization_id" IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE "member_family" 
ALTER COLUMN "organization_id" SET NOT NULL;

-- Add FK
ALTER TABLE "member_family"
ADD CONSTRAINT "member_family_organization_id_fk"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;

-- 2. member_portal_settings - Add organizationId
ALTER TABLE "member_portal_settings"
ADD COLUMN IF NOT EXISTS "organization_id" text;

UPDATE "member_portal_settings" mps
SET "organization_id" = m."organization_id"
FROM "members" m
WHERE mps."member_id" = m."id" AND mps."organization_id" IS NULL;

ALTER TABLE "member_portal_settings"
ALTER COLUMN "organization_id" SET NOT NULL;

ALTER TABLE "member_portal_settings"
ADD CONSTRAINT "member_portal_settings_organization_id_fk"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;

-- 3. member_biometrics - Add organizationId
ALTER TABLE "member_biometrics"
ADD COLUMN IF NOT EXISTS "organization_id" text;

UPDATE "member_biometrics" mb
SET "organization_id" = m."organization_id"
FROM "members" m
WHERE mb."member_id" = m."id" AND mb."organization_id" IS NULL;

ALTER TABLE "member_biometrics"
ALTER COLUMN "organization_id" SET NOT NULL;

ALTER TABLE "member_biometrics"
ADD CONSTRAINT "member_biometrics_organization_id_fk"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;

-- 4. member_documents - Add organizationId
ALTER TABLE "member_documents"
ADD COLUMN IF NOT EXISTS "organization_id" text;

UPDATE "member_documents" md
SET "organization_id" = m."organization_id"
FROM "members" m
WHERE md."member_id" = m."id" AND md."organization_id" IS NULL;

ALTER TABLE "member_documents"
ALTER COLUMN "organization_id" SET NOT NULL;

ALTER TABLE "member_documents"
ADD CONSTRAINT "member_documents_organization_id_fk"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;

-- 5. document_template_versions - Add organizationId (via document_templates)
ALTER TABLE "document_template_versions"
ADD COLUMN IF NOT EXISTS "organization_id" text;

UPDATE "document_template_versions" dtv
SET "organization_id" = dt."organization_id"
FROM "document_templates" dt
WHERE dtv."template_id" = dt."id" AND dtv."organization_id" IS NULL;

ALTER TABLE "document_template_versions"
ALTER COLUMN "organization_id" SET NOT NULL;

ALTER TABLE "document_template_versions"
ADD CONSTRAINT "document_template_versions_organization_id_fk"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;

-- 6. legal_template_versions - Add organizationId (via legal_templates)
ALTER TABLE "legal_template_versions"
ADD COLUMN IF NOT EXISTS "organization_id" text;

UPDATE "legal_template_versions" ltv
SET "organization_id" = lt."organization_id"
FROM "legal_templates" lt
WHERE ltv."template_id" = lt."id" AND ltv."organization_id" IS NULL;

ALTER TABLE "legal_template_versions"
ALTER COLUMN "organization_id" SET NOT NULL;

ALTER TABLE "legal_template_versions"
ADD CONSTRAINT "legal_template_versions_organization_id_fk"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;

-- 7. designations - Add organizationId (via departments)
ALTER TABLE "designations"
ADD COLUMN IF NOT EXISTS "organization_id" text;

UPDATE "designations" d
SET "organization_id" = dep."organization_id"
FROM "departments" dep
WHERE d."department_id" = dep."id" AND d."organization_id" IS NULL;

ALTER TABLE "designations"
ALTER COLUMN "organization_id" SET NOT NULL;

ALTER TABLE "designations"
ADD CONSTRAINT "designations_organization_id_fk"
FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;

-- Create indexes for all new organization_id columns
CREATE INDEX IF NOT EXISTS "member_family_organization_id_idx" ON "member_family"("organization_id");
CREATE INDEX IF NOT EXISTS "member_portal_settings_organization_id_idx" ON "member_portal_settings"("organization_id");
CREATE INDEX IF NOT EXISTS "member_biometrics_organization_id_idx" ON "member_biometrics"("organization_id");
CREATE INDEX IF NOT EXISTS "member_documents_organization_id_idx" ON "member_documents"("organization_id");
CREATE INDEX IF NOT EXISTS "document_template_versions_organization_id_idx" ON "document_template_versions"("organization_id");
CREATE INDEX IF NOT EXISTS "legal_template_versions_organization_id_idx" ON "legal_template_versions"("organization_id");
CREATE INDEX IF NOT EXISTS "designations_organization_id_idx" ON "designations"("organization_id");