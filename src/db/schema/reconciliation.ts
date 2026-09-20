/**
 * Bank & Cash Reconciliation tables.
 * Proper bank reconciliation: Book Balance vs Statement Balance
 * with Outstanding Cheques, Deposits in Transit, and Adjustments.
 */
import {
  pgTable, text, numeric, boolean, timestamp, uuid, varchar, index, integer,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { branches } from './branches';
import { bankAccounts } from './accountingSettings';
import { chartOfAccounts, vouchers, voucherEntries } from './accounting';

// =============================================
// BANK RECONCILIATION SESSIONS
// =============================================
export const bankReconciliation = pgTable('bank_reconciliation', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  reconciliationType: text('reconciliation_type', { enum: ['bank', 'vault'] }).notNull(),
  bankAccountId: uuid('bank_account_id').references(() => bankAccounts.id),
  glAccountId: uuid('gl_account_id').notNull().references(() => chartOfAccounts.id),
  reconcileDateBs: varchar('reconcile_date_bs', { length: 10 }).notNull(),
  reconcileDateAd: varchar('reconcile_date_ad', { length: 10 }).notNull(),
  // Balances
  statementOpeningBalance: numeric('statement_opening_balance', { precision: 18, scale: 2 }).notNull().default('0'),
  bookBalance: numeric('book_balance', { precision: 18, scale: 2 }).notNull().default('0'),
  statementBalance: numeric('statement_balance', { precision: 18, scale: 2 }).notNull().default('0'),
  adjustedBalance: numeric('adjusted_balance', { precision: 18, scale: 2 }).notNull().default('0'),
  variance: numeric('variance', { precision: 18, scale: 2 }).notNull().default('0'),
  // Reconciling items totals
  outstandingChequesTotal: numeric('outstanding_cheques_total', { precision: 18, scale: 2 }).notNull().default('0'),
  depositsInTransitTotal: numeric('deposits_in_transit_total', { precision: 18, scale: 2 }).notNull().default('0'),
  adjustmentsTotal: numeric('adjustments_total', { precision: 18, scale: 2 }).notNull().default('0'),
  // Statement period
  statementPeriodFrom: varchar('statement_period_from', { length: 10 }),
  statementPeriodTo: varchar('statement_period_to', { length: 10 }),
  // Status
  status: text('status', { enum: ['draft', 'in_progress', 'reconciled', 'exception'] }).notNull().default('draft'),
  preparedBy: text('prepared_by'),
  approvedBy: text('approved_by'),
  reconciledBy: text('reconciled_by'),
  reconciledAt: timestamp('reconciled_at'),
  reconciledDateBs: varchar('reconciled_date_bs', { length: 10 }),
  remarks: text('remarks'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_recon_org_date').on(table.organizationId, table.reconcileDateBs),
  index('idx_recon_type').on(table.organizationId, table.reconciliationType),
  index('idx_recon_status').on(table.organizationId, table.status),
]);

// =============================================
// BANK STATEMENT ENTRIES (imported or manual)
// =============================================
export const reconciliationStatementEntries = pgTable('reconciliation_statement_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  reconciliationId: uuid('reconciliation_id').notNull().references(() => bankReconciliation.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  entryDateBs: varchar('entry_date_bs', { length: 10 }).notNull(),
  description: text('description'),
  reference: text('reference'),
  chequeNo: varchar('cheque_no', { length: 50 }),
  debit: numeric('debit', { precision: 18, scale: 2 }).notNull().default('0'),
  credit: numeric('credit', { precision: 18, scale: 2 }).notNull().default('0'),
  matchStatus: text('match_status', { enum: ['matched', 'partial', 'unmatched'] }).notNull().default('unmatched'),
  matchedReconEntryId: uuid('matched_recon_entry_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_stmt_entry_recon').on(table.reconciliationId),
]);

// =============================================
// RECONCILIATION ENTRIES (matched line items from system)
// =============================================
export const bankReconciliationEntries = pgTable('bank_reconciliation_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  reconciliationId: uuid('reconciliation_id').notNull().references(() => bankReconciliation.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  voucherId: uuid('voucher_id').references(() => vouchers.id),
  voucherEntryId: uuid('voucher_entry_id').references(() => voucherEntries.id),
  bookDateBs: varchar('book_date_bs', { length: 10 }).notNull(),
  bookDescription: text('book_description'),
  bookDebit: numeric('book_debit', { precision: 18, scale: 2 }).notNull().default('0'),
  bookCredit: numeric('book_credit', { precision: 18, scale: 2 }).notNull().default('0'),
  statementDateBs: varchar('statement_date_bs', { length: 10 }),
  statementDescription: text('statement_description'),
  statementDebit: numeric('statement_debit', { precision: 18, scale: 2 }).notNull().default('0'),
  statementCredit: numeric('statement_credit', { precision: 18, scale: 2 }).notNull().default('0'),
  matchStatus: text('match_status', { enum: ['matched', 'partial', 'unmatched', 'exception'] }).notNull().default('unmatched'),
  matchType: text('match_type', { enum: ['auto', 'manual', 'exception'] }),
  varianceAmount: numeric('variance_amount', { precision: 18, scale: 2 }).notNull().default('0'),
  exceptionReason: text('exception_reason'),
  resolvedBy: text('resolved_by'),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_recon_entry_recon').on(table.reconciliationId),
  index('idx_recon_entry_voucher').on(table.voucherId),
]);

// =============================================
// RECONCILIATION ADJUSTMENTS (bank charges, interest etc.)
// =============================================
export const reconciliationAdjustments = pgTable('reconciliation_adjustments', {
  id: uuid('id').primaryKey().defaultRandom(),
  reconciliationId: uuid('reconciliation_id').notNull().references(() => bankReconciliation.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  adjustmentType: text('adjustment_type', {
    enum: ['bank_charge', 'interest_earned', 'interest_charged', 'direct_debit', 'direct_credit', 'error_correction', 'other'],
  }).notNull(),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull().default('0'),
  dateBs: varchar('date_bs', { length: 10 }).notNull(),
  voucherId: uuid('voucher_id').references(() => vouchers.id),
  needsPosting: boolean('needs_posting').default(true),
  postedBy: text('posted_by'),
  postedAt: timestamp('posted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_adj_recon').on(table.reconciliationId),
]);

// =============================================
// OUTSTANDING ITEMS (cheques + deposits in transit)
// =============================================
export const reconciliationOutstandingItems = pgTable('reconciliation_outstanding_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  reconciliationId: uuid('reconciliation_id').notNull().references(() => bankReconciliation.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  itemType: text('item_type', { enum: ['outstanding_cheque', 'deposit_in_transit'] }).notNull(),
  sourceId: uuid('source_id'),
  sourceType: text('source_type', { enum: ['bank_cheque_leaf', 'voucher_entry'] }),
  chequeNo: varchar('cheque_no', { length: 50 }),
  payeeName: text('payee_name'),
  description: text('description'),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull().default('0'),
  entryDateBs: varchar('entry_date_bs', { length: 10 }).notNull(),
  status: text('status', { enum: ['pending', 'cleared', 'voided'] }).notNull().default('pending'),
  clearedDateBs: varchar('cleared_date_bs', { length: 10 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_outstanding_recon').on(table.reconciliationId),
  index('idx_outstanding_type').on(table.reconciliationId, table.itemType),
]);

// =============================================
// CASH VARIANCE LOG
// =============================================
export const cashVarianceLog = pgTable('cash_variance_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  reconciliationId: uuid('reconciliation_id').references(() => bankReconciliation.id),
  varianceType: text('variance_type', { enum: ['cash_short', 'cash_over', 'bank_difference', 'unmatched_entry', 'missing_entry'] }).notNull(),
  amount: numeric('amount', { precision: 18, scale: 2 }).notNull().default('0'),
  description: text('description'),
  glAccountId: uuid('gl_account_id').references(() => chartOfAccounts.id),
  status: text('status', { enum: ['open', 'investigating', 'resolved', 'ignored'] }).notNull().default('open'),
  resolutionNote: text('resolution_note'),
  resolvedBy: text('resolved_by'),
  resolvedAt: timestamp('resolved_at'),
  reportedBy: text('reported_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_variance_org_status').on(table.organizationId, table.status),
  index('idx_variance_type').on(table.organizationId, table.varianceType),
]);
