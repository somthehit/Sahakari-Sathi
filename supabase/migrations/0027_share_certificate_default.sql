-- =============================================================
-- 0027: Org default share certificate format
--   Stores the organization-wide default Share Certificate Format
--   used by the Share page when printing a member's certificate.
--   Mirrors default_share_scheme_id (added in 0025).
-- =============================================================
ALTER TABLE "organization_profiles" ADD COLUMN IF NOT EXISTS "default_certificate_format_id" uuid REFERENCES "share_certificate_formats"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "organization_profiles_default_cert_format_idx" ON "organization_profiles" ("default_certificate_format_id");
