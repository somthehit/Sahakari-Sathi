/**
 * Savings Schema
 * savings_products, savings_interest_rates, savings_accounts,
 * savings_transactions, interest_postings, savings_cheque_books,
 * savings_cheque_leaves, savings_provisioning_queue
 * All tables scoped to organization_id for multi-tenancy.
 *
 * savings_products is the SINGLE canonical financial source for savings
 * product config (SETUPS → Savings A/C Settings → Account Products).
 * GL mapping columns are plain uuid FKs enforced in the SQL migration only
 * (avoids circular module imports between ./savings and ./accounting).
 */
import {
  pgTable, text, numeric, boolean, timestamp, integer, index, uuid, uniqueIndex, jsonb, varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './auth';
import { members } from './members';
import { branches } from './branches';

// =============================================
// SAVINGS PRODUCTS (Account Product — canonical config)
// =============================================
export const savingsProducts = pgTable('savings_products', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  nameNepali: varchar('name_nepali', { length: 100 }),
  productType: text('product_type', {
    enum: ['regular', 'recurring', 'fixed', 'daily_deposit']
  }).notNull(),
  productCategory: text('product_category'),
  isSystem: boolean('is_system').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),

  // — Interest / rate —
  interestRate: numeric('interest_rate', { precision: 6, scale: 4 }).notNull().default('0'),
  interestPostingFrequency: text('interest_posting_frequency', {
    enum: ['Daily', 'Monthly', 'Quarterly', 'Half_Yearly', 'Annually']
  }).notNull().default('Monthly'),
  interestCalculationMethod: text('interest_calculation_method', {
    enum: ['min_monthly_balance', 'daily_product', 'quarterly_min_balance', 'simple', 'compound']
  }).notNull().default('min_monthly_balance'),
  interestEffectiveDate: text('interest_effective_date'),

  // — Amount bounds —
  minBalance: numeric('min_balance', { precision: 15, scale: 2 }).notNull().default('0'),
  minDeposit: numeric('min_deposit', { precision: 15, scale: 2 }).notNull().default('0'),
  maxDeposit: numeric('max_deposit', { precision: 15, scale: 2 }),
  maxBalance: numeric('max_balance', { precision: 15, scale: 2 }),
  tenureMonths: integer('tenure_months'),             // for fixed/recurring
  penaltyRate: numeric('penalty_rate', { precision: 6, scale: 4 }).default('0'),

  // — Eligibility —
  eligibleMemberTypeIds: jsonb('eligible_member_type_ids').notNull().default([]),
  minAge: integer('min_age'),
  maxAge: integer('max_age'),

  // — KYC requirements —
  requiresKycVerified: boolean('requires_kyc_verified').notNull().default(true),
  requiresNominee: boolean('requires_nominee').notNull().default(true),
  requiresPhoto: boolean('requires_photo').notNull().default(true),
  requiresSignature: boolean('requires_signature').notNull().default(true),
  requiresDocuments: boolean('requires_documents').notNull().default(true),

  // — Opening rules —
  openingDepositRequired: boolean('opening_deposit_required').notNull().default(true),
  accountNoPrefix: varchar('account_no_prefix', { length: 10 }).notNull().default('SAV'),

  // — Deposit rules —
  depositModeCash: boolean('deposit_mode_cash').notNull().default(true),
  depositModeBank: boolean('deposit_mode_bank').notNull().default(true),
  depositModeTransfer: boolean('deposit_mode_transfer').notNull().default(true),
  depositModeAgent: boolean('deposit_mode_agent').notNull().default(true),
  dailyDepositLimit: numeric('daily_deposit_limit', { precision: 15, scale: 2 }),
  monthlyDepositLimit: numeric('monthly_deposit_limit', { precision: 15, scale: 2 }),
  backdateDepositAllowed: boolean('backdate_deposit_allowed').notNull().default(false),
  depositRequiresApproval: boolean('deposit_requires_approval').notNull().default(false),

  // — Withdrawal rules —
  withdrawalModeCash: boolean('withdrawal_mode_cash').notNull().default(true),
  withdrawalModeTransfer: boolean('withdrawal_mode_transfer').notNull().default(true),
  minWithdrawal: numeric('min_withdrawal', { precision: 15, scale: 2 }),
  maxWithdrawal: numeric('max_withdrawal', { precision: 15, scale: 2 }),
  dailyWithdrawalLimit: numeric('daily_withdrawal_limit', { precision: 15, scale: 2 }),
  monthlyWithdrawalLimit: numeric('monthly_withdrawal_limit', { precision: 15, scale: 2 }),
  minimumBalanceAfterWithdrawal: numeric('minimum_balance_after_withdrawal', { precision: 15, scale: 2 }),
  withdrawalRequiresApproval: boolean('withdrawal_requires_approval').notNull().default(false),

  // — Minimum balance penalty rules —
  minBalanceGraceDays: integer('min_balance_grace_days').notNull().default(0),
  minBalancePenaltyPercent: numeric('min_balance_penalty_percent', { precision: 6, scale: 4 }).notNull().default('0'),
  minBalancePenaltyAmount: numeric('min_balance_penalty_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  minBalancePenaltyFrequency: text('min_balance_penalty_frequency', {
    enum: ['Daily', 'Monthly', 'Quarterly', 'Half_Yearly', 'Annually']
  }).notNull().default('Monthly'),
  minBalanceWaiverAllowed: boolean('min_balance_waiver_allowed').notNull().default(false),

  // — Dormancy rules —
  inactiveAfterMonths: integer('inactive_after_months').notNull().default(3),
  dormantAfterMonths: integer('dormant_after_months').notNull().default(6),
  notifyBeforeDormancyDays: integer('notify_before_dormancy_days').notNull().default(30),
  reactivationRequired: boolean('reactivation_required').notNull().default(true),
  reactivationApprovalRequired: boolean('reactivation_approval_required').notNull().default(false),

  // — Closure rules —
  closureAllowed: boolean('closure_allowed').notNull().default(true),
  minimumBalanceBeforeClosure: numeric('minimum_balance_before_closure', { precision: 15, scale: 2 }).notNull().default('0'),
  closureRequiresApproval: boolean('closure_requires_approval').notNull().default(false),
  closureFee: numeric('closure_fee', { precision: 15, scale: 2 }).notNull().default('0'),

  // — Charges & fees —
  openingFee: numeric('opening_fee', { precision: 15, scale: 2 }).notNull().default('0'),
  monthlyMaintenanceFee: numeric('monthly_maintenance_fee', { precision: 15, scale: 2 }).notNull().default('0'),
  withdrawalFee: numeric('withdrawal_fee', { precision: 15, scale: 2 }).notNull().default('0'),
  chequeBookFee: numeric('cheque_book_fee', { precision: 15, scale: 2 }).notNull().default('0'),
  chequeLeafFee: numeric('cheque_leaf_fee', { precision: 15, scale: 2 }).notNull().default('0'),
  stopPaymentFee: numeric('stop_payment_fee', { precision: 15, scale: 2 }).notNull().default('0'),
  chequeReturnFee: numeric('cheque_return_fee', { precision: 15, scale: 2 }).notNull().default('0'),
  passbookFee: numeric('passbook_fee', { precision: 15, scale: 2 }).notNull().default('0'),
  statementFee: numeric('statement_fee', { precision: 15, scale: 2 }).notNull().default('0'),

  // — Cheque facility —
  chequeEnabled: boolean('cheque_enabled').notNull().default(false),
  chequeDefaultLeaves: integer('cheque_default_leaves').notNull().default(25),
  chequeMaxBooks: integer('cheque_max_books').notNull().default(1),
  chequeValidityDays: integer('cheque_validity_days').notNull().default(90),

  // — Accounting (GL) mapping (FK enforced in migration only) —
  glLiabilityAccountId: uuid('gl_liability_account_id'),
  glInterestExpenseAccountId: uuid('gl_interest_expense_account_id'),
  glInterestPayableAccountId: uuid('gl_interest_payable_account_id'),
  glFeeIncomeAccountId: uuid('gl_fee_income_account_id'),
  glPenaltyIncomeAccountId: uuid('gl_penalty_income_account_id'),
  glChequeIncomeAccountId: uuid('gl_cheque_income_account_id'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('savings_prod_org_code_uniq').on(table.organizationId, table.code),
  index('savings_prod_org_type_idx').on(table.organizationId, table.productType),
  index('savings_prod_org_active_idx').on(table.organizationId, table.isActive),
  index('savings_prod_org_category_idx').on(table.organizationId, table.productCategory),
]);

// =============================================
// SAVINGS INTEREST RATES (time-series history, mirrors loan_product_interest_rates)
// =============================================
export const savingsInterestRates = pgTable('savings_interest_rates', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  savingsProductId: uuid('savings_product_id').notNull().references(() => savingsProducts.id, { onDelete: 'cascade' }),
  rate: numeric('rate', { precision: 6, scale: 4 }).notNull().default('0'),
  effectiveFromBs: text('effective_from_bs').notNull(),
  effectiveToBs: text('effective_to_bs'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('savings_interest_rates_org_prod_from_uniq').on(table.organizationId, table.savingsProductId, table.effectiveFromBs),
  index('savings_interest_rates_org_prod_idx').on(table.organizationId, table.savingsProductId),
]);

// =============================================
// SAVINGS ACCOUNTS
// =============================================
export const savingsAccounts = pgTable('savings_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  accountNo: text('account_no').notNull(),            // unique per org
  memberId: uuid('member_id').notNull().references(() => members.id),
  memberName: text('member_name').notNull(),
  memberNo: text('member_no').notNull(),
  savingsProductId: uuid('savings_product_id').references(() => savingsProducts.id),
  productType: text('product_type', {
    enum: ['regular', 'recurring', 'fixed', 'daily_deposit']
  }).notNull(),
  productName: text('product_name').notNull(),
  interestRate: numeric('interest_rate', { precision: 6, scale: 4 }).notNull().default('0'),
  balance: numeric('balance', { precision: 15, scale: 2 }).notNull().default('0'),
  minBalance: numeric('min_balance', { precision: 15, scale: 2 }).notNull().default('0'),
  openedDateBs: text('opened_date_bs').notNull(),
  maturityDateBs: text('maturity_date_bs'),
  monthlyInstallment: numeric('monthly_installment', { precision: 15, scale: 2 }),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  collectionRouteId: uuid('collection_route_id'),
  status: text('status', { enum: ['Active', 'Dormant', 'Closed', 'Matured'] }).notNull().default('Active'),
  openedVia: text('opened_via', { enum: ['auto', 'manual'] }).notNull().default('manual'),
  lastTransactionDateBs: text('last_transaction_date_bs').notNull(),
  lastInterestPostedBs: text('last_interest_posted_bs'),

  // — Passbook printing state —
  passbookSerial: text('passbook_serial'),
  passbookLinesPerPage: integer('passbook_lines_per_page').notNull().default(30),
  lastPrintedTxnId: uuid('last_printed_txn_id'),
  lastPrintedLine: integer('last_printed_line').notNull().default(0),
  lastPrintedDateBs: text('last_printed_date_bs'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('savings_org_account_no_uniq').on(table.organizationId, table.accountNo),
  // Business rule: a member may hold ONLY ONE Active account per savings product.
  // Dormant / Closed / Matured accounts never block opening a fresh one.
  uniqueIndex('unique_active_member_savings_product')
    .on(table.organizationId, table.memberId, table.savingsProductId)
    .where(sql`${table.status} = 'Active'`),
  index('savings_org_member_idx').on(table.organizationId, table.memberId),
  index('savings_org_status_idx').on(table.organizationId, table.status),
  index('savings_branch_idx').on(table.branchId),
]);

// =============================================
// SAVINGS TRANSACTIONS (denormalized org_id for RLS)
// =============================================
export const savingsTransactions = pgTable('savings_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => savingsAccounts.id),
  accountNo: text('account_no').notNull(),
  memberId: uuid('member_id').notNull().references(() => members.id),
  memberName: text('member_name').notNull(),
  type: text('type', {
    enum: ['Deposit', 'Withdrawal', 'Interest_Posting', 'Transfer_In', 'Transfer_Out', 'Penalty']
  }).notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  balanceAfter: numeric('balance_after', { precision: 15, scale: 2 }).notNull(),
  voucherNo: text('voucher_no').notNull(),
  dateBs: text('date_bs').notNull(),
  dateAd: text('date_ad').notNull(),
  tellerName: text('teller_name').notNull(),
  remarks: text('remarks').notNull().default(''),
  paymentMode: text('payment_mode', {
    enum: ['Cash', 'Bank_Transfer', 'Internal_Transfer', 'Collection_Agent']
  }).notNull(),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('txn_org_account_idx').on(table.organizationId, table.accountId),
  index('txn_org_member_idx').on(table.organizationId, table.memberId),
  index('txn_org_date_idx').on(table.organizationId, table.dateBs),
  index('txn_branch_idx').on(table.branchId),
]);

// =============================================
// INTEREST POSTINGS (denormalized org_id for RLS)
// =============================================
export const interestPostings = pgTable('interest_postings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => savingsAccounts.id),
  memberId: uuid('member_id').notNull().references(() => members.id),
  postingDateBs: text('posting_date_bs').notNull(),
  fromDateBs: text('from_date_bs').notNull(),
  toDateBs: text('to_date_bs').notNull(),
  principalAmount: numeric('principal_amount', { precision: 15, scale: 2 }).notNull(),
  interestRate: numeric('interest_rate', { precision: 6, scale: 4 }).notNull(),
  interestAmount: numeric('interest_amount', { precision: 15, scale: 2 }).notNull(),
  taxDeducted: numeric('tax_deducted', { precision: 15, scale: 2 }).notNull().default('0'),
  netInterest: numeric('net_interest', { precision: 15, scale: 2 }).notNull(),
  voucherNo: text('voucher_no'),
  processedBy: uuid('processed_by'),
  branchId: uuid('branch_id').references(() => branches.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('int_post_org_account_idx').on(table.organizationId, table.accountId),
  index('int_post_org_date_idx').on(table.organizationId, table.postingDateBs),
  index('int_post_org_member_idx').on(table.organizationId, table.memberId),
]);

// =============================================
// CHEQUE BOOKS
// =============================================
export const savingsChequeBooks = pgTable('savings_cheque_books', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => savingsAccounts.id, { onDelete: 'cascade' }),
  accountNo: text('account_no').notNull(),
  bookNo: text('book_no').notNull(),
  firstLeafNo: integer('first_leaf_no').notNull(),
  leafCount: integer('leaf_count').notNull().default(25),
  issueDateBs: text('issue_date_bs').notNull(),
  issueDateAd: text('issue_date_ad').notNull(),
  issuedById: uuid('issued_by_id'),
  status: text('status', { enum: ['Issued', 'Completed', 'Cancelled'] }).notNull().default('Issued'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('savings_cheque_books_org_book_no_uniq').on(table.organizationId, table.bookNo),
  index('savings_cheque_books_org_account_idx').on(table.organizationId, table.accountId),
]);

// =============================================
// CHEQUE LEAVES
// =============================================
export const savingsChequeLeaves = pgTable('savings_cheque_leaves', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  bookId: uuid('book_id').notNull().references(() => savingsChequeBooks.id, { onDelete: 'cascade' }),
  leafNo: integer('leaf_no').notNull(),
  status: text('status', { enum: ['Available', 'Issued', 'Used', 'Cancelled', 'Stopped'] }).notNull().default('Available'),
  usedByTxnId: uuid('used_by_txn_id'),
  stoppedReason: text('stopped_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('savings_cheque_leaves_org_book_leaf_uniq').on(table.organizationId, table.bookId, table.leafNo),
  index('savings_cheque_leaves_org_book_idx').on(table.organizationId, table.bookId),
]);

// =============================================
// SAVINGS CHEQUE DEPOSITS (pending-clearance instrument register)
// Cheque deposits post as a pending-clearance instrument — the balance is NOT
// credited at deposit time. A clearing step credits the balance + posts the GL
// voucher; a bounce reverses (or flags) the instrument.
// =============================================
export const savingsChequeDeposits = pgTable('savings_cheque_deposits', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  accountId: uuid('account_id').notNull().references(() => savingsAccounts.id, { onDelete: 'cascade' }),
  accountNo: text('account_no').notNull(),
  memberId: uuid('member_id').notNull().references(() => members.id),
  memberName: text('member_name').notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  chequeNumber: text('cheque_number').notNull(),
  chequeBank: text('cheque_bank').notNull(),
  chequeDateBs: text('cheque_date_bs'),
  dateBs: text('date_bs').notNull(),
  dateAd: text('date_ad').notNull(),
  status: text('status', { enum: ['Pending', 'Cleared', 'Bounced'] }).notNull().default('Pending'),
  voucherNo: text('voucher_no'),
  reference: text('reference'),
  depositedById: uuid('deposited_by_id'),
  depositedByName: text('deposited_by_name'),
  clearedAt: timestamp('cleared_at'),
  clearedById: uuid('cleared_by_id'),
  clearedByName: text('cleared_by_name'),
  bouncedAt: timestamp('bounced_at'),
  bounceReason: text('bounce_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('savings_cheque_dep_org_status_idx').on(table.organizationId, table.status),
  index('savings_cheque_dep_org_account_idx').on(table.organizationId, table.accountId),
  index('savings_cheque_dep_org_number_idx').on(table.organizationId, table.chequeNumber),
]);

// =============================================
// SAVINGS PENDING WITHDRAWALS (dual-approval queue)
// Withdrawals above the configured dual-approval threshold are queued here
// instead of releasing funds instantly. A supervisor approves from the
// approval queue, which then posts the actual debit + GL voucher.
// =============================================
export const savingsPendingWithdrawals = pgTable('savings_pending_withdrawals', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  accountId: uuid('account_id').notNull().references(() => savingsAccounts.id, { onDelete: 'cascade' }),
  accountNo: text('account_no').notNull(),
  memberId: uuid('member_id').notNull().references(() => members.id),
  memberName: text('member_name').notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  payoutMode: text('payout_mode', { enum: ['Cash', 'Cheque_Issue', 'Bank_Transfer'] }).notNull().default('Cash'),
  instrumentType: text('instrument_type', { enum: ['cheque', 'slip', 'passbook'] }).notNull(),
  instrumentReference: text('instrument_reference'),
  dateBs: text('date_bs').notNull(),
  dateAd: text('date_ad').notNull(),
  voucherNo: text('voucher_no').notNull(),
  status: text('status', { enum: ['Pending', 'Approved', 'Rejected'] }).notNull().default('Pending'),
  requestedById: uuid('requested_by_id').notNull(),
  requestedByName: text('requested_by_name').notNull(),
  approvedBy: text('approved_by'),
  /** Signature-verification linkage for the queued withdrawal (plain id, FK advisory). */
  signatureLogId: uuid('signature_log_id'),
  signatureOutcome: text('signature_outcome'),
  signatureOverrideReason: text('signature_override_reason'),
  remarks: text('remarks'),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('savings_pend_wd_org_status_idx').on(table.organizationId, table.status),
  index('savings_pend_wd_org_account_idx').on(table.organizationId, table.accountId),
  index('savings_pend_wd_org_member_idx').on(table.organizationId, table.memberId),
]);

// =============================================
// SAVINGS PROVISIONING QUEUE (non-fatal auto-opening audit/retry trail)
// =============================================
export const savingsProvisioningQueue = pgTable('savings_provisioning_queue', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  memberNo: text('member_no').notNull(),
  savingsProductId: uuid('savings_product_id').notNull().references(() => savingsProducts.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('Pending'),   // Pending | Success | Failed
  attempts: integer('attempts').notNull().default(0),
  errorMessage: text('error_message'),
  openedAccountId: uuid('opened_account_id'),
  openedVoucherNo: text('opened_voucher_no'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at'),
}, (table) => [
  uniqueIndex('savings_provisioning_queue_org_member_product_uniq').on(table.organizationId, table.memberId, table.savingsProductId),
  index('savings_provisioning_queue_org_status_idx').on(table.organizationId, table.status),
]);