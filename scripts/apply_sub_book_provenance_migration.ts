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
      join(__dirname, '..', 'supabase', 'migrations', '0043_backfill_sub_book_provenance.sql'),
      'utf8'
    );
    await sql.begin(async (tx) => {
      await tx.unsafe(migrationSql);
    });
    console.log('Migration 0043 applied successfully.');

    const nullRows: any = await sql`
      SELECT COUNT(*) AS n FROM subsidiary_shares_book WHERE share_type_id IS NULL;
    `;
    console.log('Sub-book rows still NULL share_type_id:', Number(nullRows[0].n));

    const typed: any = await sql`
      SELECT s.id, s.voucher_no, s.transaction_type, s.member_id, st.code, st.name
      FROM subsidiary_shares_book s
      LEFT JOIN share_types st ON st.id = s.share_type_id
      WHERE s.voucher_no IN ('JV-00001','JV-00002','JV-00003','JV-00004')
      ORDER BY s.voucher_no, s.transaction_type;
    `;
    for (const r of typed) {
      console.log(`  ${r.voucher_no} ${r.transaction_type} member=${r.member_id} type=${r.code ?? 'NULL'} (${r.name ?? ''})`);
    }

    const idx: any = await sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename='subsidiary_shares_book' AND indexname='subs_shares_org_type_idx';
    `;
    console.log('subs_shares_org_type_idx exists:', idx.length > 0);

    const fks: any = await sql`
      SELECT conname FROM pg_constraint
      WHERE conrelid='subsidiary_shares_book'::regclass
        AND conname IN ('subs_shares_share_type_fk','subs_shares_share_account_fk');
    `;
    console.log('FKs:', fks.map((f) => f.conname).join(', '));
  } catch (e: any) {
    console.error('Migration failed:', e.message);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();