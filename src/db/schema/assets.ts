/**
 * Fixed Assets Schema
 * fixed_assets, asset_categories, depreciation_entries, asset_transfers, maintenance_records
 * All tables scoped to organization_id for multi-tenancy.
 */
import {
  pgTable, text, numeric, boolean, timestamp, uuid, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { branches } from './branches';

// =============================================
// ASSET CATEGORIES
// =============================================
export const assetCategories = pgTable('asset_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  depreciationMethod: text('depreciation_method', {
    enum: ['Straight_Line', 'WDV']
  }).notNull().default('Straight_Line'),
  defaultDepreciationRate: numeric('default_depreciation_rate', { precision: 5, scale: 2 }).notNull(),
  usefulLifeYears: numeric('useful_life_years', { precision: 5, scale: 1 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('asset_cat_org_code_uniq').on(table.organizationId, table.code),
  index('asset_cat_org_idx').on(table.organizationId),
]);

// =============================================
// FIXED ASSETS
// =============================================
export const fixedAssets = pgTable('fixed_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  assetCode: text('asset_code').notNull(),            // unique per org
  assetName: text('asset_name').notNull(),
  categoryId: uuid('category_id').references(() => assetCategories.id),
  category: text('category', {
    enum: ['Furniture', 'Vehicles', 'IT_Hardware', 'Building', 'Office_Equipment']
  }).notNull(),
  purchaseDateBs: text('purchase_date_bs').notNull(),
  originalCost: numeric('original_cost', { precision: 15, scale: 2 }).notNull(),
  depreciationMethod: text('depreciation_method', {
    enum: ['Straight_Line', 'WDV']
  }).notNull(),
  depreciationRatePercent: numeric('depreciation_rate_percent', { precision: 5, scale: 2 }).notNull(),
  accumulatedDepreciation: numeric('accumulated_depreciation', { precision: 15, scale: 2 }).notNull().default('0'),
  currentBookValue: numeric('current_book_value', { precision: 15, scale: 2 }).notNull(),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  location: text('location').notNull(),
  serialNo: text('serial_no'),
  vendor: text('vendor'),
  warrantyExpiry: text('warranty_expiry_bs'),
  status: text('status', { enum: ['Active', 'Disposed', 'Written_Off', 'Under_Maintenance'] }).notNull().default('Active'),
  disposedDateBs: text('disposed_date_bs'),
  disposedValue: numeric('disposed_value', { precision: 15, scale: 2 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('asset_org_code_uniq').on(table.organizationId, table.assetCode),
  index('asset_org_category_idx').on(table.organizationId, table.category),
  index('asset_org_status_idx').on(table.organizationId, table.status),
  index('asset_branch_idx').on(table.branchId),
]);

// =============================================
// DEPRECIATION ENTRIES
// =============================================
export const depreciationEntries = pgTable('depreciation_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  assetId: uuid('asset_id').notNull().references(() => fixedAssets.id, { onDelete: 'cascade' }),
  fiscalYearCode: text('fiscal_year_code').notNull(),
  periodBs: text('period_bs').notNull(),
  openingValue: numeric('opening_value', { precision: 15, scale: 2 }).notNull(),
  depreciationAmount: numeric('depreciation_amount', { precision: 15, scale: 2 }).notNull(),
  closingValue: numeric('closing_value', { precision: 15, scale: 2 }).notNull(),
  voucherNo: text('voucher_no'),
  processedBy: uuid('processed_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('dep_entry_org_asset_idx').on(table.organizationId, table.assetId),
  index('dep_entry_org_fy_idx').on(table.organizationId, table.fiscalYearCode),
]);

// =============================================
// ASSET TRANSFERS
// =============================================
export const assetTransfers = pgTable('asset_transfers', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  assetId: uuid('asset_id').notNull().references(() => fixedAssets.id),
  fromBranchId: uuid('from_branch_id').notNull().references(() => branches.id),
  toBranchId: uuid('to_branch_id').notNull().references(() => branches.id),
  transferDateBs: text('transfer_date_bs').notNull(),
  reason: text('reason'),
  approvedBy: uuid('approved_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('asset_transfer_org_asset_idx').on(table.organizationId, table.assetId),
  index('asset_transfer_org_date_idx').on(table.organizationId, table.transferDateBs),
]);

// =============================================
// MAINTENANCE RECORDS
// =============================================
export const maintenanceRecords = pgTable('maintenance_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  assetId: uuid('asset_id').notNull().references(() => fixedAssets.id),
  maintenanceDateBs: text('maintenance_date_bs').notNull(),
  maintenanceType: text('maintenance_type', {
    enum: ['Preventive', 'Corrective', 'Emergency']
  }).notNull(),
  description: text('description').notNull(),
  cost: numeric('cost', { precision: 15, scale: 2 }).notNull().default('0'),
  vendor: text('vendor'),
  nextMaintenanceBs: text('next_maintenance_bs'),
  status: text('status', { enum: ['Scheduled', 'Completed', 'Cancelled'] }).notNull().default('Scheduled'),
  voucherNo: text('voucher_no'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('maint_org_asset_idx').on(table.organizationId, table.assetId),
  index('maint_org_date_idx').on(table.organizationId, table.maintenanceDateBs),
]);
