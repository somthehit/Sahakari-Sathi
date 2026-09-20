/**
 * Share Settings Schema (SETUPS → Share Settings)
 *
 * share_classes              — lookup catalog for share class designations
 * share_schemes              — CANONICAL share product/pricing/opening config
 * dividend_rules             — dividend withholding / bonus parameters
 * share_certificate_formats  — printable certificate template config
 * share_provisioning_queue   — non-fatal auto-opening audit/retry queue
 *
 * Multi-tenancy: every table is scoped to organization_id.
 * Code is stored UPPERCASE (normalized before insert/update in the controller).
 *
 * Architectural decision: share_schemes is the single canonical financial
 * source for share pricing & opening. member_types keeps its financial
 * columns for eligibility/display only.
 *
 * The FK from organization_profiles.default_share_scheme_id and the
 * share_holdings/share_transactions.share_scheme_id columns are enforced in
 * the database migration only — the Drizzle columns are declared without
 * `.references()` to avoid a circular module import between ./auth and ./shares.
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { members } from './members';
import { shareTypes } from './shares';

// ---------------------------------------------------------------------------
// Shared column factory — keeps the catalogs DRY (mirrors memberSettings.ts).
// ---------------------------------------------------------------------------
const baseColumns = {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 20 }).notNull(),         // stored UPPERCASE
  name: varchar('name', { length: 100 }).notNull(),
  nameNepali: varchar('name_nepali', { length: 100 }),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  isSystem: boolean('is_system').notNull().default(false), // system records can't be deleted
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
};

import { chartOfAccounts } from './accounting';

// ---------------------------------------------------------------------------
// 1. Share Classes
// ---------------------------------------------------------------------------
export const shareClasses = pgTable('share_classes', {
  ...baseColumns,
  shareType: text('share_type').notNull().default('ORDINARY'),
  targetMemberType: text('target_member_type').notNull().default('ALL'),
  parValue: numeric('par_value', { precision: 12, scale: 2 }).notNull().default('100.00'),
  minKittaPerPurchase: integer('min_kitta_per_purchase').notNull().default(10),
  maxKittaPerMember: integer('max_kitta_per_member'),
  glAccountId: uuid('gl_account_id').references(() => chartOfAccounts.id, { onDelete: 'set null' }),
  isDividendEligible: boolean('is_dividend_eligible').notNull().default(true),
  maxDividendRatePct: numeric('max_dividend_rate_pct', { precision: 5, scale: 2 }),
}, (table) => [
  uniqueIndex('share_classes_org_code_uniq').on(table.organizationId, table.code),
  index('share_classes_org_active_idx').on(table.organizationId, table.isActive),
]);

// ---------------------------------------------------------------------------
// 2. Share Schemes (canonical product / pricing / opening config)
// ---------------------------------------------------------------------------
export const shareSchemes = pgTable('share_schemes', {
  ...baseColumns,
  shareClassId: uuid('share_class_id').references(() => shareClasses.id, { onDelete: 'set null' }),
  shareTypeId: uuid('share_type_id').references(() => shareTypes.id, { onDelete: 'set null' }),
  shareValuePerUnit: numeric('share_value_per_unit', { precision: 12, scale: 2 }).notNull().default('0.00'),
  minOpenUnits: integer('min_open_units').notNull().default(1),
  maxUnits: integer('max_units'),
  isTransferable: boolean('is_transferable').notNull().default(true),
  dividendRate: numeric('dividend_rate', { precision: 6, scale: 4 }).notNull().default('0.0000'),
  minOpeningAmount: numeric('min_opening_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
}, (table) => [
  uniqueIndex('share_schemes_org_code_uniq').on(table.organizationId, table.code),
  index('share_schemes_org_active_idx').on(table.organizationId, table.isActive),
  index('share_schemes_org_class_idx').on(table.organizationId, table.shareClassId),
]);

// ---------------------------------------------------------------------------
// 3. Dividend Rules
// ---------------------------------------------------------------------------
export const dividendRules = pgTable('dividend_rules', {
  ...baseColumns,
  taxWithholdingPercent: numeric('tax_withholding_percent', { precision: 6, scale: 2 }).notNull().default('5.00'),
  targetDividendPercent: numeric('target_dividend_percent', { precision: 6, scale: 2 }).notNull().default('12.50'),
  bonusShareRatio: varchar('bonus_share_ratio', { length: 20 }).notNull().default('1:10'),
  dividendPolicy: text('dividend_policy'),
  // Per-fiscal-year config (config-only; no distribution engine yet).
  // Values are admin-configurable, not hardcoded — confirm regulatory
  // thresholds with the org's auditor before enforcing them.
  fiscalYear: varchar('fiscal_year', { length: 20 }),
  approvalStatus: text('approval_status').notNull().default('draft'), // draft | approved (AGM gate)
  distributionMode: text('distribution_mode').notNull().default('cash'), // cash | bonus_share | member_choice
  minimumHoldingPeriodMonths: integer('minimum_holding_period_months').notNull().default(0),
}, (table) => [
  uniqueIndex('dividend_rules_org_code_uniq').on(table.organizationId, table.code),
  index('dividend_rules_org_active_idx').on(table.organizationId, table.isActive),
]);

// ---------------------------------------------------------------------------
// 4. Share Certificate Formats
// ---------------------------------------------------------------------------
export const shareCertificateFormats = pgTable('share_certificate_formats', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 20 }).notNull(),         // stored UPPERCASE
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  isSystem: boolean('is_system').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  certificatePrefix: varchar('certificate_prefix', { length: 10 }).notNull().default('SC-'),
  startingNumber: integer('starting_number').notNull().default(1),
  includeLogo: boolean('include_logo').notNull().default(true),
  headerText: text('header_text'),
  footerText: text('footer_text'),
  fieldsJson: text('fields_json'),
  // Full visual CertificateConfig JSON produced by the ShareCertificateDesigner
  // (theme, statements, signatories, draggable elements, …). Parsed by the
  // Share page when rendering a member's share certificate.
  configJson: text('config_json'),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('share_certificate_formats_org_code_uniq').on(table.organizationId, table.code),
  index('share_certificate_formats_org_active_idx').on(table.organizationId, table.isActive),
]);

// ---------------------------------------------------------------------------
// 5. Share Provisioning Queue (non-fatal auto-opening audit/retry trail)
// ---------------------------------------------------------------------------
export const shareProvisioningQueue = pgTable('share_provisioning_queue', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  memberNo: text('member_no').notNull(),
  shareSchemeId: uuid('share_scheme_id').notNull().references(() => shareSchemes.id, { onDelete: 'set null' }),
  shareTypeId: uuid('share_type_id'),
  status: text('status').notNull().default('Pending'),   // Pending | Success | Failed
  attempts: integer('attempts').notNull().default(0),
  errorMessage: text('error_message'),
  openedHoldingId: uuid('opened_holding_id'),
  openedVoucherNo: text('opened_voucher_no'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at'),
}, (table) => [
  uniqueIndex('share_provisioning_queue_org_member_scheme_uniq').on(table.organizationId, table.memberId, table.shareSchemeId),
  index('share_provisioning_queue_org_status_idx').on(table.organizationId, table.status),
]);
