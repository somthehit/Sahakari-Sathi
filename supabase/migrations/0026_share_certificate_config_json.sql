-- =============================================================
-- 0026: Share Certificate Format — full visual design payload
--   Stores the JSON CertificateConfig produced by the
--   ShareCertificateDesigner (SETUPS → Share Settings →
--   Share Certificate Format) so the Share page can render the
--   exact same design for a member's share certificate.
-- =============================================================
ALTER TABLE "share_certificate_formats" ADD COLUMN IF NOT EXISTS "config_json" text;
