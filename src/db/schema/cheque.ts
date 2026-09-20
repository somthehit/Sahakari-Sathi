/**
 * Cheque Management & Settings Schema
 * Scoped to organization_id and branch_id for multi-tenant isolation.
 */
import {
  pgTable, text, numeric, boolean, timestamp, integer, index, uuid, uniqueIndex, jsonb,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { branches } from './branches';
import { savingsAccounts, savingsProducts } from './savings';
import { chartOfAccounts } from './accounting';

// =============================================
// CHEQUE SETTINGS CONFIGURATION
// =============================================
export const chequeSettings = pgTable('cheque_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'cascade' }),
  scope: text('scope', { enum: ['organization', 'branch'] }).notNull().default('organization'),
  
  // General Facility
  enableChequeFacility: boolean('enable_cheque_facility').notNull().default(true),
  eligibleAccountProductIds: jsonb('eligible_account_product_ids').$type<string[]>().notNull().default([]),
  
  // Cheque Book Settings
  defaultLeavesPerBook: integer('default_leaves_per_book').notNull().default(25),
  allowedBookSizes: jsonb('allowed_book_sizes').$type<number[]>().notNull().default([10, 20, 25, 50, 100]),
  maxActiveBooksPerAccount: integer('max_active_books_per_account').notNull().default(1),
  reissueAllowed: boolean('reissue_allowed').notNull().default(true),
  reissueAfterExhaustion: boolean('reissue_after_exhaustion').notNull().default(true),
  lostBookReplacementAllowed: boolean('lost_book_replacement_allowed').notNull().default(true),
  cancelledBookReplacementAllowed: boolean('cancelled_book_replacement_allowed').notNull().default(true),

  // Issuance Eligibility (enforced server-side by ChequeService.evaluateIssuanceEligibility).
  // These were previously hardcoded constants in the issue-book modal; they are
  // per-organization policy and are now the single source of truth for both the
  // pre-flight check the UI shows and the guard the API applies.
  requireKycVerified: boolean('require_kyc_verified').notNull().default(true),
  blockBlacklistedMembers: boolean('block_blacklisted_members').notNull().default(true),
  minUtilizationForReissue: integer('min_utilization_for_reissue').notNull().default(80),
  reissueCooldownDays: integer('reissue_cooldown_days').notNull().default(30),
  allowSupervisorOverride: boolean('allow_supervisor_override').notNull().default(true),


  // Cheque Numbering
  numberingScope: text('numbering_scope', {
    enum: ['account_wise', 'product_wise', 'branch_wise', 'org_wise'],
  }).notNull().default('branch_wise'),
  startingChequeNumber: integer('starting_cheque_number').notNull().default(100001),
  chequePrefix: text('cheque_prefix').notNull().default('CHQ-'),
  numberLength: integer('number_length').notNull().default(6),
  allowManualNumberAssignment: boolean('allow_manual_number_assignment').notNull().default(false),
  preventDuplicateChequeNumbers: boolean('prevent_duplicate_cheque_numbers').notNull().default(true),
  
  // Cheque Validity
  validityPeriodDays: integer('validity_period_days').notNull().default(90),
  expiredChequeBehavior: text('expired_cheque_behavior', {
    enum: ['flag_only', 'reject_presentation', 'require_approval'],
  }).notNull().default('reject_presentation'),
  
  // Stop Payment
  stopPaymentEnabled: boolean('stop_payment_enabled').notNull().default(true),
  allowStopPaymentBy: jsonb('allow_stop_payment_by').$type<string[]>().notNull().default(['member', 'teller', 'branch_manager', 'admin']),
  stopPaymentCharge: numeric('stop_payment_charge', { precision: 15, scale: 2 }).notNull().default('0'),
  allowStopPaymentOn: jsonb('allow_stop_payment_on').$type<string[]>().notNull().default(['single_cheque', 'cheque_range', 'entire_book']),
  stopPaymentRequireApproval: boolean('stop_payment_require_approval').notNull().default(true),
  
  // Bounce / Dishonour
  bounceHandlingEnabled: boolean('bounce_handling_enabled').notNull().default(true),
  bounceCharge: numeric('bounce_charge', { precision: 15, scale: 2 }).notNull().default('0'),
  maxBounceCount: integer('max_bounce_count'),
  afterThresholdAction: text('after_threshold_action', {
    enum: ['flag_account', 'require_manager_review', 'suspend_cheque_facility', 'require_approval', 'no_automatic_action'],
  }).notNull().default('flag_account'),
  
  // Charges & Fees
  issuanceChargeType: text('issuance_charge_type', { enum: ['flat', 'per_leaf', 'both'] }).notNull().default('flat'),
  issuanceChargeAmount: numeric('issuance_charge_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  issuanceChargePerLeafAmount: numeric('issuance_charge_per_leaf_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  lostBookCharge: numeric('lost_book_charge', { precision: 15, scale: 2 }).notNull().default('0'),
  replacementBookCharge: numeric('replacement_book_charge', { precision: 15, scale: 2 }).notNull().default('0'),
  otherChequeCharges: jsonb('other_cheque_charges').$type<any[]>().notNull().default([]),
  taxApplicable: boolean('tax_applicable').notNull().default(false),
  taxRate: numeric('tax_rate', { precision: 5, scale: 2 }).notNull().default('0'),
  
  // GL Mapping
  glIssuanceFeeAccountId: uuid('gl_issuance_fee_account_id').references(() => chartOfAccounts.id),
  glStopPaymentFeeAccountId: uuid('gl_stop_payment_fee_account_id').references(() => chartOfAccounts.id),
  glBounceFeeAccountId: uuid('gl_bounce_fee_account_id').references(() => chartOfAccounts.id),
  glReplacementFeeAccountId: uuid('gl_replacement_fee_account_id').references(() => chartOfAccounts.id),
  glOtherChargesFeeAccountId: uuid('gl_other_charges_fee_account_id').references(() => chartOfAccounts.id),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('cheque_settings_org_branch_scope_uniq').on(table.organizationId, table.branchId, table.scope),
  index('cheque_settings_org_idx').on(table.organizationId),
]);

// =============================================
// CHEQUE BOOKS TABLE
// =============================================
export const chequeBooks = pgTable('cheque_books', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  accountId: uuid('account_id').notNull().references(() => savingsAccounts.id, { onDelete: 'cascade' }),
  accountProductId: uuid('account_product_id').references(() => savingsProducts.id, { onDelete: 'set null' }),
  bookNumber: text('book_number').notNull(),
  prefix: text('prefix'),
  leafStartNumber: integer('leaf_start_number').notNull(),
  leafEndNumber: integer('leaf_end_number').notNull(),
  leafCount: integer('leaf_count').notNull().default(25),
  issuedDateBs: text('issued_date_bs').notNull(),
  issuedDateAd: text('issued_date_ad').notNull(),
  status: text('status', { enum: ['active', 'exhausted', 'cancelled', 'lost', 'replaced'] }).notNull().default('active'),
  issuanceCharge: numeric('issuance_charge', { precision: 15, scale: 2 }).notNull().default('0'),
  issuedById: uuid('issued_by_id'),
  purpose: text('purpose'),
  deliveryMethod: text('delivery_method', { enum: ['branch', 'courier'] }),
  overrideReason: text('override_reason'),
  cancelledById: uuid('cancelled_by_id'),
  cancelledAt: timestamp('cancelled_at'),
  cancelReason: text('cancel_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('cheque_books_org_book_number_uniq').on(table.organizationId, table.bookNumber),
  index('cheque_books_org_account_idx').on(table.organizationId, table.accountId),
  index('cheque_books_org_branch_idx').on(table.organizationId, table.branchId),
]);

// =============================================
// CHEQUE LEAVES TABLE
// =============================================
export const chequeLeaves = pgTable('cheque_leaves', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  chequeBookId: uuid('cheque_book_id').notNull().references(() => chequeBooks.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => savingsAccounts.id, { onDelete: 'cascade' }),
  chequeNumber: text('cheque_number').notNull(),
  leafNo: integer('leaf_no').notNull(),
  status: text('status', { enum: ['unused', 'issued', 'presented', 'used', 'cleared', 'bounced', 'stopped', 'cancelled'] }).notNull().default('unused'),
  payeeName: text('payee_name'),
  amount: numeric('amount', { precision: 15, scale: 2 }),
  chequeDateBs: text('cheque_date_bs'),
  chequeDateAd: text('cheque_date_ad'),
  presentedDate: timestamp('presented_date'),
  clearedDate: timestamp('cleared_date'),
  usedAt: timestamp('used_at'),
  transactionId: uuid('transaction_id'),
  bounceDate: timestamp('bounce_date'),
  bounceReason: text('bounce_reason'),
  stopPaymentDate: timestamp('stop_payment_date'),
  stopPaymentReason: text('stop_payment_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('cheque_leaves_org_number_uniq').on(table.organizationId, table.chequeNumber),
  index('cheque_leaves_org_book_idx').on(table.organizationId, table.chequeBookId),
  index('cheque_leaves_org_account_idx').on(table.organizationId, table.accountId),
]);

// =============================================
// CHEQUE STOP PAYMENTS TABLE
// =============================================
export const chequeStopPayments = pgTable('cheque_stop_payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  accountId: uuid('account_id').notNull().references(() => savingsAccounts.id, { onDelete: 'cascade' }),
  chequeBookId: uuid('cheque_book_id').references(() => chequeBooks.id, { onDelete: 'set null' }),
  chequeLeafId: uuid('cheque_leaf_id').references(() => chequeLeaves.id, { onDelete: 'set null' }),
  startChequeNumber: text('start_cheque_number').notNull(),
  endChequeNumber: text('end_cheque_number').notNull(),
  reason: text('reason').notNull(),
  chargeAmount: numeric('charge_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  status: text('status', { enum: ['pending', 'approved', 'rejected', 'cancelled', 'expired'] }).notNull().default('pending'),
  requestedById: uuid('requested_by_id').notNull(),
  approvedById: uuid('approved_by_id'),
  requestedAt: timestamp('requested_at').notNull().defaultNow(),
  approvedAt: timestamp('approved_at'),
  rejectedAt: timestamp('rejected_at'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('cheque_stop_payments_org_account_idx').on(table.organizationId, table.accountId),
  index('cheque_stop_payments_org_status_idx').on(table.organizationId, table.status),
]);

// =============================================
// CHEQUE BOUNCES TABLE
// =============================================
export const chequeBounces = pgTable('cheque_bounces', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  accountId: uuid('account_id').notNull().references(() => savingsAccounts.id, { onDelete: 'cascade' }),
  chequeLeafId: uuid('cheque_leaf_id').references(() => chequeLeaves.id, { onDelete: 'set null' }),
  chequeNumber: text('cheque_number').notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  bounceReason: text('bounce_reason').notNull(),
  bounceCharge: numeric('bounce_charge', { precision: 15, scale: 2 }).notNull().default('0'),
  transactionId: uuid('transaction_id'),
  reportedDate: text('reported_date').notNull(),
  reportedById: uuid('reported_by_id').notNull(),
  reviewedById: uuid('reviewed_by_id'),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('cheque_bounces_org_account_idx').on(table.organizationId, table.accountId),
  index('cheque_bounces_org_cheque_idx').on(table.organizationId, table.chequeNumber),
]);

// =============================================
// CHEQUE LEAF DESIGNS (print templates)
// =============================================
/**
 * A saved visual layout for a printable cheque leaf, produced by the Cheque
 * Design studio. Mirrors `share_certificate_formats`: the structured columns
 * carry what the API needs to reason about (identity, size, active/default),
 * while the full visual layout — element coordinates, fonts, MICR band,
 * uploaded logo/signature data URLs — is persisted verbatim as `config_json`.
 *
 * Cheque stationery is measured in millimetres, not pixels, because the print
 * path has to line up with pre-printed paper (CTS-2010 style leaves are
 * 200 × 92 mm; Nepali bank leaves are commonly 175 × 80 mm).
 */
export const chequeDesigns = pgTable('cheque_designs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  code: text('code').notNull(),                       // stored UPPERCASE, unique per org
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  isDefault: boolean('is_default').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  widthMm: numeric('width_mm', { precision: 6, scale: 2 }).notNull().default('200'),
  heightMm: numeric('height_mm', { precision: 6, scale: 2 }).notNull().default('92'),
  // Full visual ChequeDesignConfig JSON produced by the Cheque Design studio.
  configJson: text('config_json'),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('cheque_designs_org_code_uniq').on(table.organizationId, table.code),
  index('cheque_designs_org_active_idx').on(table.organizationId, table.isActive),
]);
