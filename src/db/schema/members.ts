/**
 * Members Schema
 * Slim identity ledger + 1:1 segmented child tables:
 *   members                    -> identity, search, status, 4-eye workflow
 *   member_kyc_profiles        -> KYC documents, addresses, economic profile
 *   member_financial_profiles  -> balances, accruals, collection mapping
 *   member_family              -> household & nominee structure
 *   member_portal_settings     -> portal / settlement integration
 *   member_biometrics          -> encrypted template URL references
 *   member_documents           -> document vault rows
 */
import { pgTable, text, numeric, boolean, timestamp, integer, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { organizations } from './auth';
import { branches } from './branches';
import { memberTypes, memberCategories, occupations, educationLevels, nomineeTypes, relationshipTypes } from './memberSettings';
import { groups } from './groups';

export const members = pgTable('members', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').notNull().references(() => branches.id),
  memberNo: text('member_no').notNull(),
  fullName: text('full_name').notNull(),
  searchName: text('search_name').notNull(),
  nameNepali: text('name_nepali'),
  gender: text('gender', { enum: ['Male', 'Female', 'Other'] }).notNull(),
  dobBs: text('dob_bs').notNull(),
  dobAd: text('dob_ad'),
  phone: text('phone').notNull(),
  secondaryPhone: text('secondary_phone'),
  email: text('email'),
  membershipDateBs: text('membership_date_bs').notNull(),
  // Org-scoped classification catalogs (Member Settings / Module 3).
  memberTypeId: uuid('member_type_id').notNull().references(() => memberTypes.id),
  memberCategoryId: uuid('member_category_id').notNull().references(() => memberCategories.id),
  // Optional community group (समूह) — only for Member Types flagged is_group_type.
  groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
  memberTags: text('member_tags').array(),
  kycStatus: text('kyc_status', {
    enum: ['Not_Started', 'Pending', 'Under_Review', 'Verified', 'Expired', 'Rejected', 'Resubmission_Required'],
  }).notNull().default('Pending'),
  status: text('status', {
    enum: ['Draft', 'Pending_KYC', 'Pending_Approval', 'Active', 'Dormant', 'Blacklisted', 'Suspended', 'Closed', 'Deceased', 'Transferred', 'Merged', 'Inactive', 'Terminated'],
  }).notNull().default('Active'),
  isMinor: boolean('is_minor').default(false),

  // 4-Eye Principle Approval Workflow Engine
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  submittedBy: uuid('submitted_by'),
  verifiedBy: uuid('verified_by'),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at'),
  rejectedBy: uuid('rejected_by'),
  rejectedReason: text('rejected_reason'),

  // Soft Delete Paradigm
  deletedAt: timestamp('deleted_at'),
  deletedBy: uuid('deleted_by'),
}, (table) => [
  uniqueIndex('members_org_member_no_uniq').on(table.organizationId, table.memberNo),
  index('members_org_search_idx').on(table.organizationId, table.searchName),
  index('members_org_phone_idx').on(table.organizationId, table.phone),
  index('members_org_status_idx').on(table.organizationId, table.status),
  index('members_branch_idx').on(table.branchId),
  index('members_member_type_idx').on(table.memberTypeId),
  index('members_member_category_idx').on(table.memberCategoryId),
  index('members_group_idx').on(table.groupId),
]);

export const memberKycProfiles = pgTable('member_kyc_profiles', {
  memberId: uuid('member_id').primaryKey().references(() => members.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  // Identity Documentation
  citizenshipNo: text('citizenship_no').notNull(),
  citizenshipIssueDistrict: text('citizenship_issue_district'),
  citizenshipIssueDateBs: text('citizenship_issue_date_bs'),

  // Photo & Signature
  photoUrl: text('photo_url'),
  signatureUrl: text('signature_url'),
  citizenshipFrontUrl: text('citizenship_front_url'),
  citizenshipBackUrl: text('citizenship_back_url'),

  // Current address (quick access)
  address: text('address'),
  district: text('district'),

  // Permanent Address
  permProvince: text('perm_province'),
  permDistrict: text('perm_district'),
  permMunicipality: text('perm_municipality'),
  permWard: text('perm_ward'),
  permTole: text('perm_tole'),

  // Temporary Address
  tempProvince: text('temp_province'),
  tempDistrict: text('temp_district'),
  tempMunicipality: text('temp_municipality'),
  tempWard: text('temp_ward'),
  tempTole: text('temp_tole'),

  // Economic Profile
  occupationId: uuid('occupation_id').references(() => occupations.id),
  educationLevelId: uuid('education_level_id').references(() => educationLevels.id),
  employerName: text('employer_name'),
  annualIncome: numeric('annual_income', { precision: 15, scale: 2 }),
  sourceOfFunds: text('source_of_funds'),
  isPep: boolean('is_pep').default(false),
  pepDetails: text('pep_details'),
  ethicsAccepted: boolean('ethics_accepted').default(false),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('member_kyc_org_citizenship_idx').on(table.organizationId, table.citizenshipNo),
  index('member_kyc_occupation_idx').on(table.occupationId),
  index('member_kyc_education_idx').on(table.educationLevelId),
]);

export const memberFinancialProfiles = pgTable('member_financial_profiles', {
  memberId: uuid('member_id').primaryKey().references(() => members.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  // Structured Account Balances
  totalShares: integer('total_shares').notNull().default(0),
  shareAmount: numeric('share_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  totalSavingsBalance: numeric('total_savings_balance', { precision: 15, scale: 2 }).notNull().default('0'),
  totalLoanBalance: numeric('total_loan_balance', { precision: 15, scale: 2 }).notNull().default('0'),
  fixedDepositBalance: numeric('fixed_deposit_balance', { precision: 15, scale: 2 }).notNull().default('0'),
  recurringDepositBalance: numeric('recurring_deposit_balance', { precision: 15, scale: 2 }).notNull().default('0'),

  // Accruals & Receivables Risk Matrix
  overdueAmount: numeric('overdue_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  interestReceivable: numeric('interest_receivable', { precision: 15, scale: 2 }).notNull().default('0'),
  interestPayable: numeric('interest_payable', { precision: 15, scale: 2 }).notNull().default('0'),
  nplStatus: text('npl_status', { enum: ['Good', 'Watchlist', 'Substandard', 'Doubtful', 'Loss'] }).notNull().default('Good'),

  // Field Operations Mapping
  collectionAgentId: uuid('collection_agent_id'),
  preferredCollectionDay: integer('preferred_collection_day'),
  collectionRoute: text('collection_route'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('member_fin_org_member_idx').on(table.organizationId, table.memberId),
]);

export const memberFamily = pgTable('member_family', {
  memberId: uuid('member_id').primaryKey().references(() => members.id, { onDelete: 'cascade' }),
  familyId: text('family_id'),
  isFamilyHead: boolean('is_family_head').default(false),

  maritalStatus: text('marital_status', { enum: ['Single', 'Married', 'Divorced', 'Widowed'] }),
  bloodGroup: text('blood_group'),
  fatherName: text('father_name'),
  fatherNameNepali: text('father_name_nepali'),
  motherName: text('mother_name'),
  motherNameNepali: text('mother_name_nepali'),
  grandfatherName: text('grandfather_name'),
  grandfatherNameNepali: text('grandfather_name_nepali'),
  spouseName: text('spouse_name'),
  spouseNameNepali: text('spouse_name_nepali'),

  guardianName: text('guardian_name'),
  guardianNameNepali: text('guardian_name_nepali'),
  guardianRelation: text('guardian_relation'),
  guardianCitizenshipNo: text('guardian_citizenship_no'),
  guardianPhone: text('guardian_phone'),
  dependentsCount: integer('dependents_count'),

  // Nominee
  nomineeName: text('nominee_name'),
  nomineeNameNepali: text('nominee_name_nepali'),
  nomineeRelationId: uuid('nominee_relation_id').references(() => relationshipTypes.id),
  nomineeTypeId: uuid('nominee_type_id').references(() => nomineeTypes.id),
  nomineePhone: text('nominee_phone'),
  nomineeCitizenshipNo: text('nominee_citizenship_no'),
  nomineeSharePct: numeric('nominee_share_pct', { precision: 5, scale: 2 }),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('member_family_nominee_relation_idx').on(table.nomineeRelationId),
  index('member_family_nominee_type_idx').on(table.nomineeTypeId),
]);

export const memberPortalSettings = pgTable('member_portal_settings', {
  memberId: uuid('member_id').primaryKey().references(() => members.id, { onDelete: 'cascade' }),
  portalEnabled: boolean('portal_enabled').notNull().default(false),
  emailVerified: boolean('email_verified').notNull().default(false),
  mobileVerified: boolean('mobile_verified').notNull().default(false),
  lastLogin: timestamp('last_login'),

  // Third-Party Core Settlement Details
  bankName: text('bank_name'),
  bankAccount: text('bank_account'),
  walletIdEsewa: text('wallet_id_esewa'),
  walletIdKhalti: text('wallet_id_khalti'),
  walletIdFonepay: text('wallet_id_fonepay'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const memberBiometrics = pgTable('member_biometrics', {
  memberId: uuid('member_id').primaryKey().references(() => members.id, { onDelete: 'cascade' }),
  fingerprintTemplateUrl: text('fingerprint_template_url'),
  faceTemplateUrl: text('face_template_url'),
  irisTemplateUrl: text('iris_template_url'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const memberDocuments = pgTable('member_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  documentType: text('document_type', {
    enum: ['Citizenship_Front', 'Citizenship_Back', 'Photo', 'Signature', 'Other']
  }).notNull(),
  fileUrl: text('file_url').notNull(),
  fileName: text('file_name').notNull(),
  fileSize: integer('file_size'),
  mimeType: text('mime_type'),
  uploadedBy: text('uploaded_by'),
  uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
});
