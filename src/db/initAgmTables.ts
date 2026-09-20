import { getDb } from './client';
import { sql } from 'drizzle-orm';

export async function initAgmTables(): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS agm_meetings (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        title_nepali TEXT,
        type TEXT NOT NULL DEFAULT 'AGM',
        meeting_date_bs TEXT NOT NULL,
        meeting_date_ad DATE,
        start_time TEXT,
        end_time TEXT,
        venue TEXT,
        venue_nepali TEXT,
        description TEXT,
        agenda JSONB DEFAULT '[]'::JSONB,
        status TEXT NOT NULL DEFAULT 'Scheduled',
        quorum_required INTEGER,
        quorum_percentage NUMERIC,
        resolutions_count INTEGER DEFAULT 0,
        minutes_summary TEXT,
        called_by TEXT,
        chaired_by TEXT,
        secretary_name TEXT,
        created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS agm_meetings_org_idx ON agm_meetings(organization_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS agm_meetings_org_status_idx ON agm_meetings(organization_id, status);`);
    // Add agenda column if missing (for existing tables)
    await db.execute(sql`ALTER TABLE agm_meetings ADD COLUMN IF NOT EXISTS agenda JSONB DEFAULT '[]'::JSONB;`);
    // Fix created_by type if it was created as UUID
    await db.execute(sql`ALTER TABLE agm_meetings ALTER COLUMN created_by TYPE TEXT USING created_by::text;`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS agm_attendees (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        meeting_id UUID NOT NULL REFERENCES agm_meetings(id) ON DELETE CASCADE,
        member_id UUID REFERENCES members(id) ON DELETE SET NULL,
        member_no TEXT,
        member_name TEXT,
        attended BOOLEAN DEFAULT FALSE,
        proxy_given BOOLEAN DEFAULT FALSE,
        proxy_to TEXT,
        is_guest BOOLEAN DEFAULT FALSE,
        guest_name TEXT,
        guest_role TEXT,
        signature_received BOOLEAN DEFAULT FALSE,
        remarks TEXT,
        created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS agm_attendees_meeting_idx ON agm_attendees(meeting_id);`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS agm_resolutions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        meeting_id UUID NOT NULL REFERENCES agm_meetings(id) ON DELETE CASCADE,
        resolution_no INTEGER NOT NULL,
        title TEXT NOT NULL,
        title_nepali TEXT,
        description TEXT,
        proposed_by TEXT,
        seconded_by TEXT,
        status TEXT NOT NULL DEFAULT 'Proposed',
        votes_for INTEGER,
        votes_against INTEGER,
        abstained INTEGER,
        decision TEXT,
        assigned_to TEXT,
        due_date_bs TEXT,
        completed_at TIMESTAMPTZ,
        attachments JSONB DEFAULT '[]'::JSONB,
        created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS agm_resolutions_meeting_idx ON agm_resolutions(meeting_id);`);
    // Fix created_by type if it was created as UUID
    await db.execute(sql`ALTER TABLE agm_resolutions ALTER COLUMN created_by TYPE TEXT USING created_by::text;`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS agm_news (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        title_nepali TEXT,
        content TEXT,
        content_nepali TEXT,
        category TEXT NOT NULL DEFAULT 'Announcement',
        priority TEXT NOT NULL DEFAULT 'Medium',
        publish_date_bs TEXT,
        expiry_date_bs TEXT,
        is_published BOOLEAN DEFAULT FALSE,
        attachments JSONB DEFAULT '[]'::JSONB,
        created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS agm_news_org_idx ON agm_news(organization_id);`);

    // ─── AGM TEAM MEMBERS ────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS agm_team_members (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        meeting_id UUID REFERENCES agm_meetings(id) ON DELETE SET NULL,
        employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        name_nepali TEXT,
        role TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'Board',
        designation TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        photo_url TEXT,
        documents JSONB DEFAULT '[]'::JSONB,
        order_index INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Active',
        joined_date_bs TEXT,
        tenure_end_bs TEXT,
        notes TEXT,
        created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS agm_team_members_org_idx ON agm_team_members(organization_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS agm_team_members_meeting_idx ON agm_team_members(meeting_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS agm_team_members_category_idx ON agm_team_members(organization_id, category);`);
    await db.execute(sql`ALTER TABLE agm_team_members ALTER COLUMN created_by TYPE TEXT USING created_by::text;`);

    console.log('[init] AGM tables ready');
  } catch (e: any) {
    console.error('[init] agm tables:', e.message);
  }
}
