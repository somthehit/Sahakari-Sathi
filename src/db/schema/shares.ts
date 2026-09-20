/**
 * Share Management Schema
 * share_types, share_holdings, share_transactions, share_certificates
 * All tables scoped to organization_id for multi-tenancy.
 */
import {
  pgTable, text, numeric, integer, boolean, timestamp, uuid, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { members } from './members';
import { branches } from './branches';
import { vouchers } from './accounting';

// =============================================
// SHARE TYPES (products defined by the org)
// =============================================
export const shareTypes = pgTable('share_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),                       // unique per org
  name: text('name').notNull(),
  faceValue: numeric('face_value', { precision: 10, scale: 2 }).notNull().default('100'),
  minShares: integer('min_shares').notNull().default(1),
  maxShares: integer('max_shares'),
  isTransferable: boolean('is_transferable').notNull().default(true),
  isPledgeable: boolean('is_pledgeable').notNull().default(true),
  dividendRate: numeric('dividend_rate', { precision: 6, scale: 4 }).default('0'),
  // Distinctive kitta (कित्ता) sequence — embedded per class (not a separate setup).
  kittaPrefix: text('kitta_prefix').notNull().default(''),
  kittaStartBase: integer('kitta_start_base'),
  currentKittaPointer: integer('current_kitta_pointer').notNull().default(0),
  maxAllowedKitta: integer('max_allowed_kitta'),
  autoSequence: boolean('auto_sequence').notNull().default(true),
  status: text('status', { enum: ['Active', 'Inactive'] }).notNull().default('Active'),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('share_type_org_code_uniq').on(table.organizationId, table.code),
  index('share_type_org_idx').on(table.organizationId),
]);

// =============================================
// SHARE HOLDINGS
// =============================================
export const shareHoldings = pgTable('share_holdings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  shareTypeId: uuid('share_type_id').notNull().references(() => shareTypes.id),
  memberId: uuid('member_id').notNull().references(() => members.id),
  memberName: text('member_name').notNull(),
  memberNo: text('member_no').notNull(),
  numberOfShares: integer('number_of_shares').notNull().default(0),
  faceValuePerShare: numeric('face_value_per_share', { precision: 10, scale: 2 }).notNull().default('100'),
  totalValue: numeric('total_value', { precision: 15, scale: 2 }).notNull(),
  issuedDateBs: text('issued_date_bs').notNull(),
  status: text('status', { enum: ['Active', 'Transferred', 'Surrendered'] }).notNull().default('Active'),
  branchId: uuid('branch_id').references(() => branches.id),
  // Auto-opening provenance (FK enforced in migration 0025 only — avoids a
  // circular import with ./shareSettings).
  shareSchemeId: uuid('share_scheme_id'),
  openedVia: text('opened_via', { enum: ['auto', 'manual'] }).notNull().default('manual'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('share_holding_org_member_idx').on(table.organizationId, table.memberId),
  index('share_holding_org_status_idx').on(table.organizationId, table.status),
]);

// =============================================
// SHARE TRANSACTIONS
// =============================================
export const shareTransactions = pgTable('share_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  holdingId: uuid('holding_id').notNull().references(() => shareHoldings.id),
  memberId: uuid('member_id').notNull().references(() => members.id),
  shareTypeId: uuid('share_type_id').notNull().references(() => shareTypes.id),
  transactionType: text('transaction_type', {
    enum: ['Issue', 'Transfer_In', 'Transfer_Out', 'Surrender', 'Dividend']
  }).notNull(),
  numberOfShares: integer('number_of_shares').notNull(),
  amountPerShare: numeric('amount_per_share', { precision: 10, scale: 2 }).notNull(),
  totalAmount: numeric('total_amount', { precision: 15, scale: 2 }).notNull(),
  voucherNo: text('voucher_no'),
  dateBs: text('date_bs').notNull(),
  dateAd: text('date_ad').notNull(),
  remarks: text('remarks'),
  processedBy: text('processed_by').notNull(),
  branchId: uuid('branch_id').references(() => branches.id),
  // Scheme that priced this transaction (FK enforced in migration 0025 only).
  shareSchemeId: uuid('share_scheme_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('share_txn_org_member_idx').on(table.organizationId, table.memberId),
  index('share_txn_org_date_idx').on(table.organizationId, table.dateBs),
  index('share_txn_org_type_idx').on(table.organizationId, table.transactionType),
]);

// =============================================
// SHARE TRANSFERS (registry — one row per transfer)
// =============================================
export const shareTransfers = pgTable('share_transfers', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  transferNo: text('transfer_no').notNull(),           // e.g. ST-2083-0001 (unique per org)
  voucherId: uuid('voucher_id').references(() => vouchers.id),
  voucherNo: text('voucher_no').notNull(),             // GL journal voucher number
  certificateNo: text('certificate_no'),               // share certificate issued to transferee
  fromHoldingId: uuid('from_holding_id').notNull().references(() => shareHoldings.id),
  fromMemberId: uuid('from_member_id').notNull().references(() => members.id),
  fromMemberName: text('from_member_name').notNull(),
  fromMemberNo: text('from_member_no').notNull(),
  toHoldingId: uuid('to_holding_id').notNull().references(() => shareHoldings.id),
  toMemberId: uuid('to_member_id').notNull().references(() => members.id),
  toMemberName: text('to_member_name').notNull(),
  toMemberNo: text('to_member_no').notNull(),
  shareTypeId: uuid('share_type_id').notNull().references(() => shareTypes.id),
  shareTypeName: text('share_type_name').notNull(),
  faceValuePerShare: numeric('face_value_per_share', { precision: 10, scale: 2 }).notNull(),
  numberOfShares: integer('number_of_shares').notNull(),
  totalAmount: numeric('total_amount', { precision: 15, scale: 2 }).notNull(),
  dateBs: text('date_bs').notNull(),
  dateAd: text('date_ad').notNull(),
  status: text('status', { enum: ['Completed', 'Cancelled'] }).notNull().default('Completed'),
  remarks: text('remarks'),
  processedBy: text('processed_by').notNull(),
  branchId: uuid('branch_id').references(() => branches.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('share_transfer_org_no_uniq').on(table.organizationId, table.transferNo),
  index('share_transfer_org_date_idx').on(table.organizationId, table.dateBs),
  index('share_transfer_org_from_idx').on(table.organizationId, table.fromMemberId),
  index('share_transfer_org_to_idx').on(table.organizationId, table.toMemberId),
]);

// =============================================
// SHARE ACCOUNTS (auto-provisioned master — 1 per member)
// Created lazily on the first share issuance; also opened explicitly via the
// "Open Shares Account" (हकवाला) flow, which additionally writes nominees.
// =============================================
export const shareAccounts = pgTable('share_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => members.id),
  accountNo: text('account_no').notNull(),               // e.g. SHA-{memberNo} (unique per org)
  totalShares: integer('total_shares').notNull().default(0),
  totalCapitalAmount: numeric('total_capital_amount', { precision: 15, scale: 2 }).notNull().default('0.00'),
  status: text('status', { enum: ['Active', 'Suspended', 'Closed'] }).notNull().default('Active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('share_account_org_member_uniq').on(table.organizationId, table.memberId),
  uniqueIndex('share_account_org_no_uniq').on(table.organizationId, table.accountNo),
  index('share_account_org_status_idx').on(table.organizationId, table.status),
]);

// =============================================
// SHARE ACCOUNT NOMINEES (हकवाला)
// One or more nominees per share account; percentages must total exactly 100%.
// =============================================
export const shareAccountNominees = pgTable('share_account_nominees', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  shareAccountId: uuid('share_account_id').notNull().references(() => shareAccounts.id, { onDelete: 'cascade' }),
  fullName: text('full_name').notNull(),
  relation: text('relation').notNull(),
  citizenshipNo: text('citizenship_no'),
  contactNo: text('contact_no'),
  photoUrl: text('photo_url'),
  sharePercentage: numeric('share_percentage', { precision: 5, scale: 2 }).notNull(),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('san_org_account_idx').on(table.organizationId, table.shareAccountId),
  index('san_org_primary_idx').on(table.organizationId, table.isPrimary),
]);

// =============================================
// ORG SHARE SETTINGS (authorized capital / kitta ceilings + running totals)
// One row per org. total_issued_kitta / total_issued_capital are running
// totals maintained ATOMICALLY inside the same transaction as every issuance
// or return, so ceiling checks are O(1) and serialize on this single row
// (SELECT ... FOR UPDATE) instead of racing on SUM() aggregates.
// =============================================
export const organizationShareSettings = pgTable('organization_share_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  authorizedCapitalCeiling: numeric('authorized_capital_ceiling', { precision: 14, scale: 2 }).notNull(),
  authorizedTotalKitta: integer('authorized_total_kitta').notNull(),
  defaultFaceValue: numeric('default_face_value', { precision: 8, scale: 2 }).default('100.00'),
  // Minimum kitta a member must take when opening their FIRST share account.
  minRequiredKitta: integer('min_required_kitta').notNull().default(10),
  // Running totals — updated inside the issue/return transaction (see migration 0042).
  totalIssuedKitta: integer('total_issued_kitta').default(0).notNull(),
  totalIssuedCapital: numeric('total_issued_capital', { precision: 14, scale: 2 }).default('0.00').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('org_share_settings_org_idx').on(table.organizationId),
]);

// =============================================
// ORG-WIDE KITTA COUNTERS (sequential share certificate kitta numbering)
// One row per org; serialized under a row lock so consecutive issues never
// hand out overlapping kitta ranges.
// =============================================
export const organizationKittaCounters = pgTable('organization_kitta_counters', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  lastKittaNo: integer('last_kitta_no').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('org_kitta_counter_org_uniq').on(table.organizationId),
]);

// =============================================
// SHARE CERTIFICATES
// =============================================
export const shareCertificates = pgTable('share_certificates', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  certificateNo: text('certificate_no').notNull(),    // unique per org
  holdingId: uuid('holding_id').notNull().references(() => shareHoldings.id),
  memberId: uuid('member_id').notNull().references(() => members.id),
  shareTypeId: uuid('share_type_id').notNull().references(() => shareTypes.id),
  numberOfShares: integer('number_of_shares').notNull(),
  issuedDateBs: text('issued_date_bs').notNull(),
  status: text('status', { enum: ['Active', 'Cancelled', 'Replaced'] }).notNull().default('Active'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('share_cert_org_no_uniq').on(table.organizationId, table.certificateNo),
  index('share_cert_org_member_idx').on(table.organizationId, table.memberId),
]);
