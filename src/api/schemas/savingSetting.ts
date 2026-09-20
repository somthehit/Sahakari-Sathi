/**
 * Shared Zod schemas for the SETUPS → Savings A/C Settings domain.
 *
 * Single source of truth for request validation across:
 *   savings-products (Account Products — canonical product config)
 * plus cheque-book issuance and the org default savings product selector.
 *
 * Conventions (mirrors shareSetting.ts / loanSetting.ts):
 *  - Every schema is a `z.object({ body: ... })` wrapper that plugs directly
 *    into `validateRequest`.
 *  - Tenant columns (organization_id, created_by, updated_by) are NEVER
 *    accepted on the wire — they are always derived server-side from the
 *    authenticated JWT.
 *  - `code` is normalized to UPPERCASE server-side; the DB unique index on
 *    (organization_id, code) therefore enforces case-insensitive uniqueness.
 *  - savings-products is the canonical product config: it carries interest
 *    rate/method, amount bounds, eligibility, KYC, deposit/withdrawal limits,
 *    minimum balance penalty, dormancy, closure, charges, cheque facility and
 *    the accounting (GL) mapping. The authoritative rate history lives in
 *    savings_interest_rates and is maintained automatically by the controller
 *    whenever interestRate changes.
 */
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

export const SAVINGS_SETTING_ENTITY_TYPES = ['savings-products'] as const;

export type SavingsSettingEntityType = (typeof SAVINGS_SETTING_ENTITY_TYPES)[number];

export const SAVING_PRODUCT_TYPES = ['regular', 'recurring', 'fixed', 'daily_deposit'] as const;
export const SAVING_INTEREST_METHODS = ['min_monthly_balance', 'daily_product', 'quarterly_min_balance', 'simple', 'compound'] as const;
export const SAVING_POSTING_FREQUENCIES = ['Daily', 'Monthly', 'Quarterly', 'Half_Yearly', 'Annually'] as const;

export const savingSettingBasePayload = z.object({
  code: z.string().min(1, 'Code is required').max(20, 'Code must be 20 characters or fewer'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
  nameNepali: z.string().max(100).nullish(),
  description: z.string().max(500).nullish(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

/** Savings Product extras (canonical Account Product config). */
export const savingProductExtraPayload = z.object({
  productType: z.enum(SAVING_PRODUCT_TYPES).optional(),
  productCategory: z.string().max(100).nullish(),
  accountNoPrefix: z.string().max(10).optional(),
  // Interest / rate
  interestRate: z.coerce.number().min(0).max(100, 'Rate must be between 0 and 100').optional(),
  interestPostingFrequency: z.enum(SAVING_POSTING_FREQUENCIES).optional(),
  interestCalculationMethod: z.enum(SAVING_INTEREST_METHODS).optional(),
  interestEffectiveDate: z.string().max(20).nullish(),
  // Amount bounds
  minBalance: z.coerce.number().min(0).optional(),
  minDeposit: z.coerce.number().min(0).optional(),
  maxDeposit: z.coerce.number().min(0).nullable().optional(),
  maxBalance: z.coerce.number().min(0).nullable().optional(),
  tenureMonths: z.coerce.number().int().min(0).nullable().optional(),
  penaltyRate: z.coerce.number().min(0).optional(),
  // Eligibility
  eligibleMemberTypeIds: z.array(z.string().uuid()).optional(),
  minAge: z.coerce.number().int().min(0).nullable().optional(),
  maxAge: z.coerce.number().int().min(0).nullable().optional(),
  // KYC
  requiresKycVerified: z.boolean().optional(),
  requiresNominee: z.boolean().optional(),
  requiresPhoto: z.boolean().optional(),
  requiresSignature: z.boolean().optional(),
  requiresDocuments: z.boolean().optional(),
  // Opening
  openingDepositRequired: z.boolean().optional(),
  // Deposit rules
  depositModeCash: z.boolean().optional(),
  depositModeBank: z.boolean().optional(),
  depositModeTransfer: z.boolean().optional(),
  depositModeAgent: z.boolean().optional(),
  dailyDepositLimit: z.coerce.number().min(0).nullable().optional(),
  monthlyDepositLimit: z.coerce.number().min(0).nullable().optional(),
  backdateDepositAllowed: z.boolean().optional(),
  depositRequiresApproval: z.boolean().optional(),
  // Withdrawal rules
  withdrawalModeCash: z.boolean().optional(),
  withdrawalModeTransfer: z.boolean().optional(),
  minWithdrawal: z.coerce.number().min(0).nullable().optional(),
  maxWithdrawal: z.coerce.number().min(0).nullable().optional(),
  dailyWithdrawalLimit: z.coerce.number().min(0).nullable().optional(),
  monthlyWithdrawalLimit: z.coerce.number().min(0).nullable().optional(),
  minimumBalanceAfterWithdrawal: z.coerce.number().min(0).nullable().optional(),
  withdrawalRequiresApproval: z.boolean().optional(),
  // Minimum balance penalty
  minBalanceGraceDays: z.coerce.number().int().min(0).optional(),
  minBalancePenaltyPercent: z.coerce.number().min(0).optional(),
  minBalancePenaltyAmount: z.coerce.number().min(0).optional(),
  minBalancePenaltyFrequency: z.enum(SAVING_POSTING_FREQUENCIES).optional(),
  minBalanceWaiverAllowed: z.boolean().optional(),
  // Dormancy
  inactiveAfterMonths: z.coerce.number().int().min(0).optional(),
  dormantAfterMonths: z.coerce.number().int().min(0).optional(),
  notifyBeforeDormancyDays: z.coerce.number().int().min(0).optional(),
  reactivationRequired: z.boolean().optional(),
  reactivationApprovalRequired: z.boolean().optional(),
  // Closure
  closureAllowed: z.boolean().optional(),
  minimumBalanceBeforeClosure: z.coerce.number().min(0).optional(),
  closureRequiresApproval: z.boolean().optional(),
  closureFee: z.coerce.number().min(0).optional(),
  // Charges & fees
  openingFee: z.coerce.number().min(0).optional(),
  monthlyMaintenanceFee: z.coerce.number().min(0).optional(),
  withdrawalFee: z.coerce.number().min(0).optional(),
  chequeBookFee: z.coerce.number().min(0).optional(),
  chequeLeafFee: z.coerce.number().min(0).optional(),
  stopPaymentFee: z.coerce.number().min(0).optional(),
  chequeReturnFee: z.coerce.number().min(0).optional(),
  passbookFee: z.coerce.number().min(0).optional(),
  statementFee: z.coerce.number().min(0).optional(),
  // Cheque facility
  chequeEnabled: z.boolean().optional(),
  chequeDefaultLeaves: z.coerce.number().int().min(1).optional(),
  chequeMaxBooks: z.coerce.number().int().min(0).optional(),
  // Cheque validity — how many days a cheque is valid from its date.
  // Default 90 days (common Nepali banking practice); confirm with Som for
  // the exact regulatory figure before changing the default.
  chequeValidityDays: z.coerce.number().int().min(1).max(730).optional(),
  // Accounting (GL) mapping
  glLiabilityAccountId: z.string().uuid().nullable().optional(),
  glInterestExpenseAccountId: z.string().uuid().nullable().optional(),
  glInterestPayableAccountId: z.string().uuid().nullable().optional(),
  glFeeIncomeAccountId: z.string().uuid().nullable().optional(),
  glPenaltyIncomeAccountId: z.string().uuid().nullable().optional(),
  glChequeIncomeAccountId: z.string().uuid().nullable().optional(),
});

/** Full payload schema for a given entity type. */
export function savingSettingPayloadFor(entityType: string) {
  if (entityType === 'savings-products') {
    return savingSettingBasePayload.extend(savingProductExtraPayload.shape);
  }
  return savingSettingBasePayload;
}

/** Full `{ body }` wrapper for a specific entity type. */
export function savingSettingSchemaFor(entityType: string) {
  return z.object({ body: savingSettingPayloadFor(entityType) });
}

/** Update (`PUT`) wrapper — inner fields partial so sparse bodies are accepted. */
export function savingSettingUpdateSchemaFor(entityType: string) {
  return z.object({ body: savingSettingPayloadFor(entityType).partial() });
}

/**
 * Org default savings product selector:
 *   { defaultSavingProductId: uuid | null }  — null clears the default.
 */
export const setDefaultSavingProductSchema = z.object({
  body: z.object({
    defaultSavingProductId: z.string().uuid().nullable().optional(),
  }),
});

/** Cheque book issuance payload. */
export const issueChequeBookSchema = z.object({
  body: z.object({
    accountId: z.string().uuid('Account id must be a valid UUID'),
    leafCount: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

/**
 * Per-entity validation middleware (drop-in for `validateRequest`).
 * Reads `params.entityType` to pick the correct payload shape.
 */
export const validateSavingSettingRequest = (schemaFor: (entityType: string) => z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schemaFor(String(req.params.entityType)).parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error: any) {
      if (error && error.name === 'ZodError') {
        const zodError = error as z.ZodError<any>;
        return res.status(400).json({
          error: 'Validation Failed',
          details: (zodError.issues || []).map((err: any) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      return res.status(500).json({ error: 'Internal Server Error during validation' });
    }
  };
};