import 'dotenv/config';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL!;
const sql = postgres(url, { ssl: { rejectUnauthorized: false } });

async function main() {
  try {
    const migrationSql = readFileSync(join(__dirname, '..', 'supabase', 'migrations', '0041_share_types_kitta_config.sql'), 'utf8');
    await sql.unsafe(migrationSql);
    console.log('Migration 0041 applied successfully.');

    const cols = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'share_types'
        AND column_name IN ('kitta_prefix','kitta_start_base','current_kitta_pointer','max_allowed_kitta','auto_sequence')
      ORDER BY column_name;
    `;
    console.log('columns now present:', cols.map((c) => c.column_name).join(', '));

    const rows = await sql`
      SELECT st.id, st.code, st.kitta_prefix, st.current_kitta_pointer
      FROM share_types st
      ORDER BY st.code;
    `;
    for (const r of rows) {
      console.log(`  ${r.code} prefix=${JSON.stringify(r.kitta_prefix)} pointer=${r.current_kitta_pointer}`);
    }
  } catch (e: any) {
    console.error('Migration failed:', e.message);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();