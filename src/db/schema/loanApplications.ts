/**
 * Loan Applications — origination tables for the enhanced Credit Appraisal Wizard.
 * Covers: applications, collaterals, guarantors, documents, document templates.
 * All tables scoped to organization_id for multi-tenancy.
 */
import {
  pgTable, text, numeric, boolean, timestamp, integer, uuid, varchar, index, jsonb,
} from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { members } from './members';
import { loanProducts } from './loans';

// =============================================
// LOAN APPLICATIONS
// =============================================
export const loanApplications = pgTable('loan_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  borrowerId: uuid('borrower_id').notNull().references(() => members.id),
  coBorrowerId: uuid('co_borrower_id').references(() => members.id),
  loanProductId: uuid('loan_product_id').notNull().references(() => loanProducts.id),
  requestedAmount: numeric('requested_amount', { precision: 15, scale: 2 }).notNull(),
  approvedAmount: numeric('approved_amount', { precision: 15, scale: 2 }),
  tenureMonths: integer('tenure_months').notNull(),
  purposeCategory: varchar('purpose_category', { length: 50 }),
  purposeDetail: text('purpose_detail'),
  repaymentFrequency: varchar('repayment_frequency', { length: 20 }).default('monthly'),
  gracePeriodDays: integer('grace_period_days').default(0),
  disbursementBankAccountId: uuid('disbursement_bank_account_id'),
  cibCheckStatus: varchar('cib_check_status', { length: 20 }),
  cibCheckedAt: timestamp('cib_checked_at'),
  cibCheckedBy: uuid('cib_checked_by'),
  ltvRatio: numeric('ltv_ratio', { precision: 6, scale: 4 }),
  riskGrade: varchar('risk_grade', { length: 10 }),
  calculatedEmi: numeric('calculated_emi', { precision: 15, scale: 2 }),
  status: varchar('status', { length: 30 }).default('draft'),
  // draft → docs_pending → submitted → manager_review → approved → tamsuk_pending → disbursed → rejected
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at'),
  customGlMappings: jsonb('custom_gl_mappings').default({}),
  remarks: text('remarks'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('loan_app_org_idx').on(table.organizationId),
  index('loan_app_borrower_idx').on(table.borrowerId),
  index('loan_app_status_idx').on(table.status),
]);

// =============================================
// LOAN COLLATERALS — use `loanCollaterals` from './loans' (single canonical definition)
// Both files previously defined pgTable('loan_collaterals', ...) which caused a
// Node.js ESM star-export conflict. The canonical table is in loans.ts.
// =============================================

// =============================================
// LOAN GUARANTORS
// =============================================
export const loanGuarantors = pgTable('loan_guarantors', {
  id: uuid('id').primaryKey().defaultRandom(),
  loanApplicationId: uuid('loan_application_id').notNull().references(() => loanApplications.id, { onDelete: 'cascade' }),
  guarantorMemberId: uuid('guarantor_member_id').references(() => members.id),
  fullName: text('full_name').notNull(),
  relationshipToBorrower: text('relationship_to_borrower'),
  citizenshipNo: text('citizenship_no'),
  address: text('address'),
  monthlyIncome: numeric('monthly_income', { precision: 15, scale: 2 }),
  incomeSource: text('income_source'),
  signatureCollected: boolean('signature_collected').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// =============================================
// LOAN DOCUMENTS
// =============================================
export const loanDocuments = pgTable('loan_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  loanApplicationId: uuid('loan_application_id').notNull().references(() => loanApplications.id, { onDelete: 'cascade' }),
  documentType: varchar('document_type', { length: 50 }).notNull(),
  documentStage: varchar('document_stage', { length: 20 }).default('uploaded'),
  fileUrl: text('file_url').notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
  uploadedBy: uuid('uploaded_by'),
  verified: boolean('verified').default(false),
  verifiedBy: uuid('verified_by'),
  verifiedAt: timestamp('verified_at'),
  remarks: text('remarks'),
});

// =============================================
// LOAN DOCUMENT TEMPLATES
// =============================================
export const loanDocumentTemplates = pgTable('loan_document_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  templateType: varchar('template_type', { length: 30 }).notNull(),
  templateContent: text('template_content').notNull(),
  version: integer('version').default(1),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
