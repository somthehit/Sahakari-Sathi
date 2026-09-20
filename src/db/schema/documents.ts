/**
 * Document Management Schema
 * documents, attachments, file_metadata
 * All tables scoped to organization_id for multi-tenancy.
 */
import {
  pgTable, text, integer, boolean, timestamp, uuid, index, jsonb,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { orgUsers } from './auth';

// =============================================
// DOCUMENTS (logical document vault)
// =============================================
export const documents = pgTable('documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category').notNull(),               // e.g. 'Policy', 'Circular', 'Agreement'
  module: text('module'),                             // linked module: 'Loans', 'Members', etc.
  referenceType: text('reference_type'),              // 'loan', 'member', 'branch', etc.
  referenceId: uuid('reference_id'),
  isPublic: boolean('is_public').notNull().default(false),
  uploadedBy: uuid('uploaded_by').references(() => orgUsers.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('doc_org_module_idx').on(table.organizationId, table.module),
  index('doc_org_ref_idx').on(table.organizationId, table.referenceType, table.referenceId),
  index('doc_org_category_idx').on(table.organizationId, table.category),
]);

// =============================================
// ATTACHMENTS (physical files linked to documents)
// =============================================
export const attachments = pgTable('attachments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'cascade' }),
  fileUrl: text('file_url').notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type'),
  fileSize: integer('file_size'),
  storageProvider: text('storage_provider').default('supabase'),  // 'supabase', 's3', 'gcs'
  storagePath: text('storage_path'),
  uploadedBy: uuid('uploaded_by').references(() => orgUsers.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('attach_org_doc_idx').on(table.organizationId, table.documentId),
  index('attach_org_created_idx').on(table.organizationId, table.createdAt),
]);

// =============================================
// FILE METADATA (platform-level file registry)
// =============================================
export const fileMetadata = pgTable('file_metadata', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  storagePath: text('storage_path').notNull(),
  publicUrl: text('public_url'),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type'),
  fileSize: integer('file_size'),
  bucket: text('bucket').notNull(),
  referenceType: text('reference_type'),              // 'member_photo', 'kyc_doc', 'signature', etc.
  referenceId: uuid('reference_id'),
  uploadedBy: uuid('uploaded_by').references(() => orgUsers.id),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('file_meta_org_ref_idx').on(table.organizationId, table.referenceType, table.referenceId),
  index('file_meta_org_bucket_idx').on(table.organizationId, table.bucket),
  index('file_meta_org_created_idx').on(table.organizationId, table.createdAt),
]);
