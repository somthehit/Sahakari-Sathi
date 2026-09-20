/**
 * Member Settings Schema
 * Seven lookup/reference tables for the member settings module (Module 3).
 * All seven share an identical base structure; member_types carries three
 * additional financial fields (minShareUnits, entranceFee, shareValuePerUnit).
 *
 * Multi-tenancy: every table is scoped to organization_id.
 * Code is stored UPPERCASE (normalized before insert/update in the service).
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';

// ---------------------------------------------------------------------------
// Shared column factory — keeps the seven definitions DRY.
// ---------------------------------------------------------------------------
const baseColumns = {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 20 }).notNull(),         // stored UPPERCASE
  name: varchar('name', { length: 100 }).notNull(),
  nameNepali: varchar('name_nepali', { length: 100 }),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  isSystem: boolean('is_system').notNull().default(false), // system records can't be deleted
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
};

// ---------------------------------------------------------------------------
// 1. Member Types  (+ 3 extended financial fields)
// ---------------------------------------------------------------------------
export const memberTypes = pgTable('member_types', {
  ...baseColumns,
  minShareUnits: integer('min_share_units').notNull().default(0),
  entranceFee: numeric('entrance_fee', { precision: 12, scale: 2 }).notNull().default('0.00'),
  shareValuePerUnit: numeric('share_value_per_unit', { precision: 12, scale: 2 }).notNull().default('0.00'),
  // Flags "Group"-like types (समूह) whose members may be assigned to a Group.
  isGroupType: boolean('is_group_type').notNull().default(false),
}, (table) => [
  uniqueIndex('member_types_org_code_uniq').on(table.organizationId, table.code),
  index('member_types_org_active_idx').on(table.organizationId, table.isActive),
]);

// ---------------------------------------------------------------------------
// 2. Member Categories
// ---------------------------------------------------------------------------
export const memberCategories = pgTable('member_categories', {
  ...baseColumns,
}, (table) => [
  uniqueIndex('member_categories_org_code_uniq').on(table.organizationId, table.code),
  index('member_categories_org_active_idx').on(table.organizationId, table.isActive),
]);

// ---------------------------------------------------------------------------
// 3. Occupations
// ---------------------------------------------------------------------------
export const occupations = pgTable('occupations', {
  ...baseColumns,
}, (table) => [
  uniqueIndex('occupations_org_code_uniq').on(table.organizationId, table.code),
  index('occupations_org_active_idx').on(table.organizationId, table.isActive),
]);

// ---------------------------------------------------------------------------
// 4. Education Levels
// ---------------------------------------------------------------------------
export const educationLevels = pgTable('education_levels', {
  ...baseColumns,
}, (table) => [
  uniqueIndex('education_levels_org_code_uniq').on(table.organizationId, table.code),
  index('education_levels_org_active_idx').on(table.organizationId, table.isActive),
]);

// ---------------------------------------------------------------------------
// 5. Nominee Types
// ---------------------------------------------------------------------------
export const nomineeTypes = pgTable('nominee_types', {
  ...baseColumns,
}, (table) => [
  uniqueIndex('nominee_types_org_code_uniq').on(table.organizationId, table.code),
  index('nominee_types_org_active_idx').on(table.organizationId, table.isActive),
]);

// ---------------------------------------------------------------------------
// 6. Relationship Types
// ---------------------------------------------------------------------------
export const relationshipTypes = pgTable('relationship_types', {
  ...baseColumns,
}, (table) => [
  uniqueIndex('relationship_types_org_code_uniq').on(table.organizationId, table.code),
  index('relationship_types_org_active_idx').on(table.organizationId, table.isActive),
]);

// ---------------------------------------------------------------------------
// 7. Member Statuses  (post-approval operational statuses only)
// ---------------------------------------------------------------------------
export const memberStatuses = pgTable('member_statuses', {
  ...baseColumns,
}, (table) => [
  uniqueIndex('member_statuses_org_code_uniq').on(table.organizationId, table.code),
  index('member_statuses_org_active_idx').on(table.organizationId, table.isActive),
]);
