/**
 * Branches & Fiscal Years Schema
 * Drizzle ORM table definitions for organizational structure
 * All tables scoped to organization_id for multi-tenancy.
 */
import { pgTable, text, numeric, boolean, timestamp, integer, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './auth';

export const branches = pgTable('branches', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),             // unique per org
  name: text('name').notNull(),
  branchType: text('branch_type').notNull().default('Branch'),
  isHeadOffice: boolean('is_head_office').notNull().default(false),
  address: text('address').notNull(),
  province: text('province'),
  district: text('district'),
  municipality: text('municipality'),
  ward: text('ward'),
  tole: text('tole'),
  phone: text('phone').notNull(),
  email: text('email'),
  managerName: text('manager_name').notNull(),
  openingDateBs: text('opening_date_bs'),
  status: text('status').notNull().default('Active'),
  latitude: numeric('latitude', { precision: 12, scale: 8 }),
  longitude: numeric('longitude', { precision: 12, scale: 8 }),
  googleMapLink: text('google_map_link'),
  logoUrl: text('logo_url'),
  workingDays: text('working_days'),
  openingTime: text('opening_time'),
  closingTime: text('closing_time'),
  vaultLimit: numeric('vault_limit', { precision: 15, scale: 2 }).notNull().default('0'),
  currentVaultCash: numeric('current_vault_cash', { precision: 15, scale: 2 }).notNull().default('0'),
  remarks: text('remarks'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('branches_org_code_uniq').on(table.organizationId, table.code),
  index('branches_org_idx').on(table.organizationId),
]);

export const fiscalYears = pgTable('fiscal_years', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),             // unique per org, e.g. "2083/84"
  startDateBs: text('start_date_bs').notNull(),
  endDateBs: text('end_date_bs').notNull(),
  startDateAd: text('start_date_ad').notNull(),
  endDateAd: text('end_date_ad').notNull(),
  isCurrent: boolean('is_current').notNull().default(false),
  status: text('status', { enum: ['active', 'closed'] }).notNull().default('active'),
  closedAt: timestamp('closed_at'),
  closedBy: text('closed_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('fiscal_years_org_code_uniq').on(table.organizationId, table.code),
  index('fiscal_years_org_idx').on(table.organizationId),
]);
