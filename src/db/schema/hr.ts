/**
 * HR Schema
 * attendance, leave_requests, payroll, staff_documents
 * All tables scoped to organization_id for multi-tenancy.
 * employees, departments, designations already live in auth.ts
 */
import {
  pgTable, text, numeric, integer, boolean, timestamp, uuid, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { organizations, employees } from './auth';
import { branches } from './branches';

// =============================================
// ATTENDANCE
// =============================================
export const attendance = pgTable('attendance', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id),
  dateBs: text('date_bs').notNull(),
  dateAd: text('date_ad').notNull(),
  checkIn: timestamp('check_in'),
  checkOut: timestamp('check_out'),
  status: text('status', {
    enum: ['Present', 'Absent', 'Half_Day', 'Holiday', 'Leave', 'Late']
  }).notNull().default('Present'),
  remarks: text('remarks'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('attendance_org_emp_date_uniq').on(table.organizationId, table.employeeId, table.dateBs),
  index('attendance_org_date_idx').on(table.organizationId, table.dateBs),
  index('attendance_org_emp_idx').on(table.organizationId, table.employeeId),
]);

// =============================================
// LEAVE REQUESTS
// =============================================
export const leaveRequests = pgTable('leave_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  leaveType: text('leave_type', {
    enum: ['Annual', 'Sick', 'Maternity', 'Paternity', 'Unpaid', 'Other']
  }).notNull(),
  fromDateBs: text('from_date_bs').notNull(),
  toDateBs: text('to_date_bs').notNull(),
  totalDays: integer('total_days').notNull(),
  reason: text('reason').notNull(),
  status: text('status', {
    enum: ['Pending', 'Approved', 'Rejected', 'Cancelled']
  }).notNull().default('Pending'),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('leave_org_emp_idx').on(table.organizationId, table.employeeId),
  index('leave_org_status_idx').on(table.organizationId, table.status),
  index('leave_org_from_date_idx').on(table.organizationId, table.fromDateBs),
]);

// =============================================
// PAYROLL
// =============================================
export const payroll = pgTable('payroll', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id),
  fiscalYear: text('fiscal_year').notNull(),
  payPeriodBs: text('pay_period_bs').notNull(),      // e.g., "2081-04"
  basicSalary: numeric('basic_salary', { precision: 12, scale: 2 }).notNull(),
  allowances: numeric('allowances', { precision: 12, scale: 2 }).notNull().default('0'),
  overtime: numeric('overtime', { precision: 12, scale: 2 }).notNull().default('0'),
  grossSalary: numeric('gross_salary', { precision: 12, scale: 2 }).notNull(),
  pfEmployee: numeric('pf_employee', { precision: 12, scale: 2 }).notNull().default('0'),
  pfEmployer: numeric('pf_employer', { precision: 12, scale: 2 }).notNull().default('0'),
  taxDeduction: numeric('tax_deduction', { precision: 12, scale: 2 }).notNull().default('0'),
  otherDeductions: numeric('other_deductions', { precision: 12, scale: 2 }).notNull().default('0'),
  netSalary: numeric('net_salary', { precision: 12, scale: 2 }).notNull(),
  paymentMode: text('payment_mode', { enum: ['Cash', 'Bank_Transfer'] }).notNull(),
  paymentDateBs: text('payment_date_bs'),
  status: text('status', { enum: ['Draft', 'Approved', 'Paid'] }).notNull().default('Draft'),
  voucherNo: text('voucher_no'),
  remarks: text('remarks'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('payroll_org_emp_period_uniq').on(table.organizationId, table.employeeId, table.payPeriodBs),
  index('payroll_org_period_idx').on(table.organizationId, table.payPeriodBs),
  index('payroll_org_emp_idx').on(table.organizationId, table.employeeId),
  index('payroll_org_status_idx').on(table.organizationId, table.status),
]);

// =============================================
// STAFF DOCUMENTS
// =============================================
export const staffDocuments = pgTable('staff_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  documentType: text('document_type', {
    enum: ['Citizenship', 'Passport', 'PAN', 'Contract', 'Certificate', 'Other']
  }).notNull(),
  documentTitle: text('document_title').notNull(),
  fileUrl: text('file_url').notNull(),
  fileName: text('file_name').notNull(),
  fileSize: integer('file_size'),
  mimeType: text('mime_type'),
  expiryDateBs: text('expiry_date_bs'),
  uploadedBy: uuid('uploaded_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('staff_doc_org_emp_idx').on(table.organizationId, table.employeeId),
  index('staff_doc_org_type_idx').on(table.organizationId, table.documentType),
]);
