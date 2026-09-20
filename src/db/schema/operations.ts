/**
 * Operations Schema
 * approval_requests, audit_logs, activity_logs, customer_tickets
 *
 * NOTE: fixed_assets → assets.ts
 *       collection_routes / field_collection_entries → collection.ts
 *       ai_chat_history → ai.ts
 *
 * All tables scoped to organization_id for multi-tenancy.
 */
import {
  pgTable, text, numeric, boolean, timestamp, integer, index, uuid, uniqueIndex, jsonb,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { members } from './members';
import { branches } from './branches';

// =============================================
// APPROVAL REQUESTS (4-eye workflow)
// =============================================
export const approvalRequests = pgTable('approval_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  requestType: text('request_type', {
    enum: ['Loan_Approval', 'Expense_Claim', 'Voucher_Post', 'Share_Transfer', 'Member_Exit', 'Savings_Withdrawal', 'Loan_WriteOff']
  }).notNull(),
  referenceNo: text('reference_no').notNull(),
  requestedBy: uuid('requested_by').notNull(),
  requestedDateBs: text('requested_date_bs').notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  description: text('description').notNull(),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  status: text('status', { enum: ['Pending', 'Approved', 'Rejected'] }).notNull().default('Pending'),
  approvedBy: text('approved_by'),
  remarks: text('remarks'),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('approval_org_status_idx').on(table.organizationId, table.status),
  index('approval_org_type_idx').on(table.organizationId, table.requestType),
  index('approval_branch_idx').on(table.branchId),
]);

// =============================================
// AUDIT LOGS (denormalized org_id for RLS)
// =============================================
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  timestampBs: text('timestamp_bs').notNull(),
  timestampAd: text('timestamp_ad').notNull(),
  userName: text('user_name').notNull(),
  userRole: text('user_role').notNull(),
  userId: text('user_id'),
  module: text('module').notNull(),
  action: text('action').notNull(),
  details: text('details').notNull(),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),
  ipAddress: text('ip_address').notNull(),
  userAgent: text('user_agent'),
  branchId: uuid('branch_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('audit_org_module_idx').on(table.organizationId, table.module),
  index('audit_org_user_idx').on(table.organizationId, table.userId),
  index('audit_org_date_idx').on(table.organizationId, table.timestampBs),
]);

// =============================================
// ACTIVITY LOGS (fine-grained user actions)
// =============================================
export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id'),
  userName: text('user_name'),
  action: text('action').notNull(),                  // e.g. 'CREATE', 'UPDATE', 'DELETE', 'VIEW'
  resourceType: text('resource_type').notNull(),     // e.g. 'loan', 'member', 'voucher'
  resourceId: uuid('resource_id'),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  branchId: uuid('branch_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('activity_org_resource_idx').on(table.organizationId, table.resourceType, table.resourceId),
  index('activity_org_user_idx').on(table.organizationId, table.userId),
  index('activity_org_date_idx').on(table.organizationId, table.createdAt),
]);

// =============================================
// CUSTOMER TICKETS (support)
// =============================================
export const customerTickets = pgTable('customer_tickets', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  ticketNo: text('ticket_no').notNull(),              // unique per org
  memberId: uuid('member_id').notNull().references(() => members.id),
  memberName: text('member_name').notNull(),
  category: text('category', {
    enum: ['Passbook Error', 'ATM/Card', 'Loan Query', 'Interest Dispute', 'General']
  }).notNull(),
  subject: text('subject').notNull(),
  description: text('description').notNull(),
  assignedTo: text('assigned_to').notNull(),
  priority: text('priority', { enum: ['Low', 'Medium', 'High'] }).notNull(),
  status: text('status', { enum: ['Open', 'In Progress', 'Resolved'] }).notNull().default('Open'),
  createdDateBs: text('created_date_bs').notNull(),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('ticket_org_no_uniq').on(table.organizationId, table.ticketNo),
  index('ticket_org_status_idx').on(table.organizationId, table.status),
  index('ticket_org_member_idx').on(table.organizationId, table.memberId),
]);
