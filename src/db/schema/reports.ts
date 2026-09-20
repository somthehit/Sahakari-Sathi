/**
 * Reports Schema
 * report_exports, report_templates
 * All tables scoped to organization_id for multi-tenancy.
 */
import {
  pgTable, text, integer, boolean, timestamp, uuid, index, jsonb,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { orgUsers } from './auth';

// =============================================
// REPORT TEMPLATES
// =============================================
export const reportTemplates = pgTable('report_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),                       // e.g. 'LOAN_SUMMARY', 'TRIAL_BALANCE'
  name: text('name').notNull(),
  module: text('module').notNull(),                   // 'Loans', 'Savings', 'Accounting', etc.
  description: text('description'),
  defaultFilters: jsonb('default_filters'),           // JSON object of default filter params
  isSystem: boolean('is_system').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => orgUsers.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('rpt_tmpl_org_module_idx').on(table.organizationId, table.module),
  index('rpt_tmpl_org_code_idx').on(table.organizationId, table.code),
]);

// =============================================
// REPORT EXPORTS
// =============================================
export const reportExports = pgTable('report_exports', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  templateId: uuid('template_id').references(() => reportTemplates.id),
  reportName: text('report_name').notNull(),
  module: text('module').notNull(),
  format: text('format', { enum: ['PDF', 'Excel', 'CSV'] }).notNull(),
  filters: jsonb('filters'),                          // applied filter snapshot
  fileUrl: text('file_url'),                          // storage URL after generation
  fileSize: integer('file_size'),
  status: text('status', { enum: ['Pending', 'Processing', 'Ready', 'Failed'] }).notNull().default('Pending'),
  generatedBy: uuid('generated_by').references(() => orgUsers.id),
  generatedAt: timestamp('generated_at'),
  errorMessage: text('error_message'),
  expiresAt: timestamp('expires_at'),                 // auto-cleanup
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('rpt_export_org_status_idx').on(table.organizationId, table.status),
  index('rpt_export_org_module_idx').on(table.organizationId, table.module),
  index('rpt_export_org_user_idx').on(table.organizationId, table.generatedBy),
  index('rpt_export_org_created_idx').on(table.organizationId, table.createdAt),
]);
