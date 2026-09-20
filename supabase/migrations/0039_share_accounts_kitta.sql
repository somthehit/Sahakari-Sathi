-- 0039: Auto-provisioned share accounts + org-wide kitta counters
-- -------------------------------------
-- Adds the master share_accounts table (1 per member, auto-provisioned on
-- first issuance), an org-scoped sequential kitta counter row, and the
-- distinctive kitta range columns on the shares subsidiary book.
-- ----------------------------

CREATE TABLE IF NOT EXISTS share_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id),
  account_no text NOT NULL,
  total_shares integer NOT NULL DEFAULT 0,
  total_capital_amount numeric(15,2) NOT NULL DEFAULT '0.00',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT share_account_org_member_uniq UNIQUE (organization_id, member_id),
  CONSTRAINT share_account_org_no_uniq UNIQUE (organization_id, account_no)
);

CREATE INDEX IF NOT EXISTS share_account_org_idx ON share_accounts (organization_id);

CREATE TABLE IF NOT EXISTS organization_kitta_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  last_kitta_no integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_kitta_counter_org_uniq UNIQUE (organization_id)
);

ALTER TABLE subsidiary_shares_book
  ADD COLUMN IF NOT EXISTS start_kitta_no integer,
  ADD COLUMN IF NOT EXISTS end_kitta_no integer;

-- Backfill master accounts from active holdings (idempotent).
INSERT INTO share_accounts (organization_id, member_id, account_no, total_shares, total_capital_amount)
SELECT
  h.organization_id,
  h.member_id,
  'SHA-' || m.member_no,
  SUM(h.number_of_shares)::int,
  SUM(h.total_value::numeric)
FROM share_holdings h
JOIN members m ON m.id = h.member_id
WHERE h.status = 'Active'
GROUP BY h.organization_id, h.member_id, m.member_no
ON CONFLICT (organization_id, member_id) DO NOTHING;

-- Backfill org-wide kitta counters.
-- Legacy convention: a member holding `T` shares owns kitta [1001, 1000 + T],
-- so the org's next free kitta is 1001 + T.
INSERT INTO organization_kitta_counters (organization_id, last_kitta_no)
SELECT organization_id, 1000 + MAX(total_shares)
FROM share_accounts
GROUP BY organization_id
ON CONFLICT (organization_id) DO NOTHING;

INSERT INTO organization_kitta_counters (organization_id, last_kitta_no)
SELECT id, 1000
FROM organizations
ON CONFLICT (organization_id) DO NOTHING;