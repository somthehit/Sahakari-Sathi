/**
 * Collection Schema
 * collection_routes, collection_agents, collection_transactions, collection_reconciliation
 * All tables scoped to organization_id for multi-tenancy.
 */
import {
  pgTable, text, numeric, boolean, integer, timestamp, uuid, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { members } from './members';
import { branches } from './branches';

// =============================================
// COLLECTION AGENTS
// =============================================
export const collectionAgents = pgTable('collection_agents', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  agentCode: text('agent_code').notNull(),            // unique per org
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull(),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  assignedMembersCount: integer('assigned_members_count').notNull().default(0),
  status: text('status', { enum: ['Active', 'Inactive', 'Suspended'] }).notNull().default('Active'),
  userId: uuid('user_id'),                            // link to org_users
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('agent_org_code_uniq').on(table.organizationId, table.agentCode),
  index('agent_org_idx').on(table.organizationId),
  index('agent_branch_idx').on(table.branchId),
]);

// =============================================
// COLLECTION ROUTES
// =============================================
export const collectionRoutes = pgTable('collection_routes', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),                       // unique per org
  routeName: text('route_name').notNull(),
  agentId: uuid('agent_id').notNull().references(() => collectionAgents.id),
  agentName: text('agent_name').notNull(),
  assignedMembersCount: integer('assigned_members_count').notNull().default(0),
  todayTargetAmount: numeric('today_target_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  todayCollectedAmount: numeric('today_collected_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  status: text('status', { enum: ['Pending', 'In_Progress', 'Reconciled'] }).notNull().default('Pending'),
  branchId: uuid('branch_id').references(() => branches.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('route_org_code_uniq').on(table.organizationId, table.code),
  index('route_org_agent_idx').on(table.organizationId, table.agentId),
  index('route_org_branch_idx').on(table.organizationId, table.branchId),
]);

// =============================================
// COLLECTION TRANSACTIONS
// =============================================
export const collectionTransactions = pgTable('collection_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  routeId: uuid('route_id').notNull().references(() => collectionRoutes.id),
  agentId: uuid('agent_id').notNull().references(() => collectionAgents.id),
  agentName: text('agent_name').notNull(),
  memberId: uuid('member_id').notNull().references(() => members.id),
  memberName: text('member_name').notNull(),
  accountNo: text('account_no').notNull(),
  accountType: text('account_type', { enum: ['Savings', 'Loan_EMI', 'Share'] }).notNull(),
  collectedAmount: numeric('collected_amount', { precision: 15, scale: 2 }).notNull(),
  collectionTimeBs: text('collection_time_bs').notNull(),
  receiptNo: text('receipt_no').notNull(),            // unique per org
  reconciledWithVault: boolean('reconciled_with_vault').default(false),
  voucherNo: text('voucher_no'),
  branchId: uuid('branch_id').references(() => branches.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('col_txn_org_receipt_uniq').on(table.organizationId, table.receiptNo),
  index('col_txn_org_route_idx').on(table.organizationId, table.routeId),
  index('col_txn_org_agent_idx').on(table.organizationId, table.agentId),
  index('col_txn_org_member_idx').on(table.organizationId, table.memberId),
  index('col_txn_org_date_idx').on(table.organizationId, table.collectionTimeBs),
]);

// =============================================
// COLLECTION RECONCILIATION
// =============================================
export const collectionReconciliation = pgTable('collection_reconciliation', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  routeId: uuid('route_id').notNull().references(() => collectionRoutes.id),
  agentId: uuid('agent_id').notNull().references(() => collectionAgents.id),
  reconciliationDateBs: text('reconciliation_date_bs').notNull(),
  totalCollected: numeric('total_collected', { precision: 15, scale: 2 }).notNull().default('0'),
  totalDeposited: numeric('total_deposited', { precision: 15, scale: 2 }).notNull().default('0'),
  variance: numeric('variance', { precision: 15, scale: 2 }).notNull().default('0'),
  status: text('status', { enum: ['Pending', 'Reconciled', 'Disputed'] }).notNull().default('Pending'),
  reconciledBy: uuid('reconciled_by'),
  reconciledAt: timestamp('reconciled_at'),
  remarks: text('remarks'),
  branchId: uuid('branch_id').references(() => branches.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('col_recon_org_date_idx').on(table.organizationId, table.reconciliationDateBs),
  index('col_recon_org_agent_idx').on(table.organizationId, table.agentId),
  index('col_recon_org_status_idx').on(table.organizationId, table.status),
]);
