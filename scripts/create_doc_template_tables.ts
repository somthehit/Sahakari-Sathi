import 'dotenv/config';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  console.log('URL exists:', !!url);
  if (!url) { console.log('No DB URL'); return; }
  const sql = postgres(url);
  try {
    const r = await sql`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'document_templates') AS exists`;
    console.log('Table exists:', r[0]?.exists);
    if (!r[0]?.exists) {
      console.log('Creating tables...');
      await sql`
        CREATE TABLE IF NOT EXISTS document_templates (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          category VARCHAR(30) NOT NULL,
          sub_type VARCHAR(50),
          name TEXT NOT NULL,
          description TEXT,
          page_size VARCHAR(20) DEFAULT 'A4',
          page_width INTEGER,
          page_height INTEGER,
          orientation VARCHAR(10) DEFAULT 'portrait',
          margins JSONB DEFAULT '{"top":15,"right":15,"bottom":15,"left":15}'::JSONB,
          layout_json JSONB NOT NULL DEFAULT '{"elements":[]}'::JSONB,
          status VARCHAR(20) DEFAULT 'draft',
          version INTEGER DEFAULT 1,
          active_version_id UUID,
          is_starter_template BOOLEAN DEFAULT FALSE,
          is_system BOOLEAN DEFAULT FALSE,
          created_by UUID,
          updated_by UUID,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS dtmpl_org_name_uniq ON document_templates(organization_id, name)`;
      await sql`CREATE INDEX IF NOT EXISTS dtmpl_org_cat_idx ON document_templates(organization_id, category)`;
      await sql`CREATE INDEX IF NOT EXISTS dtmpl_org_status_idx ON document_templates(organization_id, status)`;

      await sql`
        CREATE TABLE IF NOT EXISTS document_template_versions (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
          version INTEGER NOT NULL,
          layout_json JSONB NOT NULL,
          change_notes TEXT,
          published_by UUID,
          published_at TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS dtmpl_ver_tpl_ver_uniq ON document_template_versions(template_id, version)`;
      await sql`CREATE INDEX IF NOT EXISTS dtmpl_ver_tpl_idx ON document_template_versions(template_id)`;
      console.log('Tables created!');
    }
  } catch(e) { console.error('Error:', e.message); }
  await sql.end();
}
main();
