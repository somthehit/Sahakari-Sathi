/**
 * Shared Zod schemas for the SETUPS → Loan Settings domain (Module 6).
 *
 * Single source of truth for request validation across:
 *   loan-products, loan-categories, collateral-types
 * plus the two singular org settings:
 *   guarantor-settings, emi-schedule-settings
 *
 * Conventions (mirrors memberSetting.ts / shareSetting.ts):
 *  - Every schema is a `z.object({ body: ... })` wrapper that plugs directly
 *    into `validateRequest`.
 *  - Tenant columns (organization_id, created_by, updated_by) are NEVER
 *    accepted on the wire — they are always derived server-side from the
 *    authenticated JWT.
 *  - `code` is normalized to UPPERCASE server-side; the DB unique index on
 *    (organization_id, code) therefore enforces case-insensitive uniqueness.
 *  - loan-products is the canonical product config: it carries the category
 *    FK, the current interest-rate snapshot (interestRate) and the rate method.
 *    The authoritative time-series history lives in loan_product_interest_rates
 *    and is maintained automatically by the controller when interestRate changes.
 */
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { LOAN_INTEREST_METHODS } from '../../db/schema/loans';

export const LOAN_SETTING_ENTITY_TYPES = [
  'loan-products',
  'loan-categories',
  'collateral-types',
  'guarantor-types',
] as const;

export type LoanSettingEntityType = (typeof LOAN_SETTING_ENTITY_TYPES)[number];

export const loanSettingBasePayload = z.object({
  code: z.string().min(1, 'Code is required').max(20, 'Code must be 20 characters or fewer'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
  nameNepali: z.string().max(100).nullish(),
  description: z.string().max(500).nullish(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

/** Per-product guarantor rule: which guarantor type is permitted and the rules that apply. */
export const loanGuarantorRulePayload = z.object({
  guarantorTypeId: z.string().uuid('Guarantor type id must be a valid UUID'),
  minCount: z.coerce.number().int().min(0, 'Min guarantors must be ≥ 0').optional(),
  maxCount: z.coerce.number().int().min(0, 'Max guarantors must be ≥ 0').nullable().optional(),
  coveragePercent: z.coerce.number().min(0).max(100, 'Coverage must be between 0 and 100').optional(),
});

/** Loan Product extras (canonical product config). */
export const loanProductExtraPayload = z.object({
  categoryId: z.string().uuid().nullish(),
  interestRate: z.coerce.number().min(0).max(100, 'Rate must be between 0 and 100').optional(),
  interestMethod: z.enum(LOAN_INTEREST_METHODS as unknown as [string, ...string[]]).optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
  minTenureMonths: z.coerce.number().int().min(1).optional(),
  maxTenureMonths: z.coerce.number().int().min(1).optional(),
  penaltyRate: z.coerce.number().min(0).optional(),
  processingFeePercent: z.coerce.number().min(0).max(100).optional(),
  eligibleMemberTypeIds: z.array(z.string().uuid()).optional(),
  eligibleMemberCategoryIds: z.array(z.string().uuid()).optional(),
  guarantorRules: z.array(loanGuarantorRulePayload).optional(),
  // Eligibility gate criteria (member lifecycle stage 4). 0/false disables a rule.
  minMembershipMonths: z.coerce.number().int().min(0).optional(),
  minShareAmount: z.coerce.number().min(0).optional(),
  requireActiveSavings: z.boolean().optional(),
  minSavingsBalance: z.coerce.number().min(0).optional(),
  requireVerifiedKyc: z.boolean().optional(),
  allowEligibilityOverride: z.boolean().optional(),
});

/** Collateral Type extras. */
export const collateralTypeExtraPayload = z.object({
  valuationRequired: z.boolean().optional(),
});

/** Singular org Guarantor Settings. */
export const guarantorSettingsPayload = z.object({
  minGuarantors: z.coerce.number().int().min(0, 'Min guarantors must be ≥ 0').optional(),
  maxGuarantors: z.coerce.number().int().min(0, 'Max guarantors must be ≥ 0').nullable().optional(),
  requiredCoveragePercent: z.coerce.number().min(0).max(100, 'Coverage must be between 0 and 100').optional(),
  allowMemberGuarantors: z.boolean().optional(),
});

/** Singular org EMI Schedule Settings. */
export const emiScheduleSettingsPayload = z.object({
  defaultInterestMethod: z.enum(LOAN_INTEREST_METHODS as unknown as [string, ...string[]]).optional(),
  enabledMethods: z.array(z.enum(LOAN_INTEREST_METHODS as unknown as [string, ...string[]])).min(1).optional(),
  dayCountConvention: z.enum(['365', '360']).optional(),
  installmentDayOfMonth: z.coerce.number().int().min(1).max(31, 'Installment day must be 1–31').optional(),
  roundingMode: z.enum(['round', 'floor', 'ceil']).optional(),
  shiftToWorkingDay: z.boolean().optional(),
});

/** Full payload schema for a given entity type. */
export function loanSettingPayloadFor(entityType: string) {
  if (entityType === 'loan-products') {
    return loanSettingBasePayload.extend(loanProductExtraPayload.shape);
  }
  if (entityType === 'collateral-types') {
    return loanSettingBasePayload.extend(collateralTypeExtraPayload.shape);
  }
  return loanSettingBasePayload;
}

/** Full `{ body }` wrapper for a specific entity type. */
export function loanSettingSchemaFor(entityType: string) {
  return z.object({ body: loanSettingPayloadFor(entityType) });
}

/** Update (`PUT`) wrapper — inner fields partial so sparse bodies are accepted. */
export function loanSettingUpdateSchemaFor(entityType: string) {
  return z.object({ body: loanSettingPayloadFor(entityType).partial() });
}

/**
 * Per-entity validation middleware (drop-in for `validateRequest`).
 * Reads `params.entityType` to pick the correct payload shape.
 */
export const validateLoanSettingRequest = (schemaFor: (entityType: string) => z.ZodSchema) => {
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
