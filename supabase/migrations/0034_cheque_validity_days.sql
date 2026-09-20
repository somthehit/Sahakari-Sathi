-- Migration: 0034_cheque_validity_days.sql
-- Adds cheque_validity_days to savings_products.
-- Default 90 days — staff should confirm the exact figure with their regulatory
-- requirements; the default can be updated via Cheque Settings in the UI.

ALTER TABLE "savings_products"
  ADD COLUMN IF NOT EXISTS "cheque_validity_days" integer NOT NULL DEFAULT 90;
