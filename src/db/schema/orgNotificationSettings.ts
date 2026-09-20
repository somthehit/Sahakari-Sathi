/**
 * Organization Notification Settings Schema
 * Per-organization SMS/Email/WhatsApp credentials with platform fallback
 */
import {
  pgTable, text, varchar, boolean, timestamp, uuid, index, integer,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';

// =============================================
// ORGANIZATION NOTIFICATION SETTINGS
// Per-org SMS/Email/WhatsApp credentials with platform fallback
// =============================================
export const orgNotificationSettings = pgTable('org_notification_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // SMS Configuration
  smsProvider: varchar('sms_provider', { length: 50 }),           // 'aakash' | 'sparrow'
  smsApiKey: varchar('sms_api_key', { length: 255 }),
  smsSenderId: varchar('sms_sender_id', { length: 50 }),
  smsEnabled: boolean('sms_enabled').notNull().default(false),
  
  // Email Configuration
  smtpHost: varchar('smtp_host', { length: 255 }),
  smtpPort: integer('smtp_port').default(587),
  smtpUser: varchar('smtp_user', { length: 255 }),
  smtpPass: varchar('smtp_pass', { length: 255 }),
  smtpFromName: varchar('smtp_from_name', { length: 100 }),
  smtpFromEmail: varchar('smtp_from_email', { length: 255 }),
  smtpSecure: boolean('smtp_secure').notNull().default(true),
  emailEnabled: boolean('email_enabled').notNull().default(false),
  
  // WhatsApp Configuration
  whatsappProvider: varchar('whatsapp_provider', { length: 50 }),  // 'twilio' | 'meta' | 'textme'
  whatsappApiKey: varchar('whatsapp_api_key', { length: 255 }),
  whatsappApiSecret: varchar('whatsapp_api_secret', { length: 255 }),
  whatsappPhoneNumberId: varchar('whatsapp_phone_number_id', { length: 100 }),
  whatsappBusinessAccountId: varchar('whatsapp_business_account_id', { length: 100 }),
  whatsappAccessToken: text('whatsapp_access_token'),
  whatsappEnabled: boolean('whatsapp_enabled').notNull().default(false),
  
  // Fallback Configuration
  usePlatformCredentials: boolean('use_platform_credentials').notNull().default(true),
  
  // SMS Credit Balance
  smsCreditBalance: integer('sms_credit_balance').default(0),
  smsCreditUpdatedAt: timestamp('sms_credit_updated_at'),
  
  // WhatsApp Credit Balance
  whatsappCreditBalance: integer('whatsapp_credit_balance').default(0),
  whatsappCreditUpdatedAt: timestamp('whatsapp_credit_updated_at'),
  
  // Metadata
  createdBy: text('created_by'),
  updatedBy: text('updated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('org_notif_settings_org_idx').on(table.organizationId),
]);


// =============================================
// REMINDER RULES
// Automated reminder scheduling configuration
// =============================================
export const reminderRules = pgTable('reminder_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  // Rule Configuration
  code: varchar('code', { length: 50 }).notNull(),                 // e.g. 'EMI_DUE_3DAYS'
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  
  // Trigger Configuration
  triggerType: varchar('trigger_type', { length: 50 }).notNull(),  // 'days_before' | 'days_after' | 'on_date' | 'recurring'
  triggerDays: integer('trigger_days'),                            // Days before/after event
  triggerTime: varchar('trigger_time', { length: 8 }),             // HH:MM format
  
  // Event Type
  eventType: varchar('event_type', { length: 50 }).notNull(),     // 'emi_due' | 'deposit_maturity' | 'share_dividend' | 'custom'
  
  // Channels
  sendSms: boolean('send_sms').notNull().default(true),
  sendEmail: boolean('send_email').notNull().default(false),
  sendInApp: boolean('send_in_app').notNull().default(true),
  
  // Template Reference
  smsTemplateCode: varchar('sms_template_code', { length: 50 }),
  emailTemplateCode: varchar('email_template_code', { length: 50 }),
  
  // Recipients
  recipientType: varchar('recipient_type', { length: 50 }).notNull().default('member'),  // 'member' | 'admin' | 'all_members' | 'custom'
  customRecipientIds: text('custom_recipient_ids'),                // Comma-separated user IDs for custom
  
  // Scheduling
  isActive: boolean('is_active').notNull().default(true),
  lastRunAt: timestamp('last_run_at'),
  nextRunAt: timestamp('next_run_at'),
  
  // Metadata
  createdBy: text('created_by'),
  updatedBy: text('updated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('reminder_rules_org_idx').on(table.organizationId),
  index('reminder_rules_active_idx').on(table.isActive),
  index('reminder_rules_next_run_idx').on(table.nextRunAt),
]);


// =============================================
// NOTIFICATION CATEGORIES
// Predefined categories for organizing templates
// =============================================
export const notificationCategories = pgTable('notification_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 50 }).notNull(),                 // e.g. 'TRANSACTION', 'ACCOUNT', 'SYSTEM'
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('notif_categories_org_idx').on(table.organizationId),
]);