-- Document Template Design Studio tables
-- Stores visual canvas-based templates for receipts, vouchers, certificates, reports

CREATE TABLE IF NOT EXISTS document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category VARCHAR(30) NOT NULL,           -- 'report' | 'receipt' | 'voucher' | 'certificate'
  sub_type VARCHAR(50),                    -- 'deposit_receipt', 'payment_voucher', 'share_certificate', etc.
  name TEXT NOT NULL,
  description TEXT,
  page_size VARCHAR(20) DEFAULT 'A4',
  page_width INTEGER,                      -- custom width in mm
  page_height INTEGER,                     -- custom height in mm
  orientation VARCHAR(10) DEFAULT 'portrait',
  margins JSONB DEFAULT '{"top":15,"right":15,"bottom":15,"left":15}',
  layout_json JSONB NOT NULL DEFAULT '{"elements":[]}',
  status VARCHAR(20) DEFAULT 'draft',      -- 'draft' | 'published'
  version INTEGER DEFAULT 1,
  active_version_id UUID,
  is_starter_template BOOLEAN DEFAULT FALSE,
  is_system BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES org_users(id),
  updated_by UUID REFERENCES org_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS dtmpl_org_name_uniq ON document_templates(organization_id, name);
CREATE INDEX IF NOT EXISTS dtmpl_org_cat_idx ON document_templates(organization_id, category);
CREATE INDEX IF NOT EXISTS dtmpl_org_cat_subtype_idx ON document_templates(organization_id, category, sub_type);
CREATE INDEX IF NOT EXISTS dtmpl_org_status_idx ON document_templates(organization_id, status);

CREATE TABLE IF NOT EXISTS document_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  layout_json JSONB NOT NULL,
  change_notes TEXT,
  published_by UUID REFERENCES org_users(id),
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS dtmpl_ver_tpl_ver_uniq ON document_template_versions(template_id, version);
CREATE INDEX IF NOT EXISTS dtmpl_ver_tpl_idx ON document_template_versions(template_id);

-- Add FK from document_templates.active_version_id to document_template_versions
ALTER TABLE document_templates
  ADD CONSTRAINT dtmpl_active_version_fk
  FOREIGN KEY (active_version_id) REFERENCES document_template_versions(id)
  ON DELETE SET NULL;
