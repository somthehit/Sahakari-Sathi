import 'dotenv/config';
import postgres from 'postgres';

const url = process.env.DATABASE_URL!;
const sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 1 });

(async () => {
  try {
    await sql.unsafe("ALTER TABLE share_classes ADD COLUMN IF NOT EXISTS share_type text NOT NULL DEFAULT 'ORDINARY'");
    console.log('Added share_type column');
    await sql.unsafe("ALTER TABLE share_classes ADD COLUMN IF NOT EXISTS target_member_type text NOT NULL DEFAULT 'ALL'");
    console.log('Added target_member_type column');
    const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'share_classes' AND column_name IN ('share_type','target_member_type') ORDER BY column_name`;
    console.log('Columns:', cols.map((c: any) => c.column_name).join(', '));
  } catch (e: any) {
    console.error('Error:', e.message);
  } finally {
    await sql.end();
  }
})();
