-- ============================================================
-- Migration: 0038_share_issue_cash_posting_fix.sql
--
-- Root cause of "Share Issued shows on the Liabilities ledger but
-- the corresponding Cash (Asset) entries never appear":
--
--   1. `findOrCreateCashAccount` selected/created the legacy `01-01
--      Cash / Bank` account. The 4 Ledger Book sheets (LedgerBookSheets)
--      classify ASSET accounts by code prefix (`04-*` / `100*`), so a
--      `01-*` cash debit was invisible on the Assets sheet while the
--      `01-10 Share Capital` credit rendered on Liabilities.
--   2. Historical share-issue/transfer JV vouchers (JV-00001..) existed
--      with ZERO `voucher_entries` - no double-entry posted at all.
--   3. `system_account_mappings.cash_bank` pointed at that `01-01`
--      account, so savings receipts also posted their cash leg there.
--
-- Fix:
--   - Repoint `cash_bank` onto the ledger-sheet cash account (`04-80`,
--     else `04-90`).
--   - Re-tag historical `01-01` voucher_entries to `04-80` so past
--     savings cash renders on the Assets sheet.
--   - Backfill missing share issue entries (Dr Cash / Cr Share Capital)
--     and share transfer entries (Dr/Cr Share Capital) for Posted JVs
--     that have no entries yet (idempotent).
--   - Reconcile COA balances from the complete voucher_entries and
--     retire the legacy `01-01` account.
-- ============================================================

-- 1) Repoint cash_bank system mapping onto a ledger-book cash account.
UPDATE system_account_mappings AS sam
SET account_id = tgt.id,
    updated_at = now()
FROM chart_of_accounts AS src
JOIN LATERAL (
  SELECT c.id
  FROM chart_of_accounts c
  WHERE c.organization_id = src.organization_id
    AND c.type = 'Asset'
    AND c.is_active = true
    AND c.code IN ('04-80', '04-90')
  ORDER BY c.code
  LIMIT 1
) AS tgt ON true
WHERE sam.mapping_key = 'cash_bank'
  AND sam.account_id = src.id
  AND src.organization_id = sam.organization_id
  AND src.code NOT IN ('04-80', '04-90');

-- 2) Re-tag historical voucher_entries that posted against the legacy
--    01-01 account so they render on the Assets sheet as cash (04-80).
UPDATE voucher_entries AS ve
SET account_id = tgt.id,
    account_code = tgt.code,
    account_name = tgt.name
FROM chart_of_accounts AS src
JOIN LATERAL (
  SELECT c.id, c.code, c.name
  FROM chart_of_accounts c
  WHERE c.organization_id = src.organization_id
    AND c.type = 'Asset'
    AND c.is_active = true
    AND c.code IN ('04-80', '04-90')
  ORDER BY c.code
  LIMIT 1
) AS tgt ON true
WHERE ve.account_id = src.id
  AND src.organization_id = ve.organization_id
  AND src.code = '01-01';

-- 3a) Backfill missing share-issue entries: Dr Cash / Cr Share Capital.
--     Both legs are inserted in a single statement (UNION ALL) so the
--     NOT EXISTS guard is evaluated against the pre-fill state for both rows.
INSERT INTO voucher_entries (
  id, organization_id, voucher_id, account_id, account_code, account_name,
  debit, credit, narration, created_at
)
SELECT gen_random_uuid(), v.organization_id, v.id,
       cash.id, cash.code, cash.name, v.total_amount, '0',
       'Share issue proceeds — ' || v.narration, now()
FROM vouchers v
JOIN chart_of_accounts cash
  ON cash.id = (SELECT sam.account_id FROM system_account_mappings sam
                WHERE sam.organization_id = v.organization_id
                  AND sam.mapping_key = 'cash_bank')
WHERE v.voucher_type = 'Journal'
  AND v.module_reference LIKE 'SHARE_ISSUE:%'
  AND v.status = 'Posted'
  AND NOT EXISTS (SELECT 1 FROM voucher_entries ve WHERE ve.voucher_id = v.id)

UNION ALL

SELECT gen_random_uuid(), v.organization_id, v.id,
       sc.id, sc.code, sc.name, '0', v.total_amount,
       'Share capital issued — ' || v.narration, now()
FROM vouchers v
JOIN chart_of_accounts sc
  ON sc.id = (SELECT sam.account_id FROM system_account_mappings sam
              WHERE sam.organization_id = v.organization_id
                AND sam.mapping_key = 'share_capital')
WHERE v.voucher_type = 'Journal'
  AND v.module_reference LIKE 'SHARE_ISSUE:%'
  AND v.status = 'Posted'
  AND NOT EXISTS (SELECT 1 FROM voucher_entries ve WHERE ve.voucher_id = v.id);

-- 3b) Backfill missing share-transfer entries: Dr / Cr Share Capital.
INSERT INTO voucher_entries (
  id, organization_id, voucher_id, account_id, account_code, account_name,
  debit, credit, narration, created_at
)
SELECT gen_random_uuid(), v.organization_id, v.id,
       sc.id, sc.code, sc.name, v.total_amount, '0',
       'Share Capital transfer out — ' || v.narration, now()
FROM vouchers v
JOIN chart_of_accounts sc
  ON sc.id = (SELECT sam.account_id FROM system_account_mappings sam
              WHERE sam.organization_id = v.organization_id
                AND sam.mapping_key = 'share_capital')
WHERE v.voucher_type = 'Journal'
  AND v.module_reference LIKE 'SHARE_TRANSFER:%'
  AND v.status = 'Posted'
  AND NOT EXISTS (SELECT 1 FROM voucher_entries ve WHERE ve.voucher_id = v.id)

UNION ALL

SELECT gen_random_uuid(), v.organization_id, v.id,
       sc.id, sc.code, sc.name, '0', v.total_amount,
       'Share Capital transfer in — ' || v.narration, now()
FROM vouchers v
JOIN chart_of_accounts sc
  ON sc.id = (SELECT sam.account_id FROM system_account_mappings sam
              WHERE sam.organization_id = v.organization_id
                AND sam.mapping_key = 'share_capital')
WHERE v.voucher_type = 'Journal'
  AND v.module_reference LIKE 'SHARE_TRANSFER:%'
  AND v.status = 'Posted'
  AND NOT EXISTS (SELECT 1 FROM voucher_entries ve WHERE ve.voucher_id = v.id);

-- 4) Reconcile COA balances from the (now-complete) voucher entries.
UPDATE chart_of_accounts AS c
SET balance = CASE
      WHEN c.type IN ('Asset', 'Expense') THEN t.dr - t.cr
      ELSE t.cr - t.dr
    END,
    updated_at = now()
FROM (
  SELECT ve.organization_id, ve.account_id,
         COALESCE(sum(ve.debit), 0) AS dr,
         COALESCE(sum(ve.credit), 0) AS cr
  FROM voucher_entries ve
  GROUP BY ve.organization_id, ve.account_id
) t
WHERE c.id = t.account_id
  AND c.organization_id = t.organization_id
  AND (c.code IN ('04-80', '04-90', '01-10') OR c.code = '01-01');

-- 5) Retire the legacy auto-created 01-01 account.
UPDATE chart_of_accounts
SET is_active = false,
    updated_at = now()
WHERE code = '01-01'
  AND is_active = true;
