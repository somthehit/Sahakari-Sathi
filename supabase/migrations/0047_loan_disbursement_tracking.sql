-- Add disbursement tracking columns to loan_accounts
-- These persist the payment channel and reference for audit/trail purposes.

ALTER TABLE loan_accounts
  ADD COLUMN IF NOT EXISTS disbursed_amount numeric(15,2),
  ADD COLUMN IF NOT EXISTS disbursement_payment_method text,
  ADD COLUMN IF NOT EXISTS disbursement_reference_id text;
