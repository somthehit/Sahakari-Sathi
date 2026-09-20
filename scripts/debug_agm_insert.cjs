require('dotenv/config');
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, {
  connect_timeout: 60,
  ssl: process.env.DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : false,
});

(async () => {
  try {
    // Check column types
    const cols = await sql`SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns WHERE table_name = 'agm_meetings' ORDER BY ordinal_position`;
    console.log('Columns:');
    cols.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} nullable=${c.is_nullable} default=${c.column_default}`));

    // Try a simple insert
    const result = await sql`INSERT INTO agm_meetings (organization_id, title, type, meeting_date_bs, status, agenda)
      VALUES ('98f87866-0980-41b0-8f6e-47ab6e4dad82', 'Test Meeting', 'AGM', '2083-01-01', 'Scheduled', '[]'::jsonb)
      RETURNING id`;
    console.log('Insert succeeded, id:', result[0].id);

    // Clean up
    await sql`DELETE FROM agm_meetings WHERE title = 'Test Meeting'`;
    console.log('Cleanup done');
  } catch (e) {
    console.error('Error:', e.message);
    console.error('Detail:', e.detail);
    console.error('Hint:', e.hint);
    console.error('Code:', e.code);
  } finally {
    await sql.end();
  }
})();
