require('dotenv/config');
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, {
  connect_timeout: 60,
  ssl: process.env.DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : false,
});

(async () => {
  try {
    await sql`ALTER TABLE agm_meetings ADD COLUMN IF NOT EXISTS agenda JSONB DEFAULT '[]'::JSONB`;
    console.log('agenda column added to agm_meetings');

    // Verify it exists
    const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'agm_meetings' ORDER BY ordinal_position`;
    console.log('agm_meetings columns:', cols.map(c => c.column_name).join(', '));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await sql.end();
  }
})();
