/**
 * Notifications Schema
 * notifications, notification_templates, email_logs, sms_logs
 * All tables scoped to organization_id for multi-tenancy.
 */
import {
  pgTable, text, varchar, boolean, integer, timestamp, uuid, index, jsonb,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { orgUsers } from './auth';

// =============================================
// NOTIFICATION TEMPLATES (Enhanced)
// Fully customizable per-organization templates
// =============================================
export const notificationTemplates = pgTable('notification_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 50 }).notNull(),                 // e.g. 'LOAN_APPROVED', 'EMI_DUE'
  channel: varchar('channel', { length: 20 }).notNull(),           // 'Email' | 'SMS' | 'WhatsApp' | 'Push' | 'In_App'
  category: varchar('category', { length: 50 }),                   // 'transaction' | 'account' | 'reminder' | 'system'
  subject: varchar('subject', { length: 200 }),                    // for email subject
  bodyTemplate: text('body_template').notNull(),                    // Handlebars/mustache template
  variables: jsonb('variables'),                                   // Array of available placeholders [{name, description, example}]
  language: varchar('language', { length: 10 }).default('en'),     // 'en' | 'ne' (Nepali)
  isActive: boolean('is_active').notNull().default(true),
  isSystem: boolean('is_system').notNull().default(false),         // System templates cannot be deleted
  usageCount: integer('usage_count').notNull().default(0),         // Track template usage
  lastUsedAt: timestamp('last_used_at'),
  createdBy: varchar('created_by', { length: 100 }),
  updatedBy: varchar('updated_by', { length: 100 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('notif_tmpl_org_code_idx').on(table.organizationId, table.code),
  index('notif_tmpl_org_channel_idx').on(table.organizationId, table.channel),
  index('notif_tmpl_org_category_idx').on(table.organizationId, table.category),
]);

// =============================================
// NOTIFICATIONS (in-app)
// =============================================
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => orgUsers.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  body: text('body').notNull(),
  type: text('type', {
    enum: ['Info', 'Warning', 'Alert', 'Success', 'Reminder']
  }).notNull().default('Info'),
  referenceType: text('reference_type'),              // e.g. 'loan', 'savings', 'member'
  referenceId: uuid('reference_id'),
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('notif_org_user_idx').on(table.organizationId, table.userId),
  index('notif_org_read_idx').on(table.organizationId, table.isRead),
  index('notif_org_created_idx').on(table.organizationId, table.createdAt),
]);

// =============================================
// EMAIL LOGS
// =============================================
export const emailLogs = pgTable('email_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  templateCode: text('template_code'),
  toEmail: text('to_email').notNull(),
  toName: text('to_name'),
  subject: text('subject').notNull(),
  body: text('body'),
  status: text('status', { enum: ['Pending', 'Sent', 'Failed', 'Bounced'] }).notNull().default('Pending'),
  attemptCount: integer('attempt_count').notNull().default(0),
  sentAt: timestamp('sent_at'),
  errorMessage: text('error_message'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('email_log_org_status_idx').on(table.organizationId, table.status),
  index('email_log_org_created_idx').on(table.organizationId, table.createdAt),
]);

// =============================================
// SMS LOGS
// =============================================
export const smsLogs = pgTable('sms_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  templateCode: text('template_code'),
  toPhone: text('to_phone').notNull(),
  body: text('body').notNull(),
  status: text('status', { enum: ['Pending', 'Sent', 'Failed', 'Delivered'] }).notNull().default('Pending'),
  provider: text('provider'),                         // e.g. 'Sparrow', 'Aakash'
  providerMessageId: text('provider_message_id'),
  attemptCount: integer('attempt_count').notNull().default(0),
  sentAt: timestamp('sent_at'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('sms_log_org_status_idx').on(table.organizationId, table.status),
  index('sms_log_org_phone_idx').on(table.organizationId, table.toPhone),
  index('sms_log_org_created_idx').on(table.organizationId, table.createdAt),
]);

// =============================================
// WHATSAPP LOGS
// =============================================
export const whatsappLogs = pgTable('whatsapp_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  templateCode: text('template_code'),
  toPhone: text('to_phone').notNull(),
  body: text('body').notNull(),
  status: text('status', { enum: ['Pending', 'Sent', 'Failed', 'Delivered', 'Read'] }).notNull().default('Pending'),
  provider: text('provider'),                         // e.g. 'twilio', 'meta', 'textme'
  providerMessageId: text('provider_message_id'),
  attemptCount: integer('attempt_count').notNull().default(0),
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  readAt: timestamp('read_at'),
  errorMessage: text('error_message'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('whatsapp_log_org_status_idx').on(table.organizationId, table.status),
  index('whatsapp_log_org_phone_idx').on(table.organizationId, table.toPhone),
  index('whatsapp_log_org_created_idx').on(table.organizationId, table.createdAt),
]);
