-- Add running_balance to voucher_entries for per-entry ledger balance
ALTER TABLE voucher_entries ADD COLUMN running_balance NUMERIC(18,4);
