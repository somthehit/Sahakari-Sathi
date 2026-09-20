import { getDb } from './client';
import { sql } from 'drizzle-orm';

/**
 * Bootstrap for the Savings & Deposits teller tables.
 *
 * Mirrors initChequeTables.ts: drizzle-kit is not the migration path for these
 * module tables, so raw `CREATE TABLE IF NOT EXISTS` is used. Also extends the
 * savings_accounts table with passbook printing state via idempotent
 * `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
 */
export async function initSavingsDepositsTables(): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    // Passbook state on savings_accounts (idempotent).
    await db.execute(sql`
      ALTER TABLE savings_accounts
        ADD COLUMN IF NOT EXISTS passbook_serial text,
        ADD COLUMN IF NOT EXISTS passbook_lines_per_page integer NOT NULL DEFAULT 30,
        ADD COLUMN IF NOT EXISTS last_printed_txn_id uuid,
        ADD COLUMN IF NOT EXISTS last_printed_line integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_printed_date_bs text;
    `);

    // Signature-verification linkage on the pending-withdrawal queue (idempotent).
    await db.execute(sql`
      ALTER TABLE savings_pending_withdrawals
        ADD COLUMN IF NOT EXISTS signature_log_id uuid,
        ADD COLUMN IF NOT EXISTS signature_outcome text,
        ADD COLUMN IF NOT EXISTS signature_override_reason text;
    `);

    // 1. SAVINGS CHEQUE DEPOSITS (pending-clearance instrument register)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS savings_cheque_deposits (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        branch_id uuid NOT NULL REFERENCES branches(id),
        account_id uuid NOT NULL REFERENCES savings_accounts(id) ON DELETE CASCADE,
        account_no text NOT NULL,
        member_id uuid NOT NULL REFERENCES members(id),
        member_name text NOT NULL,
        amount numeric(15,2) NOT NULL,
        cheque_number text NOT NULL,
        cheque_bank text NOT NULL,
        cheque_date_bs text,
        date_bs text NOT NULL,
        date_ad text NOT NULL,
        status text NOT NULL DEFAULT 'Pending',
        voucher_no text,
        reference text,
        deposited_by_id uuid,
        deposited_by_name text,
        cleared_at timestamp,
        cleared_by_id uuid,
        cleared_by_name text,
        bounced_at timestamp,
        bounce_reason text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS savings_cheque_dep_org_status_idx ON savings_cheque_deposits (organization_id, status);
      CREATE INDEX IF NOT EXISTS savings_cheque_dep_org_account_idx ON savings_cheque_deposits (organization_id, account_id);
      CREATE INDEX IF NOT EXISTS savings_cheque_dep_org_number_idx ON savings_cheque_deposits (organization_id, cheque_number);
    `);

    // 2. SAVINGS PENDING WITHDRAWALS (dual-approval queue)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS savings_pending_withdrawals (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        branch_id uuid NOT NULL REFERENCES branches(id),
        account_id uuid NOT NULL REFERENCES savings_accounts(id) ON DELETE CASCADE,
        account_no text NOT NULL,
        member_id uuid NOT NULL REFERENCES members(id),
        member_name text NOT NULL,
        amount numeric(15,2) NOT NULL,
        payout_mode text NOT NULL DEFAULT 'Cash',
        instrument_type text NOT NULL,
        instrument_reference text,
        date_bs text NOT NULL,
        date_ad text NOT NULL,
        voucher_no text NOT NULL,
        status text NOT NULL DEFAULT 'Pending',
        requested_by_id uuid NOT NULL,
        requested_by_name text NOT NULL,
        approved_by text,
        remarks text,
        processed_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS savings_pend_wd_org_status_idx ON savings_pending_withdrawals (organization_id, status);
      CREATE INDEX IF NOT EXISTS savings_pend_wd_org_account_idx ON savings_pending_withdrawals (organization_id, account_id);
      CREATE INDEX IF NOT EXISTS savings_pend_wd_org_member_idx ON savings_pending_withdrawals (organization_id, member_id);
    `);

    console.log('[DB] ✅ Savings deposits tables initialized successfully');
  } catch (err: any) {
    console.error('[DB] Error initializing savings deposits tables:', err.message);
  }
}
