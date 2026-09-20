-- 0040: Loan eligibility gate
-- -------------------------------------
-- Per-loan-product eligibility criteria enforced at loan origination
-- (member lifecycle stage 4) plus an audit trail on loan_accounts for
-- how an application passed (or overrode) the gate.
-- ----------------------------

-- Eligibility criteria are stored on the loan product (per-product config).
-- All fields are open-ended: a value of 0 / false means the rule is not
-- enforced for that product.
ALTER TABLE loan_products
  ADD COLUMN IF NOT EXISTS min_membership_months integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_share_amount numeric(15,2) NOT NULL DEFAULT '0.00',
  ADD COLUMN IF NOT EXISTS require_active_savings boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_savings_balance numeric(15,2) NOT NULL DEFAULT '0.00',
  ADD COLUMN IF NOT EXISTS require_verified_kyc boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_eligibility_override boolean NOT NULL DEFAULT false;

-- Audit columns on the loan account: how the gate resolved when this
-- application was created ('Eligible' | 'Overridden'), the failed reasons
-- (only populated when the application required an override), and the
-- operator's override reason.
ALTER TABLE loan_accounts
  ADD COLUMN IF NOT EXISTS eligibility_status text,
  ADD COLUMN IF NOT EXISTS eligibility_reasons jsonb,
  ADD COLUMN IF NOT EXISTS eligibility_override_reason text;