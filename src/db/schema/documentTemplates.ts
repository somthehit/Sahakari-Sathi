/**
 * Document Template Design Studio — Schema
 * Visual drag-and-drop template editor for receipts, vouchers, certificates, reports.
 * All tables scoped to organization_id for multi-tenancy.
 */
import {
  pgTable, text, varchar, integer, boolean, timestamp, uuid, index, jsonb, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';

// =============================================
// DOCUMENT TEMPLATES (master template record)
// =============================================
export const documentTemplates = pgTable('document_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  category: varchar('category', { length: 30 }).notNull(),       // 'report' | 'receipt' | 'voucher' | 'certificate'
  subType: varchar('sub_type', { length: 50 }),                   // 'balance_sheet', 'deposit_receipt', 'payment_voucher', 'share_certificate'
  name: text('name').notNull(),
  description: text('description'),
  pageSize: varchar('page_size', { length: 20 }).default('A4'),  // 'A4' | 'A5' | 'Letter' | 'Thermal80' | 'custom'
  pageWidth: integer('page_width'),                                // custom width in mm (null = use named size)
  pageHeight: integer('page_height'),                              // custom height in mm
  orientation: varchar('orientation', { length: 10 }).default('portrait'), // 'portrait' | 'landscape'
  margins: jsonb('margins').default({ top: 15, right: 15, bottom: 15, left: 15 }), // mm
  layoutJson: jsonb('layout_json').notNull().default({ elements: [] }), // canvas element tree
  status: varchar('status', { length: 20 }).default('draft'),    // 'draft' | 'published'
  version: integer('version').default(1),
  activeVersionId: uuid('active_version_id'),                     // FK to document_template_versions
  isStarterTemplate: boolean('is_starter_template').default(false),
  isSystem: boolean('is_system').default(false),                  // system templates can't be deleted
  createdBy: text('created_by'),
  updatedBy: text('updated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('dtmpl_org_name_uniq').on(table.organizationId, table.name),
  index('dtmpl_org_cat_idx').on(table.organizationId, table.category),
  index('dtmpl_org_cat_subtype_idx').on(table.organizationId, table.category, table.subType),
  index('dtmpl_org_status_idx').on(table.organizationId, table.status),
]);

// =============================================
// DOCUMENT TEMPLATE VERSIONS (immutable snapshots)
// =============================================
export const documentTemplateVersions = pgTable('document_template_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateId: uuid('template_id').notNull().references(() => documentTemplates.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  layoutJson: jsonb('layout_json').notNull(),
  changeNotes: text('change_notes'),
  publishedBy: text('published_by'),
  publishedAt: timestamp('published_at').defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('dtmpl_ver_tpl_ver_uniq').on(table.templateId, table.version),
  index('dtmpl_ver_tpl_idx').on(table.templateId),
]);
