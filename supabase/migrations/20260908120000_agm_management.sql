-- AGM Management Tables (governance)
-- Run this to create the tables for AGM meetings, attendees, resolutions, and news

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
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS agm_meetings_org_idx ON agm_meetings(organization_id);
CREATE INDEX IF NOT EXISTS agm_meetings_org_type_idx ON agm_meetings(organization_id, type);
CREATE INDEX IF NOT EXISTS agm_meetings_org_status_idx ON agm_meetings(organization_id, status);
CREATE INDEX IF NOT EXISTS agm_meetings_org_date_idx ON agm_meetings(organization_id, meeting_date_bs);

ALTER TABLE agm_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY agm_meetings_tenant ON agm_meetings USING (organization_id = current_setting('app.current_org')::UUID);
CREATE POLICY agm_meetings_all ON agm_meetings FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Attendees
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
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS agm_attendees_meeting_idx ON agm_attendees(meeting_id);
CREATE INDEX IF NOT EXISTS agm_attendees_org_meeting_idx ON agm_attendees(organization_id, meeting_id);
CREATE INDEX IF NOT EXISTS agm_attendees_member_idx ON agm_attendees(member_id);

ALTER TABLE agm_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY agm_attendees_tenant ON agm_attendees USING (organization_id = current_setting('app.current_org')::UUID);
CREATE POLICY agm_attendees_all ON agm_attendees FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Resolutions
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
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS agm_resolutions_meeting_idx ON agm_resolutions(meeting_id);
CREATE INDEX IF NOT EXISTS agm_resolutions_org_meeting_idx ON agm_resolutions(organization_id, meeting_id);

ALTER TABLE agm_resolutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY agm_resolutions_tenant ON agm_resolutions USING (organization_id = current_setting('app.current_org')::UUID);
CREATE POLICY agm_resolutions_all ON agm_resolutions FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- News / Updates
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
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS agm_news_org_idx ON agm_news(organization_id);
CREATE INDEX IF NOT EXISTS agm_news_org_category_idx ON agm_news(organization_id, category);
CREATE INDEX IF NOT EXISTS agm_news_org_published_idx ON agm_news(organization_id, is_published);

ALTER TABLE agm_news ENABLE ROW LEVEL SECURITY;
CREATE POLICY agm_news_tenant ON agm_news USING (organization_id = current_setting('app.current_org')::UUID);
CREATE POLICY agm_news_all ON agm_news FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
