-- ============================================================
-- 0050: Add custom_gl_mappings JSONB column to loan_applications
-- Stores per-loan-override GL account mappings (mappingKey → accountId)
-- ============================================================

ALTER TABLE loan_applications
ADD COLUMN IF NOT EXISTS custom_gl_mappings JSONB DEFAULT '{}';

COMMENT ON COLUMN loan_applications.custom_gl_mappings IS 'JSONB map of mappingKey → chart-of-accounts UUID for per-loan GL overrides (e.g. loan_principal_receivable → specific asset account)';
