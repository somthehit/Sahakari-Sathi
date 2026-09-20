import { getDb } from './client';
import { sql } from 'drizzle-orm';

export async function initChequeTables(): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    // 1. CHEQUE SETTINGS
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cheque_settings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
        scope text NOT NULL DEFAULT 'organization',
        enable_cheque_facility boolean NOT NULL DEFAULT true,
        eligible_account_product_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
        default_leaves_per_book integer NOT NULL DEFAULT 25,
        allowed_book_sizes jsonb NOT NULL DEFAULT '[10, 20, 25, 50, 100]'::jsonb,
        max_active_books_per_account integer NOT NULL DEFAULT 1,
        reissue_allowed boolean NOT NULL DEFAULT true,
        reissue_after_exhaustion boolean NOT NULL DEFAULT true,
        lost_book_replacement_allowed boolean NOT NULL DEFAULT true,
        cancelled_book_replacement_allowed boolean NOT NULL DEFAULT true,
        numbering_scope text NOT NULL DEFAULT 'branch_wise',
        starting_cheque_number integer NOT NULL DEFAULT 100001,
        cheque_prefix text NOT NULL DEFAULT 'CHQ-',
        number_length integer NOT NULL DEFAULT 6,
        allow_manual_number_assignment boolean NOT NULL DEFAULT false,
        prevent_duplicate_cheque_numbers boolean NOT NULL DEFAULT true,
        validity_period_days integer NOT NULL DEFAULT 90,
        expired_cheque_behavior text NOT NULL DEFAULT 'reject_presentation',
        stop_payment_enabled boolean NOT NULL DEFAULT true,
        allow_stop_payment_by jsonb NOT NULL DEFAULT '["member", "teller", "branch_manager", "admin"]'::jsonb,
        stop_payment_charge numeric(15,2) NOT NULL DEFAULT 0,
        allow_stop_payment_on jsonb NOT NULL DEFAULT '["single_cheque", "cheque_range", "entire_book"]'::jsonb,
        stop_payment_require_approval boolean NOT NULL DEFAULT true,
        bounce_handling_enabled boolean NOT NULL DEFAULT true,
        bounce_charge numeric(15,2) NOT NULL DEFAULT 0,
        max_bounce_count integer,
        after_threshold_action text NOT NULL DEFAULT 'flag_account',
        issuance_charge_type text NOT NULL DEFAULT 'flat',
        issuance_charge_amount numeric(15,2) NOT NULL DEFAULT 0,
        issuance_charge_per_leaf_amount numeric(15,2) NOT NULL DEFAULT 0,
        lost_book_charge numeric(15,2) NOT NULL DEFAULT 0,
        replacement_book_charge numeric(15,2) NOT NULL DEFAULT 0,
        other_cheque_charges jsonb NOT NULL DEFAULT '[]'::jsonb,
        tax_applicable boolean NOT NULL DEFAULT false,
        tax_rate numeric(5,2) NOT NULL DEFAULT 0,
        gl_issuance_fee_account_id uuid REFERENCES chart_of_accounts(id),
        gl_stop_payment_fee_account_id uuid REFERENCES chart_of_accounts(id),
        gl_bounce_fee_account_id uuid REFERENCES chart_of_accounts(id),
        gl_replacement_fee_account_id uuid REFERENCES chart_of_accounts(id),
        gl_other_charges_fee_account_id uuid REFERENCES chart_of_accounts(id),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);

    // 1b. Extend existing cheque_settings tables (idempotent). The issuance
    // eligibility policy used to live as hardcoded constants in the React
    // issue-book modal; it is now per-organization configuration.
    await db.execute(sql`
      ALTER TABLE cheque_settings
        ADD COLUMN IF NOT EXISTS require_kyc_verified boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS block_blacklisted_members boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS min_utilization_for_reissue integer NOT NULL DEFAULT 80,
        ADD COLUMN IF NOT EXISTS reissue_cooldown_days integer NOT NULL DEFAULT 30,
        ADD COLUMN IF NOT EXISTS allow_supervisor_override boolean NOT NULL DEFAULT true;
    `);

    // 2. CHEQUE BOOKS
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cheque_books (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
        account_id uuid NOT NULL REFERENCES savings_accounts(id) ON DELETE CASCADE,
        account_product_id uuid REFERENCES savings_products(id) ON DELETE SET NULL,
        book_number text NOT NULL,
        prefix text,
        leaf_start_number integer NOT NULL,
        leaf_end_number integer NOT NULL,
        leaf_count integer NOT NULL DEFAULT 25,
        issued_date_bs text NOT NULL,
        issued_date_ad text NOT NULL,
        status text NOT NULL DEFAULT 'active',
        issuance_charge numeric(15,2) NOT NULL DEFAULT 0,
        issued_by_id uuid,
        purpose text,
        delivery_method text,
        override_reason text,
        cancelled_by_id uuid,
        cancelled_at timestamp,
        cancel_reason text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);

    // 3. CHEQUE LEAVES
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cheque_leaves (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
        cheque_book_id uuid NOT NULL REFERENCES cheque_books(id) ON DELETE CASCADE,
        account_id uuid NOT NULL REFERENCES savings_accounts(id) ON DELETE CASCADE,
        cheque_number text NOT NULL,
        leaf_no integer NOT NULL,
        status text NOT NULL DEFAULT 'unused',
        payee_name text,
        amount numeric(15,2),
        cheque_date_bs text,
        cheque_date_ad text,
        presented_date timestamp,
        cleared_date timestamp,
        used_at timestamp,
        transaction_id uuid,
        bounce_date timestamp,
        bounce_reason text,
        stop_payment_date timestamp,
        stop_payment_reason text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);

    // 3b. Extend existing cheque_leaves tables (idempotent — CREATE TABLE IF
    // NOT EXISTS does not add columns to an already-created table).
    await db.execute(sql`
      ALTER TABLE cheque_leaves
        ADD COLUMN IF NOT EXISTS used_at timestamp,
        ADD COLUMN IF NOT EXISTS transaction_id uuid;
    `);

    // 2b. Extend existing cheque_books tables (idempotent).
    await db.execute(sql`
      ALTER TABLE cheque_books
        ADD COLUMN IF NOT EXISTS purpose text,
        ADD COLUMN IF NOT EXISTS delivery_method text,
        ADD COLUMN IF NOT EXISTS override_reason text;
    `);

    // 4. CHEQUE STOP PAYMENTS
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cheque_stop_payments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
        account_id uuid NOT NULL REFERENCES savings_accounts(id) ON DELETE CASCADE,
        cheque_book_id uuid REFERENCES cheque_books(id) ON DELETE SET NULL,
        cheque_leaf_id uuid REFERENCES cheque_leaves(id) ON DELETE SET NULL,
        start_cheque_number text NOT NULL,
        end_cheque_number text NOT NULL,
        reason text NOT NULL,
        charge_amount numeric(15,2) NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'pending',
        requested_by_id uuid NOT NULL,
        approved_by_id uuid,
        requested_at timestamp NOT NULL DEFAULT now(),
        approved_at timestamp,
        rejected_at timestamp,
        rejection_reason text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);

    // 5. CHEQUE BOUNCES
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cheque_bounces (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
        account_id uuid NOT NULL REFERENCES savings_accounts(id) ON DELETE CASCADE,
        cheque_leaf_id uuid REFERENCES cheque_leaves(id) ON DELETE SET NULL,
        cheque_number text NOT NULL,
        amount numeric(15,2) NOT NULL,
        bounce_reason text NOT NULL,
        bounce_charge numeric(15,2) NOT NULL DEFAULT 0,
        transaction_id uuid,
        reported_date text NOT NULL,
        reported_by_id uuid NOT NULL,
        reviewed_by_id uuid,
        reviewed_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);

    // 6. CHEQUE DESIGNS (printable leaf layouts)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cheque_designs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
        code text NOT NULL,
        name text NOT NULL,
        description text,
        is_active boolean NOT NULL DEFAULT true,
        is_default boolean NOT NULL DEFAULT false,
        sort_order integer NOT NULL DEFAULT 0,
        width_mm numeric(6,2) NOT NULL DEFAULT 200,
        height_mm numeric(6,2) NOT NULL DEFAULT 92,
        config_json text,
        created_by uuid,
        updated_by uuid,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS cheque_designs_org_code_uniq
        ON cheque_designs (organization_id, code);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS cheque_designs_org_active_idx
        ON cheque_designs (organization_id, is_active);
    `);

    // 7. BANK CHEQUE BOOKS (cooperative's own bank cheque books)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS bank_cheque_books (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
        bank_account_id uuid NOT NULL REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
        book_number text NOT NULL,
        prefix text,
        leaf_start_number integer NOT NULL,
        leaf_end_number integer NOT NULL,
        leaf_count integer NOT NULL DEFAULT 25,
        issued_date_bs text NOT NULL,
        issued_date_ad text NOT NULL,
        status text NOT NULL DEFAULT 'active',
        issued_by_id uuid,
        purpose text,
        cancel_reason text,
        cancelled_by_id uuid,
        cancelled_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS bank_cheque_books_org_book_number_uniq
        ON bank_cheque_books (organization_id, book_number);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS bank_cheque_books_org_bank_account_idx
        ON bank_cheque_books (organization_id, bank_account_id);
    `);

    // 8. BANK CHEQUE LEAVES (individual cheque leaves from bank cheque books)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS bank_cheque_leaves (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        cheque_book_id uuid NOT NULL REFERENCES bank_cheque_books(id) ON DELETE CASCADE,
        bank_account_id uuid NOT NULL REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
        cheque_number text NOT NULL,
        leaf_no integer NOT NULL,
        status text NOT NULL DEFAULT 'unused',
        payee_name text,
        amount numeric(15,2),
        cheque_date_bs text,
        cheque_date_ad text,
        loan_id uuid,
        voucher_id uuid,
        used_at timestamp,
        cleared_at timestamp,
        cancel_reason text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS bank_cheque_leaves_org_number_uniq
        ON bank_cheque_leaves (organization_id, cheque_number);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS bank_cheque_leaves_org_book_idx
        ON bank_cheque_leaves (organization_id, cheque_book_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS bank_cheque_leaves_org_bank_account_idx
        ON bank_cheque_leaves (organization_id, bank_account_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS bank_cheque_leaves_org_status_idx
        ON bank_cheque_leaves (organization_id, status);
    `);

    console.log('[DB] ✅ Cheque tables initialized successfully');
  } catch (err: any) {
    console.error('[DB] Error initializing cheque tables:', err.message);
  }
}
