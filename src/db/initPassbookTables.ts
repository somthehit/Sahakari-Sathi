import { getDb } from './client';
import { sql } from 'drizzle-orm';

/**
 * Idempotent runtime DDL for the passbook module — mirrors initChequeTables.
 * The authoritative schema lives in src/db/schema/passbook.ts and is applied via
 * drizzle-kit (db:push); this belt-and-suspenders init lets a fresh dev database
 * self-heal on boot. DDL run through the transaction pooler can fail benignly
 * (prepared-statement limitation); errors are logged, never thrown.
 */
export async function initPassbookTables(): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    // 1. PASSBOOK DESIGNS (calibratable print layouts)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS passbook_designs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
        code text NOT NULL,
        name text NOT NULL,
        description text,
        mode text NOT NULL DEFAULT 'booklet',
        is_active boolean NOT NULL DEFAULT true,
        is_default boolean NOT NULL DEFAULT false,
        sort_order integer NOT NULL DEFAULT 0,
        width_mm numeric(6,2) NOT NULL DEFAULT 105,
        height_mm numeric(6,2) NOT NULL DEFAULT 165,
        config_json text,
        created_by uuid,
        updated_by uuid,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS passbook_designs_org_code_uniq
        ON passbook_designs (organization_id, code);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS passbook_designs_org_active_idx
        ON passbook_designs (organization_id, is_active);
    `);

    // 2. PASSBOOK BOOKS (physical booklets + renewal chain)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS passbook_books (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
        account_id uuid NOT NULL REFERENCES savings_accounts(id) ON DELETE CASCADE,
        serial text NOT NULL,
        status text NOT NULL DEFAULT 'active',
        lines_per_page integer NOT NULL DEFAULT 30,
        page_count integer NOT NULL DEFAULT 20,
        capacity integer NOT NULL DEFAULT 600,
        lines_used integer NOT NULL DEFAULT 0,
        issued_date_bs text,
        issued_date_ad text,
        closed_date_bs text,
        previous_book_id uuid,
        replaced_by_book_id uuid,
        issuance_reason text NOT NULL DEFAULT 'new',
        issued_by uuid,
        remarks text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS passbook_books_org_serial_uniq
        ON passbook_books (organization_id, serial);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS passbook_books_org_account_idx
        ON passbook_books (organization_id, account_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS passbook_books_org_status_idx
        ON passbook_books (organization_id, status);
    `);

    // 3. PASSBOOK PRINT LOG (per-run audit + continuation safety)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS passbook_print_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
        account_id uuid NOT NULL REFERENCES savings_accounts(id) ON DELETE CASCADE,
        book_id uuid REFERENCES passbook_books(id) ON DELETE SET NULL,
        design_id uuid,
        mode text NOT NULL DEFAULT 'booklet',
        status text NOT NULL DEFAULT 'printed',
        from_txn_id uuid,
        to_txn_id uuid,
        txn_count integer NOT NULL DEFAULT 0,
        start_line integer NOT NULL DEFAULT 0,
        end_line integer NOT NULL DEFAULT 0,
        lines_printed integer NOT NULL DEFAULT 0,
        page_count integer NOT NULL DEFAULT 0,
        from_date_bs text,
        to_date_bs text,
        printed_by uuid,
        printed_by_name text,
        remarks text,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS passbook_print_log_org_account_idx
        ON passbook_print_log (organization_id, account_id, created_at);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS passbook_print_log_org_book_idx
        ON passbook_print_log (organization_id, book_id);
    `);

    console.log('[DB] ✅ Passbook tables initialized successfully');
  } catch (err: any) {
    console.error('[DB] Error initializing passbook tables:', err.message);
  }
}
