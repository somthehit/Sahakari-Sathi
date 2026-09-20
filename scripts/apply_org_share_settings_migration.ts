import 'dotenv/config';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL!;
const sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 1 });

async function main() {
  try {
    const migrationSql = readFileSync(
      join(__dirname, '..', 'supabase', 'migrations', '0042_org_share_settings.sql'),
      'utf8'
    );
    await sql.begin(async (tx) => {
      await tx.unsafe(migrationSql);
    });
    console.log('Migration 0042 applied successfully.');

    const cols = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'subsidiary_shares_book'
        AND column_name IN ('share_type_id','share_account_id')
      ORDER BY column_name;
    `;
    console.log('subsidiary_shares_book columns:', cols.map((c) => c.column_name).join(', '));

    const tbl = await sql`SELECT to_regclass('public.organization_share_settings') AS tbl`;
    console.log('organization_share_settings exists:', tbl[0].tbl != null);

    const rows: any = await sql`
      SELECT organization_id, authorized_capital_ceiling, authorized_total_kitta, total_issued_kitta, total_issued_capital
      FROM organization_share_settings;
    `;
    for (const r of rows) {
      console.log(`  org=${r.organization_id} ceiling=${r.authorized_capital_ceiling} kitta=${r.authorized_total_kitta} issued_kitta=${r.total_issued_kitta} issued_capital=${r.total_issued_capital}`);
    }

    const nullShare = await sql`
      SELECT COUNT(*) AS n
      FROM subsidiary_shares_book
      WHERE share_type_id IS NULL AND transaction_type = 'Purchase';
    `;
    console.log('Purchase rows still missing share_type_id:', Number(nullShare[0].n));
  } catch (e: any) {
    console.error('Migration failed:', e.message);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();