/**
 * Signature Verification Schema (Module: Savings & Deposits — withdrawal security)
 *
 * Three tables back the instrument-verification pipeline for teller withdrawals:
 *
 *   member_signature_specimens       — per-account signature specimens captured at
 *                                      account opening (or later). Supports joint
 *                                      accounts with one specimen per signatory and
 *                                      the account's signing rule (any / all / specific).
 *   signature_verification_logs      — an immutable event trail for every comparison:
 *                                      score, both images, machine verdict, and the
 *                                      final disposition (auto-approved, teller
 *                                      override, supervisor override, rejected) with
 *                                      the reviewer + mandatory override reason.
 *   savings_withdrawal_instruments   — consumed-instrument register. Pre-numbered slip
 *                                      serials must never be reused; cheque leaves get a
 *                                      second line of defense (fingerprint of
 *                                      number + amount + date) on top of leaf status.
 *
 * All tables are scoped to organization_id (and branch_id) for multi-tenant isolation.
 */
import {
  pgTable, text, numeric, boolean, timestamp, integer, index, uuid, uniqueIndex, varchar,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { branches } from './branches';
import { members } from './members';
import { savingsAccounts, savingsTransactions } from './savings';

// =============================================
// MEMBER SIGNATURE SPECIMENS
// =============================================
export const memberSignatureSpecimens = pgTable('member_signature_specimens', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => savingsAccounts.id, { onDelete: 'cascade' }),
  /** Display name of the signatory (defaults to the member's name). */
  signatoryName: text('signatory_name'),
  imageUrl: text('image_url').notNull(),
  /** 'any' = either signatory may sign · 'all' = joint signature required · 'specific' = only this signatory. */
  signingRule: varchar('signing_rule', { length: 20 }).notNull().default('any'),
  isActive: boolean('is_active').notNull().default(true),
  capturedById: uuid('captured_by_id'),
  /** Source: 'member.kyc' (existing member signature on file) | 'open_account' | 'teller' | 'admin'. */
  capturedVia: text('captured_via', { enum: ['member.kyc', 'open_account', 'teller', 'admin'] }).notNull().default('open_account'),
  capturedAt: timestamp('captured_at').notNull().defaultNow(),
}, (table) => [
  index('mss_org_member_idx').on(table.organizationId, table.memberId),
  index('mss_org_account_idx').on(table.organizationId, table.accountId),
]);

// =============================================
// SIGNATURE VERIFICATION LOGS (immutable audit trail)
// =============================================
export const signatureVerificationLogs = pgTable('signature_verification_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  accountId: uuid('account_id').notNull().references(() => savingsAccounts.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  /** Null when the comparison ran against the member's on-file signature (no specimen row yet). */
  specimenId: uuid('specimen_id').references(() => memberSignatureSpecimens.id, { onDelete: 'set null' }),
  presentedImageUrl: text('presented_image_url').notNull(),
  specimenImageUrl: text('specimen_image_url').notNull(),
  matchScore: numeric('match_score', { precision: 5, scale: 2 }).notNull(),
  /** Machine verdict at comparison time: auto_approved | teller_review (orange band) | blocked (hard). */
  machineVerdict: varchar('machine_verdict', { length: 20 }).notNull(),
  /** Final disposition, filled when the withdrawal posts: auto_approved | teller_override | supervisor_override | rejected. */
  outcome: varchar('outcome', { length: 20 }),
  reviewedByUserId: uuid('reviewed_by_user_id'),
  overrideReason: text('override_reason'),
  /** Linked to the savings_transactions row once the withdrawal posts. */
  withdrawalId: uuid('withdrawal_id').references(() => savingsTransactions.id, { onDelete: 'set null' }),
  voucherNo: text('voucher_no'),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('svl_org_account_idx').on(table.organizationId, table.accountId),
  index('svl_org_member_idx').on(table.organizationId, table.memberId),
  index('svl_org_withdrawal_idx').on(table.organizationId, table.withdrawalId),
  index('svl_org_created_idx').on(table.organizationId, table.createdAt),
]);

// =============================================
// SAVINGS WITHDRAWAL INSTRUMENTS (consumed-instrument register)
// =============================================
export const savingsWithdrawalInstruments = pgTable('savings_withdrawal_instruments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  accountId: uuid('account_id').notNull().references(() => savingsAccounts.id, { onDelete: 'cascade' }),
  accountNo: text('account_no').notNull(),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  memberName: text('member_name').notNull(),
  type: text('type', { enum: ['slip', 'cheque', 'passbook'] }).notNull(),
  /** Slip serial number / cheque number / passbook last-line pointer. */
  reference: text('reference').notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  dateBs: text('date_bs').notNull(),
  voucherNo: text('voucher_no'),
  transactionId: uuid('transaction_id').references(() => savingsTransactions.id, { onDelete: 'set null' }),
  createdById: uuid('created_by_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  // A slip serial (or any instrument reference) is single-use per org — blocks
  // photocopied / re-presented slips outright.
  uniqueIndex('swi_org_type_reference_uniq').on(table.organizationId, table.type, table.reference),
  index('swi_org_account_idx').on(table.organizationId, table.accountId),
  index('swi_org_type_date_idx').on(table.organizationId, table.type, table.dateBs),
]);