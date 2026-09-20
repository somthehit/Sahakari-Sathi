require('dotenv/config');
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, {
  connect_timeout: 60,
  ssl: process.env.DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : false,
});

(async () => {
  try {
    // Fix created_by type: uuid -> text (controller passes username string, not UUID)
    await sql`ALTER TABLE agm_meetings ALTER COLUMN created_by TYPE text USING created_by::text`;
    console.log('agm_meetings.created_by -> text OK');

    await sql`ALTER TABLE agm_attendees ALTER COLUMN created_by TYPE text USING created_by::text`;
    console.log('agm_attendees.created_by -> text OK');

    await sql`ALTER TABLE agm_resolutions ALTER COLUMN created_by TYPE text USING created_by::text`;
    console.log('agm_resolutions.created_by -> text OK');

    await sql`ALTER TABLE agm_news ALTER COLUMN created_by TYPE text USING created_by::text`;
    console.log('agm_news.created_by -> text OK');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await sql.end();
  }
})();
