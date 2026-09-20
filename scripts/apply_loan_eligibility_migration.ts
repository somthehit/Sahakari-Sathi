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
      join(__dirname, '..', 'supabase', 'migrations', '0040_loan_eligibility_gate.sql'),
      'utf8'
    );
    await sql.begin(async (tx) => {
      await tx.unsafe(migrationSql);
    });
    console.log('Migration 0040 applied successfully.');
  } catch (e: any) {
    console.error('Migration failed:', e.message);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();