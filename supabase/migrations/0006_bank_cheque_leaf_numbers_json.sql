-- Add leaf_numbers_json column to bank_cheque_books for individual-mode cheque registration
ALTER TABLE bank_cheque_books
  ADD COLUMN leaf_numbers_json jsonb;
