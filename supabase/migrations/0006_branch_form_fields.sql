-- Branch Registration Form Fields
-- Extends the branches table with fields surfaced in the Branch Registration
-- form (create / edit / view) while preserving the original 10-column core.
-- All new columns are nullable or carry safe defaults so existing rows remain valid.

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS branch_type text NOT NULL DEFAULT 'Branch',
  ADD COLUMN IF NOT EXISTS is_head_office boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS municipality text,
  ADD COLUMN IF NOT EXISTS ward text,
  ADD COLUMN IF NOT EXISTS tole text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS opening_date_bs text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS latitude numeric(12,8),
  ADD COLUMN IF NOT EXISTS longitude numeric(12,8),
  ADD COLUMN IF NOT EXISTS google_map_link text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS working_days text,
  ADD COLUMN IF NOT EXISTS opening_time text,
  ADD COLUMN IF NOT EXISTS closing_time text,
  ADD COLUMN IF NOT EXISTS remarks text;
