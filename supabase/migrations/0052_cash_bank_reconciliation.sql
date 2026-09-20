-- ============================================================
-- 0052: Bank & Cash Reconciliation tables
-- Supports daily cash/bank reconciliation and variance analysis
-- ============================================================

-- Reconciliation sessions (one per bank account or vault per day)
CREATE TABLE IF NOT EXISTS bank_reconciliation (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id       UUID NOT NULL REFERENCES branches(id),
  -- Target: either a bank account GL or vault cash
  reconciliation_type TEXT NOT NULL CHECK (reconciliation_type IN ('bank', 'vault')),
  bank_account_id UUID REFERENCES bank_accounts(id),
  gl_account_id   UUID NOT NULL REFERENCES chart_of_accounts(id),
  -- Period
  reconcile_date_bs TEXT NOT NULL,
  reconcile_date_ad TEXT NOT NULL,
  -- Balances
  book_balance    NUMERIC(18,2) NOT NULL DEFAULT 0,
  statement_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  variance        NUMERIC(18,2) NOT NULL DEFAULT 0,
  -- Status
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'reconciled', 'exception')),
  reconciled_by   TEXT,
  reconciled_at   TIMESTAMP,
  remarks         TEXT,
  -- Audit
  created_by      UUID,
  created_at      TIMESTAMP NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recon_org_date ON bank_reconciliation (organization_id, reconcile_date_bs);
CREATE INDEX IF NOT EXISTS idx_recon_type ON bank_reconciliation (organization_id, reconciliation_type);
CREATE INDEX IF NOT EXISTS idx_recon_status ON bank_reconciliation (organization_id, status);

-- Individual entries matched during reconciliation
CREATE TABLE IF NOT EXISTS bank_reconciliation_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id UUID NOT NULL REFERENCES bank_reconciliation(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Book side (from voucher_entries / bank_books / cash_books)
  voucher_id      UUID REFERENCES vouchers(id),
  voucher_entry_id UUID REFERENCES voucher_entries(id),
  book_date_bs    TEXT NOT NULL,
  book_description TEXT,
  book_debit      NUMERIC(18,2) NOT NULL DEFAULT 0,
  book_credit     NUMERIC(18,2) NOT NULL DEFAULT 0,
  -- Bank/statement side
  statement_date_bs TEXT,
  statement_description TEXT,
  statement_debit NUMERIC(18,2) NOT NULL DEFAULT 0,
  statement_credit NUMERIC(18,2) NOT NULL DEFAULT 0,
  -- Match
  match_status    TEXT NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('matched', 'partial', 'unmatched', 'exception')),
  match_type      TEXT CHECK (match_type IN ('auto', 'manual', 'exception')),
  variance_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  exception_reason TEXT,
  resolved_by     TEXT,
  resolved_at     TIMESTAMP,
  -- Audit
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recon_entry_recon ON bank_reconciliation_entries (reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_recon_entry_voucher ON bank_reconciliation_entries (voucher_id);

-- Variance analysis log (tracks exceptions and resolutions)
CREATE TABLE IF NOT EXISTS cash_variance_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id       UUID NOT NULL REFERENCES branches(id),
  reconciliation_id UUID REFERENCES bank_reconciliation(id),
  variance_type   TEXT NOT NULL CHECK (variance_type IN ('cash_short', 'cash_over', 'bank_difference', 'unmatched_entry', 'missing_entry')),
  amount          NUMERIC(18,2) NOT NULL DEFAULT 0,
  description     TEXT,
  gl_account_id   UUID REFERENCES chart_of_accounts(id),
  -- Resolution
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'ignored')),
  resolution_note TEXT,
  resolved_by     TEXT,
  resolved_at     TIMESTAMP,
  -- Audit
  reported_by     TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_variance_org_status ON cash_variance_log (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_variance_type ON cash_variance_log (organization_id, variance_type);
