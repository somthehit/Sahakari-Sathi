require('dotenv/config');
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, {
  connect_timeout: 60,
  ssl: process.env.DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : false,
});

(async () => {
  try {
    // Check agm_resolutions columns
    const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'agm_resolutions' ORDER BY ordinal_position`;
    console.log('agm_resolutions columns:', cols.map(c => c.column_name).join(', '));

    // Check what Drizzle schema expects
    const schemaCols = ['id','organization_id','meeting_id','resolution_no','title','title_nepali','description','proposed_by','seconded_by','status','votes_for','votes_against','abstained','decision','assigned_to','due_date_bs','completed_at','created_by','created_at','updated_at'];
    const dbCols = cols.map(c => c.column_name);
    const missing = schemaCols.filter(c => !dbCols.includes(c));
    console.log('Missing columns:', missing.length ? missing.join(', ') : 'none');

    // Add missing columns
    for (const col of missing) {
      if (col === 'completed_at') {
        await sql`ALTER TABLE agm_resolutions ADD COLUMN completed_at TIMESTAMPTZ`;
        console.log('Added completed_at');
      } else {
        console.log(`Skipping ${col} (manual intervention needed)`);
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await sql.end();
  }
})();
