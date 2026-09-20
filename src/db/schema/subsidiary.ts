/**
 * Subsidiary Ledgers (सहायक खाताहरू)
 * Granular, member-wise sub-books that link back to the General Ledger via
 * voucher_no. While the GL posts aggregate rows into the 4 main books
 * (Assets, Liabilities, Income, Expenses), these sub-books track per-member
 * share, savings, and loan detail.
 *
 *   subsidiary_shares_book   -> Share movements (Purchase / Return / Bonus)
 *   subsidiary_savings_book  -> Savings transactions per account (SAV-xxx-xxxx)
 *   subsidiary_loans_book    -> Loan principal / interest / penalty movements
 *
 * Single-View requirement is served by the SQL view
 * `view_member_financial_summary` (see migration 0013) which returns
 * total share balance, total savings across accounts, and total outstanding
 * loan principal for any member.
 *
 * All tables are strictly scoped to organization_id for multi-tenancy.
 */
import {
  pgTable, text, numeric, integer, timestamp, uuid, index,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { members } from './members';
import { shareTypes, shareAccounts } from './shares';

// =============================================
// १. सेयर सहायक खाता (Shares Subsidiary Book)
// =============================================
export const subsidiarySharesBook = pgTable('subsidiary_shares_book', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => members.id),
  voucherNo: text('voucher_no').notNull(),            // GL लिंक
  transactionDateBs: text('transaction_date_bs').notNull(),
  transactionType: text('transaction_type', {
    enum: ['Purchase', 'Return', 'Bonus', 'Transfer_In', 'Transfer_Out'],
  }).notNull(),
  shareQuantity: integer('share_quantity').notNull(),
  faceValue: numeric('face_value', { precision: 15, scale: 2 }).notNull().default('100.00'),
  debitAmount: numeric('debit_amount', { precision: 15, scale: 2 }).notNull().default('0.00'),   // सेयर फिर्ता
  creditAmount: numeric('credit_amount', { precision: 15, scale: 2 }).notNull().default('0.00'), // सेयर खरिद
  balanceAmount: numeric('balance_amount', { precision: 15, scale: 2 }).notNull(),
  // Distinctive certificate kitta range covered by this movement (issue only).
  startKittaNo: integer('start_kitta_no'),
  endKittaNo: integer('end_kitta_no'),
  // Per-class / per-account provenance (added in migration 0042) — needed for
  // per-share-type manual-entry overlap validation and the certificate register.
  shareTypeId: uuid('share_type_id').references(() => shareTypes.id, { onDelete: 'set null' }),
  shareAccountId: uuid('share_account_id').references(() => shareAccounts.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('subs_shares_org_member_idx').on(table.organizationId, table.memberId),
  index('subs_shares_member_date_idx').on(table.memberId, table.transactionDateBs),
  index('subs_shares_org_type_idx').on(table.organizationId, table.shareTypeId),
]);

// =============================================
// २. बचत सहायक खाता (Savings Subsidiary Book)
// =============================================
export const subsidiarySavingsBook = pgTable('subsidiary_savings_book', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => members.id),
  accountNo: text('account_no').notNull(),            // e.g. SAV-101-0042
  accountType: text('account_type', {
    enum: ['Mandatory', 'Optional', 'Fixed'],
  }).notNull(),
  voucherNo: text('voucher_no').notNull(),            // GL लिंक
  transactionDateBs: text('transaction_date_bs').notNull(),
  debitAmount: numeric('debit_amount', { precision: 15, scale: 2 }).notNull().default('0.00'),   // झिक्दा (Withdrawal)
  creditAmount: numeric('credit_amount', { precision: 15, scale: 2 }).notNull().default('0.00'), // जम्मा गर्दा (Deposit)
  balanceAmount: numeric('balance_amount', { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('subs_sav_org_member_idx').on(table.organizationId, table.memberId),
  index('subs_sav_member_acct_date_idx').on(table.memberId, table.accountNo, table.transactionDateBs),
]);

// =============================================
// ३. ऋण सहायक खाता (Loans Subsidiary Book)
// =============================================
export const subsidiaryLoansBook = pgTable('subsidiary_loans_book', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => members.id),
  loanAccountNo: text('loan_account_no').notNull(),
  voucherNo: text('voucher_no').notNull(),            // GL लिंक
  transactionDateBs: text('transaction_date_bs').notNull(),
  principalDebit: numeric('principal_debit', { precision: 15, scale: 2 }).notNull().default('0.00'),   // ऋण प्रवाह
  principalCredit: numeric('principal_credit', { precision: 15, scale: 2 }).notNull().default('0.00'), // साँवा फिर्ता
  interestCredit: numeric('interest_credit', { precision: 15, scale: 2 }).notNull().default('0.00'),   // ब्याज असुली
  penaltyCredit: numeric('penalty_credit', { precision: 15, scale: 2 }).notNull().default('0.00'),     // हर्जाना असुली
  remainingPrincipal: numeric('remaining_principal', { precision: 15, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('subs_loan_org_member_idx').on(table.organizationId, table.memberId),
  index('subs_loan_member_acct_date_idx').on(table.memberId, table.loanAccountNo, table.transactionDateBs),
]);
