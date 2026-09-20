-- 0042: Organization share ceilings + running totals, per-class subsidiary links
-- ---------------------------------------------------------------------
-- 1. organization_share_settings — one row per org holding the THREE ceilings
--    (share-type ceiling lives on share_types itself) and the running totals:
--      authorized_capital_ceiling  authorized capital (NPR)     [ceiling #3]
--      authorized_total_kitta      authorized kitta count       [ceiling #2]
--      total_issued_kitta          running count (issue +, return -)
--      total_issued_capital        running NPR amount (issue +, return -)
--    The running totals are updated ATOMICALLY inside the issue/return
--    transaction under SELECT ... FOR UPDATE, so org-wide checks are O(1)
--    and two concurrent issuances can never both pass a stale check.
-- 2. subsidiary_shares_book gains share_type_id + share_account_id so the
--    certificate register and manual-entry overlap validation can be scoped
--    per share class.
-- This migration is purely additive (new table + columns) and idempotent.
-- ---------------------------------------------------------------------

ALTER TABLE subsidiary_shares_book
  ADD COLUMN IF NOT EXISTS share_type_id uuid,
  ADD COLUMN IF NOT EXISTS share_account_id uuid;

CREATE TABLE IF NOT EXISTS organization_share_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  authorized_capital_ceiling numeric(14, 2) NOT NULL,
  authorized_total_kitta integer NOT NULL,
  default_face_value numeric(8, 2) DEFAULT '100.00',
  total_issued_kitta integer NOT NULL DEFAULT 0,
  total_issued_capital numeric(14, 2) NOT NULL DEFAULT '0.00',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Backfill subsidiary_shares_book.share_type_id from the matching
-- share_transactions movement (same member + voucher).
UPDATE subsidiary_shares_book s
SET share_type_id = st.share_type_id
FROM share_transactions st
WHERE s.share_type_id IS NULL
  AND st.member_id = s.member_id
  AND st.voucher_no = s.voucher_no;

-- Backfill subsidiary_shares_book.share_account_id from the member's master account.
UPDATE subsidiary_shares_book s
SET share_account_id = sa.id
FROM share_accounts sa
WHERE s.share_account_id IS NULL
  AND sa.organization_id = s.organization_id
  AND sa.member_id = s.member_id;

-- Seed organization_share_settings for every org that already has issued
-- share capital. Ceiling defaults equal the CURRENT issued totals, so
-- enforcement only bounds NEW issuance — nothing existing gets blocked.
-- Orgs without share data yet get their row lazily on first issuance.
INSERT INTO organization_share_settings (
  organization_id,
  authorized_capital_ceiling,
  authorized_total_kitta,
  total_issued_kitta,
  total_issued_capital
)
SELECT
  sa.organization_id,
  COALESCE(SUM(sa.total_capital_amount), 0),
  COALESCE(SUM(sa.total_shares), 0),
  COALESCE(SUM(sa.total_shares), 0),
  COALESCE(SUM(sa.total_capital_amount), 0)
FROM share_accounts sa
GROUP BY sa.organization_id
ON CONFLICT (organization_id) DO NOTHING;