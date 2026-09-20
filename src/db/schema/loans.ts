/**
 * Loan Accounts, EMI Schedule, Repayments, Collaterals, Guarantors,
 * Penalties, Reschedules, Write-offs, Loan Products
 * All tables scoped to organization_id for multi-tenancy.
 */
import {
  pgTable, text, numeric, boolean, timestamp, integer, index, uuid, uniqueIndex, jsonb, varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './auth';
import { members } from './members';
import { branches } from './branches';
import { memberTypes, memberCategories } from './memberSettings';

// Interest calculation methods supported by the loan engine (Module 6).
export const LOAN_INTEREST_METHODS = [
  'flat',                // Flat rate — interest on full principal for the whole tenure
  'diminishing_emi',     // Diminishing-Equal EMI — reducing balance, equal installments
  'diminishing_principal', // Diminishing-Equal Principal — constant principal + reducing interest
  'daily_reducing',      // Daily reducing — interest accrued on actual days (365/360)
  'bullet',              // Bullet — interest-only installments, full principal at maturity
] as const;
export type LoanInterestMethod = (typeof LOAN_INTEREST_METHODS)[number];

// =============================================
// LOAN PRODUCTS
// =============================================
export const loanProducts = pgTable('loan_products', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  productType: text('product_type', {
    enum: ['general', 'business', 'agriculture', 'emergency', 'hire_purchase']
  }).notNull().default('general'),
  categoryId: uuid('category_id').references(() => loanCategories.id),
  // Current effective rate snapshot. The authoritative time-series history
  // lives in loan_product_interest_rates (effective_from_bs / effective_to_bs).
  interestRate: numeric('interest_rate', { precision: 6, scale: 4 }).notNull(),
  interestMethod: text('interest_method', { enum: LOAN_INTEREST_METHODS }).notNull().default('diminishing_emi'),
  minAmount: numeric('min_amount', { precision: 15, scale: 2 }).notNull(),
  maxAmount: numeric('max_amount', { precision: 15, scale: 2 }).notNull(),
  minTenureMonths: integer('min_tenure_months').notNull(),
  maxTenureMonths: integer('max_tenure_months').notNull(),
  penaltyRate: numeric('penalty_rate', { precision: 6, scale: 4 }).default('0'),
  processingFeePercent: numeric('processing_fee_percent', { precision: 6, scale: 4 }).default('0'),
  // Eligibility gate (member lifecycle stage 4) — a value of 0/false disables
  // that rule for this product.
  minMembershipMonths: integer('min_membership_months').notNull().default(0),
  minShareAmount: numeric('min_share_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  requireActiveSavings: boolean('require_active_savings').notNull().default(false),
  minSavingsBalance: numeric('min_savings_balance', { precision: 15, scale: 2 }).notNull().default('0'),
  requireVerifiedKyc: boolean('require_verified_kyc').notNull().default(true),
  allowEligibilityOverride: boolean('allow_eligibility_override').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  description: text('description'),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('loan_prod_org_code_uniq').on(table.organizationId, table.code),
  index('loan_prod_org_idx').on(table.organizationId),
  index('loan_prod_org_category_idx').on(table.organizationId, table.categoryId),
]);

// =============================================
// LOAN ACCOUNTS
// =============================================
export const loanAccounts = pgTable('loan_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  loanNo: text('loan_no').notNull(),                  // unique per org
  memberId: uuid('member_id').notNull().references(() => members.id),
  memberName: text('member_name').notNull(),
  memberNo: text('member_no').notNull(),
  loanProductId: uuid('loan_product_id').references(() => loanProducts.id),
  productType: text('product_type', {
    enum: ['general', 'business', 'agriculture', 'emergency', 'hire_purchase']
  }).notNull(),
  productName: text('product_name').notNull(),
  appliedAmount: numeric('applied_amount', { precision: 15, scale: 2 }).notNull(),
  approvedAmount: numeric('approved_amount', { precision: 15, scale: 2 }).notNull(),
  outstandingPrincipal: numeric('outstanding_principal', { precision: 15, scale: 2 }).notNull().default('0'),
  interestRate: numeric('interest_rate', { precision: 6, scale: 4 }).notNull(),
  interestMethod: text('interest_method', { enum: LOAN_INTEREST_METHODS }).notNull(),
  tenureMonths: integer('tenure_months').notNull(),
  monthlyEmi: numeric('monthly_emi', { precision: 15, scale: 2 }).notNull(),
  disbursedDateBs: text('disbursed_date_bs').notNull(),
  maturityDateBs: text('maturity_date_bs').notNull(),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  status: text('status', {
    enum: ['Applied', 'Appraised', 'Approved', 'Disbursed', 'Closed', 'Written_Off']
  }).notNull().default('Applied'),
  nplStatus: text('npl_status', {
    enum: ['Pass', 'Watchlist', 'Substandard', 'Doubtful', 'Loss']
  }).notNull().default('Pass'),
  daysOverdue: integer('days_overdue').notNull().default(0),
  overdueAmount: numeric('overdue_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  provisionAmount: numeric('provision_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  lastRepaymentDateBs: text('last_repayment_date_bs'),
  // Eligibility gate audit trail — set when the application is created:
  // eligibilityStatus 'Eligible' | 'Overridden', plus the failed reasons and
  // the operator's override reason when the gate was overridden.
  eligibilityStatus: text('eligibility_status', { enum: ['Eligible', 'Overridden'] }),
  eligibilityReasons: jsonb('eligibility_reasons').$type<string[]>(),
  eligibilityOverrideReason: text('eligibility_override_reason'),
  createdBy: text('created_by'),
  approvedBy: text('approved_by'),
  // Disbursement tracking — set when funds are released
  disbursedAmount: numeric('disbursed_amount', { precision: 15, scale: 2 }),
  disbursementPaymentMethod: text('disbursement_payment_method', {
    enum: ['CASH', 'SAVINGS_TRANSFER', 'CHEQUE']
  }),
  disbursementReferenceId: text('disbursement_reference_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('loan_org_loan_no_uniq').on(table.organizationId, table.loanNo),
  index('loan_org_member_idx').on(table.organizationId, table.memberId),
  index('loan_org_status_idx').on(table.organizationId, table.status),
  index('loan_org_npl_idx').on(table.organizationId, table.nplStatus),
  index('loan_branch_idx').on(table.branchId),
]);

// =============================================
// LOAN COLLATERALS
// =============================================
export const loanCollaterals = pgTable('loan_collaterals', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  loanId: uuid('loan_id').notNull().references(() => loanAccounts.id, { onDelete: 'cascade' }),
  // Canonical catalog reference (Module 6). The legacy text enum is retained
  // for existing rows; new origination writes should set collateral_type_id.
  collateralTypeId: uuid('collateral_type_id').references(() => loanCollateralTypes.id),
  collateralType: text('collateral_type', {
    enum: ['Land', 'Building', 'Vehicle', 'Gold', 'FD', 'Shares', 'Other']
  }).notNull(),
  description: text('description').notNull(),
  valuation: numeric('valuation', { precision: 15, scale: 2 }).notNull().default('0'),
  documentNo: text('document_no'),
  documentUrl: text('document_url'),
  valuedBy: text('valued_by'),
  valuationDateBs: text('valuation_date_bs'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('collateral_org_loan_idx').on(table.organizationId, table.loanId),
]);

// =============================================
// GUARANTORS
// =============================================
export const guarantors = pgTable('guarantors', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  loanId: uuid('loan_id').notNull().references(() => loanAccounts.id, { onDelete: 'cascade' }),
  guarantorMemberId: uuid('guarantor_member_id').references(() => members.id),
  guarantorName: text('guarantor_name').notNull(),
  guarantorPhone: text('guarantor_phone'),
  citizenshipNo: text('citizenship_no'),
  relationship: text('relationship'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('guarantor_org_loan_idx').on(table.organizationId, table.loanId),
]);

// =============================================
// EMI SCHEDULES (denormalized org_id for RLS)
// =============================================
export const emiSchedules = pgTable('emi_schedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  loanId: uuid('loan_id').notNull().references(() => loanAccounts.id, { onDelete: 'cascade' }),
  installmentNo: integer('installment_no').notNull(),
  dueDateBs: text('due_date_bs').notNull(),
  principal: numeric('principal', { precision: 15, scale: 2 }).notNull(),
  interest: numeric('interest', { precision: 15, scale: 2 }).notNull(),
  totalEmi: numeric('total_emi', { precision: 15, scale: 2 }).notNull(),
  balancePrincipal: numeric('balance_principal', { precision: 15, scale: 2 }).notNull(),
  status: text('status', { enum: ['Paid', 'Due', 'Overdue'] }).notNull().default('Due'),
  paidDateBs: text('paid_date_bs'),
  paidAmount: numeric('paid_amount', { precision: 15, scale: 2 }),
}, (table) => [
  index('emi_org_loan_idx').on(table.organizationId, table.loanId),
  index('emi_org_status_idx').on(table.organizationId, table.status),
  index('emi_org_due_date_idx').on(table.organizationId, table.dueDateBs),
]);

// =============================================
// LOAN REPAYMENTS (denormalized org_id for RLS)
// =============================================
export const loanRepayments = pgTable('loan_repayments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  loanId: uuid('loan_id').notNull().references(() => loanAccounts.id),
  memberId: uuid('member_id').notNull().references(() => members.id),
  receiptNo: text('receipt_no').notNull(),            // unique per org
  principalPaid: numeric('principal_paid', { precision: 15, scale: 2 }).notNull(),
  interestPaid: numeric('interest_paid', { precision: 15, scale: 2 }).notNull(),
  penaltyPaid: numeric('penalty_paid', { precision: 15, scale: 2 }).notNull().default('0'),
  totalPaid: numeric('total_paid', { precision: 15, scale: 2 }).notNull(),
  outstandingAfter: numeric('outstanding_after', { precision: 15, scale: 2 }).notNull(),
  paymentMode: text('payment_mode', { enum: ['Cash', 'Bank_Transfer'] }).notNull(),
  dateBs: text('date_bs').notNull(),
  dateAd: text('date_ad').notNull(),
  collectedBy: text('collected_by').notNull(),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  voucherNo: text('voucher_no'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('repay_org_receipt_no_uniq').on(table.organizationId, table.receiptNo),
  index('repay_org_loan_idx').on(table.organizationId, table.loanId),
  index('repay_org_date_idx').on(table.organizationId, table.dateBs),
  index('repay_branch_idx').on(table.branchId),
]);

// =============================================
// LOAN PENALTIES
// =============================================
export const loanPenalties = pgTable('loan_penalties', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  loanId: uuid('loan_id').notNull().references(() => loanAccounts.id),
  memberId: uuid('member_id').notNull().references(() => members.id),
  penaltyDateBs: text('penalty_date_bs').notNull(),
  daysOverdue: integer('days_overdue').notNull(),
  penaltyRate: numeric('penalty_rate', { precision: 6, scale: 4 }).notNull(),
  penaltyAmount: numeric('penalty_amount', { precision: 15, scale: 2 }).notNull(),
  isPaid: boolean('is_paid').notNull().default(false),
  paidDateBs: text('paid_date_bs'),
  waived: boolean('waived').notNull().default(false),
  waivedBy: uuid('waived_by'),
  waivedReason: text('waived_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('penalty_org_loan_idx').on(table.organizationId, table.loanId),
  index('penalty_org_date_idx').on(table.organizationId, table.penaltyDateBs),
]);

// =============================================
// LOAN RESCHEDULES
// =============================================
export const loanReschedules = pgTable('loan_reschedules', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  loanId: uuid('loan_id').notNull().references(() => loanAccounts.id),
  rescheduledDateBs: text('rescheduled_date_bs').notNull(),
  previousTenure: integer('previous_tenure').notNull(),
  newTenure: integer('new_tenure').notNull(),
  previousRate: numeric('previous_rate', { precision: 6, scale: 4 }).notNull(),
  newRate: numeric('new_rate', { precision: 6, scale: 4 }).notNull(),
  previousEmi: numeric('previous_emi', { precision: 15, scale: 2 }).notNull(),
  newEmi: numeric('new_emi', { precision: 15, scale: 2 }).notNull(),
  reason: text('reason').notNull(),
  approvedBy: uuid('approved_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('reschedule_org_loan_idx').on(table.organizationId, table.loanId),
]);

// =============================================
// LOAN WRITE-OFFS
// =============================================
export const loanWriteoffs = pgTable('loan_writeoffs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  loanId: uuid('loan_id').notNull().references(() => loanAccounts.id),
  memberId: uuid('member_id').notNull().references(() => members.id),
  writeoffDateBs: text('writeoff_date_bs').notNull(),
  principalWrittenOff: numeric('principal_written_off', { precision: 15, scale: 2 }).notNull(),
  interestWrittenOff: numeric('interest_written_off', { precision: 15, scale: 2 }).notNull().default('0'),
  totalWrittenOff: numeric('total_written_off', { precision: 15, scale: 2 }).notNull(),
  reason: text('reason').notNull(),
  approvedBy: uuid('approved_by'),
  voucherNo: text('voucher_no'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('writeoff_org_loan_idx').on(table.organizationId, table.loanId),
  index('writeoff_org_date_idx').on(table.organizationId, table.writeoffDateBs),
]);

// =============================================
// LOAN CATEGORIES (Module 6 — SETUPS → Loan Settings)
// Flat classification catalog. loan_products.category_id replaces the legacy
// free-text product_type as the canonical loan classification.
// =============================================
export const loanCategories = pgTable('loan_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
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
}, (table) => [
  uniqueIndex('loan_categories_org_code_uniq').on(table.organizationId, table.code),
  index('loan_categories_org_active_idx').on(table.organizationId, table.isActive),
]);

// =============================================
// LOAN COLLATERAL TYPES (Module 6)
// Catalog of acceptable collateral/security types (धितो प्रकार).
// loan_collaterals.collateral_type_id references this catalog.
// =============================================
export const loanCollateralTypes = pgTable('loan_collateral_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 20 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  nameNepali: varchar('name_nepali', { length: 100 }),
  description: text('description'),
  valuationRequired: boolean('valuation_required').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  isSystem: boolean('is_system').notNull().default(false),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('loan_collateral_types_org_code_uniq').on(table.organizationId, table.code),
  index('loan_collateral_types_org_active_idx').on(table.organizationId, table.isActive),
]);

// =============================================
// GUARANTOR SETTINGS (Module 6 — singular org settings)
// One row per organization. Configures the guarantor requirement enforced
// at loan origination: minimum/maximum count and required coverage %.
// =============================================
export const guarantorSettings = pgTable('guarantor_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  minGuarantors: integer('min_guarantors').notNull().default(1),
  maxGuarantors: integer('max_guarantors'),
  requiredCoveragePercent: numeric('required_coverage_percent', { precision: 5, scale: 2 }).notNull().default('0'),
  allowMemberGuarantors: boolean('allow_member_guarantors').notNull().default(true),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('guarantor_settings_org_uniq').on(table.organizationId),
]);

// =============================================
// EMI SCHEDULE SETTINGS (Module 6 — singular org settings)
// One row per organization. Controls how the loan engine builds installment
// schedules: which interest methods are enabled, the default method, the
// day-count convention, installment day-of-month, rounding and whether due
// dates shift forward to the next working day (Module 1 working_days).
// =============================================
export const emiScheduleSettings = pgTable('emi_schedule_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  defaultInterestMethod: text('default_interest_method', { enum: LOAN_INTEREST_METHODS }).notNull().default('diminishing_emi'),
  enabledMethods: jsonb('enabled_methods').$type<string[]>().notNull().default(sql`'["flat","diminishing_emi","diminishing_principal","daily_reducing","bullet"]'::jsonb`),
  dayCountConvention: text('day_count_convention', { enum: ['365', '360'] }).notNull().default('365'),
  installmentDayOfMonth: integer('installment_day_of_month').notNull().default(1),
  roundingMode: text('rounding_mode', { enum: ['round', 'floor', 'ceil'] }).notNull().default('round'),
  shiftToWorkingDay: boolean('shift_to_working_day').notNull().default(true),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('emi_schedule_settings_org_uniq').on(table.organizationId),
]);

// =============================================
// LOAN PROVISIONING SETTINGS (Module 6 — singular org settings)
// One row per organization. Defines the days-overdue bands that classify a
// loan into loan_accounts.npl_status and the provision % applied to the
// outstanding principal for each band.
//
// These values are DELIBERATELY configurable rather than compiled in: the
// regulator's classification thresholds change, and a co-operative may be
// held to stricter internal policy. Nothing in the servicing engine may
// hardcode a band or a percentage — it must read this row.
//
// Bands are read as inclusive lower bounds on days overdue and must be
// monotonically increasing (Watchlist < Substandard < Doubtful < Loss).
// A loan below watchlist_min_days is 'Pass'.
// =============================================
export const loanProvisioningSettings = pgTable('loan_provisioning_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  // Days-overdue lower bound for each classification band.
  watchlistMinDays: integer('watchlist_min_days').notNull().default(31),
  substandardMinDays: integer('substandard_min_days').notNull().default(91),
  doubtfulMinDays: integer('doubtful_min_days').notNull().default(181),
  lossMinDays: integer('loss_min_days').notNull().default(366),
  // Provision rate applied to outstanding principal, per band (percent).
  passProvisionPercent: numeric('pass_provision_percent', { precision: 6, scale: 3 }).notNull().default('1'),
  watchlistProvisionPercent: numeric('watchlist_provision_percent', { precision: 6, scale: 3 }).notNull().default('5'),
  substandardProvisionPercent: numeric('substandard_provision_percent', { precision: 6, scale: 3 }).notNull().default('25'),
  doubtfulProvisionPercent: numeric('doubtful_provision_percent', { precision: 6, scale: 3 }).notNull().default('50'),
  lossProvisionPercent: numeric('loss_provision_percent', { precision: 6, scale: 3 }).notNull().default('100'),
  // Days after an installment's due date before penalty starts accruing.
  penaltyGraceDays: integer('penalty_grace_days').notNull().default(0),
  // When true, an arrears run also rewrites npl_status / provision_amount.
  autoClassifyOnAccrual: boolean('auto_classify_on_accrual').notNull().default(true),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('loan_provisioning_settings_org_uniq').on(table.organizationId),
]);

// =============================================
// LOAN PRODUCT INTEREST RATES (Module 6 — time-series §5)
// Historical record of every rate applied to a loan product. The open row
// (effective_to_bs IS NULL) is the current effective rate; the product's
// interest_rate column is a convenience snapshot of that open row.
// =============================================
export const loanProductInterestRates = pgTable('loan_product_interest_rates', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  loanProductId: uuid('loan_product_id').notNull().references(() => loanProducts.id, { onDelete: 'cascade' }),
  rate: numeric('rate', { precision: 6, scale: 4 }).notNull(),
  effectiveFromBs: text('effective_from_bs').notNull(),
  effectiveToBs: text('effective_to_bs'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('loan_prod_rate_org_product_idx').on(table.organizationId, table.loanProductId),
]);

// =============================================
// LOAN PRODUCT ELIGIBILITY (Module 6)
// Which member types / member categories may take a given loan product.
// Empty eligibility = open to all. Both are linked to Module 3 catalogs.
// =============================================
export const loanProductEligibleMemberTypes = pgTable('loan_product_eligible_member_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  loanProductId: uuid('loan_product_id').notNull().references(() => loanProducts.id, { onDelete: 'cascade' }),
  memberTypeId: uuid('member_type_id').notNull().references(() => memberTypes.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('loan_prod_elig_type_uniq').on(table.organizationId, table.loanProductId, table.memberTypeId),
  index('loan_prod_elig_type_org_idx').on(table.organizationId, table.loanProductId),
]);

export const loanProductEligibleMemberCategories = pgTable('loan_product_eligible_member_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  loanProductId: uuid('loan_product_id').notNull().references(() => loanProducts.id, { onDelete: 'cascade' }),
  memberCategoryId: uuid('member_category_id').notNull().references(() => memberCategories.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('loan_prod_elig_cat_uniq').on(table.organizationId, table.loanProductId, table.memberCategoryId),
  index('loan_prod_elig_cat_org_idx').on(table.organizationId, table.loanProductId),
]);

// =============================================
// GUARANTOR TYPES (Module 6 — configurable catalog)
// Guarantor type catalog, org-scoped and admin-configurable (NOT hardcoded).
// Every Loan Product can permit a subset of these types and attach per-type
// rules (min/max count + coverage %) via loan_product_guarantor_rules.
// =============================================
export const guarantorTypes = pgTable('guarantor_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
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
}, (table) => [
  uniqueIndex('guarantor_types_org_code_uniq').on(table.organizationId, table.code),
  index('guarantor_types_org_active_idx').on(table.organizationId, table.isActive),
]);

// =============================================
// LOAN PRODUCT GUARANTOR RULES (Module 6 — per-product)
// A Loan Product permits a guarantor type when a row exists here. Each row
// carries the per-type rules: minimum/maximum number of guarantors of that
// type and the loan coverage % they must collectively guarantee. When no rule
// exists the org-wide guarantor_settings defaults apply.
// =============================================
export const loanProductGuarantorRules = pgTable('loan_product_guarantor_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  loanProductId: uuid('loan_product_id').notNull().references(() => loanProducts.id, { onDelete: 'cascade' }),
  guarantorTypeId: uuid('guarantor_type_id').notNull().references(() => guarantorTypes.id, { onDelete: 'cascade' }),
  minCount: integer('min_count').notNull().default(1),
  maxCount: integer('max_count'),
  coveragePercent: numeric('coverage_percent', { precision: 5, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('loan_prod_guarantor_rule_uniq').on(table.organizationId, table.loanProductId, table.guarantorTypeId),
  index('loan_prod_guarantor_rule_org_idx').on(table.organizationId, table.loanProductId),
]);
