import 'dotenv/config';
import postgres from 'postgres';

const url = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL!;
const sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 1 });

(async () => {
  try {
    await sql.unsafe("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS province_id uuid REFERENCES provinces(id) ON DELETE SET NULL");
    console.log('Added province_id');
    await sql.unsafe("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS district_id uuid REFERENCES districts(id) ON DELETE SET NULL");
    console.log('Added district_id');
    await sql.unsafe("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS municipality_id uuid REFERENCES municipalities(id) ON DELETE SET NULL");
    console.log('Added municipality_id');
    await sql.unsafe("ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ward_no integer");
    console.log('Added ward_no');

    // Indexes
    await sql.unsafe("CREATE INDEX IF NOT EXISTS organizations_province_idx ON organizations(province_id)");
    await sql.unsafe("CREATE INDEX IF NOT EXISTS organizations_district_idx ON organizations(district_id)");
    await sql.unsafe("CREATE INDEX IF NOT EXISTS organizations_municipality_idx ON organizations(municipality_id)");
    console.log('Indexes created');

    // Verify
    const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'organizations' AND column_name IN ('province_id','district_id','municipality_id','ward_no') ORDER BY column_name`;
    console.log('Columns:', cols.map((c: any) => c.column_name).join(', '));
  } catch (e: any) {
    console.error('Error:', e.message);
  } finally {
    await sql.end();
  }
})();
