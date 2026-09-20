import { z } from 'zod';

export const chequeSettingsSchema = z.object({
  scope: z.enum(['organization', 'branch']).default('organization'),
  branchId: z.string().uuid().nullable().optional(),
  enableChequeFacility: z.boolean().default(true),
  eligibleAccountProductIds: z.array(z.string().uuid()).default([]),
  
  defaultLeavesPerBook: z.coerce.number().int().min(1).default(25),
  allowedBookSizes: z.array(z.coerce.number().int()).default([10, 20, 25, 50, 100]),
  maxActiveBooksPerAccount: z.coerce.number().int().min(1).default(1),
  reissueAllowed: z.boolean().default(true),
  reissueAfterExhaustion: z.boolean().default(true),
  lostBookReplacementAllowed: z.boolean().default(true),
  cancelledBookReplacementAllowed: z.boolean().default(true),

  // Issuance eligibility policy (enforced server-side by ChequeService).
  requireKycVerified: z.boolean().default(true),
  blockBlacklistedMembers: z.boolean().default(true),
  minUtilizationForReissue: z.coerce.number().int().min(0).max(100).default(80),
  reissueCooldownDays: z.coerce.number().int().min(0).max(365).default(30),
  allowSupervisorOverride: z.boolean().default(true),

  numberingScope: z.enum(['account_wise', 'product_wise', 'branch_wise', 'org_wise']).default('branch_wise'),
  startingChequeNumber: z.coerce.number().int().min(1).default(100001),
  chequePrefix: z.string().max(20).default('CHQ-'),
  numberLength: z.coerce.number().int().min(4).max(12).default(6),
  allowManualNumberAssignment: z.boolean().default(false),
  preventDuplicateChequeNumbers: z.boolean().default(true),
  
  validityPeriodDays: z.coerce.number().int().min(1).max(730).default(90),
  expiredChequeBehavior: z.enum(['flag_only', 'reject_presentation', 'require_approval']).default('reject_presentation'),
  
  stopPaymentEnabled: z.boolean().default(true),
  allowStopPaymentBy: z.array(z.string()).default(['member', 'teller', 'branch_manager', 'admin']),
  stopPaymentCharge: z.coerce.number().min(0).default(0),
  allowStopPaymentOn: z.array(z.string()).default(['single_cheque', 'cheque_range', 'entire_book']),
  stopPaymentRequireApproval: z.boolean().default(true),
  
  bounceHandlingEnabled: z.boolean().default(true),
  bounceCharge: z.coerce.number().min(0).default(0),
  maxBounceCount: z.coerce.number().int().min(1).nullable().optional(),
  afterThresholdAction: z.enum(['flag_account', 'require_manager_review', 'suspend_cheque_facility', 'require_approval', 'no_automatic_action']).default('flag_account'),
  
  issuanceChargeType: z.enum(['flat', 'per_leaf', 'both']).default('flat'),
  issuanceChargeAmount: z.coerce.number().min(0).default(0),
  issuanceChargePerLeafAmount: z.coerce.number().min(0).default(0),
  lostBookCharge: z.coerce.number().min(0).default(0),
  replacementBookCharge: z.coerce.number().min(0).default(0),
  otherChequeCharges: z.array(z.any()).default([]),
  taxApplicable: z.boolean().default(false),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  
  glIssuanceFeeAccountId: z.string().uuid().nullable().optional().or(z.literal('')),
  glStopPaymentFeeAccountId: z.string().uuid().nullable().optional().or(z.literal('')),
  glBounceFeeAccountId: z.string().uuid().nullable().optional().or(z.literal('')),
  glReplacementFeeAccountId: z.string().uuid().nullable().optional().or(z.literal('')),
  glOtherChargesFeeAccountId: z.string().uuid().nullable().optional().or(z.literal('')),
});

export const issueChequeBookSchema = z.object({
  accountId: z.string().uuid('Valid savings account ID is required'),
  leafCount: z.coerce.number().int().min(1).optional(),
  manualPrefix: z.string().optional(),
  manualStartNumber: z.coerce.number().int().optional(),
  purpose: z.string().max(200).optional(),
  deliveryMethod: z.enum(['branch', 'courier']).optional(),
  overrideReason: z.string().max(500).optional(),
});

export const cancelChequeBookSchema = z.object({
  reason: z.string().min(1, 'Reason for cancellation is required'),
});

export const stopPaymentSchema = z.object({
  accountId: z.string().uuid('Valid savings account ID is required'),
  startChequeNumber: z.string().min(1, 'Start cheque number is required'),
  endChequeNumber: z.string().min(1, 'End cheque number is required'),
  reason: z.string().min(1, 'Reason for stop payment is required'),
  chargeAmount: z.coerce.number().min(0).optional(),
});

export const recordBounceSchema = z.object({
  accountId: z.string().uuid('Valid savings account ID is required'),
  chequeLeafId: z.string().uuid().optional(),
  chequeNumber: z.string().min(1, 'Cheque number is required'),
  amount: z.coerce.number().gt(0, 'Amount must be greater than 0'),
  bounceReason: z.string().min(1, 'Bounce reason is required'),
  bounceCharge: z.coerce.number().min(0).optional(),
});

// ─────────────────────────────────────────────────────────────
// Cheque leaf design templates (Cheque Design studio)
// ─────────────────────────────────────────────────────────────

export const chequeDesignSchema = z.object({
  code: z.string().min(1, 'Design code is required').max(40),
  name: z.string().min(1, 'Design name is required').max(120),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
  // Cheque stationery is measured in millimetres (CTS-2010 leaves are 200×92mm;
  // Nepali bank leaves are commonly 175×80mm).
  widthMm: z.coerce.number().positive().max(500).default(200),
  heightMm: z.coerce.number().positive().max(400).default(92),
  // Full ChequeDesignConfig produced by the studio — object or pre-serialized string.
  configJson: z.any().optional(),
  branchId: z.string().uuid().nullable().optional(),
});

export const chequeDesignUpdateSchema = chequeDesignSchema.partial();
