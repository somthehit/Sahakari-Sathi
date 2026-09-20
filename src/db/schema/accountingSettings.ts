/**
 * Accounting Settings Schema (SETUPS → Accounting Settings)
 *
 * Configuration catalogs that feed the accounting engine:
 *   voucher_types, voucher_type_counters, cost_centers, journal_templates,
 *   journal_template_entries, financial_periods, banks, bank_accounts,
 *   cash_counters, payment_methods, system_account_mappings
 *
 * Sharing model (mirrors the accounting architecture):
 *   Organization-level  : account_groups, chart_of_accounts, voucher_types,
 *                         journal_templates, financial_periods, banks,
 *                         payment_methods, system_account_mappings
 *   Branch-level        : cost_centers (optional branch), bank_accounts,
 *                         cash_counters
 *
 * Multi-tenancy: every table is scoped to organization_id. Branch references
 * are validated server-side via the scope middleware. Codes are stored
 * UPPERCASE (normalized in the controller).
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  bigint,
  numeric,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { branches, fiscalYears } from './branches';
import { chartOfAccounts } from './accounting';

// ---------------------------------------------------------------------------
// Shared base columns (mirrors memberSettings.ts baseColumns)
// ---------------------------------------------------------------------------
const baseColumns = {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 20 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  nameNepali: varchar('name_nepali', { length: 100 }),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  isSystem: boolean('is_system').notNull().default(false),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
};

// =============================================
// VOUCHER TYPES
// Drives voucher numbering + posting defaults. `category` is the engine-level
// voucher_type (Receipt|Payment|Journal|Contra) the type maps to, so the
// existing voucher engine keeps working while users add branded types.
// =============================================
export const voucherTypes = pgTable('voucher_types', {
  ...baseColumns,
  category: text('category', {
    enum: ['Receipt', 'Payment', 'Journal', 'Contra'],
  }).notNull().default('Journal'),
  prefix: varchar('prefix', { length: 8 }).notNull().default('JV'),
  numberingRule: text('numbering_rule', { enum: ['fiscal_year', 'global', 'monthly'] })
    .notNull().default('fiscal_year'),
  padding: integer('padding').notNull().default(6),
  defaultDebitAccountId: uuid('default_debit_account_id').references(() => chartOfAccounts.id),
  defaultCreditAccountId: uuid('default_credit_account_id').references(() => chartOfAccounts.id),
  requiresApproval: boolean('requires_approval').notNull().default(false),
  requiresNarration: boolean('requires_narration').notNull().default(true),
  requiresCostCenter: boolean('requires_cost_center').notNull().default(false),
  requiresReference: boolean('requires_reference').notNull().default(false),
  isBranchScoped: boolean('is_branch_scoped').notNull().default(false),
  allowBackdate: boolean('allow_backdate').notNull().default(true),
}, (table) => [
  uniqueIndex('voucher_types_org_code_uniq').on(table.organizationId, table.code),
  index('voucher_types_org_cat_idx').on(table.organizationId, table.category),
]);

// =============================================
// VOUCHER TYPE COUNTERS (DB-safe per-type/FY sequences)
// Used to generate unique voucher numbers without duplicates under concurrency.
// =============================================
export const voucherTypeCounters = pgTable('voucher_type_counters', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  voucherTypeId: uuid('voucher_type_id').notNull().references(() => voucherTypes.id, { onDelete: 'cascade' }),
  fiscalYearCode: varchar('fiscal_year_code', { length: 20 }).notNull(),
  nextSeq: bigint('next_seq', { mode: 'number' }).notNull().default(1),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('voucher_type_counter_uniq').on(table.organizationId, table.voucherTypeId, table.fiscalYearCode),
]);

// =============================================
// COST CENTERS (optional branch scoping)
// =============================================
export const costCenters = pgTable('cost_centers', {
  ...baseColumns,
  parentId: uuid('parent_id'),
  branchId: uuid('branch_id').references(() => branches.id),
  managerId: uuid('manager_id'),
  managerName: varchar('manager_name', { length: 100 }),
}, (table) => [
  uniqueIndex('cost_centers_org_code_uniq').on(table.organizationId, table.code),
  index('cost_centers_org_branch_idx').on(table.organizationId, table.branchId),
]);

// =============================================
// JOURNAL TEMPLATES (+ line entries)
// =============================================
export const journalTemplates = pgTable('journal_templates', {
  ...baseColumns,
  voucherTypeId: uuid('voucher_type_id').references(() => voucherTypes.id),
  narrationTemplate: text('narration_template'),
  frequency: text('frequency', {
    enum: ['manual', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
  }).notNull().default('manual'),
  branchId: uuid('branch_id').references(() => branches.id),
}, (table) => [
  uniqueIndex('journal_templates_org_code_uniq').on(table.organizationId, table.code),
  index('journal_templates_org_branch_idx').on(table.organizationId, table.branchId),
]);

export const journalTemplateEntries = pgTable('journal_template_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  templateId: uuid('template_id').notNull().references(() => journalTemplates.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => chartOfAccounts.id),
  accountCode: varchar('account_code', { length: 20 }).notNull(),
  accountName: varchar('account_name', { length: 100 }).notNull(),
  entryType: text('entry_type', { enum: ['debit', 'credit'] }).notNull(),
  amountType: text('amount_type', { enum: ['amount', 'percent'] }).notNull().default('amount'),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull().default('0'),
  costCenterId: uuid('cost_center_id').references(() => costCenters.id),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('jt_entry_org_template_idx').on(table.organizationId, table.templateId),
  index('jt_entry_org_account_idx').on(table.organizationId, table.accountId),
]);

// =============================================
// FINANCIAL PERIODS (finer than fiscal years)
// Gating: posting validates the voucher date falls in an Open period.
// =============================================
export const financialPeriods = pgTable('financial_periods', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 20 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  nameNepali: varchar('name_nepali', { length: 100 }),
  fiscalYearId: uuid('fiscal_year_id').references(() => fiscalYears.id),
  fiscalYearCode: varchar('fiscal_year_code', { length: 20 }).notNull(),
  startDateBs: varchar('start_date_bs', { length: 10 }).notNull(),
  endDateBs: varchar('end_date_bs', { length: 10 }).notNull(),
  startDateAd: varchar('start_date_ad', { length: 10 }).notNull(),
  endDateAd: varchar('end_date_ad', { length: 10 }).notNull(),
  status: text('status', { enum: ['draft', 'open', 'locked', 'closed'] }).notNull().default('draft'),
  isCurrent: boolean('is_current').notNull().default(false),
  closedAt: timestamp('closed_at'),
  closedBy: varchar('closed_by', { length: 100 }),
  lockedAt: timestamp('locked_at'),
  lockedBy: varchar('locked_by', { length: 100 }),
  reason: text('reason'),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('financial_periods_org_code_uniq').on(table.organizationId, table.code),
  index('financial_periods_org_fy_idx').on(table.organizationId, table.fiscalYearId),
  index('financial_periods_org_status_idx').on(table.organizationId, table.status),
]);

// =============================================
// BANKS (org-scoped master, consistent with the tenant architecture)
// =============================================
export const banks = pgTable('banks', {
  ...baseColumns,
  swiftCode: varchar('swift_code', { length: 20 }),
  shortName: varchar('short_name', { length: 50 }),
}, (table) => [
  uniqueIndex('banks_org_code_uniq').on(table.organizationId, table.code),
  index('banks_org_active_idx').on(table.organizationId, table.isActive),
]);

// =============================================
// BANK ACCOUNTS (branch-scoped, GL-mapped)
// =============================================
export const bankAccounts = pgTable('bank_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  bankId: uuid('bank_id').notNull().references(() => banks.id),
  accountName: varchar('account_name', { length: 100 }).notNull(),
  accountNumber: varchar('account_number', { length: 50 }).notNull(),
  branchId: uuid('branch_id').references(() => branches.id),
  currency: varchar('currency', { length: 3 }).notNull().default('NPR'),
  glAccountId: uuid('gl_account_id').references(() => chartOfAccounts.id),
  accountType: text('account_type', {
    enum: ['Current', 'Saving', 'Call', 'Fixed Deposit', 'Other'],
  }).notNull().default('Current'),
  openingBalance: numeric('opening_balance', { precision: 18, scale: 2 }).notNull().default('0'),
  openingDateBs: varchar('opening_date_bs', { length: 10 }),
  isPrimary: boolean('is_primary').notNull().default(false),
  reconciliationEnabled: boolean('reconciliation_enabled').notNull().default(false),
  lastReconciledDateBs: varchar('last_reconciled_date_bs', { length: 10 }),
  isActive: boolean('is_active').notNull().default(true),
  isSystem: boolean('is_system').notNull().default(false),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('bank_accounts_org_no_uniq').on(table.organizationId, table.accountNumber),
  index('bank_accounts_org_bank_idx').on(table.organizationId, table.bankId),
  index('bank_accounts_org_branch_idx').on(table.organizationId, table.branchId),
]);

// =============================================
// CASH COUNTERS (branch-scoped, user + GL mapped)
// =============================================
export const cashCounters = pgTable('cash_counters', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 20 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  nameNepali: varchar('name_nepali', { length: 100 }),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  assignedUserId: uuid('assigned_user_id'),
  glCashAccountId: uuid('gl_cash_account_id').references(() => chartOfAccounts.id),
  openingBalance: numeric('opening_balance', { precision: 18, scale: 2 }).notNull().default('0'),
  maxCashLimit: numeric('max_cash_limit', { precision: 18, scale: 2 }),
  isActive: boolean('is_active').notNull().default(true),
  isSystem: boolean('is_system').notNull().default(false),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('cash_counters_org_branch_code_uniq').on(table.organizationId, table.branchId, table.code),
  index('cash_counters_org_branch_idx').on(table.organizationId, table.branchId),
]);

// =============================================
// PAYMENT METHODS (GL-mapped)
// =============================================
export const paymentMethods = pgTable('payment_methods', {
  ...baseColumns,
  type: text('type', {
    enum: ['Cash', 'Bank', 'Cheque', 'Digital', 'Card', 'Other'],
  }).notNull().default('Other'),
  requiresReference: boolean('requires_reference').notNull().default(false),
  requiresBank: boolean('requires_bank').notNull().default(false),
  requiresChequeNumber: boolean('requires_cheque_number').notNull().default(false),
  requiresTransactionId: boolean('requires_transaction_id').notNull().default(false),
  glAccountId: uuid('gl_account_id').references(() => chartOfAccounts.id),
}, (table) => [
  uniqueIndex('payment_methods_org_code_uniq').on(table.organizationId, table.code),
  index('payment_methods_org_type_idx').on(table.organizationId, table.type),
]);

// =============================================
// SYSTEM ACCOUNT MAPPINGS
// Maps well-known accounting purposes to Chart of Account records so business
// logic never hardcodes account ids or relies on fragile name lookups.
// =============================================
export const systemAccountMappings = pgTable('system_account_mappings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  mappingKey: text('mapping_key').notNull(),
  accountId: uuid('account_id').notNull().references(() => chartOfAccounts.id),
  description: text('description'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('sys_map_org_key_uniq').on(table.organizationId, table.mappingKey),
  index('sys_map_org_account_idx').on(table.organizationId, table.accountId),
]);
