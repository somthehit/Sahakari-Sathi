-- Department Registration Form Fields
-- Extends the departments table with fields surfaced in the Department
-- setup form (create / edit / view) while preserving the original slim core.
-- All new columns are nullable or carry safe defaults so existing rows remain valid.

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS code varchar(50),
  ADD COLUMN IF NOT EXISTS head_of_department text,
  ADD COLUMN IF NOT EXISTS branch_id uuid,
  ADD COLUMN IF NOT EXISTS staff_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS budget_allocation numeric(15,2) NOT NULL DEFAULT '0',
  ADD COLUMN IF NOT EXISTS used_budget numeric(15,2) NOT NULL DEFAULT '0',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS cost_center_code varchar(50),
  ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS departments_org_code_uniq ON departments (organization_id, code);
CREATE INDEX IF NOT EXISTS departments_org_idx ON departments (organization_id);
