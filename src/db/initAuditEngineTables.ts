import { getDb } from './client';
import { sql } from 'drizzle-orm';

export async function initAuditEngineTables(): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    // ── audit_rules ──────────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_rules (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        rule_code VARCHAR(30) NOT NULL,
        name VARCHAR(200) NOT NULL,
        name_nepali VARCHAR(200),
        description TEXT,
        category TEXT NOT NULL CHECK (category IN ('integrity','statutory','analytical')),
        layer INTEGER NOT NULL DEFAULT 1,
        source_statement VARCHAR(100),
        severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical','high','medium','low','advisory')),
        parameters JSONB DEFAULT '{}'::JSONB,
        is_blocking BOOLEAN NOT NULL DEFAULT FALSE,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        effective_from VARCHAR(20),
        effective_to VARCHAR(20),
        created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS audit_rules_org_idx ON audit_rules(organization_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS audit_rules_org_category_idx ON audit_rules(organization_id, category);`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS audit_rules_org_code_idx ON audit_rules(organization_id, rule_code);`);
    // Add executable rule columns
    await db.execute(sql`ALTER TABLE audit_rules ADD COLUMN IF NOT EXISTS rule_type TEXT NOT NULL DEFAULT 'tie_out';`);
    await db.execute(sql`ALTER TABLE audit_rules ADD COLUMN IF NOT EXISTS field_a VARCHAR(200);`);
    await db.execute(sql`ALTER TABLE audit_rules ADD COLUMN IF NOT EXISTS field_b VARCHAR(200);`);
    await db.execute(sql`ALTER TABLE audit_rules ADD COLUMN IF NOT EXISTS operator VARCHAR(20);`);
    await db.execute(sql`ALTER TABLE audit_rules ADD COLUMN IF NOT EXISTS tolerance NUMERIC(18,2) DEFAULT '0';`);
    await db.execute(sql`ALTER TABLE audit_rules ADD COLUMN IF NOT EXISTS base_field VARCHAR(200);`);
    await db.execute(sql`ALTER TABLE audit_rules ADD COLUMN IF NOT EXISTS threshold_value NUMERIC(18,4);`);
    await db.execute(sql`ALTER TABLE audit_rules ADD COLUMN IF NOT EXISTS threshold_operator VARCHAR(10);`);

    // ── audit_runs ───────────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_runs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        fiscal_year_id UUID REFERENCES fiscal_years(id) ON DELETE SET NULL,
        fiscal_year_label VARCHAR(50),
        rule_set_version INTEGER NOT NULL DEFAULT 1,
        triggered_by TEXT NOT NULL DEFAULT 'manual',
        status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
        total_rules INTEGER DEFAULT 0,
        rules_passed INTEGER DEFAULT 0,
        rules_failed INTEGER DEFAULT 0,
        rules_skipped INTEGER DEFAULT 0,
        started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
        completed_at TIMESTAMPTZ,
        error_message TEXT,
        created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS audit_runs_org_idx ON audit_runs(organization_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS audit_runs_org_fy_idx ON audit_runs(organization_id, fiscal_year_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS audit_runs_org_status_idx ON audit_runs(organization_id, status);`);

    // ── audit_findings ───────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_findings (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        run_id UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
        rule_id UUID NOT NULL REFERENCES audit_rules(id) ON DELETE CASCADE,
        severity TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low','advisory')),
        title VARCHAR(300) NOT NULL,
        description TEXT,
        category TEXT NOT NULL CHECK (category IN ('integrity','statutory','analytical')),
        source_statement VARCHAR(100),
        evidence_ref JSONB DEFAULT '{}'::JSONB,
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','resolved','waived')),
        resolution_note TEXT,
        waived_justification TEXT,
        owner_user_id VARCHAR(100),
        owner_name VARCHAR(200),
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
        resolved_at TIMESTAMPTZ
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS audit_findings_org_idx ON audit_findings(organization_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS audit_findings_run_idx ON audit_findings(run_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS audit_findings_run_status_idx ON audit_findings(run_id, status);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS audit_findings_org_status_idx ON audit_findings(organization_id, status);`);

    // ── audit_workpapers ─────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_workpapers (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        finding_id UUID NOT NULL REFERENCES audit_findings(id) ON DELETE CASCADE,
        type TEXT NOT NULL DEFAULT 'system_ref' CHECK (type IN ('attachment','system_ref','note')),
        reference TEXT,
        file_name VARCHAR(200),
        file_url TEXT,
        file_size INTEGER,
        uploaded_by VARCHAR(100),
        uploaded_at TIMESTAMPTZ DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS audit_workpapers_finding_idx ON audit_workpapers(finding_id);`);

    // ── audit_opinion_drafts ─────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_opinion_drafts (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        run_id UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
        suggested_classification TEXT NOT NULL CHECK (suggested_classification IN ('unqualified','qualified','adverse','disclaimer')),
        final_classification TEXT CHECK (final_classification IN ('unqualified','qualified','adverse','disclaimer')),
        basis_summary TEXT,
        override_reason TEXT,
        set_by_user_id VARCHAR(100),
        set_by_user_name VARCHAR(200),
        set_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS audit_opinion_drafts_org_idx ON audit_opinion_drafts(organization_id);`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS audit_opinion_drafts_run_idx ON audit_opinion_drafts(run_id);`);

    // ── audit_signoffs ───────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_signoffs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        run_id UUID NOT NULL REFERENCES audit_runs(id) ON DELETE CASCADE,
        stage TEXT NOT NULL CHECK (stage IN ('preparer','internal_auditor','external_auditor','board','doc_submission')),
        user_id VARCHAR(100) NOT NULL,
        user_name VARCHAR(200),
        decision TEXT NOT NULL CHECK (decision IN ('approved','rejected','needs_revision')),
        comments TEXT,
        signed_document_ref TEXT,
        timestamp TIMESTAMPTZ DEFAULT now() NOT NULL
      );
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS audit_signoffs_run_idx ON audit_signoffs(run_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS audit_signoffs_org_stage_idx ON audit_signoffs(organization_id, stage);`);
    // Add stage-specific reference columns
    await db.execute(sql`ALTER TABLE audit_signoffs ADD COLUMN IF NOT EXISTS external_auditor_name VARCHAR(200);`);
    await db.execute(sql`ALTER TABLE audit_signoffs ADD COLUMN IF NOT EXISTS external_auditor_firm VARCHAR(200);`);
    await db.execute(sql`ALTER TABLE audit_signoffs ADD COLUMN IF NOT EXISTS opinion_pdf_url TEXT;`);
    await db.execute(sql`ALTER TABLE audit_signoffs ADD COLUMN IF NOT EXISTS opinion_pdf_name VARCHAR(200);`);
    await db.execute(sql`ALTER TABLE audit_signoffs ADD COLUMN IF NOT EXISTS resolution_id UUID;`);
    await db.execute(sql`ALTER TABLE audit_signoffs ADD COLUMN IF NOT EXISTS resolution_number VARCHAR(50);`);
    await db.execute(sql`ALTER TABLE audit_signoffs ADD COLUMN IF NOT EXISTS resolution_date VARCHAR(20);`);
    await db.execute(sql`ALTER TABLE audit_signoffs ADD COLUMN IF NOT EXISTS resolution_title VARCHAR(200);`);
    await db.execute(sql`ALTER TABLE audit_signoffs ADD COLUMN IF NOT EXISTS doc_submission_date VARCHAR(20);`);
    await db.execute(sql`ALTER TABLE audit_signoffs ADD COLUMN IF NOT EXISTS doc_reference_number VARCHAR(100);`);
    await db.execute(sql`ALTER TABLE audit_signoffs ADD COLUMN IF NOT EXISTS doc_portal_url TEXT;`);

    console.log('[init] Audit Engine tables ready');
  } catch (e: any) {
    console.error('[init] audit engine tables:', e.message);
  }
}
