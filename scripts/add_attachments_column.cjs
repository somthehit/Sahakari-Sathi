require('dotenv/config');
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, {
  connect_timeout: 60,
  ssl: process.env.DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : false,
});

(async () => {
  try {
    await sql`ALTER TABLE agm_resolutions ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::JSONB`;
    console.log('attachments column added to agm_resolutions');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await sql.end();
  }
})();
