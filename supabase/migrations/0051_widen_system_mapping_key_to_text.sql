-- ============================================================
-- 0051: Widen system_account_mappings.mapping_key from strict enum to text
-- The admin UI allows custom mapping keys beyond the original enum,
-- causing a DB error on save.
-- ============================================================

-- Drop the enum constraint and widen to plain text
ALTER TABLE system_account_mappings
  ALTER COLUMN mapping_key TYPE text;

-- Recreate the unique index (enum may have replaced it with a different one)
DROP INDEX IF EXISTS sys_map_org_key_uniq;
CREATE UNIQUE INDEX sys_map_org_key_uniq ON system_account_mappings (organization_id, mapping_key);
