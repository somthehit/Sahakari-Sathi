import { Router } from 'express';
import { MemberController, createMemberSchema } from '../controllers/MemberController';
import { StorageController } from '../controllers/StorageController';
import { BranchController } from '../controllers/BranchController';
import { DepartmentController, createDepartmentSchema, updateDepartmentSchema } from '../controllers/DepartmentController';
import { DesignationController, createDesignationSchema, updateDesignationSchema } from '../controllers/DesignationController';
import { WorkingDayController } from '../controllers/WorkingDayController';
import { FiscalYearController } from '../controllers/FiscalYearController';
import { ExchangeRateController } from '../controllers/ExchangeRateController';
import { LocalizationController } from '../controllers/LocalizationController';
import { StaffController } from '../controllers/StaffController';
import { SavingsController } from '../controllers/SavingsController';
import {
  SavingsDepositController,
  openAccountSchema,
  depositSchema,
  batchDepositSchema,
  withdrawalSchema,
  withdrawalDecisionSchema,
  printPassbookSchema,
  bounceChequeDepositSchema,
  chequeTransferSchema,
  updateAccountSchema,
  batchInterestPostingSchema,
} from '../controllers/SavingsDepositController';
import { ShareController, createShareTypeSchema, issueSharesSchema, transferSharesSchema, surrenderSharesSchema, shareTransactionRequestSchema, openShareAccountSchema } from '../controllers/ShareController';
import { LoanController, applyLoanSchema, checkEligibilitySchema, repayLoanSchema } from '../controllers/LoanController';
import {
  LoanServicingController,
  disburseLoanSchema,
  servicingRepaySchema,
  accruePenaltySchema,
  arrearsBatchSchema,
  classifySchema,
  waivePenaltySchema,
  rescheduleLoanSchema,
  writeOffLoanSchema,
  provisioningSettingsSchema,
  BankChequeController,
} from '../controllers/LoanServicingController';
import { AccountingController } from '../controllers/AccountingController';
import { SubsidiaryController } from '../controllers/SubsidiaryController';
import { LegalDocumentController } from '../controllers/LegalDocumentController';
import { AuthController, loginSchema, superAdminLoginSchema, createOrganizationSchema, updateOrgProfileSchema, MyProfileController, updateMyProfileSchema } from '../controllers/AuthController';
import {
  createBranchSchema,
  updateBranchSchema,
  updateWorkingDaysSchema,
  createFiscalYearSchema,
  updateFiscalYearSchema,
  createExchangeRateSchema,
  updateFinancialSettingsSchema,
  updateLocalizationSettingsSchema,
  updateSecuritySettingsSchema,
  completeSecuritySetupSchema,
} from '../schemas/organizationSettings';
import { MasterDataController } from '../controllers/MasterDataController';
import {
  SignatureVerificationController,
  signatureVerifySchema,
  captureSpecimenSchema,
  passbookReconcileSchema,
} from '../controllers/SignatureVerificationController';
import { GeoController } from '../controllers/GeoController';
import { RoleController } from '../controllers/RoleController';
import { DocumentTemplateController } from '../controllers/DocumentTemplateController';
import { MemberSettingController } from '../controllers/MemberSettingController';
import { validateMemberSettingRequest, memberSettingSchemaFor, memberSettingUpdateSchemaFor } from '../schemas/memberSetting';
import { GroupController } from '../controllers/GroupController';
import { createGroupSchema, updateGroupSchema } from '../schemas/group';
import { ApprovalLevelController } from '../controllers/ApprovalLevelController';
import { ApprovalMatrixController } from '../controllers/ApprovalMatrixController';
import { ApprovalRequestController } from '../controllers/ApprovalRequestController';
import {
  createApprovalLevelSchema,
  updateApprovalLevelSchema,
  createApprovalMatrixSchema,
  updateApprovalMatrixSchema,
  approvalDecisionSchema,
  putRoleApprovalLimitsSchema,
} from '../schemas/approvalSettings';
import { PlatformRoleController } from '../controllers/PlatformRoleController';
import { ModuleController } from '../controllers/ModuleController';
import { SubscriptionController } from '../controllers/SubscriptionController';
import { ApiKeyController } from '../controllers/ApiKeyController';
import { DatabaseAdminController } from '../controllers/DatabaseAdminController';
import { SystemSettingsController } from '../controllers/SystemSettingsController';
import { DatabaseSettingsController } from '../controllers/DatabaseSettingsController';
import { OcrController } from '../controllers/OcrController';
import { verifyToken, requireRole, sensitiveRouteLimiter, validateRequest, authRateLimit, financialWriteRateLimit, signatureRateLimit, generalApiRateLimit, postOnly } from '../middleware';
import { HardDeleteController, hardDeleteMemberSchema, hardDeleteSavingsAccountSchema } from '../controllers/HardDeleteController';
import { MemberSettingsController } from '../controllers/MemberSettingsController';
import { ChequeSettingController } from '../controllers/ChequeSettingController';
import { ChequeRegistryController } from '../controllers/ChequeRegistryController';
import { PassbookController } from '../controllers/PassbookController';
import { ShareSettingController } from '../controllers/ShareSettingController';
import {
  validateShareSettingRequest,
  shareSettingSchemaFor,
  shareSettingUpdateSchemaFor,
  setDefaultShareSchemeSchema,
  setDefaultCertificateFormatSchema,
  saveCertificateFormatSchema,
} from '../schemas/shareSetting';
import { LoanSettingController } from '../controllers/LoanSettingController';
import {
  validateLoanSettingRequest,
  loanSettingSchemaFor,
  loanSettingUpdateSchemaFor,
} from '../schemas/loanSetting';
import { SavingsSettingController } from '../controllers/SavingsSettingController';
import {
  validateSavingSettingRequest,
  savingSettingSchemaFor,
  savingSettingUpdateSchemaFor,
  setDefaultSavingProductSchema,
  issueChequeBookSchema,
} from '../schemas/savingSetting';
import { AccountingSettingController } from '../controllers/AccountingSettingController';
import { ReconciliationController } from '../controllers/ReconciliationController';
import { COAController } from '../controllers/COAController';
import {
  validateAccountingSettingRequest,
  accountingSettingSchemaFor,
  accountingSettingUpdateSchemaFor,
  financialPeriodStatusRequest,
  accountCreateRequest,
  accountUpdateRequest,
  accountGroupCreateRequest,
  accountGroupUpdateRequest,
  systemMappingsRequest,
} from '../schemas/accountingSetting';
import { bulkImportRequest, seedDefaultRequest } from '../schemas/coa';
const router = Router();

// ==========================================
// Public auth routes (no token required)
// ==========================================
// Strict rate limiting on login (anti brute-force), keyed on IP + attempted username
router.post('/auth/login', authRateLimit, validateRequest(loginSchema), AuthController.login);
router.post('/auth/forgot-password', authRateLimit, AuthController.forgotPassword);
router.post('/auth/super-admin/login', authRateLimit, validateRequest(superAdminLoginSchema), AuthController.superAdminLogin);
router.post('/auth/emis/login', authRateLimit, validateRequest(superAdminLoginSchema), AuthController.superAdminLogin);
router.post('/auth/refresh-token', AuthController.refreshToken);

// Public media proxy so <img>/<a> tags can render stored objects without
// attaching Authorization headers. Buckets stay private via signed URLs.
router.get('/uploads/:bucket/*', StorageController.serve);

// ==========================================
// Apply auth to all routes below, then tenant-aware rate limiting.
// ==========================================
router.use(verifyToken);
// General authenticated API budget (120/min per org+user). Mounted after
// verifyToken so the session (organizationId, userId) is available for the key.
router.use(generalApiRateLimit);

// Financial write throttling (30/min per teller): money-moving endpoints get a
// tighter per-session budget than the general limiter, guarding against a
// compromised/scripted teller session or a runaway frontend retry loop. Mounted
// by path prefix and restricted to mutating methods so shared-path reads stay
// on the general budget. Keyed on organizationId + userId, never IP.
router.use('/savings/deposits', postOnly(financialWriteRateLimit));
router.use('/savings/withdrawals', postOnly(financialWriteRateLimit));
router.use('/savings/cheque-deposits', postOnly(financialWriteRateLimit));
router.use('/savings/cheque-transfers', postOnly(financialWriteRateLimit));
router.use('/savings/transaction', postOnly(financialWriteRateLimit));
router.use('/cheque-books', postOnly(financialWriteRateLimit));
router.use('/savings-settings/cheque-books', postOnly(financialWriteRateLimit));
router.use('/cheque-stop-payments', postOnly(financialWriteRateLimit));
router.use('/cheque-bounces', postOnly(financialWriteRateLimit));
router.use('/shares/issue', postOnly(financialWriteRateLimit));
router.use('/shares/transfer', postOnly(financialWriteRateLimit));
router.use('/shares/transaction', postOnly(financialWriteRateLimit));
router.use('/shares/holdings', postOnly(financialWriteRateLimit));
router.use('/shares/open-account', postOnly(financialWriteRateLimit));
// Loan servicing writes post to the general ledger, so they get the same
// tightened per-session budget as the other financial mutations.
router.use('/loans/disburse', postOnly(financialWriteRateLimit));
router.use('/loans/repayment', postOnly(financialWriteRateLimit));
router.use('/loans/write-off', postOnly(financialWriteRateLimit));
router.use('/loans/reschedule', postOnly(financialWriteRateLimit));
router.use('/loans/penalties', postOnly(financialWriteRateLimit));

// Current session info
router.get('/auth/me', AuthController.me);
router.post('/auth/logout', AuthController.logout);

// ==========================================
// Master Data (frontend bootstrap)
// ==========================================
router.get('/master-data', MasterDataController.getAll);

// ==========================================
// Storage / Media uploads
// ==========================================
router.post('/uploads', StorageController.upload);

// ==========================================
// OCR / Document Scanning
// ==========================================
router.post('/ocr/extract', requireRole(['org_admin', 'manager', 'teller', 'member_service']), OcrController.extract);

// ==========================================
// Geo / Administrative Hierarchy
// ==========================================
router.get('/geo', GeoController.getTree);
router.get('/geo/provinces', GeoController.getProvinces);
router.get('/geo/provinces/:province/districts', GeoController.getDistricts);
router.get(
  '/geo/provinces/:province/districts/:district/municipalities',
  GeoController.getMunicipalities
);
router.get(
  '/geo/provinces/:province/districts/:district/municipalities/:municipality/wards',
  GeoController.getWards
);

// ==========================================
// Roles & Permissions (Org Admin RBAC)
// ==========================================
router.get('/roles', RoleController.getRoles);
router.get('/roles/clone-sources', RoleController.getCloneSources);
router.get('/roles/:id', RoleController.getRole);
router.post('/roles', requireRole(['org_admin']), RoleController.createRole);
router.put('/roles/:id', requireRole(['org_admin']), RoleController.updateRole);
router.patch('/roles/:id/status', requireRole(['org_admin']), RoleController.updateRoleStatus);
router.delete('/roles/:id', requireRole(['org_admin']), RoleController.deleteRole);
router.get('/roles/:id/permissions', RoleController.getRolePermissions);
router.put('/roles/:id/permissions', requireRole(['org_admin']), RoleController.putRolePermissions);
router.get('/roles/:id/data-scope', RoleController.getRoleDataScope);
router.put('/roles/:id/data-scope', requireRole(['org_admin']), RoleController.putRoleDataScope);
router.get('/roles/:id/users', RoleController.getRoleUsers);
router.get('/roles/:id/approval-limits', requireRole(['org_admin', 'manager']), RoleController.getRoleApprovalLimits);
router.put('/roles/:id/approval-limits',
  requireRole(['org_admin']),
  validateRequest(putRoleApprovalLimitsSchema),
  RoleController.putRoleApprovalLimits
);

// ==========================================
// Organization User Management (Org Admin)
// ==========================================
router.get('/org/users', requireRole(['org_admin', 'manager']), AuthController.getOrgUsers);
router.post('/org/users', requireRole(['org_admin']), AuthController.createOrgUser);
router.put('/org/users/:id', requireRole(['org_admin']), AuthController.updateOrgUser);
router.post('/org/users/:id/unlock', requireRole(['org_admin', 'manager']), AuthController.unlockUser);
router.post('/org/users/:id/lock', requireRole(['org_admin', 'manager']), AuthController.lockUser);
router.post('/org/users/:id/activate', requireRole(['org_admin', 'manager']), AuthController.activateUser);
router.post('/org/users/:id/deactivate', requireRole(['org_admin', 'manager']), AuthController.deactivateUser);
router.post('/org/users/:id/force-reset', requireRole(['org_admin', 'manager']), AuthController.forcePasswordReset);
router.post('/org/users/:id/reset-password', requireRole(['org_admin', 'manager']), AuthController.resetUserPassword);
router.post('/org/users/:id/resend-welcome', requireRole(['org_admin', 'manager']), AuthController.resendWelcome);
router.post('/org/users/:id/terminate-sessions', requireRole(['org_admin', 'manager']), AuthController.terminateSessions);
router.post('/auth/change-password', verifyToken, AuthController.changePassword);
router.post('/auth/verify-password', verifyToken, MyProfileController.verifyPassword);
router.get('/auth/security-questions', verifyToken, AuthController.getSecurityQuestions);
router.get('/auth/session-policy', verifyToken, AuthController.getSessionPolicy);
router.post('/auth/security-setup/complete',
  verifyToken,
  validateRequest(completeSecuritySetupSchema),
  AuthController.completeSecuritySetup
);
router.post('/org/switch-branch', requireRole(['org_admin']), AuthController.switchBranch);

// ==========================================
// Organization Security Policy (SETUPS → Admin → Security)
// Read by org_admin + manager; only org_admin may change policy.
// ==========================================
router.get('/org/security-settings',
  requireRole(['org_admin', 'manager']),
  AuthController.getSecuritySettings
);
router.put('/org/security-settings',
  requireRole(['org_admin']),
  validateRequest(updateSecuritySettingsSchema),
  AuthController.updateSecuritySettings
);

// ==========================================
// Organization Profile (Org Admin / Manager)
// ==========================================
router.get('/org/profile', requireRole(['org_admin', 'manager']), AuthController.getOrgProfile);
router.put('/org/profile',
  requireRole(['org_admin']),
  validateRequest(updateOrgProfileSchema),
  AuthController.updateOrgProfile
);
router.get('/org/reference', requireRole(['org_admin', 'manager']), AuthController.getOrgReference);

// ==========================================
// User Profile (any authenticated user)
// ==========================================
router.put('/user/profile',
  validateRequest(updateMyProfileSchema),
  MyProfileController.updateMyProfile
);

// ==========================================
// Super Admin: Organization Management
// ==========================================
router.get('/super-admin/organizations', requireRole(['super_admin']), AuthController.getOrganizations);
router.get('/super-admin/organizations/next-reg-no', requireRole(['super_admin']), AuthController.getNextRegNo);
router.post('/super-admin/organizations/provision',
  requireRole(['super_admin']),
  AuthController.provisionOrganization
);
router.post('/super-admin/organizations',
  requireRole(['super_admin']),
  validateRequest(createOrganizationSchema),
  AuthController.createOrganization
);
router.put('/super-admin/organizations/:id/status', requireRole(['super_admin']), AuthController.updateOrganizationStatus);
router.put('/super-admin/organizations/:id', requireRole(['super_admin']), AuthController.updateOrganization);
router.get('/super-admin/organizations/:id', requireRole(['super_admin']), AuthController.getOrganizationDetail);
router.get('/super-admin/organizations/:id/audit-logs', requireRole(['super_admin']), AuthController.getOrgAuditLogs);
router.get('/super-admin/organizations/:id/roles', requireRole(['super_admin']), AuthController.getOrgRoles);

// ==========================================
// Super Admin: Platform Overview
// ==========================================
router.get('/super-admin/stats', requireRole(['super_admin']), AuthController.getPlatformStats);
router.get('/super-admin/users', requireRole(['super_admin']), AuthController.getPlatformUsers);
router.post('/super-admin/users', requireRole(['super_admin']), AuthController.createSuperAdminUser);
router.put('/super-admin/users/:id', requireRole(['super_admin']), AuthController.updatePlatformUser);
router.post('/super-admin/users/:id/reset-password', requireRole(['super_admin']), AuthController.resetPlatformUserPassword);

router.get('/super-admin/super-admins', requireRole(['super_admin']), AuthController.getSuperAdmins);
router.put('/super-admin/super-admins/:id', requireRole(['super_admin']), AuthController.updateSuperAdminUser);
router.post('/super-admin/platform-users', requireRole(['super_admin']), AuthController.createPlatformUser);
router.get('/super-admin/audit-logs', requireRole(['super_admin']), AuthController.getAuditLogs);

// ==========================================
// Super Admin: Platform Roles & Access
// ==========================================
router.get('/super-admin/platform-roles', requireRole(['super_admin']), PlatformRoleController.listRoles);
router.get('/super-admin/platform-roles/:id', requireRole(['super_admin']), PlatformRoleController.getRole);
router.post('/super-admin/platform-roles', requireRole(['super_admin']), PlatformRoleController.createRole);
router.put('/super-admin/platform-roles/:id', requireRole(['super_admin']), PlatformRoleController.updateRole);
router.delete('/super-admin/platform-roles/:id', requireRole(['super_admin']), PlatformRoleController.deleteRole);
router.get('/super-admin/platform-roles/:id/permissions', requireRole(['super_admin']), PlatformRoleController.getRolePermissions);
router.put('/super-admin/platform-roles/:id/permissions', requireRole(['super_admin']), PlatformRoleController.putRolePermissions);
router.get('/super-admin/platform-roles/:id/data-scope', requireRole(['super_admin']), PlatformRoleController.getRoleDataScope);
router.put('/super-admin/platform-roles/:id/data-scope', requireRole(['super_admin']), PlatformRoleController.putRoleDataScope);

// ==========================================
// Super Admin: API Keys Management
// ==========================================
router.get('/super-admin/api-keys/stats', requireRole(['super_admin']), ApiKeyController.getKeyStats);
router.get('/super-admin/api-keys', requireRole(['super_admin']), ApiKeyController.listKeys);
router.post('/super-admin/api-keys', requireRole(['super_admin']), ApiKeyController.createKey);
router.get('/super-admin/api-keys/:id', requireRole(['super_admin']), ApiKeyController.getKey);
router.post('/super-admin/api-keys/:id/revoke', requireRole(['super_admin']), ApiKeyController.revokeKey);
router.post('/super-admin/api-keys/:id/rotate', requireRole(['super_admin']), ApiKeyController.rotateKey);
router.delete('/super-admin/api-keys/:id', requireRole(['super_admin']), ApiKeyController.deleteKey);

// ==========================================
// Super Admin: Enterprise Module Management
// ==========================================
// Static-path routes must be declared before /modules/:id.
router.get('/modules', requireRole(['super_admin']), ModuleController.listModules);
router.get('/modules/stats', requireRole(['super_admin']), ModuleController.getStats);
router.get('/modules/categories', requireRole(['super_admin']), ModuleController.listCategories);
router.get('/modules/audit-logs', requireRole(['super_admin']), ModuleController.listAuditLogs);
router.get('/modules/notifications', requireRole(['super_admin']), ModuleController.listNotifications);
router.get('/modules/installation-logs', requireRole(['super_admin']), ModuleController.listInstallationLogs);
router.get('/modules/templates', requireRole(['super_admin']), ModuleController.listTemplates);
router.get('/modules/recommendations', requireRole(['super_admin']), ModuleController.listRecommendations);

// Module CRUD
router.post('/modules', requireRole(['super_admin']), ModuleController.createModule);
router.get('/modules/:id', requireRole(['super_admin']), ModuleController.getModule);
router.put('/modules/:id', requireRole(['super_admin']), ModuleController.updateModule);
router.delete('/modules/:id', requireRole(['super_admin']), ModuleController.deleteModule);

// Module sub-resources
router.get('/modules/:id/features', requireRole(['super_admin']), ModuleController.listFeatures);
router.post('/modules/:id/features', requireRole(['super_admin']), ModuleController.createFeature);
router.put('/modules/:id/features/:featureId', requireRole(['super_admin']), ModuleController.updateFeature);
router.delete('/modules/:id/features/:featureId', requireRole(['super_admin']), ModuleController.deleteFeature);
router.get('/modules/:id/dependencies', requireRole(['super_admin']), ModuleController.listDependencies);
router.post('/modules/:id/dependencies', requireRole(['super_admin']), ModuleController.addDependency);
router.delete('/modules/:id/dependencies/:depId', requireRole(['super_admin']), ModuleController.removeDependency);
router.get('/modules/:id/versions', requireRole(['super_admin']), ModuleController.listVersions);
router.post('/modules/:id/versions', requireRole(['super_admin']), ModuleController.createVersion);
router.get('/modules/:id/licenses', requireRole(['super_admin']), ModuleController.listLicenses);
router.post('/modules/:id/licenses', requireRole(['super_admin']), ModuleController.createLicense);
router.put('/modules/:id/licenses/:licenseId', requireRole(['super_admin']), ModuleController.updateLicense);
router.delete('/modules/:id/licenses/:licenseId', requireRole(['super_admin']), ModuleController.deleteLicense);
router.get('/modules/:id/settings', requireRole(['super_admin']), ModuleController.listSettings);
router.put('/modules/:id/settings', requireRole(['super_admin']), ModuleController.upsertSetting);
router.delete('/modules/:id/settings/:settingId', requireRole(['super_admin']), ModuleController.deleteSetting);
router.get('/modules/:id/permissions', requireRole(['super_admin']), ModuleController.listPermissions);
router.put('/modules/:id/permissions', requireRole(['super_admin']), ModuleController.upsertPermission);
router.delete('/modules/:id/permissions/:permId', requireRole(['super_admin']), ModuleController.deletePermission);
router.get('/modules/:id/assignments', requireRole(['super_admin']), ModuleController.listModuleAssignments);
router.get('/modules/:id/usage', requireRole(['super_admin']), ModuleController.getUsage);
router.put('/modules/:id/marketplace', requireRole(['super_admin']), ModuleController.upsertMarketplace);

// Assignment operations
router.post('/modules/assign', requireRole(['super_admin']), ModuleController.assignModules);
router.post('/modules/unassign', requireRole(['super_admin']), ModuleController.unassignModules);
router.put('/modules/assignments/:assignmentId', requireRole(['super_admin']), ModuleController.updateAssignment);

// Usage recording (from org services)
router.post('/modules/usage', requireRole(['super_admin']), ModuleController.recordUsage);

// Templates / recommendations mutations
router.post('/modules/templates', requireRole(['super_admin']), ModuleController.createTemplate);
router.delete('/modules/templates/:templateId', requireRole(['super_admin']), ModuleController.deleteTemplate);
router.post('/modules/recommendations/generate', requireRole(['super_admin']), ModuleController.generateRecommendations);
router.put('/modules/recommendations/:recommendationId/status', requireRole(['super_admin']), ModuleController.updateRecommendationStatus);

// Organization-scoped module operations
router.get('/super-admin/orgs/:organizationId/modules', requireRole(['super_admin']), ModuleController.listOrgAssignments);
router.post('/super-admin/orgs/:organizationId/modules/:moduleId/toggle', requireRole(['super_admin']), ModuleController.toggleOrgModule);
router.get('/super-admin/orgs/:organizationId/modules/:moduleId/features', requireRole(['super_admin']), ModuleController.listOrgFeatures);
router.put('/super-admin/orgs/:organizationId/modules/:moduleId/features', requireRole(['super_admin']), ModuleController.setOrgFeature);
router.get('/super-admin/orgs/:organizationId/modules/:moduleId/settings', requireRole(['super_admin']), ModuleController.listOrgSettings);
router.put('/super-admin/orgs/:organizationId/modules/:moduleId/settings', requireRole(['super_admin']), ModuleController.setOrgSetting);
router.get('/super-admin/orgs/:organizationId/modules/:moduleId/permissions', requireRole(['super_admin']), ModuleController.listOrgPermissions);
router.put('/super-admin/orgs/:organizationId/modules/:moduleId/permissions', requireRole(['super_admin']), ModuleController.setOrgPermission);

// Marketplace
router.get('/marketplace', requireRole(['super_admin']), ModuleController.getMarketplace);
router.post('/marketplace/install', requireRole(['super_admin']), ModuleController.marketplaceInstall);
router.post('/marketplace/update', requireRole(['super_admin']), ModuleController.marketplaceUpdate);
router.post('/marketplace/remove', requireRole(['super_admin']), ModuleController.marketplaceRemove);

// Organization lookup (for assignment dialogs)
router.get('/super-admin/org-list', requireRole(['super_admin']), ModuleController.listOrganizations);

// ==========================================
// Super Admin: Subscription Management
// ==========================================
router.get('/super-admin/subscriptions/stats', requireRole(['super_admin']), SubscriptionController.getSubscriptionStats);
router.get('/super-admin/subscriptions/plan-usage', requireRole(['super_admin']), SubscriptionController.getPlanUsage);
router.get('/super-admin/subscriptions/plans', requireRole(['super_admin']), SubscriptionController.listPlans);
router.post('/super-admin/subscriptions/plans', requireRole(['super_admin']), SubscriptionController.createPlan);
router.put('/super-admin/subscriptions/plans/:id', requireRole(['super_admin']), SubscriptionController.updatePlan);
router.delete('/super-admin/subscriptions/plans/:id', requireRole(['super_admin']), SubscriptionController.deletePlan);
router.get('/super-admin/subscriptions/orgs', requireRole(['super_admin']), SubscriptionController.getOrgSubscriptions);
router.post('/super-admin/subscriptions/orgs/:orgId/change-plan', requireRole(['super_admin']), SubscriptionController.changeOrgPlan);

// ==========================================
// Super Admin: System Settings
// ==========================================
router.get('/super-admin/settings', requireRole(['super_admin']), SystemSettingsController.getSettings);
router.get('/super-admin/settings/grouped', requireRole(['super_admin']), SystemSettingsController.getSettingsGrouped);
router.post('/super-admin/settings/reset', requireRole(['super_admin']), SystemSettingsController.resetSettings);
router.put('/super-admin/settings/bulk', requireRole(['super_admin']), SystemSettingsController.updateBulk);
router.get('/super-admin/settings/:key', requireRole(['super_admin']), SystemSettingsController.getSettingByKey);
router.put('/super-admin/settings/:key', requireRole(['super_admin']), SystemSettingsController.updateSetting);

// ==========================================
// Super Admin: Database Configuration
// ==========================================
router.get('/super-admin/database-config', requireRole(['super_admin']), DatabaseSettingsController.getConfig);
router.put('/super-admin/database-config', requireRole(['super_admin']), DatabaseSettingsController.updateConfig);
router.post('/super-admin/database-config/test', requireRole(['super_admin']), DatabaseSettingsController.testConnection);
router.post('/super-admin/database-config/apply', requireRole(['super_admin']), DatabaseSettingsController.applyConfig);

// ==========================================
// Notification Settings (per-organization SMS/Email credentials)
// ==========================================
import {
  getNotificationSettings,
  updateNotificationSettings,
  getSmsCredentials,
  getEmailCredentials,
  getWhatsAppCredentials,
  testSmsConfiguration,
  testEmailConfiguration,
  testWhatsAppConfiguration,
  checkSmsBalance,
  checkWhatsAppBalance,
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getReminderRules,
  getReminderRule,
  createReminderRule,
  updateReminderRule,
  deleteReminderRule,
  getSmsLogs,
  getEmailLogs,
  getWhatsAppLogs,
} from '../controllers/NotificationSettingsController';

// Organization notification settings
router.get('/notification-settings/:organizationId', requireRole(['org_admin', 'manager']), getNotificationSettings);
router.put('/notification-settings/:organizationId', requireRole(['org_admin']), updateNotificationSettings);
router.get('/notification-settings/:organizationId/sms-credentials', requireRole(['org_admin', 'manager']), getSmsCredentials);
router.get('/notification-settings/:organizationId/email-credentials', requireRole(['org_admin', 'manager']), getEmailCredentials);
router.get('/notification-settings/:organizationId/whatsapp-credentials', requireRole(['org_admin', 'manager']), getWhatsAppCredentials);
router.post('/notification-settings/:organizationId/test-sms', requireRole(['org_admin']), testSmsConfiguration);
router.post('/notification-settings/:organizationId/test-email', requireRole(['org_admin']), testEmailConfiguration);
router.post('/notification-settings/:organizationId/test-whatsapp', requireRole(['org_admin']), testWhatsAppConfiguration);
router.post('/notification-settings/:organizationId/check-sms-balance', requireRole(['org_admin', 'manager']), checkSmsBalance);
router.post('/notification-settings/:organizationId/check-whatsapp-balance', requireRole(['org_admin', 'manager']), checkWhatsAppBalance);

// Notification templates
router.get('/notification-templates/:organizationId', requireRole(['org_admin', 'manager']), getTemplates);
router.get('/notification-templates/:organizationId/:templateId', requireRole(['org_admin', 'manager']), getTemplate);
router.post('/notification-templates/:organizationId', requireRole(['org_admin']), createTemplate);
router.put('/notification-templates/:organizationId/:templateId', requireRole(['org_admin']), updateTemplate);
router.delete('/notification-templates/:organizationId/:templateId', requireRole(['org_admin']), deleteTemplate);

// Reminder rules
router.get('/reminder-rules/:organizationId', requireRole(['org_admin', 'manager']), getReminderRules);
router.get('/reminder-rules/:organizationId/:ruleId', requireRole(['org_admin', 'manager']), getReminderRule);
router.post('/reminder-rules/:organizationId', requireRole(['org_admin']), createReminderRule);
router.put('/reminder-rules/:organizationId/:ruleId', requireRole(['org_admin']), updateReminderRule);
router.delete('/reminder-rules/:organizationId/:ruleId', requireRole(['org_admin']), deleteReminderRule);

// SMS, Email and WhatsApp logs
router.get('/sms-logs/:organizationId', requireRole(['org_admin', 'manager']), getSmsLogs);
router.get('/email-logs/:organizationId', requireRole(['org_admin', 'manager']), getEmailLogs);
router.get('/whatsapp-logs/:organizationId', requireRole(['org_admin', 'manager']), getWhatsAppLogs);

// ==========================================
// Super Admin: Database Administration
// ==========================================
router.get('/super-admin/database/overview', requireRole(['super_admin']), DatabaseAdminController.getDatabaseOverview);
router.get('/super-admin/database/tables', requireRole(['super_admin']), DatabaseAdminController.getTableStats);
router.get('/super-admin/database/indexes', requireRole(['super_admin']), DatabaseAdminController.getIndexStats);
router.get('/super-admin/database/queries', requireRole(['super_admin']), DatabaseAdminController.getRecentQueries);
router.get('/super-admin/database/vacuum', requireRole(['super_admin']), DatabaseAdminController.getVacuumStatus);
router.post('/super-admin/database/query', requireRole(['super_admin']), DatabaseAdminController.runQuery);

// ==========================================
// Members API
// ==========================================
router.get('/members', MemberController.getMembers);
router.get('/members/:id', MemberController.getMember);
router.post('/members',
  sensitiveRouteLimiter,
  requireRole(['org_admin', 'manager', 'teller', 'member_service']),
  validateRequest(createMemberSchema),
  MemberController.createMember
);
router.put('/members/:id', requireRole(['org_admin', 'manager', 'member_service']), MemberController.updateMember);
router.delete('/members/:id', requireRole(['org_admin']), MemberController.deleteMember);
router.get('/members/:id/documents', requireRole(['org_admin', 'manager', 'member_service', 'teller']), MemberController.getMemberDocuments);
router.post('/members/:id/documents', requireRole(['org_admin', 'manager', 'member_service']), MemberController.addMemberDocument);
router.delete('/members/:id/documents/:docId', requireRole(['org_admin', 'manager', 'member_service']), MemberController.deleteMemberDocument);
// Secure hard delete (admin only): archives an immutable snapshot to
// audit_deletion_logs, then permanently removes the member + linked financial
// records inside one transaction. Body requires `confirmation: 'DELETE'`.
router.post(
  '/members/:id/hard-delete',
  sensitiveRouteLimiter,
  requireRole(['org_admin']),
  validateRequest(hardDeleteMemberSchema),
  HardDeleteController.hardDeleteMember,
);

// Read-only immutable hard-delete audit trail (admin only).
router.get('/audit/deletion-logs', requireRole(['org_admin']), HardDeleteController.listDeletionLogs);

// ==========================================
// Member Settings API (Module 3 — classification catalogs)
// org_admin/manager read; only org_admin writes.
// ==========================================
const MEMBER_SETTING_READ_ROLES = ['org_admin', 'manager', 'member_service', 'teller'];
router.get('/member-settings/:entityType', requireRole(MEMBER_SETTING_READ_ROLES), MemberSettingController.getSettings);
router.get('/member-settings/:entityType/:id', requireRole(MEMBER_SETTING_READ_ROLES), MemberSettingController.getSetting);
router.post(
  '/member-settings/:entityType',
  requireRole(['org_admin']),
  validateMemberSettingRequest(memberSettingSchemaFor),
  MemberSettingController.createSetting,
);
router.put(
  '/member-settings/:entityType/:id',
  requireRole(['org_admin']),
  validateMemberSettingRequest(memberSettingUpdateSchemaFor),
  MemberSettingController.updateSetting,
);
router.delete('/member-settings/:entityType/:id', requireRole(['org_admin']), MemberSettingController.deleteSetting);

// ==========================================
// Share Settings API (SETUPS → Share Settings)
// share-classes, share-schemes, dividend-rules, certificate-formats.
// org_admin/manager read; only org_admin writes. Share-schemes is the
// canonical pricing config; default-scheme selection is org_admin only.
// ==========================================
const SHARE_SETTING_READ_ROLES = ['org_admin', 'manager', 'member_service', 'teller', 'accountant'];

// Singular Share Certificate Format (embedded designer save/load).
// Registered BEFORE the :entityType param routes below so it isn't swallowed
// by them (entityType would otherwise resolve to an unknown entity).
router.get('/share-settings/certificate-format', requireRole(SHARE_SETTING_READ_ROLES), ShareSettingController.getCertificateFormat);
router.put(
  '/share-settings/certificate-format',
  requireRole(['org_admin']),
  validateRequest(saveCertificateFormatSchema),
  ShareSettingController.saveCertificateFormat,
);

router.get('/share-settings/:entityType', requireRole(SHARE_SETTING_READ_ROLES), ShareSettingController.getSettings);
router.get('/share-settings/:entityType/:id', requireRole(SHARE_SETTING_READ_ROLES), ShareSettingController.getSetting);
router.post(
  '/share-settings/:entityType',
  requireRole(['org_admin']),
  validateShareSettingRequest(shareSettingSchemaFor),
  ShareSettingController.createSetting,
);
router.put(
  '/share-settings/:entityType/:id',
  requireRole(['org_admin']),
  validateShareSettingRequest(shareSettingUpdateSchemaFor),
  ShareSettingController.updateSetting,
);
router.patch(
  '/share-settings/:entityType/reorder',
  requireRole(['org_admin', 'manager']),
  ShareSettingController.reorderSettings,
);
router.delete('/share-settings/:entityType/:id', requireRole(['org_admin']), ShareSettingController.deleteSetting);

// ==========================================
// Loan Settings API (SETUPS → Loan Settings — Module 6)
// loan-products, loan-categories, collateral-types + two singular org
// settings (guarantor-settings, emi-schedule-settings).
// org_admin/manager/member_service/teller read; only org_admin writes.
// Singular routes are registered BEFORE the :entityType param routes so
// they aren't swallowed by them.
// ==========================================
const LOAN_SETTING_READ_ROLES = ['org_admin', 'manager', 'member_service', 'teller'];

router.get('/loan-settings/guarantor-settings', requireRole(LOAN_SETTING_READ_ROLES), LoanSettingController.getGuarantorSettings);
router.put('/loan-settings/guarantor-settings', requireRole(['org_admin']), LoanSettingController.updateGuarantorSettings);
router.get('/loan-settings/emi-schedule-settings', requireRole(LOAN_SETTING_READ_ROLES), LoanSettingController.getEmiScheduleSettings);
router.put('/loan-settings/emi-schedule-settings', requireRole(['org_admin']), LoanSettingController.updateEmiScheduleSettings);

router.get('/loan-settings/:entityType', requireRole(LOAN_SETTING_READ_ROLES), LoanSettingController.getSettings);
router.get('/loan-settings/:entityType/:id', requireRole(LOAN_SETTING_READ_ROLES), LoanSettingController.getSetting);
router.post(
  '/loan-settings/:entityType',
  requireRole(['org_admin']),
  validateLoanSettingRequest(loanSettingSchemaFor),
  LoanSettingController.createSetting,
);
router.put(
  '/loan-settings/:entityType/:id',
  requireRole(['org_admin']),
  validateLoanSettingRequest(loanSettingUpdateSchemaFor),
  LoanSettingController.updateSetting,
);
router.delete('/loan-settings/:entityType/:id', requireRole(['org_admin']), LoanSettingController.deleteSetting);

// ==========================================
// Savings A/C Settings API (SETUPS — Savings A/C Settings)
// savings-products (canonical savings_products table).
// org_admin/manager/member_service/teller/accountant read; only org_admin writes.
// ==========================================
const SAVINGS_SETTING_READ_ROLES = ['org_admin', 'manager', 'member_service', 'teller', 'accountant'];

// ==========================================
// Advanced Cheque Settings & Management API
// ==========================================
router.get('/cheque-settings', requireRole(SAVINGS_SETTING_READ_ROLES), ChequeSettingController.getSettings);

router.put('/cheque-settings', requireRole(['org_admin', 'manager']), ChequeSettingController.updateSettings);
router.get('/cheque-settings/products', requireRole(SAVINGS_SETTING_READ_ROLES), ChequeSettingController.getEligibleProducts);

router.get('/cheque-books', requireRole(SAVINGS_SETTING_READ_ROLES), ChequeSettingController.getChequeBooks);
router.post('/cheque-books', requireRole(['org_admin', 'manager', 'member_service', 'teller']), ChequeSettingController.issueChequeBook);
router.put('/cheque-books/:id/status', requireRole(['org_admin', 'manager']), ChequeSettingController.updateBookStatus);

router.get('/cheque-leaves', requireRole(SAVINGS_SETTING_READ_ROLES), ChequeSettingController.getChequeLeaves);
router.get('/cheque-leaves/search', requireRole(SAVINGS_SETTING_READ_ROLES), ChequeSettingController.searchChequeLeaf);

router.get('/cheque-stop-payments', requireRole(SAVINGS_SETTING_READ_ROLES), ChequeSettingController.getStopPayments);
router.post('/cheque-stop-payments', requireRole(['org_admin', 'manager', 'member_service', 'teller']), ChequeSettingController.createStopPayment);
router.post('/cheque-stop-payments/:id/approve', requireRole(['org_admin', 'manager']), ChequeSettingController.approveStopPayment);
router.post('/cheque-stop-payments/:id/reject', requireRole(['org_admin', 'manager']), ChequeSettingController.rejectStopPayment);

router.get('/cheque-bounces', requireRole(SAVINGS_SETTING_READ_ROLES), ChequeSettingController.getBounces);
router.post('/cheque-bounces', requireRole(['org_admin', 'manager', 'member_service', 'teller']), ChequeSettingController.recordBounce);

// Consolidated registry: unified register, per-account history, dashboard stats.
router.get('/cheque-register', requireRole(SAVINGS_SETTING_READ_ROLES), ChequeRegistryController.getRegister);
router.get('/cheque-stats', requireRole(SAVINGS_SETTING_READ_ROLES), ChequeRegistryController.getStats);
router.get('/cheque-accounts/:accountId/history', requireRole(SAVINGS_SETTING_READ_ROLES), ChequeRegistryController.getAccountHistory);

// Cheque leaf design templates (Cheque Design studio persistence).
router.get('/cheque-designs', requireRole(SAVINGS_SETTING_READ_ROLES), ChequeRegistryController.listDesigns);
router.get('/cheque-designs/:id', requireRole(SAVINGS_SETTING_READ_ROLES), ChequeRegistryController.getDesign);
router.post('/cheque-designs', requireRole(['org_admin', 'manager']), ChequeRegistryController.createDesign);
router.put('/cheque-designs/:id', requireRole(['org_admin', 'manager']), ChequeRegistryController.updateDesign);
router.delete('/cheque-designs/:id', requireRole(['org_admin', 'manager']), ChequeRegistryController.deleteDesign);

// Legacy fallback routes for backward compatibility
router.get('/savings-settings/cheque-books', requireRole(SAVINGS_SETTING_READ_ROLES), ChequeSettingController.getChequeBooks);
router.post('/savings-settings/cheque-books', requireRole(['org_admin', 'manager', 'member_service', 'teller']), ChequeSettingController.issueChequeBook);
router.post('/savings-settings/cheque-books/:id/cancel', requireRole(['org_admin', 'manager']), (req, res) => {
  req.body.status = 'cancelled';
  return ChequeSettingController.updateBookStatus(req, res);
});


router.get('/savings/settings/default-product', requireRole(SAVINGS_SETTING_READ_ROLES), SavingsSettingController.getDefaultProduct);
router.put(
  '/savings/settings/default-product',
  requireRole(['org_admin']),
  validateRequest(setDefaultSavingProductSchema),
  SavingsSettingController.setDefaultProduct,
);

router.get('/savings-settings/:entityType', requireRole(SAVINGS_SETTING_READ_ROLES), SavingsSettingController.getSettings);
router.get('/savings-settings/:entityType/:id', requireRole(SAVINGS_SETTING_READ_ROLES), SavingsSettingController.getSetting);
router.post(
  '/savings-settings/:entityType',
  requireRole(['org_admin']),
  validateSavingSettingRequest(savingSettingSchemaFor),
  SavingsSettingController.createSetting,
);
router.put(
  '/savings-settings/:entityType/:id',
  requireRole(['org_admin']),
  validateSavingSettingRequest(savingSettingUpdateSchemaFor),
  SavingsSettingController.updateSetting,
);
router.patch(
  '/savings-settings/:entityType/reorder',
  requireRole(['org_admin', 'manager']),
  SavingsSettingController.reorderSettings,
);
router.delete('/savings-settings/:entityType/:id', requireRole(['org_admin']), SavingsSettingController.deleteSetting);

// Org default share scheme (drives auto-opening at member registration).
router.get('/shares/settings/default-scheme', requireRole(SHARE_SETTING_READ_ROLES), ShareSettingController.getDefaultScheme);
router.put(
  '/shares/settings/default-scheme',
  requireRole(['org_admin']),
  validateRequest(setDefaultShareSchemeSchema),
  ShareSettingController.setDefaultScheme,
);

// Org default share certificate format (drives the Share page certificate print).
router.get('/shares/settings/default-certificate-format', requireRole(SHARE_SETTING_READ_ROLES), ShareSettingController.getDefaultCertificateFormat);
router.put(
  '/shares/settings/default-certificate-format',
  requireRole(['org_admin']),
  validateRequest(setDefaultCertificateFormatSchema),
  ShareSettingController.setDefaultCertificateFormat,
);

// ==========================================
// Groups API (Module 3 — operational community groups)
// org_admin/manager read; only org_admin writes.
// ==========================================
router.get('/groups', requireRole(MEMBER_SETTING_READ_ROLES), GroupController.listGroups);
router.get('/groups/:id', requireRole(MEMBER_SETTING_READ_ROLES), GroupController.getGroup);
router.post('/groups', requireRole(['org_admin']), validateRequest(createGroupSchema), GroupController.createGroup);
router.put('/groups/:id', requireRole(['org_admin']), validateRequest(updateGroupSchema), GroupController.updateGroup);
router.delete('/groups/:id', requireRole(['org_admin']), GroupController.deleteGroup);

// ==========================================
// Branches API
// ==========================================
router.get('/branches', BranchController.getBranches);
router.get('/branches/:id', BranchController.getBranch);
router.post('/branches',
  requireRole(['org_admin', 'manager']),
  validateRequest(createBranchSchema),
  BranchController.createBranch
);
router.put('/branches/:id',
  requireRole(['org_admin', 'manager']),
  validateRequest(updateBranchSchema),
  BranchController.updateBranch
);
router.post('/branches/:id/deactivate',
  requireRole(['org_admin']),
  BranchController.deactivateBranch
);

// ==========================================
// Departments API
// ==========================================
router.get('/departments', DepartmentController.getDepartments);
router.get('/departments/:id', DepartmentController.getDepartment);
router.post('/departments',
  requireRole(['org_admin', 'manager']),
  validateRequest(createDepartmentSchema),
  DepartmentController.createDepartment
);
router.put('/departments/:id',
  requireRole(['org_admin', 'manager']),
  validateRequest(updateDepartmentSchema),
  DepartmentController.updateDepartment
);
router.delete('/departments/:id', requireRole(['org_admin']), DepartmentController.deleteDepartment);

// ==========================================
// Designations API (nested under Departments)
// ==========================================
router.get('/designations', DesignationController.getDesignations);
router.get('/departments/:id/designations', DesignationController.getDesignationsByDepartment);
router.post('/departments/:id/designations',
  requireRole(['org_admin', 'manager']),
  validateRequest(createDesignationSchema),
  DesignationController.createDesignation
);
router.put('/designations/:id',
  requireRole(['org_admin', 'manager']),
  validateRequest(updateDesignationSchema),
  DesignationController.updateDesignation
);
router.delete('/designations/:id', requireRole(['org_admin']), DesignationController.deleteDesignation);

// ==========================================
// Working Days & Hours Setup
// ==========================================
router.get('/working-days', WorkingDayController.getWorkingDays);
router.put('/working-days',
  requireRole(['org_admin', 'manager']),
  validateRequest(updateWorkingDaysSchema),
  WorkingDayController.updateWorkingDays
);

// ==========================================
// Workflow & Approvals (Module 2)
// ==========================================
router.get('/approvals/levels', requireRole(['org_admin', 'manager']), ApprovalLevelController.getLevels);
router.get('/approvals/levels/:id', requireRole(['org_admin', 'manager']), ApprovalLevelController.getLevel);
router.post('/approvals/levels',
  requireRole(['org_admin']),
  validateRequest(createApprovalLevelSchema),
  ApprovalLevelController.createLevel
);
router.put('/approvals/levels/:id',
  requireRole(['org_admin']),
  validateRequest(updateApprovalLevelSchema),
  ApprovalLevelController.updateLevel
);
router.delete('/approvals/levels/:id', requireRole(['org_admin']), ApprovalLevelController.deleteLevel);

router.get('/approvals/matrix', requireRole(['org_admin', 'manager']), ApprovalMatrixController.getMatrix);
router.post('/approvals/matrix',
  requireRole(['org_admin']),
  validateRequest(createApprovalMatrixSchema),
  ApprovalMatrixController.createRule
);
router.put('/approvals/matrix/:id',
  requireRole(['org_admin']),
  validateRequest(updateApprovalMatrixSchema),
  ApprovalMatrixController.updateRule
);
router.delete('/approvals/matrix/:id', requireRole(['org_admin']), ApprovalMatrixController.deleteRule);

router.get('/approvals', requireRole(['org_admin', 'manager', 'loan_officer', 'accountant']), ApprovalRequestController.getRequests);
router.post('/approvals/:id/decision',
  requireRole(['org_admin', 'manager']),
  validateRequest(approvalDecisionSchema),
  ApprovalRequestController.decision
);

// ==========================================
// Fiscal Years API
// ==========================================
router.get('/fiscal-years', FiscalYearController.getFiscalYears);
router.get('/fiscal-years/:id', FiscalYearController.getFiscalYear);
router.post('/fiscal-years',
  requireRole(['org_admin', 'manager']),
  validateRequest(createFiscalYearSchema),
  FiscalYearController.createFiscalYear
);
router.put('/fiscal-years/:id',
  requireRole(['org_admin', 'manager']),
  validateRequest(updateFiscalYearSchema),
  FiscalYearController.updateFiscalYear
);
router.delete('/fiscal-years/:id', requireRole(['org_admin']), FiscalYearController.deleteFiscalYear);

// ==========================================
// Exchange Rates & Financial Settings (Currency)
// ==========================================
router.get('/exchange-rates', ExchangeRateController.getRates);
router.post('/exchange-rates/sync',
  requireRole(['org_admin', 'manager']),
  ExchangeRateController.syncLatest
);
router.post('/exchange-rates',
  requireRole(['org_admin', 'manager']),
  validateRequest(createExchangeRateSchema),
  ExchangeRateController.createRate
);
router.get('/org/financial-settings',
  requireRole(['org_admin', 'manager']),
  ExchangeRateController.getFinancialSettings
);
router.put('/org/financial-settings',
  requireRole(['org_admin']),
  validateRequest(updateFinancialSettingsSchema),
  ExchangeRateController.updateFinancialSettings
);

// ==========================================
// Organization Localization Settings (Language & Localization)
// ==========================================
router.get('/org/localization-settings',
  requireRole(['org_admin', 'manager']),
  LocalizationController.getSettings
);
router.patch('/org/localization-settings',
  requireRole(['org_admin']),
  validateRequest(updateLocalizationSettingsSchema),
  LocalizationController.updateSettings
);

// ==========================================
// Staff API (staff-first HR model)
// ==========================================
router.get('/staff', requireRole(['org_admin', 'manager']), StaffController.getStaffList);
router.get('/staff/:id', requireRole(['org_admin', 'manager']), StaffController.getStaffById);
router.post('/staff', requireRole(['org_admin', 'manager']), StaffController.createStaff);
router.put('/staff/:id', requireRole(['org_admin', 'manager']), StaffController.updateStaff);
router.delete('/staff/:id', requireRole(['org_admin']), StaffController.deleteStaff);

// ==========================================
// Savings API
// ==========================================
const SAVINGS_OPERATOR_ROLES = ['org_admin', 'manager', 'teller', 'cashier', 'member_service'];

router.get('/savings', SavingsController.getAccounts);

// Savings & Deposits teller module (registered BEFORE /savings/:id so the
// single-segment static paths below win over the id param route).
router.get('/savings/accounts/lookup', requireRole(SAVINGS_OPERATOR_ROLES), SavingsDepositController.lookupAccounts);
router.get('/savings/members/search', requireRole(SAVINGS_OPERATOR_ROLES), SavingsDepositController.searchMembers);
router.get('/savings/members/:id/nominees', requireRole(SAVINGS_OPERATOR_ROLES), SavingsDepositController.getMemberNominees);
router.get('/savings/schemes', requireRole(SAVINGS_OPERATOR_ROLES), SavingsDepositController.listSchemes);
router.post('/savings/accounts/open', requireRole(SAVINGS_OPERATOR_ROLES), validateRequest(openAccountSchema), SavingsDepositController.openAccount);
router.put('/savings/accounts/:id', requireRole(SAVINGS_OPERATOR_ROLES), validateRequest(updateAccountSchema), SavingsDepositController.updateAccount);
router.post('/savings/deposits', requireRole(SAVINGS_OPERATOR_ROLES), validateRequest(depositSchema), SavingsDepositController.recordDeposit);
router.post('/savings/deposits/batch', requireRole(SAVINGS_OPERATOR_ROLES), validateRequest(batchDepositSchema), SavingsDepositController.recordBatchDeposits);
router.post('/savings/withdrawals', requireRole(SAVINGS_OPERATOR_ROLES), validateRequest(withdrawalSchema), SavingsDepositController.recordWithdrawal);
router.get('/savings/withdrawals/pending', requireRole(SAVINGS_OPERATOR_ROLES), SavingsDepositController.listPendingWithdrawals);
router.post('/savings/withdrawals/:id/approve', requireRole(['org_admin', 'manager']), validateRequest(withdrawalDecisionSchema), SavingsDepositController.approveWithdrawal);
router.post('/savings/withdrawals/:id/reject', requireRole(['org_admin', 'manager']), validateRequest(withdrawalDecisionSchema), SavingsDepositController.rejectWithdrawal);
router.get('/savings/cheque-deposits', requireRole(SAVINGS_OPERATOR_ROLES), SavingsDepositController.listChequeDeposits);
router.post('/savings/cheque-deposits/:id/clear', requireRole(SAVINGS_OPERATOR_ROLES), validateRequest(withdrawalDecisionSchema), SavingsDepositController.clearChequeDeposit);
router.post('/savings/cheque-deposits/:id/bounce', requireRole(SAVINGS_OPERATOR_ROLES), validateRequest(bounceChequeDepositSchema), SavingsDepositController.bounceChequeDeposit);
router.post('/savings/cheque-transfers', requireRole(SAVINGS_OPERATOR_ROLES), validateRequest(chequeTransferSchema), SavingsDepositController.postChequeTransfer);
router.get('/savings/accounts/:id/ledger', requireRole(SAVINGS_OPERATOR_ROLES), SavingsDepositController.getLedger);
router.get('/savings/accounts/:id/passbook/summary', requireRole(SAVINGS_OPERATOR_ROLES), SavingsDepositController.getPassbookSummary);
router.get('/savings/accounts/:id/unprinted-transactions', requireRole(SAVINGS_OPERATOR_ROLES), SavingsDepositController.getUnprintedTransactions);
router.post('/savings/accounts/:id/passbook/print', requireRole(SAVINGS_OPERATOR_ROLES), validateRequest(printPassbookSchema), SavingsDepositController.printPassbook);
router.get('/savings/passbook/test-align', requireRole(SAVINGS_OPERATOR_ROLES), SavingsDepositController.testAlignment);
router.post('/savings/interest-posting/run', requireRole(['org_admin', 'manager']), validateRequest(batchInterestPostingSchema), SavingsDepositController.batchInterestPosting);

// ── Passbook print layouts (Passbook Design studio persistence) ──────────────
router.get('/passbook-designs', requireRole(SAVINGS_SETTING_READ_ROLES), PassbookController.listDesigns);
router.get('/passbook-designs/:id', requireRole(SAVINGS_SETTING_READ_ROLES), PassbookController.getDesign);
router.post('/passbook-designs', requireRole(['org_admin', 'manager']), PassbookController.createDesign);
router.put('/passbook-designs/:id', requireRole(['org_admin', 'manager']), PassbookController.updateDesign);
router.delete('/passbook-designs/:id', requireRole(['org_admin', 'manager']), PassbookController.deleteDesign);

// ── Passbook booklets (issuance / renewal chain) ─────────────────────────────
router.get('/savings/accounts/:id/passbook/books', requireRole(SAVINGS_OPERATOR_ROLES), PassbookController.listBooks);
router.post('/savings/accounts/:id/passbook/books', requireRole(SAVINGS_OPERATOR_ROLES), PassbookController.issueBook);
router.post('/savings/accounts/:id/passbook/books/renew', requireRole(SAVINGS_OPERATOR_ROLES), PassbookController.renewBook);

// ── Passbook print flow (two-step build → confirm) + print-log records ───────
router.post('/savings/accounts/:id/passbook/build', requireRole(SAVINGS_OPERATOR_ROLES), PassbookController.buildPrintPayload);
router.post('/savings/accounts/:id/passbook/confirm', requireRole(SAVINGS_OPERATOR_ROLES), PassbookController.confirmPrint);
router.get('/savings/accounts/:id/passbook/print-log', requireRole(SAVINGS_OPERATOR_ROLES), PassbookController.listPrintLog);
router.post('/savings/passbook/print-log/:logId/void', requireRole(SAVINGS_OPERATOR_ROLES), PassbookController.voidPrintRun);
// Secure hard delete of a savings account (admin only): archives an immutable
// snapshot of the account + ledger, then permanently removes them atomically.
router.post(
  '/savings/accounts/:id/hard-delete',
  sensitiveRouteLimiter,
  requireRole(['org_admin']),
  validateRequest(hardDeleteSavingsAccountSchema),
  HardDeleteController.hardDeleteSavingsAccount,
);

// Cheque leaf validation for the teller withdrawal form.
router.get('/cheque/leaves/:chequeNumber', requireRole(SAVINGS_OPERATOR_ROLES), SavingsDepositController.validateChequeLeaf);

// ==========================================
// Signature verification pipeline (withdrawal security)
// ==========================================
router.post('/signature/verify', requireRole(SAVINGS_OPERATOR_ROLES), signatureRateLimit, validateRequest(signatureVerifySchema), SignatureVerificationController.verifySignature);
router.get('/savings/accounts/:id/specimens', requireRole(SAVINGS_OPERATOR_ROLES), SignatureVerificationController.listSpecimens);
router.post('/savings/accounts/:id/specimens', requireRole(SAVINGS_OPERATOR_ROLES), validateRequest(captureSpecimenSchema), SignatureVerificationController.captureSpecimen);
router.get('/savings/accounts/:id/signature-logs', requireRole(SAVINGS_OPERATOR_ROLES), SignatureVerificationController.listVerificationActivity);
router.post('/savings/accounts/:id/passbook-reconcile', requireRole(SAVINGS_OPERATOR_ROLES), validateRequest(passbookReconcileSchema), SignatureVerificationController.reconcilePassbook);

router.get('/savings/:id', SavingsController.getAccount);
router.get('/savings/:id/statement', requireRole(SAVINGS_SETTING_READ_ROLES), SavingsController.getStatement);
router.post('/savings', requireRole(['org_admin', 'manager']), SavingsController.openAccount);
router.post('/savings/transaction', requireRole(['org_admin', 'manager', 'teller', 'cashier']), SavingsController.processTransaction);

// ==========================================
// Shares API (शेयर व्यवस्थापन)
// ==========================================
router.get('/shares/summary', requireRole(['org_admin', 'manager', 'teller', 'member_service']), ShareController.getSummary);
router.get('/shares/types', requireRole(['org_admin', 'manager']), ShareController.getTypes);
router.get('/shares/types/:id', requireRole(['org_admin', 'manager']), ShareController.getType);
router.post('/shares/types',
  requireRole(['org_admin', 'manager']),
  validateRequest(createShareTypeSchema),
  ShareController.createType
);
router.put('/shares/types/:id',
  requireRole(['org_admin', 'manager']),
  ShareController.updateType
);
router.delete('/shares/types/:id', requireRole(['org_admin']), ShareController.deleteType);
router.get('/shares/holdings', requireRole(['org_admin', 'manager', 'teller', 'member_service']), ShareController.getHoldings);
router.get('/shares/transactions', requireRole(['org_admin', 'manager', 'teller', 'member_service']), ShareController.getTransactions);
router.get('/shares/certificates', requireRole(['org_admin', 'manager', 'teller', 'member_service']), ShareController.getCertificates);
router.get('/shares/certificate/:memberId', requireRole(['org_admin', 'manager', 'teller', 'member_service']), ShareController.getMemberShareCertificateData);
router.get('/shares/transfers', requireRole(['org_admin', 'manager', 'teller', 'member_service']), ShareController.getTransfers);
router.get('/shares/transfers/:id', requireRole(['org_admin', 'manager', 'teller', 'member_service']), ShareController.getTransfer);
router.get('/shares/register', requireRole(['org_admin', 'manager', 'teller', 'member_service']), ShareController.getShareRegister);
router.get('/shares/accounts/:memberId/nominees', requireRole(['org_admin', 'manager', 'teller', 'member_service']), ShareController.getShareAccountNominees);
router.get('/shares/accounts/:memberId', requireRole(['org_admin', 'manager', 'teller', 'member_service']), ShareController.getShareAccount);
router.get('/shares/unprovisioned-members', requireRole(['org_admin', 'manager', 'teller', 'member_service']), ShareController.getUnprovisionedMembers);
router.get('/shares/settings', requireRole(['org_admin', 'manager']), ShareController.getOrgShareSettings);
router.put('/shares/settings', requireRole(['org_admin']), ShareController.updateOrgShareSettings);
router.post('/shares/open-account',
  requireRole(['org_admin', 'manager', 'teller', 'member_service']),
  validateRequest(openShareAccountSchema),
  ShareController.openShareAccount
);
router.post('/shares/issue',
  requireRole(['org_admin', 'manager', 'teller', 'member_service']),
  validateRequest(issueSharesSchema),
  ShareController.issueShares
);
router.post('/shares/transfer',
  requireRole(['org_admin', 'manager']),
  validateRequest(transferSharesSchema),
  ShareController.transferShares
);
router.post('/shares/holdings/:holdingId/surrender',
  requireRole(['org_admin', 'manager']),
  validateRequest(surrenderSharesSchema),
  ShareController.surrenderShares
);
router.post('/shares/transaction',
  requireRole(['org_admin', 'manager', 'teller', 'member_service']),
  validateRequest(shareTransactionRequestSchema),
  ShareController.processShareTransaction
);

// ==========================================
// Loans API
// ==========================================
router.get('/loans', LoanController.getLoans);
// Note: eligibility route must be registered before /loans/:id so the
// concrete `eligibility/...` path is not swallowed by the `:id` param.
router.get('/loans/eligibility/:memberId/:productId',
  requireRole(['org_admin', 'manager', 'loan_officer']),
  validateRequest(checkEligibilitySchema),
  LoanController.checkEligibility
);
// ------------------------------------------------------------------
// Loan servicing (ledger-posting lifecycle)
//
// Registered BEFORE `/loans/:id` for the same reason as the eligibility
// route above: `portfolio-risk` and `provisioning-settings` are concrete
// single-segment GET paths and would otherwise be captured as an `:id`.
//
// Role split follows the module convention — loan officers originate and
// disburse, tellers/cashiers collect, and the irreversible or policy-level
// operations (write-off, waiver, provisioning bands, portfolio batches)
// are held to org_admin/manager.
// ------------------------------------------------------------------
router.get('/loans/portfolio-risk',
  requireRole(['org_admin', 'manager', 'accountant', 'loan_officer']),
  LoanServicingController.getPortfolioRisk
);
router.get('/loans/provisioning-settings',
  requireRole(['org_admin', 'manager', 'accountant']),
  LoanServicingController.getProvisioningSettings
);
router.put('/loans/provisioning-settings',
  requireRole(['org_admin']),
  validateRequest(provisioningSettingsSchema),
  LoanServicingController.updateProvisioningSettings
);
router.get('/loans/active-portfolio',
  requireRole(['org_admin', 'manager', 'accountant', 'loan_officer']),
  LoanServicingController.getActivePortfolio
);

// Per-loan reads. Two path segments, so these never collide with `/loans/:id`.
router.get('/loans/:id/preview-disbursement',
  requireRole(['org_admin', 'manager', 'loan_officer']),
  LoanServicingController.previewDisbursement
);
router.get('/loans/:id/schedule', LoanServicingController.getSchedule);
router.get('/loans/:id/due', LoanServicingController.getDueBreakdown);
router.get('/loans/:id/penalties', LoanServicingController.listPenalties);
router.get('/loans/:id/reschedules', LoanServicingController.listReschedules);
router.get('/loans/:id/repayments', LoanServicingController.getRepayments);
router.get('/loans/:id/statement', LoanServicingController.getStatement);

// Money-moving writes.
router.post('/loans/disburse',
  requireRole(['org_admin', 'manager', 'loan_officer']),
  validateRequest(disburseLoanSchema),
  LoanServicingController.disburse
);
router.post('/loans/repayment',
  requireRole(['org_admin', 'manager', 'teller', 'cashier']),
  validateRequest(servicingRepaySchema),
  LoanServicingController.recordRepayment
);
router.post('/loans/write-off',
  requireRole(['org_admin']),
  validateRequest(writeOffLoanSchema),
  LoanServicingController.writeOff
);
router.post('/loans/write-off/request',
  requireRole(['org_admin', 'manager', 'loan_officer']),
  LoanServicingController.requestWriteOff
);
router.post('/loans/reschedule',
  requireRole(['org_admin', 'manager']),
  validateRequest(rescheduleLoanSchema),
  LoanServicingController.reschedule
);

// Arrears, penalties and classification.
router.post('/loans/penalties/accrue',
  requireRole(['org_admin', 'manager', 'loan_officer']),
  validateRequest(accruePenaltySchema),
  LoanServicingController.accruePenalty
);
router.post('/loans/penalties/waive',
  requireRole(['org_admin', 'manager']),
  validateRequest(waivePenaltySchema),
  LoanServicingController.waivePenalty
);
router.post('/loans/arrears-run',
  requireRole(['org_admin', 'manager']),
  validateRequest(arrearsBatchSchema),
  LoanServicingController.runArrearsBatch
);
router.post('/loans/classification-run',
  requireRole(['org_admin', 'manager']),
  validateRequest(classifySchema),
  LoanServicingController.runClassificationBatch
);
router.post('/loans/:id/classify',
  requireRole(['org_admin', 'manager', 'loan_officer']),
  validateRequest(classifySchema),
  LoanServicingController.classify
);

router.get('/loans/:id', LoanController.getLoan);
router.post('/loans/apply',
  requireRole(['org_admin', 'manager', 'loan_officer']),
  validateRequest(applyLoanSchema),
  LoanController.applyForLoan
);
router.post('/loans/repay', requireRole(['org_admin', 'manager', 'teller', 'cashier']), validateRequest(repayLoanSchema), LoanController.processRepayment);

// ==========================================
// Accounting API
// ==========================================
router.get('/accounting/coa', AccountingController.getChartOfAccounts);
router.get('/accounting/vouchers', AccountingController.getVouchers);
router.post('/accounting/vouchers', requireRole(['org_admin', 'manager', 'accountant']), AccountingController.createVoucher);
router.post('/accounting/vouchers/:id/post', requireRole(['org_admin', 'manager']), AccountingController.postVoucher);
router.post('/accounting/ledgers/backfill', requireRole(['org_admin']), AccountingController.backfillLedgers);
router.get('/accounting/ledgers', requireRole(['org_admin', 'manager', 'accountant']), AccountingController.getLedgers);

// ==========================================
// Accounting Settings API (SETUPS → Accounting Settings)
// Note: specific routes must be registered before the generic
// `/accounting/settings/:entityType` routes below.
// ==========================================
router.get('/accounting/settings/health', requireRole(['org_admin', 'manager', 'accountant']), AccountingSettingController.getHealth);
router.get('/accounting/settings/system-mappings', requireRole(['org_admin', 'manager', 'accountant']), AccountingSettingController.getSystemMappings);
router.put('/accounting/settings/system-mappings', requireRole(['org_admin', 'manager']), validateRequest(systemMappingsRequest), AccountingSettingController.upsertSystemMappings);
router.get('/accounting/settings/coa', requireRole(['org_admin', 'manager', 'accountant']), AccountingSettingController.getAccounts);
router.post('/accounting/settings/coa/accounts', requireRole(['org_admin', 'manager']), validateRequest(accountCreateRequest), AccountingSettingController.createAccount);
router.put('/accounting/settings/coa/accounts/:id', requireRole(['org_admin', 'manager']), validateRequest(accountUpdateRequest), AccountingSettingController.updateAccount);
router.delete('/accounting/settings/coa/accounts/:id', requireRole(['org_admin']), AccountingSettingController.deleteAccount);
router.get('/accounting/settings/coa/groups', requireRole(['org_admin', 'manager', 'accountant']), AccountingSettingController.getAccountGroups);
router.post('/accounting/settings/coa/groups', requireRole(['org_admin', 'manager']), validateRequest(accountGroupCreateRequest), AccountingSettingController.createAccountGroup);
router.put('/accounting/settings/coa/groups/:id', requireRole(['org_admin', 'manager']), validateRequest(accountGroupUpdateRequest), AccountingSettingController.updateAccountGroup);
router.delete('/accounting/settings/coa/groups/:id', requireRole(['org_admin']), AccountingSettingController.deleteAccountGroup);
// Bulk COA import + standard template seeding (atomic transactions).
// Registered before the generic registry so the specific paths win.
router.post('/accounting/settings/coa/bulk-import', requireRole(['org_admin', 'manager']), validateRequest(bulkImportRequest), COAController.bulkImport);
router.post('/accounting/settings/coa/seed-default', requireRole(['org_admin', 'manager']), validateRequest(seedDefaultRequest), COAController.seedDefault);
router.post('/accounting/settings/financial-periods/:id/status', requireRole(['org_admin', 'manager']), validateRequest(financialPeriodStatusRequest), AccountingSettingController.transitionPeriod);

// Bank account detail (cheque books + leaves)
router.post('/accounting/settings/bank-accounts/void-voucher/:voucherId', requireRole(['org_admin', 'manager', 'accountant']), AccountingSettingController.voidVoucher);
router.get('/accounting/settings/bank-accounts/:id/detail', requireRole(['org_admin', 'manager', 'accountant']), AccountingSettingController.getBankAccountDetail);
router.get('/accounting/settings/bank-accounts/balance-summaries', requireRole(['org_admin', 'manager', 'accountant']), AccountingSettingController.getBalanceSummaries);
router.get('/accounting/settings/bank-accounts/:id/transactions', requireRole(['org_admin', 'manager', 'accountant']), AccountingSettingController.getBankTransactions);
router.post('/accounting/settings/bank-accounts/:id/deposit', requireRole(['org_admin', 'manager', 'accountant', 'teller']), AccountingSettingController.createBankDeposit);

// Generic registry CRUD (registered last so the specific routes win).
router.get('/accounting/settings/:entityType', requireRole(['org_admin', 'manager', 'accountant']), AccountingSettingController.getSettings);
router.get('/accounting/settings/:entityType/:id', requireRole(['org_admin', 'manager', 'accountant']), AccountingSettingController.getSetting);
router.post('/accounting/settings/:entityType', requireRole(['org_admin', 'manager']), validateAccountingSettingRequest(accountingSettingSchemaFor), AccountingSettingController.createSetting);
router.put('/accounting/settings/:entityType/:id', requireRole(['org_admin', 'manager']), validateAccountingSettingRequest(accountingSettingUpdateSchemaFor), AccountingSettingController.updateSetting);
router.delete('/accounting/settings/:entityType/:id', requireRole(['org_admin']), AccountingSettingController.deleteSetting);

// ==========================================
// Subsidiary Ledgers API (सहायक खाताहरू)
// ==========================================
router.get('/subsidiary/books', SubsidiaryController.getBooks);

// ==========================================
// Bank Cheque Management (cooperative's own bank cheques)
// ==========================================
router.get('/bank-cheques/leaves', requireRole(['org_admin', 'manager', 'loan_officer', 'teller']), BankChequeController.getAvailableLeaves);
router.get('/bank-cheques/books', requireRole(['org_admin', 'manager', 'loan_officer']), BankChequeController.getBooks);
router.post('/bank-cheques/issue', requireRole(['org_admin', 'manager']), BankChequeController.issueBook);
router.post('/bank-cheques/void', requireRole(['org_admin', 'manager', 'teller']), BankChequeController.voidLeaf);
router.patch('/bank-cheques/:leafId/clear', requireRole(['org_admin', 'manager', 'teller']), BankChequeController.clearLeaf);
  router.patch('/bank-cheques/:leafId/bounce', requireRole(['org_admin', 'manager', 'teller']), BankChequeController.bounceLeaf);

  router.post('/bank-cheques/voucher', requireRole(['org_admin', 'manager', 'teller']), BankChequeController.postVoucher);
  router.post('/bank-cheques/savings-withdrawal', requireRole(['org_admin', 'manager', 'teller']), BankChequeController.postSavingsWithdrawalByCheque);
  router.post('/bank-cheques/mark-issued', requireRole(['org_admin', 'manager', 'teller']), BankChequeController.markLeafIssued);

  // Internal Cheque Repayment (member savings cheque → loan EMI)
  router.post('/bank-cheques/internal-repayment', requireRole(['org_admin', 'manager', 'teller']), BankChequeController.postInternalChequeRepayment);

// Member Settings reorder (patched onto the existing member-settings block above)
router.patch(
  '/member-settings/:entityType/reorder',
  requireRole(['org_admin', 'manager']),
  MemberSettingsController.reorder
);

// ==========================================
// Legal Document Generator Studio
// ==========================================
const legalDocRoles = ['org_admin', 'manager', 'loan_officer', 'member_service'];

// Categories
router.get('/legal-docs/categories', requireRole(legalDocRoles), LegalDocumentController.listCategories);
router.post('/legal-docs/categories', requireRole(['org_admin', 'manager']), LegalDocumentController.createCategory);

// Templates
router.get('/legal-docs/templates', requireRole(legalDocRoles), LegalDocumentController.listTemplates);
router.get('/legal-docs/templates/:id', requireRole(legalDocRoles), LegalDocumentController.getTemplate);
router.post('/legal-docs/templates', requireRole(['org_admin', 'manager']), LegalDocumentController.createTemplate);
router.put('/legal-docs/templates/:id', requireRole(['org_admin', 'manager']), LegalDocumentController.updateTemplate);

// Versions
router.get('/legal-docs/templates/:templateId/versions', requireRole(legalDocRoles), LegalDocumentController.listVersions);
router.get('/legal-docs/versions/:id', requireRole(legalDocRoles), LegalDocumentController.getVersion);
router.post('/legal-docs/templates/:templateId/versions', requireRole(['org_admin', 'manager']), LegalDocumentController.createVersion);
router.put('/legal-docs/versions/:id', requireRole(['org_admin', 'manager']), LegalDocumentController.updateVersion);
router.post('/legal-docs/versions/:id/approve', requireRole(['org_admin']), LegalDocumentController.approveVersion);

// Clauses
router.get('/legal-docs/clauses', requireRole(legalDocRoles), LegalDocumentController.listClauses);
router.post('/legal-docs/clauses', requireRole(['org_admin', 'manager']), LegalDocumentController.createClause);

// Documents
router.post('/legal-docs/generate', requireRole(legalDocRoles), LegalDocumentController.generateDocument);
router.get('/legal-docs/documents', requireRole(legalDocRoles), LegalDocumentController.listDocuments);
router.get('/legal-docs/documents/:id', requireRole(legalDocRoles), LegalDocumentController.getDocument);
router.patch('/legal-docs/documents/:id/print', requireRole(legalDocRoles), LegalDocumentController.markPrinted);

// Audit
router.get('/legal-docs/audit', requireRole(legalDocRoles), LegalDocumentController.getAuditTrail);

// ==========================================
// Reconciliation
// ==========================================
const reconRoles = ['org_admin', 'manager', 'accountant', 'teller'];

// Sessions
router.post('/reconciliation/sessions', requireRole(reconRoles), ReconciliationController.createSession);
router.get('/reconciliation/sessions', requireRole(reconRoles), ReconciliationController.getSessions);
router.get('/reconciliation/sessions/:id', requireRole(reconRoles), ReconciliationController.getSessionById);
router.put('/reconciliation/sessions/:id', requireRole(reconRoles), ReconciliationController.updateSession);

// Outstanding cheques & deposits in transit
router.get('/reconciliation/outstanding-cheques', requireRole(reconRoles), ReconciliationController.getOutstandingCheques);
router.post('/reconciliation/sessions/:id/outstanding', requireRole(reconRoles), ReconciliationController.addOutstandingItems);
router.patch('/reconciliation/outstanding/:id', requireRole(reconRoles), ReconciliationController.updateOutstandingItem);

// Statement entries
router.post('/reconciliation/sessions/:id/statement-entries', requireRole(reconRoles), ReconciliationController.addStatementEntries);

// Adjustments (bank charges, interest, etc.)
router.post('/reconciliation/sessions/:id/adjustments', requireRole(reconRoles), ReconciliationController.addAdjustment);
router.delete('/reconciliation/adjustments/:id', requireRole(reconRoles), ReconciliationController.deleteAdjustment);

// Auto-match & summary
router.post('/reconciliation/sessions/:id/auto-match', requireRole(reconRoles), ReconciliationController.autoMatch);
router.get('/reconciliation/sessions/:id/summary', requireRole(reconRoles), ReconciliationController.getSummary);

// Data feeds
router.get('/reconciliation/bank-accounts', requireRole(reconRoles), ReconciliationController.getBankAccounts);
router.get('/reconciliation/book-entries', requireRole(reconRoles), ReconciliationController.getBookEntries);
router.get('/reconciliation/deposits-in-transit', requireRole(reconRoles), ReconciliationController.getDepositsInTransit);

// Finalize
router.post('/reconciliation/sessions/:id/finalize', requireRole(reconRoles), ReconciliationController.finalizeReconciliation);

// Variance logs
router.get('/reconciliation/variance-logs', requireRole(reconRoles), ReconciliationController.getVarianceLogs);
router.post('/reconciliation/variance-logs', requireRole(reconRoles), ReconciliationController.createVarianceLog);
router.patch('/reconciliation/variance-logs/:id', requireRole(reconRoles), ReconciliationController.resolveVarianceLog);
router.get('/reconciliation/variance-summary', requireRole(reconRoles), ReconciliationController.getVarianceSummary);

// ==========================================
// Regulatory Returns API
// ==========================================
import { RegulatoryReportController } from '../controllers/RegulatoryReportController';
import { AgmGovernanceController } from '../controllers/AgmGovernanceController';
import { AgmManagementController } from '../controllers/AgmManagementController';
import { AuditEngineController } from '../controllers/AuditEngineController';
const reportRoles = ['org_admin', 'manager', 'accountant'];
router.get('/reports/doc-annual-return', requireRole(reportRoles), RegulatoryReportController.getDocAnnualReturn);
router.get('/reports/doc-statistical-return', requireRole(reportRoles), RegulatoryReportController.getDocStatisticalReturn);
router.get('/reports/ird-tax-return', requireRole(reportRoles), RegulatoryReportController.getIrdTaxReturnSummary);
  router.get('/reports/tds-deduction', requireRole(reportRoles), RegulatoryReportController.getTdsDeductionReport);

  // AGM & Governance Reports
  router.get('/reports/agm-presentation-pack', requireRole(reportRoles), AgmGovernanceController.getAgmPresentationPack);
  router.get('/reports/agm-resolution-minutes', requireRole(reportRoles), AgmGovernanceController.getAgmResolutionMinutes);
  router.get('/reports/board-meeting', requireRole(reportRoles), AgmGovernanceController.getBoardMeetingReport);
  router.get('/reports/agm-attendance-quorum', requireRole(reportRoles), AgmGovernanceController.getAgmAttendanceQuorum);

  // AGM Management CRUD
  const agmRoles = ['org_admin', 'manager', 'accountant'];
  router.get('/agm/meetings', requireRole(agmRoles), AgmManagementController.getMeetings);
  router.get('/agm/meetings/:id', requireRole(agmRoles), AgmManagementController.getMeeting);
  router.post('/agm/meetings', requireRole(agmRoles), AgmManagementController.createMeeting);
  router.put('/agm/meetings/:id', requireRole(agmRoles), AgmManagementController.updateMeeting);
  router.patch('/agm/meetings/:id/agenda', requireRole(agmRoles), AgmManagementController.updateAgenda);
  router.delete('/agm/meetings/:id', requireRole(agmRoles), AgmManagementController.deleteMeeting);
  // Attendees
  router.get('/agm/meetings/:meetingId/attendees', requireRole(agmRoles), AgmManagementController.getAttendees);
  router.post('/agm/meetings/:meetingId/attendees', requireRole(agmRoles), AgmManagementController.addAttendee);
  router.post('/agm/meetings/:meetingId/attendees/bulk', requireRole(agmRoles), AgmManagementController.bulkAddMembers);
  router.put('/agm/attendees/:id', requireRole(agmRoles), AgmManagementController.updateAttendee);
  router.delete('/agm/attendees/:id', requireRole(agmRoles), AgmManagementController.deleteAttendee);
  // Resolutions
  router.get('/agm/meetings/:meetingId/resolutions', requireRole(agmRoles), AgmManagementController.getResolutions);
  router.post('/agm/meetings/:meetingId/resolutions', requireRole(agmRoles), AgmManagementController.addResolution);
  router.put('/agm/resolutions/:id', requireRole(agmRoles), AgmManagementController.updateResolution);
  router.delete('/agm/resolutions/:id', requireRole(agmRoles), AgmManagementController.deleteResolution);
  // News
  router.get('/agm/news', requireRole(agmRoles), AgmManagementController.getNews);
  router.post('/agm/news', requireRole(agmRoles), AgmManagementController.createNews);
  router.put('/agm/news/:id', requireRole(agmRoles), AgmManagementController.updateNews);
  router.delete('/agm/news/:id', requireRole(agmRoles), AgmManagementController.deleteNews);
  // Team Members
  router.get('/agm/team', requireRole(agmRoles), AgmManagementController.getTeamMembers);
  router.get('/agm/team/:id', requireRole(agmRoles), AgmManagementController.getTeamMember);
  router.post('/agm/team', requireRole(agmRoles), AgmManagementController.addTeamMember);
  router.put('/agm/team/:id', requireRole(agmRoles), AgmManagementController.updateTeamMember);
  router.delete('/agm/team/:id', requireRole(agmRoles), AgmManagementController.deleteTeamMember);

  // ═══════════════════════════════════════════════════════════════════════
  // AUDIT ENGINE
  // ═══════════════════════════════════════════════════════════════════════
  const auditRoles = ['org_admin', 'manager', 'accountant'];
  const auditAdminRoles = ['org_admin'];

  // Dashboard
  router.get('/audit/dashboard', requireRole(auditRoles), AuditEngineController.getDashboardStats);

  // Rules CRUD
  router.get('/audit/rules', requireRole(auditRoles), AuditEngineController.getRules);
  router.post('/audit/rules', requireRole(auditAdminRoles), AuditEngineController.createRule);
  router.put('/audit/rules/:id', requireRole(auditAdminRoles), AuditEngineController.updateRule);
  router.delete('/audit/rules/:id', requireRole(auditAdminRoles), AuditEngineController.deleteRule);
  router.post('/audit/rules/seed', requireRole(auditAdminRoles), AuditEngineController.seedDefaultRules);

  // Runs
  router.get('/audit/runs', requireRole(auditRoles), AuditEngineController.getRuns);
  router.get('/audit/runs/:id', requireRole(auditRoles), AuditEngineController.getRun);
  router.post('/audit/runs', requireRole(auditRoles), AuditEngineController.triggerRun);

  // Findings
  router.get('/audit/findings', requireRole(auditRoles), AuditEngineController.getFindings);
  router.put('/audit/findings/:id/resolve', requireRole(auditRoles), AuditEngineController.resolveFinding);

  // Workpapers
  router.get('/audit/workpapers/:findingId', requireRole(auditRoles), AuditEngineController.getWorkpapers);
  router.post('/audit/workpapers', requireRole(auditRoles), AuditEngineController.addWorkpaper);

  // Opinion
  router.get('/audit/opinion/:runId', requireRole(auditRoles), AuditEngineController.getOpinionDraft);
  router.put('/audit/opinion/:runId', requireRole(auditRoles), AuditEngineController.updateOpinionDraft);

  // Signoffs
  router.get('/audit/signoffs/:runId', requireRole(auditRoles), AuditEngineController.getSignoffs);
  router.post('/audit/signoffs', requireRole(auditRoles), AuditEngineController.addSignoff);

  // ── Document Template Design Studio ──────────────────────────────────────
  const tmplAdminRoles = ['org_admin', 'manager'];
  router.get('/document-templates', requireRole(tmplAdminRoles), DocumentTemplateController.list);
  router.get('/document-templates/:id', requireRole(tmplAdminRoles), DocumentTemplateController.get);
  router.post('/document-templates', requireRole(tmplAdminRoles), DocumentTemplateController.create);
  router.put('/document-templates/:id', requireRole(tmplAdminRoles), DocumentTemplateController.update);
  router.delete('/document-templates/:id', requireRole(tmplAdminRoles), DocumentTemplateController.delete);
  router.post('/document-templates/:id/publish', requireRole(tmplAdminRoles), DocumentTemplateController.publish);
  router.post('/document-templates/:id/unpublish', requireRole(tmplAdminRoles), DocumentTemplateController.unpublish);
  router.get('/document-templates/:id/versions', requireRole(tmplAdminRoles), DocumentTemplateController.listVersions);
  router.post('/document-templates/:id/restore/:versionId', requireRole(tmplAdminRoles), DocumentTemplateController.restoreVersion);
  router.post('/document-templates/:id/clone', requireRole(tmplAdminRoles), DocumentTemplateController.clone);

export default router;
