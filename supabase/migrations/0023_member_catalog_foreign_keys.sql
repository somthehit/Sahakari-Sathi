-- =============================================================
-- 0023: Member classification catalogs → org-scoped FK columns (Phase 1)
--
-- Purely additive. Adds:
--   * member_types.is_group_type            (flags "Group"-like Member Types)
--   * members.member_type_id / member_category_id / group_id
--   * member_kyc_profiles.occupation_id / education_level_id
--   * member_family.nominee_relation_id / nominee_type_id
--
-- Then SEEDS any missing catalog rows from existing text usage
-- (create matching rows, never reassign, leave existing rows untouched)
-- and BACKFILLS the new FK columns from the old text values.
-- Nothing is dropped here — that happens in 0024.
-- =============================================================

-- ---- 1. member_types.is_group_type -------------------------------------
ALTER TABLE "member_types"
  ADD COLUMN IF NOT EXISTS "is_group_type" boolean DEFAULT false NOT NULL;

-- ---- 2. members FK columns (nullable in phase 1) ------------------------
ALTER TABLE "members"
  ADD COLUMN IF NOT EXISTS "member_type_id" uuid REFERENCES "member_types"("id") ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS "member_category_id" uuid REFERENCES "member_categories"("id") ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS "group_id" uuid REFERENCES "groups"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "members_member_type_idx" ON "members" ("member_type_id");
CREATE INDEX IF NOT EXISTS "members_member_category_idx" ON "members" ("member_category_id");
CREATE INDEX IF NOT EXISTS "members_group_idx" ON "members" ("group_id");

-- ---- 3. member_kyc_profiles FK columns ---------------------------------
ALTER TABLE "member_kyc_profiles"
  ADD COLUMN IF NOT EXISTS "occupation_id" uuid REFERENCES "occupations"("id") ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS "education_level_id" uuid REFERENCES "education_levels"("id") ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS "member_kyc_occupation_idx" ON "member_kyc_profiles" ("occupation_id");
CREATE INDEX IF NOT EXISTS "member_kyc_education_idx" ON "member_kyc_profiles" ("education_level_id");

-- ---- 4. member_family FK columns ---------------------------------------
ALTER TABLE "member_family"
  ADD COLUMN IF NOT EXISTS "nominee_relation_id" uuid REFERENCES "relationship_types"("id") ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS "nominee_type_id" uuid REFERENCES "nominee_types"("id") ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS "member_family_nominee_relation_idx" ON "member_family" ("nominee_relation_id");
CREATE INDEX IF NOT EXISTS "member_family_nominee_type_idx" ON "member_family" ("nominee_type_id");

-- ---- 5. Seed missing catalog rows from existing text usage --------------
-- For every org, create a row for each distinct text value that is currently
-- referenced but has no matching catalog row. Existing rows (e.g. the seeded
-- IND / Individual Member) are left untouched. Matches by name (case-insensitive)
-- or by the normalized UPPERCASE code so we never create duplicates.
-- Code derivation: UPPER(REPLACE(value, ' ', '_')) mirrors the API normalizer.
-- -------------------------------------------------------------------------

-- member_types ← members.membership_type
INSERT INTO "member_types" ("organization_id", "code", "name", "is_system", "is_group_type")
SELECT DISTINCT
  m."organization_id",
  UPPER(REPLACE(TRIM(m."membership_type"), ' ', '_')),
  TRIM(m."membership_type"),
  true,
  false
FROM "members" m
WHERE m."membership_type" IS NOT NULL AND TRIM(m."membership_type") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "member_types" t
    WHERE t."organization_id" = m."organization_id"
      AND (t."name" ILIKE TRIM(m."membership_type")
           OR t."code" = UPPER(REPLACE(TRIM(m."membership_type"), ' ', '_')))
  )
ON CONFLICT ("organization_id", "code") DO NOTHING;

-- member_categories ← members.member_category
INSERT INTO "member_categories" ("organization_id", "code", "name", "is_system")
SELECT DISTINCT
  m."organization_id",
  UPPER(REPLACE(TRIM(m."member_category"), ' ', '_')),
  TRIM(m."member_category"),
  true
FROM "members" m
WHERE m."member_category" IS NOT NULL AND TRIM(m."member_category") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "member_categories" c
    WHERE c."organization_id" = m."organization_id"
      AND (c."name" ILIKE TRIM(m."member_category")
           OR c."code" = UPPER(REPLACE(TRIM(m."member_category"), ' ', '_')))
  )
ON CONFLICT ("organization_id", "code") DO NOTHING;

-- occupations ← member_kyc_profiles.occupation
INSERT INTO "occupations" ("organization_id", "code", "name", "is_system")
SELECT DISTINCT
  k."organization_id",
  UPPER(REPLACE(TRIM(k."occupation"), ' ', '_')),
  TRIM(k."occupation"),
  true
FROM "member_kyc_profiles" k
WHERE k."occupation" IS NOT NULL AND TRIM(k."occupation") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "occupations" o
    WHERE o."organization_id" = k."organization_id"
      AND (o."name" ILIKE TRIM(k."occupation")
           OR o."code" = UPPER(REPLACE(TRIM(k."occupation"), ' ', '_')))
  )
ON CONFLICT ("organization_id", "code") DO NOTHING;

-- relationship_types ← member_family.nominee_relation
-- NOTE: member_family has no organization_id; the org is derived via the member.
INSERT INTO "relationship_types" ("organization_id", "code", "name", "is_system")
SELECT DISTINCT
  m."organization_id",
  UPPER(REPLACE(TRIM(f."nominee_relation"), ' ', '_')),
  TRIM(f."nominee_relation"),
  true
FROM "member_family" f
JOIN "members" m ON m."id" = f."member_id"
WHERE f."nominee_relation" IS NOT NULL AND TRIM(f."nominee_relation") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "relationship_types" rt
    WHERE rt."organization_id" = m."organization_id"
      AND (rt."name" ILIKE TRIM(f."nominee_relation")
           OR rt."code" = UPPER(REPLACE(TRIM(f."nominee_relation"), ' ', '_')))
  )
ON CONFLICT ("organization_id", "code") DO NOTHING;

-- ---- 6. Backfill the new FK columns from the old text values ------------
-- Match by name (case-insensitive) OR normalized code, within the org only.
-- -------------------------------------------------------------------------

UPDATE "members" m
SET "member_type_id" = (
  SELECT t."id" FROM "member_types" t
  WHERE t."organization_id" = m."organization_id"
    AND (t."name" ILIKE TRIM(m."membership_type")
         OR t."code" = UPPER(REPLACE(TRIM(m."membership_type"), ' ', '_')))
  ORDER BY t."is_active" DESC, t."sort_order", t."created_at"
  LIMIT 1
)
WHERE m."member_type_id" IS NULL
  AND m."membership_type" IS NOT NULL AND TRIM(m."membership_type") <> '';

UPDATE "members" m
SET "member_category_id" = (
  SELECT c."id" FROM "member_categories" c
  WHERE c."organization_id" = m."organization_id"
    AND (c."name" ILIKE TRIM(m."member_category")
         OR c."code" = UPPER(REPLACE(TRIM(m."member_category"), ' ', '_')))
  ORDER BY c."is_active" DESC, c."sort_order", c."created_at"
  LIMIT 1
)
WHERE m."member_category_id" IS NULL
  AND m."member_category" IS NOT NULL AND TRIM(m."member_category") <> '';

UPDATE "member_kyc_profiles" k
SET "occupation_id" = (
  SELECT o."id" FROM "occupations" o
  WHERE o."organization_id" = k."organization_id"
    AND (o."name" ILIKE TRIM(k."occupation")
         OR o."code" = UPPER(REPLACE(TRIM(k."occupation"), ' ', '_')))
  ORDER BY o."is_active" DESC, o."sort_order", o."created_at"
  LIMIT 1
)
WHERE k."occupation_id" IS NULL
  AND k."occupation" IS NOT NULL AND TRIM(k."occupation") <> '';

UPDATE "member_family" f
SET "nominee_relation_id" = (
  SELECT rt."id" FROM "relationship_types" rt
  WHERE rt."organization_id" = m."organization_id"
    AND (rt."name" ILIKE TRIM(f."nominee_relation")
         OR rt."code" = UPPER(REPLACE(TRIM(f."nominee_relation"), ' ', '_')))
  ORDER BY rt."is_active" DESC, rt."sort_order", rt."created_at"
  LIMIT 1
)
FROM "members" m
WHERE m."id" = f."member_id"
  AND f."nominee_relation_id" IS NULL
  AND f."nominee_relation" IS NOT NULL AND TRIM(f."nominee_relation") <> '';
