/**
 * Accounting Schema
 * chart_of_accounts, account_groups, vouchers, voucher_entries,
 * journals, ledgers, trial_balances, balance_sheets, income_statements,
 * cash_books, bank_books, budgets, budget_lines
 * All tables scoped to organization_id for multi-tenancy.
 */
import {
  pgTable, text, numeric, boolean, timestamp, index, uuid, uniqueIndex, jsonb, integer,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { branches } from './branches';
import { fiscalYears } from './branches';

// =============================================
// ACCOUNT GROUPS (hierarchy root)
// =============================================
export const accountGroups = pgTable('account_groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  type: text('type', {
    enum: ['Asset', 'Liability', 'Equity', 'Income', 'Expense']
  }).notNull(),
  parentId: uuid('parent_id'),                        // self-ref (no FK to avoid circular)
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('acct_grp_org_code_uniq').on(table.organizationId, table.code),
  index('acct_grp_org_type_idx').on(table.organizationId, table.type),
]);

// =============================================
// CHART OF ACCOUNTS
// =============================================
export const chartOfAccounts = pgTable('chart_of_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  groupId: uuid('group_id').references(() => accountGroups.id),
  code: text('code').notNull(),                       // unique per org
  name: text('name').notNull(),
  nameNepali: text('name_nepali'),
  type: text('type', {
    enum: ['Asset', 'Liability', 'Equity', 'Income', 'Expense']
  }).notNull(),
  parentCode: text('parent_code'),
  balance: numeric('balance', { precision: 18, scale: 4 }).notNull().default('0'),
  normalBalance: text('normal_balance', { enum: ['debit', 'credit'] }).notNull().default('debit'),
  allowPosting: boolean('allow_posting').notNull().default(true),
  isSystemAccount: boolean('is_system_account').default(false),
  isControlAccount: boolean('is_control_account').notNull().default(false),
  cashBankAccount: boolean('cash_bank_account').notNull().default(false),
  reconciliationRequired: boolean('reconciliation_required').notNull().default(false),
  costCenterRequired: boolean('cost_center_required').notNull().default(false),
  displayOrder: integer('display_order').notNull().default(0),
  branchId: uuid('branch_id').references(() => branches.id),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('coa_org_code_uniq').on(table.organizationId, table.code),
  index('coa_org_type_idx').on(table.organizationId, table.type),
  index('coa_org_parent_idx').on(table.organizationId, table.parentCode),
]);

// =============================================
// VOUCHERS
// =============================================
export const vouchers = pgTable('vouchers', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  voucherNo: text('voucher_no').notNull(),            // unique per org
  voucherType: text('voucher_type', {
    enum: ['Journal', 'Payment', 'Receipt', 'Contra']
  }).notNull(),
  dateBs: text('date_bs').notNull(),
  dateAd: text('date_ad').notNull(),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  fiscalYearId: uuid('fiscal_year_id').references(() => fiscalYears.id),
  fiscalYearCode: text('fiscal_year_code').notNull(),
  preparedBy: text('prepared_by').notNull(),
  approvedBy: text('approved_by'),
  status: text('status', { enum: ['Draft', 'Posted', 'Cancelled', 'Voided'] }).notNull().default('Draft'),
  totalAmount: numeric('total_amount', { precision: 15, scale: 2 }).notNull(),
  narration: text('narration').notNull(),
  moduleReference: text('module_reference'),
  isReversing: boolean('is_reversing').default(false),
  reversalOfVoucherId: uuid('reversal_of_voucher_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('vouchers_org_no_uniq').on(table.organizationId, table.voucherNo),
  index('vchr_org_date_idx').on(table.organizationId, table.dateBs),
  index('vchr_org_status_idx').on(table.organizationId, table.status),
  index('vchr_branch_idx').on(table.branchId),
]);

// =============================================
// VOUCHER ENTRIES (denormalized org_id for RLS)
// =============================================
export const voucherEntries = pgTable('voucher_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  voucherId: uuid('voucher_id').notNull().references(() => vouchers.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => chartOfAccounts.id),
  accountCode: text('account_code').notNull(),
  accountName: text('account_name').notNull(),
  debit: numeric('debit', { precision: 15, scale: 4 }).notNull().default('0'),
  credit: numeric('credit', { precision: 15, scale: 4 }).notNull().default('0'),
  narration: text('narration'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('ventry_org_voucher_idx').on(table.organizationId, table.voucherId),
  index('ventry_org_account_idx').on(table.organizationId, table.accountId),
]);

// =============================================
// JOURNALS (general journal register)
// =============================================
export const journals = pgTable('journals', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  voucherId: uuid('voucher_id').notNull().references(() => vouchers.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => chartOfAccounts.id),
  dateBs: text('date_bs').notNull(),
  debit: numeric('debit', { precision: 15, scale: 4 }).notNull().default('0'),
  credit: numeric('credit', { precision: 15, scale: 4 }).notNull().default('0'),
  balance: numeric('balance', { precision: 15, scale: 4 }).notNull().default('0'),
  narration: text('narration'),
  fiscalYearCode: text('fiscal_year_code').notNull(),
  branchId: uuid('branch_id').references(() => branches.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('journal_org_account_date_idx').on(table.organizationId, table.accountId, table.dateBs),
  index('journal_org_fiscal_idx').on(table.organizationId, table.fiscalYearCode),
]);

// =============================================
// LEDGERS (account-level running balance)
// =============================================
export const ledgers = pgTable('ledgers', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => chartOfAccounts.id),
  fiscalYearCode: text('fiscal_year_code').notNull(),
  openingBalance: numeric('opening_balance', { precision: 18, scale: 4 }).notNull().default('0'),
  totalDebit: numeric('total_debit', { precision: 18, scale: 4 }).notNull().default('0'),
  totalCredit: numeric('total_credit', { precision: 18, scale: 4 }).notNull().default('0'),
  closingBalance: numeric('closing_balance', { precision: 18, scale: 4 }).notNull().default('0'),
  lastUpdatedAt: timestamp('last_updated_at').notNull().defaultNow(),
  branchId: uuid('branch_id').references(() => branches.id),
}, (table) => [
  uniqueIndex('ledger_org_acct_fy_uniq').on(table.organizationId, table.accountId, table.fiscalYearCode),
  index('ledger_org_fy_idx').on(table.organizationId, table.fiscalYearCode),
]);

// =============================================
// TRIAL BALANCES (snapshot per period)
// =============================================
export const trialBalances = pgTable('trial_balances', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  fiscalYearCode: text('fiscal_year_code').notNull(),
  asOfDateBs: text('as_of_date_bs').notNull(),
  data: jsonb('data').notNull(),                      // snapshot of all account balances
  generatedBy: uuid('generated_by'),
  branchId: uuid('branch_id').references(() => branches.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('trial_bal_org_fy_idx').on(table.organizationId, table.fiscalYearCode),
  index('trial_bal_org_date_idx').on(table.organizationId, table.asOfDateBs),
]);

// =============================================
// BALANCE SHEETS
// =============================================
export const balanceSheets = pgTable('balance_sheets', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  fiscalYearCode: text('fiscal_year_code').notNull(),
  asOfDateBs: text('as_of_date_bs').notNull(),
  data: jsonb('data').notNull(),
  generatedBy: uuid('generated_by'),
  branchId: uuid('branch_id').references(() => branches.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('bal_sheet_org_fy_idx').on(table.organizationId, table.fiscalYearCode),
]);

// =============================================
// INCOME STATEMENTS
// =============================================
export const incomeStatements = pgTable('income_statements', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  fiscalYearCode: text('fiscal_year_code').notNull(),
  fromDateBs: text('from_date_bs').notNull(),
  toDateBs: text('to_date_bs').notNull(),
  data: jsonb('data').notNull(),
  generatedBy: uuid('generated_by'),
  branchId: uuid('branch_id').references(() => branches.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('income_stmt_org_fy_idx').on(table.organizationId, table.fiscalYearCode),
]);

// =============================================
// CASH BOOKS
// =============================================
export const cashBooks = pgTable('cash_books', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  voucherId: uuid('voucher_id').references(() => vouchers.id),
  dateBs: text('date_bs').notNull(),
  particulars: text('particulars').notNull(),
  voucherNo: text('voucher_no'),
  debit: numeric('debit', { precision: 15, scale: 2 }).notNull().default('0'),
  credit: numeric('credit', { precision: 15, scale: 2 }).notNull().default('0'),
  balance: numeric('balance', { precision: 15, scale: 2 }).notNull().default('0'),
  fiscalYearCode: text('fiscal_year_code').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('cash_book_org_branch_date_idx').on(table.organizationId, table.branchId, table.dateBs),
  index('cash_book_org_fy_idx').on(table.organizationId, table.fiscalYearCode),
]);

// =============================================
// BANK BOOKS
// =============================================
export const bankBooks = pgTable('bank_books', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  bankAccountId: uuid('bank_account_id').references(() => chartOfAccounts.id),
  voucherId: uuid('voucher_id').references(() => vouchers.id),
  dateBs: text('date_bs').notNull(),
  particulars: text('particulars').notNull(),
  voucherNo: text('voucher_no'),
  debit: numeric('debit', { precision: 15, scale: 2 }).notNull().default('0'),
  credit: numeric('credit', { precision: 15, scale: 2 }).notNull().default('0'),
  balance: numeric('balance', { precision: 15, scale: 2 }).notNull().default('0'),
  isReconciled: boolean('is_reconciled').notNull().default(false),
  fiscalYearCode: text('fiscal_year_code').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('bank_book_org_branch_date_idx').on(table.organizationId, table.branchId, table.dateBs),
  index('bank_book_org_fy_idx').on(table.organizationId, table.fiscalYearCode),
]);

// =============================================
// BUDGETS (header)
// =============================================
export const budgets = pgTable('budgets', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  fiscalYearCode: text('fiscal_year_code').notNull(),
  name: text('name').notNull(),
  branchId: uuid('branch_id').references(() => branches.id),
  status: text('status', { enum: ['Draft', 'Approved', 'Closed'] }).notNull().default('Draft'),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('budget_org_fy_idx').on(table.organizationId, table.fiscalYearCode),
  index('budget_org_status_idx').on(table.organizationId, table.status),
]);

// =============================================
// BUDGET LINES (detail rows)
// =============================================
export const budgetLines = pgTable('budget_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  budgetId: uuid('budget_id').notNull().references(() => budgets.id, { onDelete: 'cascade' }),
  glAccountCode: text('gl_account_code').notNull(),
  glAccountName: text('gl_account_name').notNull(),
  fiscalYear: text('fiscal_year').notNull(),
  allocatedBudget: numeric('allocated_budget', { precision: 15, scale: 2 }).notNull(),
  usedActual: numeric('used_actual', { precision: 15, scale: 2 }).notNull().default('0'),
  committed: numeric('committed', { precision: 15, scale: 2 }).notNull().default('0'),
  department: text('department').notNull(),
  branchId: uuid('branch_id').references(() => branches.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('budget_line_org_budget_idx').on(table.organizationId, table.budgetId),
  index('budget_line_org_fy_idx').on(table.organizationId, table.fiscalYear),
]);
