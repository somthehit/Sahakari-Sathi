-- Migration 0049: Loan Application Origination tables
-- Adds loan_applications, loan_guarantors, loan_documents, loan_document_templates
-- Tamsuk / collateral detail fields stored as JSONB on loan_applications

CREATE TABLE IF NOT EXISTS loan_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  borrower_id UUID NOT NULL REFERENCES members(id),
  co_borrower_id UUID REFERENCES members(id),
  loan_product_id UUID NOT NULL REFERENCES loan_products(id),
  requested_amount NUMERIC(15,2) NOT NULL,
  approved_amount NUMERIC(15,2),
  tenure_months INTEGER NOT NULL,
  purpose_category VARCHAR(50),
  purpose_detail TEXT,
  repayment_frequency VARCHAR(20) DEFAULT 'monthly',
  grace_period_days INTEGER DEFAULT 0,
  disbursement_bank_account_id UUID,
  cib_check_status VARCHAR(20),
  cib_checked_at TIMESTAMPTZ,
  cib_checked_by UUID,
  ltv_ratio NUMERIC(6,4),
  risk_grade VARCHAR(10),
  calculated_emi NUMERIC(15,2),
  status VARCHAR(30) DEFAULT 'draft',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  remarks TEXT,
  -- Collateral & guarantor data stored as JSONB (for origination before loan_accounts exists)
  collaterals JSONB DEFAULT '[]',
  guarantors_data JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS loan_app_org_idx ON loan_applications(organization_id);
CREATE INDEX IF NOT EXISTS loan_app_borrower_idx ON loan_applications(borrower_id);
CREATE INDEX IF NOT EXISTS loan_app_status_idx ON loan_applications(status);

CREATE TABLE IF NOT EXISTS loan_guarantors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  guarantor_member_id UUID REFERENCES members(id),
  full_name TEXT NOT NULL,
  relationship_to_borrower TEXT,
  citizenship_no TEXT,
  address TEXT,
  monthly_income NUMERIC(15,2),
  income_source TEXT,
  signature_collected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loan_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_application_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  document_stage VARCHAR(20) DEFAULT 'uploaded',
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID,
  verified BOOLEAN DEFAULT FALSE,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  remarks TEXT
);

CREATE TABLE IF NOT EXISTS loan_document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_type VARCHAR(30) NOT NULL,
  template_content TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
