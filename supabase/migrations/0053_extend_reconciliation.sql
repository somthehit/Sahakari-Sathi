-- ============================================================
-- 0053: Extend reconciliation for proper bank reconciliation flow
-- Adds: statement entries, adjustments, outstanding tracking
-- ============================================================

-- Extend bank_reconciliation with proper fields
ALTER TABLE bank_reconciliation
  ADD COLUMN IF NOT EXISTS statement_opening_balance NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjusted_balance NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outstanding_cheques_total NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposits_in_transit_total NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjustments_total NUMERIC(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS statement_period_from VARCHAR(10),
  ADD COLUMN IF NOT EXISTS statement_period_to VARCHAR(10),
  ADD COLUMN IF NOT EXISTS prepared_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS reconciled_date_bs VARCHAR(10);

-- Bank statement entries (imported or manually entered)
CREATE TABLE IF NOT EXISTS reconciliation_statement_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id UUID NOT NULL REFERENCES bank_reconciliation(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_date_bs VARCHAR(10) NOT NULL,
  description TEXT,
  reference TEXT,
  cheque_no VARCHAR(50),
  debit NUMERIC(18,2) NOT NULL DEFAULT 0,
  credit NUMERIC(18,2) NOT NULL DEFAULT 0,
  -- Matching
  match_status TEXT NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('matched', 'partial', 'unmatched')),
  matched_recon_entry_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stmt_entry_recon ON reconciliation_statement_entries (reconciliation_id);

-- Reconciliation adjustments (bank charges, interest, direct debits etc.)
CREATE TABLE IF NOT EXISTS reconciliation_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id UUID NOT NULL REFERENCES bank_reconciliation(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('bank_charge', 'interest_earned', 'interest_charged', 'direct_debit', 'direct_credit', 'error_correction', 'other')),
  description TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  date_bs VARCHAR(10) NOT NULL,
  -- Link to GL voucher if adjustment has been posted
  voucher_id UUID REFERENCES vouchers(id),
  -- Whether this adjustment needs a GL posting
  needs_posting BOOLEAN DEFAULT true,
  posted_by TEXT,
  posted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adj_recon ON reconciliation_adjustments (reconciliation_id);

-- Outstanding cheques tracking per reconciliation
CREATE TABLE IF NOT EXISTS reconciliation_outstanding_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id UUID NOT NULL REFERENCES bank_reconciliation(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('outstanding_cheque', 'deposit_in_transit')),
  -- Reference to the source record
  source_id UUID,
  source_type TEXT CHECK (source_type IN ('bank_cheque_leaf', 'voucher_entry')),
  cheque_no VARCHAR(50),
  payee_name TEXT,
  description TEXT,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  entry_date_bs VARCHAR(10) NOT NULL,
  -- Status in reconciliation
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'cleared', 'voided')),
  cleared_date_bs VARCHAR(10),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outstanding_recon ON reconciliation_outstanding_items (reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_outstanding_type ON reconciliation_outstanding_items (reconciliation_id, item_type);
