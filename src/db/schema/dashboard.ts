/**
 * Dashboard Schema
 * dashboard_preferences, dashboard_widgets
 * All tables scoped to organization_id for multi-tenancy.
 */
import {
  pgTable, text, integer, boolean, timestamp, uuid, index, jsonb, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { orgUsers } from './auth';

// =============================================
// DASHBOARD WIDGETS (org-level widget catalog)
// =============================================
export const dashboardWidgets = pgTable('dashboard_widgets', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),                       // e.g. 'LOAN_SUMMARY', 'MEMBER_COUNT'
  title: text('title').notNull(),
  widgetType: text('widget_type', {
    enum: ['KPI', 'Chart', 'Table', 'Map', 'List']
  }).notNull(),
  dataSource: text('data_source').notNull(),          // API endpoint or query key
  defaultConfig: jsonb('default_config'),             // chart type, colors, etc.
  requiredPermission: text('required_permission'),    // permission key to see this widget
  isSystem: boolean('is_system').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('widget_org_code_uniq').on(table.organizationId, table.code),
  index('widget_org_type_idx').on(table.organizationId, table.widgetType),
]);

// =============================================
// DASHBOARD PREFERENCES (per user layout)
// =============================================
export const dashboardPreferences = pgTable('dashboard_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => orgUsers.id, { onDelete: 'cascade' }),
  widgetId: uuid('widget_id').notNull().references(() => dashboardWidgets.id, { onDelete: 'cascade' }),
  positionX: integer('position_x').notNull().default(0),
  positionY: integer('position_y').notNull().default(0),
  width: integer('width').notNull().default(4),
  height: integer('height').notNull().default(3),
  isVisible: boolean('is_visible').notNull().default(true),
  customConfig: jsonb('custom_config'),               // user overrides to widget defaults
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('dash_pref_org_user_widget_uniq').on(table.organizationId, table.userId, table.widgetId),
  index('dash_pref_org_user_idx').on(table.organizationId, table.userId),
]);
