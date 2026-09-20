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
      join(__dirname, '..', 'supabase', 'migrations', '0044_share_class_dynamic_references.sql'),
      'utf8'
    );
    await sql.begin(async (tx) => {
      await tx.unsafe(migrationSql);
    });
    console.log('Migration 0044 applied successfully.');

    const cols = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'share_classes'
        AND column_name IN ('share_type','target_member_type')
      ORDER BY column_name;
    `;
    console.log('share_classes columns:', cols.map((c: any) => c.column_name).join(', '));
  } catch (e: any) {
    console.error('Migration failed:', e.message);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
