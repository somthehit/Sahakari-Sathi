/**
 * Module Management Schema
 * Enterprise module catalog, feature flags, licensing, org assignments,
 * marketplace, usage analytics and audit — platform (super-admin) level.
 *
 * Global tables (NO organization_id): module_categories, modules,
 * module_features, module_dependencies, module_versions, module_settings,
 * module_permissions, module_licenses, module_marketplace, module_templates,
 * module_template_items, module_health_checks, module_recommendations.
 *
 * Multi-tenant tables (carry organization_id): organization_modules,
 * organization_module_features, organization_module_settings,
 * organization_module_permissions, module_license_history, module_usage_logs,
 * module_installation_logs, module_audit_logs, module_notifications.
 */
import {
  pgTable, pgEnum, uuid, text, varchar, integer, boolean, jsonb,
  timestamp, index, uniqueIndex, date, numeric, bigint,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';

// ── Enums ────────────────────────────────────────────────────────────────────
export const moduleTypeEnum = pgEnum('module_type', [
  'Core', 'Optional', 'Premium', 'Enterprise', 'Marketplace',
  'Partner', 'Custom', 'Experimental', 'Beta', 'Deprecated', 'Hidden',
]);

export const moduleStatusEnum = pgEnum('module_status', [
  'Draft', 'Active', 'Inactive', 'Beta', 'Deprecated',
]);

export const moduleLicenseTypeEnum = pgEnum('module_license_type', [
  'Free', 'Trial', 'Monthly', 'Quarterly', 'Yearly', 'Lifetime', 'Enterprise', 'Custom',
]);

export const orgModuleStatusEnum = pgEnum('org_module_status', [
  'Enabled', 'Disabled', 'Trial', 'Pending', 'Expired',
]);

export const moduleVersionChannelEnum = pgEnum('module_version_channel', [
  'Stable', 'Beta', 'LTS',
]);

export const moduleHealthStatusEnum = pgEnum('module_health_status', [
  'Healthy', 'Degraded', 'Down', 'Unknown',
]);

export const moduleAuditActionEnum = pgEnum('module_audit_action', [
  'CREATE', 'UPDATE', 'DELETE', 'ENABLE', 'DISABLE', 'ASSIGN', 'UNASSIGN',
  'INSTALL', 'UNINSTALL', 'UPGRADE', 'ROLLBACK', 'LICENSE_CHANGE',
  'FEATURE_TOGGLE', 'SETTINGS_CHANGE', 'PERMISSION_CHANGE', 'IMPORT', 'EXPORT',
]);

// ── Module categories ────────────────────────────────────────────────────────
export const moduleCategories = pgTable('module_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(), // e.g. 'core_banking'
  name: varchar('name', { length: 100 }).notNull(),
  icon: varchar('icon', { length: 50 }).default('Package'),
  color: varchar('color', { length: 20 }).default('#059669'),
  description: text('description'),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('module_categories_active_idx').on(table.isActive, table.sortOrder),
]);

// ── Modules ──────────────────────────────────────────────────────────────────
export const modules = pgTable('modules', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(), // e.g. 'savings'
  name: varchar('name', { length: 100 }).notNull(),
  nameNepali: varchar('name_nepali', { length: 150 }),
  shortDescription: text('short_description'),
  longDescription: text('long_description'),
  categoryId: uuid('category_id').references(() => moduleCategories.id, { onDelete: 'set null' }),
  type: moduleTypeEnum('type').default('Optional').notNull(),
  icon: varchar('icon', { length: 50 }).default('Package'),
  color: varchar('color', { length: 20 }).default('#059669'),
  developer: varchar('developer', { length: 100 }).default('Sahakari Sathi'),
  website: varchar('website', { length: 200 }),
  versionCurrent: varchar('version_current', { length: 20 }).default('1.0.0'),
  versionLatest: varchar('version_latest', { length: 20 }).default('1.0.0'),
  licenseType: moduleLicenseTypeEnum('license_type').default('Free').notNull(),
  status: moduleStatusEnum('status').default('Active').notNull(),
  isRequired: boolean('is_required').default(false).notNull(),
  isSystem: boolean('is_system').default(false).notNull(),
  isHidden: boolean('is_hidden').default(false).notNull(),
  autoUpdate: boolean('auto_update').default(false).notNull(),
  releaseChannel: moduleVersionChannelEnum('release_channel').default('Stable').notNull(),
  lastReleasedAt: timestamp('last_released_at'),
  lastCheckedAt: timestamp('last_checked_at'),
  rating: numeric('rating', { precision: 3, scale: 2 }).default('0'),
  downloadCount: integer('download_count').default(0).notNull(),
  installCount: integer('install_count').default(0).notNull(),
  settingsSchema: jsonb('settings_schema'),       // dynamic settings definition
  screenshots: jsonb('screenshots'),              // [{url, caption}]
  metadata: jsonb('metadata'),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('modules_name_uniq').on(table.name),
  index('modules_category_idx').on(table.categoryId),
  index('modules_type_status_idx').on(table.type, table.status),
  index('modules_required_idx').on(table.isRequired),
]);

// ── Module features (feature flags) ──────────────────────────────────────────
export const moduleFeatures = pgTable('module_features', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: uuid('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 80 }).notNull(), // e.g. 'fixed_deposit'
  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  isRequired: boolean('is_required').default(false).notNull(),
  settingsSchema: jsonb('settings_schema'),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('module_features_module_code_uniq').on(table.moduleId, table.code),
  index('module_features_module_idx').on(table.moduleId),
]);

// ── Module dependencies ──────────────────────────────────────────────────────
export const moduleDependencies = pgTable('module_dependencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: uuid('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
  dependsOnModuleId: uuid('depends_on_module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
  minVersion: varchar('min_version', { length: 20 }),
  isRequired: boolean('is_required').default(true).notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('module_dependencies_pair_uniq').on(table.moduleId, table.dependsOnModuleId),
  index('module_dependencies_module_idx').on(table.moduleId),
  index('module_dependencies_dep_idx').on(table.dependsOnModuleId),
]);

// ── Module versions ──────────────────────────────────────────────────────────
export const moduleVersions = pgTable('module_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: uuid('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
  version: varchar('version', { length: 20 }).notNull(),
  channel: moduleVersionChannelEnum('channel').default('Stable').notNull(),
  releaseDate: timestamp('release_date'),
  releaseNotes: text('release_notes'),
  isCurrent: boolean('is_current').default(false).notNull(),
  isLatest: boolean('is_latest').default(false).notNull(),
  minAppVersion: varchar('min_app_version', { length: 20 }),
  compatibility: jsonb('compatibility'),  // { platforms: ['web','mobile'], dbMin: '...' }
  checksum: varchar('checksum', { length: 128 }),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).default(0).notNull(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('module_versions_module_version_uniq').on(table.moduleId, table.version),
  index('module_versions_module_idx').on(table.moduleId),
]);

// ── Module settings definitions ──────────────────────────────────────────────
export const moduleSettings = pgTable('module_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: uuid('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
  key: varchar('key', { length: 80 }).notNull(),
  label: varchar('label', { length: 120 }).notNull(),
  type: varchar('type', { length: 20 }).default('text').notNull(), // text, number, boolean, select, json
  groupName: varchar('group_name', { length: 80 }).default('General'),
  defaultValue: jsonb('default_value'),
  options: jsonb('options'),       // for select
  isRequired: boolean('is_required').default(false).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('module_settings_module_key_uniq').on(table.moduleId, table.key),
  index('module_settings_module_idx').on(table.moduleId),
]);

// ── Module permission actions (catalog) ──────────────────────────────────────
export const modulePermissions = pgTable('module_permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: uuid('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 30 }).notNull(), // view, create, edit, delete, approve, reject, reverse, print, export, import, configure, audit, assign
  label: varchar('label', { length: 60 }).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('module_permissions_module_action_uniq').on(table.moduleId, table.action),
  index('module_permissions_module_idx').on(table.moduleId),
]);

// ── License plans per module ─────────────────────────────────────────────────
export const moduleLicenses = pgTable('module_licenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: uuid('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 50 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  type: moduleLicenseTypeEnum('type').notNull(),
  price: numeric('price', { precision: 14, scale: 2 }).default('0'),
  currency: varchar('currency', { length: 3 }).default('NPR'),
  billingPeriod: varchar('billing_period', { length: 20 }), // month, quarter, year, lifetime
  features: jsonb('features'),     // granted feature codes
  maxUsers: integer('max_users'),
  maxBranches: integer('max_branches'),
  trialDays: integer('trial_days').default(0),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('module_licenses_module_code_uniq').on(table.moduleId, table.code),
  index('module_licenses_module_idx').on(table.moduleId),
]);

// ── Organization module assignments ──────────────────────────────────────────
export const organizationModules = pgTable('organization_modules', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  moduleId: uuid('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
  status: orgModuleStatusEnum('status').default('Enabled').notNull(),
  licenseId: uuid('license_id').references(() => moduleLicenses.id, { onDelete: 'set null' }),
  isTrial: boolean('is_trial').default(false).notNull(),
  activationDate: timestamp('activation_date'),
  expiryDate: timestamp('expiry_date'),
  autoRenew: boolean('auto_renew').default(false).notNull(),
  graceDays: integer('grace_days').default(0),
  notes: text('notes'),
  versionInstalled: varchar('version_installed', { length: 20 }),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('organization_modules_org_module_uniq').on(table.organizationId, table.moduleId),
  index('organization_modules_org_idx').on(table.organizationId),
  index('organization_modules_module_idx').on(table.moduleId),
  index('organization_modules_status_idx').on(table.status),
]);

// ── Organization module feature toggles ──────────────────────────────────────
export const organizationModuleFeatures = pgTable('organization_module_features', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  moduleId: uuid('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
  featureId: uuid('feature_id').notNull().references(() => moduleFeatures.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').default(true).notNull(),
  value: jsonb('value'),           // feature-level override
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('org_mod_features_org_module_feat_uniq').on(table.organizationId, table.moduleId, table.featureId),
  index('org_mod_features_module_idx').on(table.moduleId),
]);

// ── Organization module settings overrides ───────────────────────────────────
export const organizationModuleSettings = pgTable('organization_module_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  moduleId: uuid('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
  key: varchar('key', { length: 80 }).notNull(),
  value: jsonb('value').notNull(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('org_mod_settings_org_module_key_uniq').on(table.organizationId, table.moduleId, table.key),
  index('org_mod_settings_module_idx').on(table.moduleId),
]);

// ── Organization module permission grants ────────────────────────────────────
export const organizationModulePermissions = pgTable('organization_module_permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  moduleId: uuid('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 40 }).notNull(), // org role code
  action: varchar('action', { length: 30 }).notNull(),
  granted: boolean('granted').default(true).notNull(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('org_mod_perms_org_module_role_act_uniq').on(table.organizationId, table.moduleId, table.role, table.action),
  index('org_mod_perms_module_idx').on(table.moduleId),
]);

// ── License history ──────────────────────────────────────────────────────────
export const moduleLicenseHistory = pgTable('module_license_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  moduleId: uuid('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
  licenseId: uuid('license_id').references(() => moduleLicenses.id, { onDelete: 'set null' }),
  plan: varchar('plan', { length: 60 }),
  action: varchar('action', { length: 30 }).notNull(), // issue, renew, upgrade, downgrade, expire, revoke
  startDate: timestamp('start_date'),
  expiryDate: timestamp('expiry_date'),
  amount: numeric('amount', { precision: 14, scale: 2 }),
  details: text('details'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('mod_license_history_org_idx').on(table.organizationId),
  index('mod_license_history_module_idx').on(table.moduleId),
]);

// ── Marketplace entries ──────────────────────────────────────────────────────
export const moduleMarketplace = pgTable('module_marketplace', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: uuid('module_id').notNull().unique().references(() => modules.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).default('Draft').notNull(), // Draft, Published, Featured, Unpublished
  price: numeric('price', { precision: 14, scale: 2 }).default('0'),
  pricing: jsonb('pricing'),        // { plans: [...] }
  screenshots: jsonb('screenshots'),
  docsUrl: varchar('docs_url', { length: 300 }),
  rating: numeric('rating', { precision: 3, scale: 2 }).default('0'),
  reviewCount: integer('review_count').default(0).notNull(),
  reviews: jsonb('reviews'),
  developerProfile: jsonb('developer_profile'),
  compatibility: jsonb('compatibility'),
  featured: boolean('featured').default(false).notNull(),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('module_marketplace_status_idx').on(table.status),
]);

// ── Usage analytics ──────────────────────────────────────────────────────────
export const moduleUsageLogs = pgTable('module_usage_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  moduleId: uuid('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  dau: integer('dau').default(0).notNull(),
  mau: integer('mau').default(0).notNull(),
  transactions: integer('transactions').default(0).notNull(),
  apiCalls: integer('api_calls').default(0).notNull(),
  storageBytes: bigint('storage_bytes', { mode: 'number' }).default(0).notNull(),
  avgResponseMs: integer('avg_response_ms').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('module_usage_org_module_date_uniq').on(table.organizationId, table.moduleId, table.date),
  index('module_usage_module_date_idx').on(table.moduleId, table.date),
  index('module_usage_org_idx').on(table.organizationId),
]);

// ── Installation log ─────────────────────────────────────────────────────────
export const moduleInstallationLogs = pgTable('module_installation_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  moduleId: uuid('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 30 }).notNull(), // install, update, uninstall, rollback, enable, disable
  version: varchar('version', { length: 20 }),
  status: varchar('status', { length: 20 }).default('Completed').notNull(),
  details: text('details'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('mod_install_logs_module_idx').on(table.moduleId),
  index('mod_install_logs_org_idx').on(table.organizationId),
]);

// ── Module audit log ─────────────────────────────────────────────────────────
export const moduleAuditLogs = pgTable('module_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  moduleId: uuid('module_id').references(() => modules.id, { onDelete: 'cascade' }),
  featureId: uuid('feature_id').references(() => moduleFeatures.id, { onDelete: 'set null' }),
  action: moduleAuditActionEnum('action').notNull(),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('module_audit_module_idx').on(table.moduleId),
  index('module_audit_org_idx').on(table.organizationId),
  index('module_audit_created_idx').on(table.createdAt),
]);

// ── Module templates (bundles) ───────────────────────────────────────────────
export const moduleTemplates = pgTable('module_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 50 }),
  icon: varchar('icon', { length: 50 }).default('Layers'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('module_templates_active_idx').on(table.isActive),
]);

export const moduleTemplateItems = pgTable('module_template_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').notNull().references(() => moduleTemplates.id, { onDelete: 'cascade' }),
  moduleId: uuid('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
  licenseId: uuid('license_id').references(() => moduleLicenses.id, { onDelete: 'set null' }),
  config: jsonb('config'),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('module_template_items_tpl_module_uniq').on(table.templateId, table.moduleId),
  index('module_template_items_template_idx').on(table.templateId),
]);

// ── Module notifications ─────────────────────────────────────────────────────
export const moduleNotifications = pgTable('module_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  moduleId: uuid('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 30 }).notNull(), // installed, updated, license_expired, dependency_broken, update_available, marketplace
  title: varchar('title', { length: 150 }).notNull(),
  body: text('body'),
  read: boolean('read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('module_notifications_module_idx').on(table.moduleId),
  index('module_notifications_read_idx').on(table.read),
]);

// ── Health checks ────────────────────────────────────────────────────────────
export const moduleHealthChecks = pgTable('module_health_checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  moduleId: uuid('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
  status: moduleHealthStatusEnum('status').default('Unknown').notNull(),
  responseMs: integer('response_ms'),
  uptime: numeric('uptime', { precision: 5, scale: 2 }).default('100'),
  details: jsonb('details'),
  checkedAt: timestamp('checked_at').defaultNow().notNull(),
}, (table) => [
  index('module_health_module_idx').on(table.moduleId),
]);

// ── AI recommendations ───────────────────────────────────────────────────────
export const moduleRecommendations = pgTable('module_recommendations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  moduleId: uuid('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  priority: integer('priority').default(50),
  score: numeric('score', { precision: 4, scale: 2 }),
  status: varchar('status', { length: 20 }).default('Suggested').notNull(), // Suggested, Accepted, Dismissed
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('module_recommendations_org_idx').on(table.organizationId),
  index('module_recommendations_module_idx').on(table.moduleId),
]);
