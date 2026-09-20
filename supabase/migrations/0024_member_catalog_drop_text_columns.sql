-- =============================================================
-- 0024: Member classification catalogs — drop text columns (Phase 2)
--
-- Safe teardown AFTER 0023 backfilled the FK columns:
--   * guard: abort unless every member has a resolved member_type_id /
--     member_category_id (no data loss).
--   * DROP the legacy text columns that are now superseded by FKs.
--   * enforce NOT NULL on the new required FKs.
--   * add a trigger invariant: group_id may only be set when the member's
--     Member Type is flagged is_group_type = true.
-- =============================================================

-- ---- 1. Guard: never drop columns while references are unmapped --------
DO $$
DECLARE
  orphans integer;
BEGIN
  SELECT count(*) INTO orphans FROM "members" WHERE "member_type_id" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION 'Cannot drop members.membership_type: % member(s) have no member_type_id', orphans;
  END IF;
  SELECT count(*) INTO orphans FROM "members" WHERE "member_category_id" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION 'Cannot drop members.member_category: % member(s) have no member_category_id', orphans;
  END IF;
END $$;

-- ---- 2. NOT NULL on the new required FKs -------------------------------
ALTER TABLE "members" ALTER COLUMN "member_type_id" SET NOT NULL;
ALTER TABLE "members" ALTER COLUMN "member_category_id" SET NOT NULL;

-- ---- 3. Drop legacy text columns ---------------------------------------
ALTER TABLE "members" DROP COLUMN IF EXISTS "membership_type";
ALTER TABLE "members" DROP COLUMN IF EXISTS "member_category";
ALTER TABLE "member_kyc_profiles" DROP COLUMN IF EXISTS "occupation";
ALTER TABLE "member_family" DROP COLUMN IF EXISTS "nominee_relation";

-- ---- 4. Group-only-when-group-type invariant ---------------------------
CREATE OR REPLACE FUNCTION enforce_member_group_type()
RETURNS trigger AS $$
BEGIN
  IF NEW."group_id" IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM "member_types" t
      WHERE t."id" = NEW."member_type_id" AND t."is_group_type" = true
    ) THEN
      RAISE EXCEPTION 'Group assignment requires a Member Type flagged as a group type.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS members_group_type_invariant ON "members";
CREATE TRIGGER members_group_type_invariant
BEFORE INSERT OR UPDATE OF "group_id", "member_type_id" ON "members"
FOR EACH ROW EXECUTE FUNCTION enforce_member_group_type();
