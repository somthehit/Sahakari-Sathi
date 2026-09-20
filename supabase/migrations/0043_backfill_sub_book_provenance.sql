-- 0043: Backfill legacy subsidiary_shares_book provenance + finish schema wiring
-- ---------------------------------------------------------------------
-- 0042 added share_type_id / share_account_id columns but only backfilled
-- them from matching share_transactions rows. Legacy rows written directly to
-- the sub-book (auto-opening pushes at member registration, demo seeds) have
-- no share_transactions counterpart, so they are still NULL — which makes the
-- certificate register bucket them under "Legacy" and skips overlap validation.
--
-- This migration:
--   1. Backfills the remaining NULL share_type_id from the member's single
--      Active share holding (the authoritative source for the class).
--   2. For Transfer_In rows with no holding (target member may have no active
--      holding), propagates the class from the paired Transfer_Out row that
--      shares the same voucher_no — a transfer never changes share class.
--   3. Adds the missing subs_shares_org_type_idx index (declared in the Drizzle
--      schema but never created) that the getShareAccountDetail join and
--      certificate-register builder rely on.
--   4. Adds the FK constraints for share_type_id / share_account_id declared
--      in the Drizzle schema (ON DELETE SET NULL).
-- Purely additive + idempotent.
-- ---------------------------------------------------------------------

-- Backfill from the member's Active holding (single authoritative class).
UPDATE subsidiary_shares_book s
SET share_type_id = h.share_type_id
FROM share_holdings h
WHERE s.share_type_id IS NULL
  AND h.member_id = s.member_id
  AND h.status = 'Active'
  AND h.organization_id = s.organization_id;

-- Propagate Transfer_Out class to the paired Transfer_In (same voucher).
UPDATE subsidiary_shares_book s
SET share_type_id = out_row.share_type_id
FROM (
  SELECT s2.voucher_no, s2.member_id, s2.share_type_id
  FROM subsidiary_shares_book s2
  WHERE s2.transaction_type = 'Transfer_Out'
    AND s2.share_type_id IS NOT NULL
) out_row
WHERE s.transaction_type = 'Transfer_In'
  AND s.share_type_id IS NULL
  AND s.voucher_no = out_row.voucher_no;

-- Index used by getShareAccountDetail + certificate register (per class).
CREATE INDEX IF NOT EXISTS subs_shares_org_type_idx
  ON subsidiary_shares_book (organization_id, share_type_id);

-- FK wiring to keep the ledger referentially sound (matches Drizzle schema).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subs_shares_share_type_fk'
      AND conrelid = 'subsidiary_shares_book'::regclass
  ) THEN
    ALTER TABLE subsidiary_shares_book
      ADD CONSTRAINT subs_shares_share_type_fk
      FOREIGN KEY (share_type_id) REFERENCES share_types(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subs_shares_share_account_fk'
      AND conrelid = 'subsidiary_shares_book'::regclass
  ) THEN
    ALTER TABLE subsidiary_shares_book
      ADD CONSTRAINT subs_shares_share_account_fk
      FOREIGN KEY (share_account_id) REFERENCES share_accounts(id) ON DELETE SET NULL;
  END IF;
END $$;