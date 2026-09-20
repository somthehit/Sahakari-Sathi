/**
 * Legal Document Generator Studio — Schema
 * Template management, version control, document generation, audit trail.
 * All tables scoped to organization_id for multi-tenancy.
 */
import {
  pgTable, text, integer, boolean, timestamp, uuid, index, jsonb, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { orgUsers } from './auth';

// =============================================
// LEGAL TEMPLATE CATEGORIES (document type registry)
// =============================================
export const legalTemplateCategories = pgTable('legal_template_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),                    // 'Loan Tamsuk', 'Loan Agreement', 'Share Certificate'
  code: text('code').notNull(),                    // 'LOAN_TAMSHUK', 'LOAN_AGREEMENT', 'SHARE_CERT'
  description: text('description'),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('legal_cat_org_code_uniq').on(table.organizationId, table.code),
  index('legal_cat_org_idx').on(table.organizationId),
]);

// =============================================
// LEGAL TEMPLATES (master template record)
// =============================================
export const legalTemplates = pgTable('legal_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => legalTemplateCategories.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),                    // 'Loan Tamsuk Template v2'
  description: text('description'),
  status: text('status', { enum: ['draft', 'under_review', 'approved', 'published', 'archived'] }).notNull().default('draft'),
  activeVersionId: uuid('active_version_id'),      // FK set after version approval
  currentVersion: integer('current_version').default(1),
  // Applicable rules — determines when this template can be used
  applicableRules: jsonb('applicable_rules').default({}).$type<{
    requiresGuarantor?: boolean;
    requiresCollateral?: boolean;
    minLoanAmount?: number;
    maxLoanAmount?: number;
    loanTypes?: string[];          // applicable loan product codes
    borrowerTypes?: string[];      // 'individual', 'joint', 'group'
    hasPenaltyClauses?: boolean;
    hasPrepaymentClauses?: boolean;
  }>(),
  // Document formatting
  fontStyle: text('font_style').default('Traditional'),
  fontSize: integer('font_size').default(12),
  pageLayout: text('page_layout').default('A4'),
  marginNormal: text('margin_normal').default('25mm'),
  headerContent: text('header_content'),
  footerContent: text('footer_content'),
  createdBy: uuid('created_by').references(() => orgUsers.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('legal_tpl_org_cat_idx').on(table.organizationId, table.categoryId),
  index('legal_tpl_org_status_idx').on(table.organizationId, table.status),
  index('legal_tpl_org_idx').on(table.organizationId),
]);

// =============================================
// LEGAL TEMPLATE VERSIONS (immutable once approved)
// =============================================
export const legalTemplateVersions = pgTable('legal_template_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateId: uuid('template_id').notNull().references(() => legalTemplates.id, { onDelete: 'cascade' }),
  versionNumber: integer('version_number').notNull(),
  content: text('content').notNull(),              // HTML/markup with {{variable}} placeholders
  contentMd: text('content_md'),                   // Optional markdown source
  changeNotes: text('change_notes'),
  status: text('status', { enum: ['draft', 'under_review', 'approved', 'rejected'] }).notNull().default('draft'),
  approvedBy: uuid('approved_by').references(() => orgUsers.id),
  approvedAt: timestamp('approved_at'),
  rejectionReason: text('rejection_reason'),
  isCurrent: boolean('is_current').notNull().default(false),
  createdBy: uuid('created_by').references(() => orgUsers.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('legal_ver_tpl_num_uniq').on(table.templateId, table.versionNumber),
  index('legal_ver_tpl_idx').on(table.templateId),
  index('legal_ver_status_idx').on(table.status),
]);

// =============================================
// LEGAL TEMPLATE CLAUSES (reusable clause library)
// =============================================
export const legalTemplateClauses = pgTable('legal_template_clauses', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),                    // 'Standard Penalty Clause', 'Collateral Lien'
  clauseType: text('clause_type', { enum: ['required', 'conditional', 'optional'] }).notNull().default('required'),
  category: text('category'),                      // 'penalty', 'collateral', 'guarantee', 'general'
  content: text('content').notNull(),              // clause text with {{variables}}
  applicableRules: jsonb('applicable_rules').default({}).$type<{
    requiresGuarantor?: boolean;
    requiresCollateral?: boolean;
    minAmount?: number;
    maxAmount?: number;
    loanTypes?: string[];
  }>(),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => orgUsers.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('legal_clause_org_idx').on(table.organizationId, table.category),
  index('legal_clause_org_type_idx').on(table.organizationId, table.clauseType),
]);

// =============================================
// LEGAL DOCUMENTS (generated document instances)
// =============================================
export const legalDocuments = pgTable('legal_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  documentNo: text('document_no').notNull(),       // auto-generated: TMS-2025-0001
  templateId: uuid('template_id').notNull().references(() => legalTemplates.id, { onDelete: 'restrict' }),
  templateVersionId: uuid('template_version_id').notNull().references(() => legalTemplateVersions.id, { onDelete: 'restrict' }),
  // Linked entities
  loanId: uuid('loan_id'),                        // link to loan_accounts
  memberId: uuid('member_id'),                    // link to members
  // Generated content
  generatedContent: text('generated_content').notNull(), // final HTML
  inputVariables: jsonb('input_variables'),        // snapshot of resolved variables
  // Metadata
  status: text('status', { enum: ['draft', 'final', 'printed', 'archived'] }).notNull().default('draft'),
  generatedBy: uuid('generated_by').references(() => orgUsers.id),
  printedAt: timestamp('printed_at'),
  printCount: integer('print_count').default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('legal_doc_org_docno_uniq').on(table.organizationId, table.documentNo),
  index('legal_doc_org_tpl_idx').on(table.organizationId, table.templateId),
  index('legal_doc_org_loan_idx').on(table.organizationId, table.loanId),
  index('legal_doc_org_member_idx').on(table.organizationId, table.memberId),
  index('legal_doc_org_status_idx').on(table.organizationId, table.status),
  index('legal_doc_org_created_idx').on(table.organizationId, table.createdAt),
]);

// =============================================
// LEGAL DOCUMENT AUDITS (full audit trail)
// =============================================
export const legalDocumentAudits = pgTable('legal_document_audits', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  entityType: text('entity_type', { enum: ['template', 'version', 'document', 'clause'] }).notNull(),
  entityId: uuid('entity_id').notNull(),
  action: text('action', {
    enum: ['created', 'updated', 'approved', 'rejected', 'published', 'archived',
           'generated', 'printed', 'downloaded', 'version_created', 'status_changed']
  }).notNull(),
  actorId: uuid('actor_id').references(() => orgUsers.id),
  actorName: text('actor_name'),
  details: jsonb('details'),                       // { from: 'draft', to: 'approved', ... }
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('legal_audit_org_entity_idx').on(table.organizationId, table.entityType, table.entityId),
  index('legal_audit_org_actor_idx').on(table.organizationId, table.actorId),
  index('legal_audit_org_created_idx').on(table.organizationId, table.createdAt),
]);
