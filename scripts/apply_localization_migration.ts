import 'dotenv/config';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = postgres(process.env.DATABASE_URL!, { ssl: { rejectUnauthorized: false } });

async function main() {
  try {
    const migrationSql = readFileSync(join(__dirname, '..', 'supabase', 'migrations', '0014_localization_settings.sql'), 'utf8');
    await sql.unsafe(migrationSql);
    console.log('Migration 0014 applied successfully.');

    const table = await sql`SELECT to_regclass('public.organization_localization_settings') AS tbl`;
    console.log('table exists:', table[0].tbl);

    const fn = await sql`SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'format_nepali_currency') AS fn`;
    console.log('function exists:', fn[0].fn);

    const result = await sql`SELECT public.format_nepali_currency(1234567.89, 'IN') AS in_style, public.format_nepali_currency(1234567.89, 'US') AS us_style`;
    console.log('format_nepali_currency IN :', result[0].in_style);
    console.log('format_nepali_currency US :', result[0].us_style);
  } catch (e: any) {
    console.error('Migration failed:', e.message);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
