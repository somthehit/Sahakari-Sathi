import { getDb } from './client';
import { sql } from 'drizzle-orm';

export async function initDocumentTemplateTables(): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    await db.execute(sql`
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
        created_by TEXT,
        updated_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'dtmpl_org_name_uniq') THEN
          CREATE UNIQUE INDEX dtmpl_org_name_uniq ON document_templates(organization_id, name);
        END IF;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'dtmpl_org_cat_idx') THEN
          CREATE INDEX dtmpl_org_cat_idx ON document_templates(organization_id, category);
        END IF;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'dtmpl_org_status_idx') THEN
          CREATE INDEX dtmpl_org_status_idx ON document_templates(organization_id, status);
        END IF;
      END $$;
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS document_template_versions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        layout_json JSONB NOT NULL,
        change_notes TEXT,
        published_by TEXT,
        published_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'dtmpl_ver_tpl_ver_uniq') THEN
          CREATE UNIQUE INDEX dtmpl_ver_tpl_ver_uniq ON document_template_versions(template_id, version);
        END IF;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'dtmpl_ver_tpl_idx') THEN
          CREATE INDEX dtmpl_ver_tpl_idx ON document_template_versions(template_id);
        END IF;
      END $$;
    `);

    console.log('[DB] document_templates tables initialized.');
  } catch (err) {
    console.error('[DB] Failed to init document_templates tables:', err);
  }
}
