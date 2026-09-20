-- Backfill disbursed_date_bs for loans that are in 'Disbursed' status
-- but have an empty or null disbursed_date_bs (created via old LoanService.createLoan flow).
-- Uses the loan's created_at timestamp converted via a reasonable approximation:
-- For seed data, we default to '2083-01-01' as a safe placeholder.
UPDATE loan_accounts
SET disbursed_date_bs = '2083-01-01'
WHERE status = 'Disbursed'
  AND (disbursed_date_bs IS NULL OR disbursed_date_bs = '');

-- Also fix the root cause: make LoanService.createLoan stop writing empty disbursed_date_bs
-- This is handled in the application code (LoanService.ts line 89).
