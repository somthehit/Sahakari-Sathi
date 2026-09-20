import { getDb } from './client';
import { sql } from 'drizzle-orm';

/**
 * Bootstrap for the Withdrawal Security tables (signature verification pipeline).
 *
 * Mirrors initChequeTables.ts / initSavingsDepositsTables.ts: drizzle-kit is not
 * the migration path for these module tables, so raw `CREATE TABLE IF NOT EXISTS`
 * is used. Each table carries organization_id for multi-tenant isolation.
 */
export async function initSignatureVerificationTables(): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    // 1. MEMBER SIGNATURE SPECIMENS (per-account signatory signature on file)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS member_signature_specimens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
        member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        account_id uuid NOT NULL REFERENCES savings_accounts(id) ON DELETE CASCADE,
        signatory_name text,
        image_url text NOT NULL,
        signing_rule varchar(20) NOT NULL DEFAULT 'any',
        is_active boolean NOT NULL DEFAULT true,
        captured_by_id uuid,
        captured_via text NOT NULL DEFAULT 'open_account',
        captured_at timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS mss_org_member_idx ON member_signature_specimens (organization_id, member_id);
      CREATE INDEX IF NOT EXISTS mss_org_account_idx ON member_signature_specimens (organization_id, account_id);
    `);

    // 2. SIGNATURE VERIFICATION LOGS (immutable audit trail for every comparison)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS signature_verification_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
        account_id uuid NOT NULL REFERENCES savings_accounts(id) ON DELETE CASCADE,
        member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        specimen_id uuid REFERENCES member_signature_specimens(id) ON DELETE SET NULL,
        presented_image_url text NOT NULL,
        specimen_image_url text NOT NULL,
        match_score numeric(5,2) NOT NULL,
        machine_verdict varchar(20) NOT NULL,
        outcome varchar(20),
        reviewed_by_user_id uuid,
        override_reason text,
        withdrawal_id uuid REFERENCES savings_transactions(id) ON DELETE SET NULL,
        voucher_no text,
        created_by_id uuid,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS svl_org_account_idx ON signature_verification_logs (organization_id, account_id);
      CREATE INDEX IF NOT EXISTS svl_org_member_idx ON signature_verification_logs (organization_id, member_id);
      CREATE INDEX IF NOT EXISTS svl_org_withdrawal_idx ON signature_verification_logs (organization_id, withdrawal_id);
      CREATE INDEX IF NOT EXISTS svl_org_created_idx ON signature_verification_logs (organization_id, created_at);
    `);

    // 3. SAVINGS WITHDRAWAL INSTRUMENTS (consumed-instrument register;
    //    single-use per org for slip serials, fingerprint for cheque leaves)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS savings_withdrawal_instruments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
        account_id uuid NOT NULL REFERENCES savings_accounts(id) ON DELETE CASCADE,
        account_no text NOT NULL,
        member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        member_name text NOT NULL,
        type text NOT NULL,
        reference text NOT NULL,
        amount numeric(15,2) NOT NULL,
        date_bs text NOT NULL,
        voucher_no text,
        transaction_id uuid REFERENCES savings_transactions(id) ON DELETE SET NULL,
        created_by_id uuid,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS swi_org_type_reference_uniq ON savings_withdrawal_instruments (organization_id, type, reference);
      CREATE INDEX IF NOT EXISTS swi_org_account_idx ON savings_withdrawal_instruments (organization_id, account_id);
      CREATE INDEX IF NOT EXISTS swi_org_type_date_idx ON savings_withdrawal_instruments (organization_id, type, date_bs);
    `);

    console.log('[DB] ✅ Signature verification tables initialized successfully');
  } catch (err: any) {
    console.error('[DB] Error initializing signature verification tables:', err.message);
  }
}