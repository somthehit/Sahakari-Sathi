/**
 * Platform Control (Super Admin) — Schema
 * Subscription plans, system settings, API keys, and announcements.
 * Global platform tables — NOT scoped to any organization.
 */
import {
  pgTable, text, varchar, integer, boolean, timestamp, uuid, index, jsonb, uniqueIndex, numeric,
} from 'drizzle-orm/pg-core';

// =============================================
// SUBSCRIPTION PLANS (platform-level plan definitions)
// =============================================
export const subscriptionPlans = pgTable('subscription_plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  priceMonthlyNpr: numeric('price_monthly_npr', { precision: 10, scale: 2 }).notNull().default('0'),
  priceYearlyNpr: numeric('price_yearly_npr', { precision: 10, scale: 2 }).notNull().default('0'),
  maxMembers: integer('max_members').notNull().default(1000),
  maxUsers: integer('max_users').notNull().default(50),
  maxBranches: integer('max_branches').notNull().default(5),
  storageLimitMb: integer('storage_limit_mb').notNull().default(5120),
  aiEnabled: boolean('ai_enabled').notNull().default(false),
  aiCredits: integer('ai_credits').notNull().default(0),
  features: jsonb('features'),                  // array of feature flags included in the plan
  isPublic: boolean('is_public').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  status: varchar('status', { length: 20 }).notNull().default('Active'),
  createdBy: text('created_by'),
  updatedBy: text('updated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('splans_code_idx').on(table.code),
  index('splans_status_idx').on(table.status),
  index('splans_sort_idx').on(table.sortOrder),
]);

// =============================================
// SYSTEM SETTINGS (platform key-value config)
// =============================================
export const systemSettings = pgTable('system_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  category: varchar('category', { length: 50 }).notNull(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: text('value'),
  valueType: varchar('value_type', { length: 20 }).notNull().default('string'),
  label: varchar('label', { length: 200 }),
  description: text('description'),
  isSecret: boolean('is_secret').notNull().default(false),
  updatedBy: text('updated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('syscfg_key_idx').on(table.key),
  index('syscfg_cat_idx').on(table.category),
]);

// =============================================
// API KEYS (platform API access tokens)
// =============================================
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  keyPrefix: varchar('key_prefix', { length: 10 }).notNull(),
  keyHash: varchar('key_hash', { length: 255 }).notNull(),
  secretHash: varchar('secret_hash', { length: 255 }),
  scopes: jsonb('scopes').notNull().default('["*"]'),
  rateLimit: integer('rate_limit').notNull().default(1000),
  organizationId: uuid('organization_id'),
  status: varchar('status', { length: 20 }).notNull().default('Active'),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  revokedAt: timestamp('revoked_at'),
  revokedReason: text('revoked_reason'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('apikey_prefix_idx').on(table.keyPrefix),
  index('apikey_status_idx').on(table.status),
  index('apikey_org_idx').on(table.organizationId),
]);

// =============================================
// PLATFORM ANNOUNCEMENTS
// =============================================
export const platformAnnouncements = pgTable('platform_announcements', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  body: text('body').notNull(),
  type: varchar('type', { length: 30 }).notNull().default('info'),
  priority: varchar('priority', { length: 20 }).notNull().default('normal'),
  targetAudience: varchar('target_audience', { length: 30 }).notNull().default('all'),
  isActive: boolean('is_active').notNull().default(true),
  publishedAt: timestamp('published_at'),
  expiresAt: timestamp('expires_at'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('pannc_active_idx').on(table.isActive),
  index('pannc_type_idx').on(table.type),
  index('pannc_priority_idx').on(table.priority),
  index('pannc_audience_idx').on(table.targetAudience),
]);
