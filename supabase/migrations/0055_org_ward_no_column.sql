-- Add ward_no column to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ward_no integer;
