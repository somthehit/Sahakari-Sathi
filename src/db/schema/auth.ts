/**
 * Organizations & Users Schema
 * Multi-tenant auth: Organization Code + Username + Password
 */
import { pgTable, uuid, varchar, text, timestamp, boolean, integer, pgEnum, jsonb, index, uniqueIndex, numeric, time } from 'drizzle-orm/pg-core';

// --- Enums ---
export const orgStatusEnum = pgEnum('org_status', ['Active', 'Suspended', 'Inactive']);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'Trial',
  'Active',
  'Suspended',
  'Past_Due',
  'Cancelled',
  'Expired',
]);



export const employeeStatusEnum = pgEnum('employee_status', [
  'Draft',
  'Pending Approval',
  'Active',
  'On Leave',
  'Suspended',
  'Resigned',
  'Retired',
  'Terminated'
]);

export const userStatusEnum = pgEnum('user_status', [
  'Draft',
  'Pending Activation',
  'Active',
  'Locked',
  'Suspended',
  'Archived'
]);

// =============================================
// ORGANIZATIONS TABLE
// =============================================
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),

  // General
  organizationCode: varchar('organization_code', { length: 12 }).notNull().unique(), // e.g. SOFTLAB, PRAGATI
  organizationName: text('organization_name').notNull(),
  shortName: varchar('short_name', { length: 20 }),
  organizationType: varchar('organization_type', { length: 50 }).notNull().default('SACCOS'), // SACCOS, Cooperative, School, College, NGO, Hospital, Business
  slug: varchar('slug', { length: 100 }).unique(), // everest-saccos

  // Location
  province: varchar('province', { length: 50 }),
  district: varchar('district', { length: 50 }),
  municipality: varchar('municipality', { length: 100 }),
  wardNo: integer('ward_no'),
  address: text('address'),

  // Contact
  phone: varchar('phone', { length: 20 }),
  mobile: varchar('mobile', { length: 20 }),
  email: varchar('email', { length: 150 }),
  website: varchar('website', { length: 200 }),

  // Government Registration
  govtRegNo: varchar('govt_reg_no', { length: 100 }),  // Dept. of Cooperatives / Registrar

  // Ownership & Audit
  ownerUserId: uuid('owner_user_id'), // Super Admin assigns after creation
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),

  // Status
  status: orgStatusEnum('status').default('Active').notNull(),
  isVerified: boolean('is_verified').default(false).notNull(), // Organization KYC

  // Soft Delete
  deletedAt: timestamp('deleted_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  deletedAtIdx: index('organizations_deleted_at_idx').on(table.deletedAt),
}));

// =============================================
// ORGANIZATION VERTICAL SPLIT (1:1 child tables)
// Cold/wide columns moved off the hot organizations row:
//   profiles       -> legal, branding, localization
//   subscriptions  -> licensing / plan
//   limits         -> feature flags & quota
// =============================================
export const organizationProfiles = pgTable('organization_profiles', {
  organizationId: uuid('organization_id').primaryKey().references(() => organizations.id, { onDelete: 'cascade' }),

  // Legal
  pan: varchar('pan', { length: 20 }),
  registrationNo: varchar('registration_no', { length: 50 }),
  registrationDate: timestamp('registration_date'),

  // Branding
  logoUrl: text('logo_url'),
  faviconUrl: text('favicon_url'),
  themeColor: varchar('theme_color', { length: 7 }).default('#10b981'), // Tailwind emerald-600

  // Localization
  timezone: varchar('timezone', { length: 100 }).default('Asia/Kathmandu').notNull(),
  locale: varchar('locale', { length: 10 }).default('ne').notNull(), // ne, en, hi
  currencyCode: varchar('currency_code', { length: 10 }).default('NPR').notNull(),
  dateFormat: varchar('date_format', { length: 20 }).default('BS').notNull(), // BS, AD
  fiscalYear: varchar('fiscal_year', { length: 20 }),

  // Share Settings — org-wide default share scheme (canonical pricing config).
  // FK enforced in migration 0025 only (avoids circular import with ./shares).
  defaultShareSchemeId: uuid('default_share_scheme_id'),

  // Org default share certificate format used by the Share page for printing.
  // FK enforced in migration 0027 only (avoids circular import with ./shares).
  defaultCertificateFormatId: uuid('default_certificate_format_id'),

  // Savings Settings — org-wide default savings product (canonical config).
  // FK enforced in migration 0033 only (avoids circular import with ./savings).
  defaultSavingProductId: uuid('default_saving_product_id'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const organizationSubscriptions = pgTable('organization_subscriptions', {
  organizationId: uuid('organization_id').primaryKey().references(() => organizations.id, { onDelete: 'cascade' }),

  // Licensing
  subscriptionPlan: varchar('subscription_plan', { length: 50 }).default('Trial').notNull(), // Trial, Starter, Growth, Enterprise
  subscriptionStatus: subscriptionStatusEnum('subscription_status').default('Trial').notNull(),
  subscriptionStart: timestamp('subscription_start'),
  subscriptionEnd: timestamp('subscription_end'),
  trialEnd: timestamp('trial_end'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  subscriptionStatusIdx: index('organization_subscriptions_status_idx').on(table.subscriptionStatus),
}));

export const organizationLimits = pgTable('organization_limits', {
  organizationId: uuid('organization_id').primaryKey().references(() => organizations.id, { onDelete: 'cascade' }),

  // Features & Limits
  isMultiBranch: boolean('is_multi_branch').default(false).notNull(),
  aiEnabled: boolean('ai_enabled').default(false).notNull(),
  aiCredit: integer('ai_credit').default(0).notNull(),
  storageLimitMb: integer('storage_limit_mb').default(5120).notNull(),
  storageUsedMb: integer('storage_used_mb').default(0).notNull(),
  maxMembers: integer('max_members').default(1000).notNull(),
  maxUsers: integer('max_users').default(50).notNull(),
  maxBranches: integer('max_branches').default(5).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// =============================================
// DYNAMIC RBAC & HR LOOKUP TABLES
// =============================================
export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 20 }), // e.g., 'ACC', 'CSH' — unique per org
  name: varchar('name', { length: 100 }).notNull(), // e.g., 'Cashier', 'Manager'
  nameNepali: varchar('name_nepali', { length: 100 }),
  description: text('description'),
  permissions: text('permissions').notNull(), // JSON string of permission keys
  isSystem: boolean('is_system').default(false).notNull(), // True for default roles (can't be deleted)
  status: varchar('status', { length: 20 }).default('Active').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('roles_org_code_uniq').on(table.organizationId, table.code),
  uniqueIndex('roles_org_name_uniq').on(table.organizationId, table.name),
  index('roles_org_status_idx').on(table.organizationId, table.status),
]);

// =============================================
// ROLE PERMISSIONS (granular RBAC grants)
// One row per (role, category, action).
// Categories: Dashboard, Members, Savings, Loans, Accounting, Shares,
//             Inventory, HR, Reports, Admin, Settings, Audit
// Actions:    view, create, edit, delete, approve, export, print, assign
// =============================================
export const rolePermissions = pgTable('role_permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  category: varchar('category', { length: 50 }).notNull(), // e.g. 'Members'
  key: varchar('key', { length: 100 }).notNull(),          // e.g. 'members'
  action: varchar('action', { length: 30 }).notNull(),     // e.g. 'view', 'create'
  granted: boolean('granted').default(true).notNull(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('role_perm_role_key_action_uniq').on(table.roleId, table.key, table.action),
  index('role_perm_org_idx').on(table.organizationId),
  index('role_perm_role_idx').on(table.roleId),
]);

// =============================================
// ROLE DATA SCOPE
// One row per role controlling record-level access.
// scope:  'all'   — every record across branches/users
//         'branch' — only the user's assigned branch
//         'self'   — only records the user created
// actions: JSON object of generic capability toggles (view/create/edit/
//          delete/approve/export) applied within the scope.
// =============================================
export const roleDataScopes = pgTable('role_data_scopes', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  scope: varchar('scope', { length: 20 }).default('all').notNull(),
  actions: jsonb('actions').notNull(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('role_data_scope_role_uniq').on(table.roleId),
  index('role_data_scope_org_idx').on(table.organizationId),
]);

export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 50 }),
  name: varchar('name', { length: 100 }).notNull(), // e.g., 'Loans', 'Accounts'
  headOfDepartment: text('head_of_department'),
  branchId: uuid('branch_id'),
  staffCount: integer('staff_count').default(0).notNull(),
  budgetAllocation: numeric('budget_allocation', { precision: 15, scale: 2 }).default('0').notNull(),
  usedBudget: numeric('used_budget', { precision: 15, scale: 2 }).default('0').notNull(),
  description: text('description'),
  costCenterCode: varchar('cost_center_code', { length: 50 }),
  status: varchar('status', { length: 20 }).default('Active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('departments_org_code_uniq').on(table.organizationId, table.code),
  index('departments_org_idx').on(table.organizationId),
]);

export const designations = pgTable('designations', {
  id: uuid('id').primaryKey().defaultRandom(),
  departmentId: uuid('department_id').notNull().references(() => departments.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(), // e.g., 'Senior Accountant'
  code: varchar('code', { length: 50 }), // e.g., 'DSG-CRED-01'
  reportsToId: uuid('reports_to_id').references(() => designations.id),
  jobGrade: varchar('job_grade', { length: 50 }), // e.g., 'Level 2', 'Grade L3'
  minSalary: numeric('min_salary', { precision: 15, scale: 2 }).default('0').notNull(),
  maxSalary: numeric('max_salary', { precision: 15, scale: 2 }).default('0').notNull(),
  allowanceEligible: boolean('allowance_eligible').default(false).notNull(),
  approvalLimit: numeric('approval_limit', { precision: 15, scale: 2 }).default('0').notNull(),
  systemAccessRole: varchar('system_access_role', { length: 50 }), // e.g., 'Maker', 'Checker', 'Approver'
  pearlsRole: varchar('pearls_role', { length: 100 }), // regulatory/compliance tag
  employmentType: varchar('employment_type', { length: 50 }), // Full-time | Contract | Probation
  description: text('description'), // responsibilities / KPIs
  status: varchar('status', { length: 20 }).default('Active').notNull(),
});

// =============================================
// EMPLOYEES TABLE (HR Module)
// =============================================
export const employees = pgTable('employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  employeeCode: varchar('employee_code', { length: 50 }).notNull(),
  firstName: varchar('first_name', { length: 50 }).notNull(),
  middleName: varchar('middle_name', { length: 50 }),
  lastName: varchar('last_name', { length: 50 }).notNull(),
  gender: varchar('gender', { length: 20 }),
  dob: timestamp('dob'),
  citizenshipNumber: varchar('citizenship_number', { length: 50 }),
  passportNumber: varchar('passport_number', { length: 50 }),
  panNumber: varchar('pan_number', { length: 20 }),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 150 }).notNull(),
  photoUrl: text('photo_url'),
  category: varchar('category', { length: 50 }).notNull(), // 'Financial Staff' or 'Non Financial Staff'
  isFinancialStaff: boolean('is_financial_staff').default(false).notNull(),
  departmentId: uuid('department_id').references(() => departments.id),
  designationId: uuid('designation_id').references(() => designations.id),
  experience: text('experience'),
  branchId: uuid('branch_id'), // Will link to branches table
  enableErpLogin: boolean('enable_erp_login').default(false).notNull(),
  joiningDate: timestamp('joining_date'),
  employmentType: varchar('employment_type', { length: 50 }),
  // Payroll master fields (migrated from the legacy `staff` table)
  basicSalary: numeric('basic_salary', { precision: 12, scale: 2 }).notNull().default('0'),
  allowances: numeric('allowances', { precision: 12, scale: 2 }).notNull().default('0'),
  pfContributionPercent: numeric('pf_contribution_percent', { precision: 5, scale: 2 }).notNull().default('10'),
  status: employeeStatusEnum('status').default('Draft').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// =============================================
// USERS TABLE (multi-tenant)
// Username is unique PER ORGANIZATION, not globally.
// SOFTLAB/admin and ABCSC/admin are both valid.
// Linked to Employee record.
// =============================================
export const orgUsers = pgTable('org_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'set null' }),
  username: varchar('username', { length: 30 }).notNull(), // unique within org
  email: varchar('email', { length: 150 }), 
  emailVerified: boolean('email_verified').default(false).notNull(),
  authUserId: varchar('auth_user_id', { length: 128 }).unique(),
  requiresPasswordChange: boolean('requires_password_change').default(true).notNull(),
  // Temporary password tracking
  isTemporaryPassword: boolean('is_temporary_password').default(true).notNull(),
  temporaryPassword: boolean('temporary_password').default(false).notNull(),
  passwordCreatedAt: timestamp('password_created_at'),
  passwordExpiresAt: timestamp('password_expires_at'),
  passwordChangedAt: timestamp('password_changed_at'),
  // First-time security setup tracking
  securitySetupCompleted: boolean('security_setup_completed').default(false).notNull(),
  securitySetupCompletedAt: timestamp('security_setup_completed_at'),
  mobileVerified: boolean('mobile_verified').default(false).notNull(),
  mobileNumber: varchar('mobile_number', { length: 20 }),
  securityQuestionsCompleted: boolean('security_questions_completed').default(false).notNull(),
  passwordChanged: boolean('password_changed').default(false).notNull(),
  firstLoginCompleted: boolean('first_login_completed').default(false).notNull(),
  securityScore: integer('security_score').default(0).notNull(),
  authMethods: jsonb('auth_methods'), // e.g. ['password', 'phone', 'google.com']
  roleId: uuid('role_id').references(() => roles.id),
  branchId: uuid('branch_id'), // Branch-scoped ERP access (no FK — avoids branches/auth cycle)
  activeBranchId: uuid('active_branch_id'), // Current branch context for branch-scoped operations (no FK — avoids branches/auth cycle)
  dataScope: varchar('data_scope', { length: 30 }).default('own'),
  avatarUrl: text('avatar_url'),
  lastLoginAt: timestamp('last_login_at'),
  lastActivityAt: timestamp('last_activity_at'),
  status: userStatusEnum('status').default('Pending Activation').notNull(),
  createdBy: uuid('created_by'), // ID of HR/Admin who created this user
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// =============================================
// SECURITY CONFIGURATION TABLES
// =============================================
export const securityQuestions = pgTable('security_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }), // Null = Global question
  questionText: text('question_text').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userSecurityAnswers = pgTable('user_security_answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => orgUsers.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => securityQuestions.id, { onDelete: 'cascade' }),
  // Salted scrypt digest: scrypt$<N>$<r>$<p>$<saltHex>$<digestHex>. Answers are
  // verified, never displayed, so a one-way KDF is correct; the column name is
  // retained from the original declaration. See src/api/utils/secretHash.ts.
  encryptedAnswer: text('encrypted_answer').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Org-wide security policy edited on SETUPS → Admin → Security.
 *
 * Enforcement is deliberately partial and each column says which it is:
 *  - Password rules + expiry: ENFORCED in AuthController.changePassword.
 *  - Session timeout: ENFORCED client-side as an idle timeout.
 *  - enforce2FA / ipWhitelist: stored intent only, NOT enforced. There is no
 *    OTP delivery channel in this codebase, and req.ip is the proxy address
 *    unless TRUST_PROXY is configured — enforcing either would lock a tenant
 *    out of its own installation. The UI labels them as not yet active.
 */
export const organizationSecuritySettings = pgTable('organization_security_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().unique().references(() => organizations.id, { onDelete: 'cascade' }),
  minPasswordLength: integer('min_password_length').default(8).notNull(),
  requireSpecialChar: boolean('require_special_char').default(true).notNull(),
  requireNumber: boolean('require_number').default(true).notNull(),
  requireUppercase: boolean('require_uppercase').default(true).notNull(),
  requireLowercase: boolean('require_lowercase').default(true).notNull(),
  /** 0 = passwords never expire. */
  passwordExpiryDays: integer('password_expiry_days').default(90).notNull(),
  /** 0 = no idle timeout. */
  sessionTimeoutMinutes: integer('session_timeout_minutes').default(15).notNull(),
  enforce2fa: boolean('enforce_2fa').default(false).notNull(),
  ipWhitelist: text('ip_whitelist'),
  ipWhitelistEnabled: boolean('ip_whitelist_enabled').default(false).notNull(),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// =============================================
// SUPER ADMIN TABLE (platform-level only)
// =============================================
export const superAdmins = pgTable('super_admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  authUserId: varchar('auth_user_id', { length: 128 }).unique(),
  username: varchar('username', { length: 30 }).notNull().unique(),
  email: varchar('email', { length: 150 }).notNull(),
  fullName: varchar('full_name', { length: 150 }).notNull(),
  status: userStatusEnum('status').default('Active').notNull(),
  lastLogin: timestamp('last_login'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// =============================================
// PLATFORM ROLES (super-admin level, no org)
// Mirrors the tenant `roles`/`role_permissions`/`role_data_scopes` tables so
// platform-wide access control can be managed from the Roles & Access page.
// =============================================
export const platformRoles = pgTable('platform_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 20 }), // e.g. 'PLT_ADMIN'
  name: varchar('name', { length: 100 }).notNull(),
  nameNepali: varchar('name_nepali', { length: 100 }),
  description: text('description'),
  permissions: text('permissions').notNull(), // JSON string of permission keys
  isSystem: boolean('is_system').default(false).notNull(),
  status: varchar('status', { length: 20 }).default('Active').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('platform_roles_code_uniq').on(table.code),
  uniqueIndex('platform_roles_name_uniq').on(table.name),
  index('platform_roles_status_idx').on(table.status),
]);

export const platformRolePermissions = pgTable('platform_role_permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  roleId: uuid('role_id').notNull().references(() => platformRoles.id, { onDelete: 'cascade' }),
  category: varchar('category', { length: 50 }).notNull(),
  key: varchar('key', { length: 100 }).notNull(),
  action: varchar('action', { length: 30 }).notNull(),
  granted: boolean('granted').default(true).notNull(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('plat_role_perm_role_key_action_uniq').on(table.roleId, table.key, table.action),
  index('plat_role_perm_role_idx').on(table.roleId),
]);

export const platformRoleDataScopes = pgTable('platform_role_data_scopes', {
  id: uuid('id').primaryKey().defaultRandom(),
  roleId: uuid('role_id').notNull().references(() => platformRoles.id, { onDelete: 'cascade' }),
  scope: varchar('scope', { length: 20 }).default('all').notNull(),
  actions: jsonb('actions').notNull(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('plat_role_data_scope_role_uniq').on(table.roleId),
]);

// =============================================
// AUDIT LOG TABLE (tracks every login/logout)
// =============================================
export const authAuditLogs = pgTable('auth_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id'),
  userId: uuid('user_id'),
  username: varchar('username', { length: 30 }),
  organizationCode: varchar('organization_code', { length: 12 }),
  event: varchar('event', { length: 50 }).notNull(), // 'LOGIN', 'LOGOUT', 'FAILED_LOGIN', 'LOCKED', 'PASSWORD_RESET'
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  success: boolean('success').default(true).notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// =============================================
// EMAIL QUEUE TABLE (outbound transactional emails)
// =============================================
export const emailQueueStatusEnum = pgEnum('email_queue_status', [
  'Pending',
  'Sent',
  'Failed',
  'Retrying',
]);

export const emailQueue = pgTable('email_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => orgUsers.id, { onDelete: 'set null' }),
  toEmail: varchar('to_email', { length: 150 }).notNull(),
  toName: varchar('to_name', { length: 150 }),
  subject: varchar('subject', { length: 255 }).notNull(),
  templateType: varchar('template_type', { length: 50 }).notNull(), // 'welcome', 'password_reset', 'verification'
  templateData: jsonb('template_data'),   // data passed to the template
  status: emailQueueStatusEnum('status').default('Pending').notNull(),
  attemptCount: integer('attempt_count').default(0).notNull(),
  lastAttemptAt: timestamp('last_attempt_at'),
  sentAt: timestamp('sent_at'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// =============================================
// WORKING DAYS & HOURS TABLE (per-weekday, org-scoped)
// 0 = Sunday … 6 = Saturday (Nepal week convention)
// =============================================
export const workingDays = pgTable('working_days', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(),
  isWorkingDay: boolean('is_working_day').default(true).notNull(),
  openTime: time('open_time'),
  closeTime: time('close_time'),
  halfDay: boolean('half_day').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('working_days_org_day_idx').on(table.organizationId, table.dayOfWeek),
]);
