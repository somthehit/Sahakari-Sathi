require('dotenv/config');
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, {
  connect_timeout: 60,
  ssl: process.env.DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : false,
});

(async () => {
  try {
    await sql`CREATE TABLE IF NOT EXISTS agm_meetings (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      title TEXT NOT NULL, title_nepali TEXT, type TEXT NOT NULL DEFAULT 'AGM',
      meeting_date_bs TEXT NOT NULL, meeting_date_ad DATE,
      start_time TEXT, end_time TEXT, venue TEXT, venue_nepali TEXT,
      description TEXT, agenda JSONB DEFAULT '[]'::JSONB,
      status TEXT NOT NULL DEFAULT 'Scheduled',
      quorum_required INTEGER, quorum_percentage NUMERIC, resolutions_count INTEGER DEFAULT 0,
      minutes_summary TEXT, called_by TEXT, chaired_by TEXT, secretary_name TEXT,
      created_by UUID, created_at TIMESTAMPTZ DEFAULT now() NOT NULL, updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
    )`;
    console.log('agm_meetings OK');

    await sql`CREATE TABLE IF NOT EXISTS agm_attendees (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      meeting_id UUID NOT NULL REFERENCES agm_meetings(id) ON DELETE CASCADE,
      member_id UUID REFERENCES members(id) ON DELETE SET NULL,
      member_no TEXT, member_name TEXT, attended BOOLEAN DEFAULT FALSE,
      proxy_given BOOLEAN DEFAULT FALSE, proxy_to TEXT,
      is_guest BOOLEAN DEFAULT FALSE, guest_name TEXT, guest_role TEXT,
      signature_received BOOLEAN DEFAULT FALSE, remarks TEXT,
      created_by UUID, created_at TIMESTAMPTZ DEFAULT now() NOT NULL
    )`;
    console.log('agm_attendees OK');

    await sql`CREATE TABLE IF NOT EXISTS agm_resolutions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      meeting_id UUID NOT NULL REFERENCES agm_meetings(id) ON DELETE CASCADE,
      resolution_no INTEGER NOT NULL, title TEXT NOT NULL, title_nepali TEXT,
      description TEXT, proposed_by TEXT, seconded_by TEXT,
      status TEXT NOT NULL DEFAULT 'Proposed',
      votes_for INTEGER, votes_against INTEGER, abstained INTEGER,
      decision TEXT, assigned_to TEXT, due_date_bs TEXT,
      created_by UUID, created_at TIMESTAMPTZ DEFAULT now() NOT NULL, updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
    )`;
    console.log('agm_resolutions OK');

    await sql`CREATE TABLE IF NOT EXISTS agm_news (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      title TEXT NOT NULL, title_nepali TEXT, content TEXT, content_nepali TEXT,
      category TEXT NOT NULL DEFAULT 'Announcement', priority TEXT NOT NULL DEFAULT 'Medium',
      publish_date_bs TEXT, expiry_date_bs TEXT, is_published BOOLEAN DEFAULT FALSE,
      attachments JSONB DEFAULT '[]'::JSONB,
      created_by UUID, created_at TIMESTAMPTZ DEFAULT now() NOT NULL, updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
    )`;
    console.log('agm_news OK');

    console.log('All AGM tables created successfully!');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await sql.end();
  }
})();
