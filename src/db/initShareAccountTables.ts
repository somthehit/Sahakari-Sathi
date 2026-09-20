import { getDb } from './client';
import { sql } from 'drizzle-orm';

/**
 * Open Shares Account (हकवाला) bootstrap — idempotent.
 *
 * Extends the auto-provisioned share_accounts table with a lifecycle status
 * (Active / Suspended / Closed) and updated_at, adds the org-level
 * min_required_kitta ceiling to organization_share_settings, and creates the
 * share_account_nominees register that backs the nominee (हकवाला) section of
 * the account-opening flow. CREATE TABLE IF NOT EXISTS never mutates existing
 * tables, so the ALTER ... ADD COLUMN IF NOT EXISTS statements keep already-
 * provisioned databases in sync.
 */
export async function initShareAccountTables(): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    await db.execute(sql`
      ALTER TABLE share_accounts
        ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Active',
        ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();
    `);

    await db.execute(sql`
      ALTER TABLE organization_share_settings
        ADD COLUMN IF NOT EXISTS min_required_kitta integer NOT NULL DEFAULT 10;
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS share_account_nominees (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        share_account_id uuid NOT NULL REFERENCES share_accounts(id) ON DELETE CASCADE,
        full_name text NOT NULL,
        relation text NOT NULL,
        citizenship_no text,
        contact_no text,
        photo_url text,
        share_percentage numeric(5,2) NOT NULL CHECK (share_percentage > 0 AND share_percentage <= 100),
        is_primary boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS san_org_account_idx
        ON share_account_nominees (organization_id, share_account_id);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS san_org_primary_idx
        ON share_account_nominees (organization_id, is_primary);
    `);

    console.log('[DB] ✅ Share account tables initialized successfully');
  } catch (err: any) {
    console.error('[DB] Error initializing share account tables:', err.message);
  }
}