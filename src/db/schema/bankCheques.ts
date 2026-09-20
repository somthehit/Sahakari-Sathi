/**
 * Bank Cheque Management Schema
 * Tracks the cooperative's own bank cheque books and leaves.
 * These are cheques the cooperative writes from its bank accounts (at commercial banks)
 * for purposes like loan disbursements — distinct from member savings cheque books.
 */
import {
  pgTable, text, numeric, boolean, timestamp, integer, index, uuid, uniqueIndex, jsonb,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { branches } from './branches';
import { chartOfAccounts } from './accounting';

// =============================================
// BANK CHEQUE BOOKS
// =============================================
export const bankChequeBooks = pgTable('bank_cheque_books', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  /** The GL bank account (chart_of_accounts) this cheque book belongs to. */
  bankAccountId: uuid('bank_account_id').notNull().references(() => chartOfAccounts.id, { onDelete: 'cascade' }),
  bookNumber: text('book_number').notNull(),
  prefix: text('prefix'),
  leafStartNumber: integer('leaf_start_number').notNull(),
  leafEndNumber: integer('leaf_end_number').notNull(),
  leafCount: integer('leaf_count').notNull().default(25),
  issuedDateBs: text('issued_date_bs').notNull(),
  issuedDateAd: text('issued_date_ad').notNull(),
  status: text('status', { enum: ['active', 'exhausted', 'cancelled'] }).notNull().default('active'),
  issuedById: uuid('issued_by_id'),
  purpose: text('purpose'),
  /** Only populated for individual-mode books — stores the raw leaf number list. */
  leafNumbersJson: jsonb('leaf_numbers_json'),
  cancelReason: text('cancel_reason'),
  cancelledById: uuid('cancelled_by_id'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('bank_cheque_books_org_book_number_uniq').on(table.organizationId, table.bookNumber),
  index('bank_cheque_books_org_bank_account_idx').on(table.organizationId, table.bankAccountId),
  index('bank_cheque_books_org_branch_idx').on(table.organizationId, table.branchId),
]);

// =============================================
// BANK CHEQUE LEAVES
// =============================================
export const bankChequeLeaves = pgTable('bank_cheque_leaves', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  chequeBookId: uuid('cheque_book_id').notNull().references(() => bankChequeBooks.id, { onDelete: 'cascade' }),
  bankAccountId: uuid('bank_account_id').notNull().references(() => chartOfAccounts.id, { onDelete: 'cascade' }),
  chequeNumber: text('cheque_number').notNull(),
  leafNo: integer('leaf_no').notNull(),
  status: text('status', { enum: ['unused', 'issued', 'cancelled', 'cleared'] }).notNull().default('unused'),
  payeeName: text('payee_name'),
  amount: numeric('amount', { precision: 15, scale: 2 }),
  chequeDateBs: text('cheque_date_bs'),
  chequeDateAd: text('cheque_date_ad'),
  /** If issued for a loan disbursement, reference it here. */
  loanId: uuid('loan_id'),
  /** If issued for a loan disbursement, reference the GL voucher. */
  voucherId: uuid('voucher_id'),
  usedAt: timestamp('used_at'),
  clearedAt: timestamp('cleared_at'),
  cancelReason: text('cancel_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('bank_cheque_leaves_org_number_uniq').on(table.organizationId, table.chequeNumber),
  index('bank_cheque_leaves_org_book_idx').on(table.organizationId, table.chequeBookId),
  index('bank_cheque_leaves_org_bank_account_idx').on(table.organizationId, table.bankAccountId),
  index('bank_cheque_leaves_org_status_idx').on(table.organizationId, table.status),
]);
