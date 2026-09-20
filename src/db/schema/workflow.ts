/**
 * Workflow & Approvals Schema (Module 2)
 * approval_levels, approval_matrix, role_approval_limits
 *
 * All tables scoped to organization_id for multi-tenancy.
 * The request_type enum matches approval_requests in ./operations.
 */
import {
  pgTable, text, numeric, boolean, timestamp, integer, uuid, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations, roles } from './auth';

export const APPROVAL_REQUEST_TYPES = [
  'Loan_Approval',
  'Expense_Claim',
  'Voucher_Post',
  'Share_Transfer',
  'Member_Exit',
  'Savings_Withdrawal',
] as const;

// =============================================
// APPROVAL LEVELS (hierarchy of sign-off tiers)
// =============================================
export const approvalLevels = pgTable('approval_levels', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  levelNo: integer('level_no').notNull(),                // 1 … N (ascending authority)
  roleKey: text('role_key').notNull(),                   // e.g. 'loan_officer', 'branch_manager'
  roleLabel: text('role_label').notNull(),               // e.g. 'Loan Officer / Accountant'
  minAmount: numeric('min_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  maxAmount: numeric('max_amount', { precision: 15, scale: 2 }),   // null = no upper bound
  scope: text('scope').notNull().default(''),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('approval_levels_org_no_uniq').on(table.organizationId, table.levelNo),
  index('approval_levels_org_idx').on(table.organizationId),
]);

// =============================================
// APPROVAL MATRIX (dual-control signatory rules)
// =============================================
export const approvalMatrix = pgTable('approval_matrix', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  requestType: text('request_type', { enum: APPROVAL_REQUEST_TYPES }).notNull(),
  thresholdMin: numeric('threshold_min', { precision: 15, scale: 2 }).notNull().default('0'),
  thresholdMax: numeric('threshold_max', { precision: 15, scale: 2 }),   // null = above thresholdMin with no cap
  signatory1Role: text('signatory1_role').notNull(),
  signatory2Role: text('signatory2_role'),                              // null = single signatory
  smsNotify: boolean('sms_notify').notNull().default(false),
  active: boolean('active').notNull().default(true),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('approval_matrix_org_type_idx').on(table.organizationId, table.requestType),
]);

// =============================================
// ROLE APPROVAL LIMITS (per-role, per-module min/max)
// =============================================
export const roleApprovalLimits = pgTable('role_approval_limits', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  moduleKey: text('module_key').notNull(),               // e.g. 'loan_writeoff', 'voucher_posting'
  minAmount: numeric('min_amount', { precision: 15, scale: 2 }),
  maxAmount: numeric('max_amount', { precision: 15, scale: 2 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('role_approval_limits_role_module_uniq').on(table.roleId, table.moduleKey),
  index('role_approval_limits_org_idx').on(table.organizationId),
]);
