/**
 * Audit Engine schema — rules, runs, findings, workpapers, opinion drafts, signoffs.
 * All tables scoped to organization_id for multi-tenancy.
 */
import {
  pgTable, text, varchar, integer, boolean, timestamp, uuid, jsonb, index, uniqueIndex, numeric,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { fiscalYears } from './branches';

// =============================================
// AUDIT RULES
// =============================================
export const auditRules = pgTable('audit_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  ruleCode: varchar('rule_code', { length: 30 }).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  nameNepali: varchar('name_nepali', { length: 200 }),
  description: text('description'),
  category: text('category', {
    enum: ['integrity', 'statutory', 'analytical'],
  }).notNull(),
  layer: integer('layer').notNull().default(1),
  // ── Executable rule definition ──────────────────────────────────────
  ruleType: text('rule_type', {
    enum: ['tie_out', 'threshold', 'percentage_of_base', 'classification_match', 'custom'],
  }).notNull().default('tie_out'),
  fieldA: varchar('field_a', { length: 200 }),
  fieldB: varchar('field_b', { length: 200 }),
  operator: varchar('operator', { length: 20 }),
  tolerance: numeric('tolerance', { precision: 18, scale: 2 }).default('0'),
  baseField: varchar('base_field', { length: 200 }),
  thresholdValue: numeric('threshold_value', { precision: 18, scale: 4 }),
  thresholdOperator: varchar('threshold_operator', { length: 10 }),
  // ── Metadata ────────────────────────────────────────────────────────
  sourceStatement: varchar('source_statement', { length: 100 }),
  severity: text('severity', {
    enum: ['critical', 'high', 'medium', 'low', 'advisory'],
  }).notNull().default('medium'),
  parameters: jsonb('parameters').$type<Record<string, any>>().default({}),
  isBlocking: boolean('is_blocking').notNull().default(false),
  active: boolean('active').notNull().default(true),
  effectiveFrom: varchar('effective_from', { length: 20 }),
  effectiveTo: varchar('effective_to', { length: 20 }),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('audit_rules_org_idx').on(table.organizationId),
  index('audit_rules_org_category_idx').on(table.organizationId, table.category),
  uniqueIndex('audit_rules_org_code_idx').on(table.organizationId, table.ruleCode),
]);

// =============================================
// AUDIT RUNS
// =============================================
export const auditRuns = pgTable('audit_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  fiscalYearId: uuid('fiscal_year_id').references(() => fiscalYears.id, { onDelete: 'set null' }),
  fiscalYearLabel: varchar('fiscal_year_label', { length: 50 }),
  ruleSetVersion: integer('rule_set_version').notNull().default(1),
  triggeredBy: text('triggered_by').notNull().default('manual'),
  status: text('status', {
    enum: ['running', 'completed', 'failed'],
  }).notNull().default('running'),
  totalRules: integer('total_rules').default(0),
  rulesPassed: integer('rules_passed').default(0),
  rulesFailed: integer('rules_failed').default(0),
  rulesSkipped: integer('rules_skipped').default(0),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  errorMessage: text('error_message'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('audit_runs_org_idx').on(table.organizationId),
  index('audit_runs_org_fy_idx').on(table.organizationId, table.fiscalYearId),
  index('audit_runs_org_status_idx').on(table.organizationId, table.status),
]);

// =============================================
// FINDINGS
// =============================================
export const auditFindings = pgTable('audit_findings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  runId: uuid('run_id').notNull().references(() => auditRuns.id, { onDelete: 'cascade' }),
  ruleId: uuid('rule_id').notNull().references(() => auditRules.id, { onDelete: 'cascade' }),
  severity: text('severity', {
    enum: ['critical', 'high', 'medium', 'low', 'advisory'],
  }).notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  description: text('description'),
  category: text('category', {
    enum: ['integrity', 'statutory', 'analytical'],
  }).notNull(),
  sourceStatement: varchar('source_statement', { length: 100 }),
  evidenceRef: jsonb('evidence_ref').$type<{
    statement?: string;
    accountCode?: string;
    accountName?: string;
    amount?: number;
    expectedAmount?: number;
    variance?: number;
    details?: string;
  }>().default({}),
  status: text('status', {
    enum: ['open', 'in_review', 'resolved', 'waived'],
  }).notNull().default('open'),
  resolutionNote: text('resolution_note'),
  waivedJustification: text('waived_justification'),
  ownerUserId: varchar('owner_user_id', { length: 100 }),
  ownerName: varchar('owner_name', { length: 200 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at'),
}, (table) => [
  index('audit_findings_org_idx').on(table.organizationId),
  index('audit_findings_run_idx').on(table.runId),
  index('audit_findings_run_status_idx').on(table.runId, table.status),
  index('audit_findings_org_status_idx').on(table.organizationId, table.status),
]);

// =============================================
// WORKPAPERS / EVIDENCE
// =============================================
export const auditWorkpapers = pgTable('audit_workpapers', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  findingId: uuid('finding_id').notNull().references(() => auditFindings.id, { onDelete: 'cascade' }),
  type: text('type', {
    enum: ['attachment', 'system_ref', 'note'],
  }).notNull().default('system_ref'),
  reference: text('reference'),
  fileName: varchar('file_name', { length: 200 }),
  fileUrl: text('file_url'),
  fileSize: integer('file_size'),
  uploadedBy: varchar('uploaded_by', { length: 100 }),
  uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
}, (table) => [
  index('audit_workpapers_finding_idx').on(table.findingId),
]);

// =============================================
// OPINION DRAFT
// =============================================
export const auditOpinionDrafts = pgTable('audit_opinion_drafts', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  runId: uuid('run_id').notNull().references(() => auditRuns.id, { onDelete: 'cascade' }),
  suggestedClassification: text('suggested_classification', {
    enum: ['unqualified', 'qualified', 'adverse', 'disclaimer'],
  }).notNull(),
  finalClassification: text('final_classification', {
    enum: ['unqualified', 'qualified', 'adverse', 'disclaimer'],
  }),
  basisSummary: text('basis_summary'),
  overrideReason: text('override_reason'),
  setByUserId: varchar('set_by_user_id', { length: 100 }),
  setByUserName: varchar('set_by_user_name', { length: 200 }),
  setAt: timestamp('set_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('audit_opinion_drafts_org_idx').on(table.organizationId),
  uniqueIndex('audit_opinion_drafts_run_idx').on(table.runId),
]);

// =============================================
// SIGNOFFS
// =============================================
export const auditSignoffs = pgTable('audit_signoffs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  runId: uuid('run_id').notNull().references(() => auditRuns.id, { onDelete: 'cascade' }),
  stage: text('stage', {
    enum: ['preparer', 'internal_auditor', 'external_auditor', 'board', 'doc_submission'],
  }).notNull(),
  userId: varchar('user_id', { length: 100 }).notNull(),
  userName: varchar('user_name', { length: 200 }),
  decision: text('decision', {
    enum: ['approved', 'rejected', 'needs_revision'],
  }).notNull(),
  comments: text('comments'),
  signedDocumentRef: text('signed_document_ref'),
  // Stage-specific reference fields
  // External Auditor: uploaded signed opinion PDF
  externalAuditorName: varchar('external_auditor_name', { length: 200 }),
  externalAuditorFirm: varchar('external_auditor_firm', { length: 200 }),
  opinionPdfUrl: text('opinion_pdf_url'),
  opinionPdfName: varchar('opinion_pdf_name', { length: 200 }),
  // Board: reference to AGM Resolution
  resolutionId: uuid('resolution_id'),
  resolutionNumber: varchar('resolution_number', { length: 50 }),
  resolutionDate: varchar('resolution_date', { length: 20 }),
  resolutionTitle: varchar('resolution_title', { length: 200 }),
  // DoC: reference to Regulatory Returns submission
  docSubmissionDate: varchar('doc_submission_date', { length: 20 }),
  docReferenceNumber: varchar('doc_reference_number', { length: 100 }),
  docPortalUrl: text('doc_portal_url'),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
}, (table) => [
  index('audit_signoffs_run_idx').on(table.runId),
  index('audit_signoffs_org_stage_idx').on(table.organizationId, table.stage),
]);
