/**
 * Shared Zod schemas for the SETUPS → Accounting Settings domain.
 *
 * Single source of truth for request validation across the config
 * catalogs registered by AccountingSettingController:
 *   voucher-types, cost-centers, journal-templates, financial-periods,
 *   banks, bank-accounts, cash-counters, payment-methods
 * plus the two COA catalogs (account-groups, chart-of-accounts) and the
 * singular system-account-mappings & financial-period transitions.
 *
 * Conventions (mirrors loanSetting.ts / memberSetting.ts):
 *  - Every schema is a `z.object({ body: ... })` wrapper that plugs directly
 *    into `validateRequest`.
 *  - Tenant columns (organization_id, created_by, updated_by) are NEVER
 *    accepted on the wire — always derived server-side from the JWT.
 *  - `code` is normalized to UPPERCASE server-side; DB unique indexes on
 *    (organization_id, code) enforce case-insensitive uniqueness.
 */
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

export const ACCOUNTING_SETTING_ENTITY_TYPES = [
  'voucher-types',
  'cost-centers',
  'journal-templates',
  'financial-periods',
  'banks',
  'bank-accounts',
  'cash-counters',
  'payment-methods',
] as const;

export type AccountingSettingEntityType = (typeof ACCOUNTING_SETTING_ENTITY_TYPES)[number];

/** Voucher categories the existing posting engine understands. */
export const VOUCHER_CATEGORIES = ['Receipt', 'Payment', 'Journal', 'Contra'] as const;
export const NUMBERING_RULES = ['fiscal_year', 'sequential', 'monthly'] as const;
export const JOURNAL_FREQUENCIES = ['manual', 'monthly', 'quarterly', 'annual'] as const;
export const BANK_ACCOUNT_TYPES = ['Current', 'Savings', 'Fixed', 'Other'] as const;
export const PAYMENT_METHOD_TYPES = ['Cash', 'Bank', 'Cheque', 'Digital', 'Card', 'Other'] as const;

/** Mapping keys the engine can resolve at posting time (see getSystemAccount). */
export const SYSTEM_ACCOUNT_KEYS = [
  'share_capital',
  'cash_bank',
  'member_savings',
  'loan_principal_receivable',
  'loan_interest_income',
  'loan_penalty_income',
  'loan_processing_fee_income',
  'savings_interest_expense',
  'dividend_payable',
  'entrance_fee_income',
  'membership_fee_income',
  'suspense',
  'retained_earnings',
  'profit_loss',
] as const;

export const accountingSettingBasePayload = z.object({
  code: z.string().max(20, 'Code must be 20 characters or fewer').nullish(),
  name: z.string().max(100, 'Name must be 100 characters or fewer').nullish(),
  nameNepali: z.string().max(100).nullish(),
  description: z.string().max(500).nullish(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

const uuidOrNull = z.string().uuid('Must be a valid UUID').nullish();

/** Voucher Type extras. */
export const voucherTypeExtraPayload = z.object({
  category: z.enum(VOUCHER_CATEGORIES as unknown as [string, ...string[]]).default('Journal'),
  prefix: z.string().max(8, 'Prefix must be 8 characters or fewer').default('JV'),
  numberingRule: z.enum(NUMBERING_RULES as unknown as [string, ...string[]]).default('fiscal_year'),
  padding: z.coerce.number().int().min(0).max(10).default(6),
  defaultDebitAccountId: uuidOrNull,
  defaultCreditAccountId: uuidOrNull,
  requiresApproval: z.boolean().default(false),
  requiresNarration: z.boolean().default(true),
  requiresCostCenter: z.boolean().default(false),
  requiresReference: z.boolean().default(false),
  isBranchScoped: z.boolean().default(false),
  allowBackdate: z.boolean().default(true),
});

/** Cost Center extras. */
export const costCenterExtraPayload = z.object({
  parentId: uuidOrNull,
  branchId: uuidOrNull,
  managerId: uuidOrNull,
  managerName: z.string().max(100).nullish(),
});

/** Journal template entry line. */
export const journalTemplateEntryPayload = z.object({
  accountId: z.string().uuid('Account id must be a valid UUID'),
  accountCode: z.string().min(1).max(20),
  accountName: z.string().min(1).max(100),
  entryType: z.enum(['debit', 'credit']),
  amountType: z.enum(['amount', 'percent']).default('amount'),
  amount: z.coerce.number().min(0),
  costCenterId: uuidOrNull,
  description: z.string().max(200).nullish(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

/** Journal Template extras. */
export const journalTemplateExtraPayload = z.object({
  voucherTypeId: uuidOrNull,
  narrationTemplate: z.string().max(500).nullish(),
  frequency: z.enum(JOURNAL_FREQUENCIES as unknown as [string, ...string[]]).default('manual'),
  branchId: uuidOrNull,
  entries: z.array(journalTemplateEntryPayload).optional(),
});

/** Financial Period extras. */
export const financialPeriodExtraPayload = z.object({
  fiscalYearId: uuidOrNull,
  fiscalYearCode: z.string().min(1).max(20),
  startDateBs: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'BS dates must be YYYY-MM-DD'),
  endDateBs: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'BS dates must be YYYY-MM-DD'),
  startDateAd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'AD dates must be YYYY-MM-DD'),
  endDateAd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'AD dates must be YYYY-MM-DD'),
  status: z.enum(['draft', 'open', 'locked', 'closed']).default('draft'),
  isCurrent: z.boolean().default(false),
  reason: z.string().max(500).nullish(),
});

/** Bank extras. */
export const bankExtraPayload = z.object({
  swiftCode: z.string().max(20).nullish(),
  shortName: z.string().max(50).nullish(),
});

/** Bank Account extras. */
export const bankAccountExtraPayload = z.object({
  bankId: z.string().uuid('Bank id must be a valid UUID'),
  accountName: z.string().min(1, 'Account name is required').max(100),
  accountNumber: z.string().min(1, 'Account number is required').max(50),
  branchId: uuidOrNull,
  currency: z.string().length(3).default('NPR'),
  glAccountId: uuidOrNull,
  accountType: z.enum(BANK_ACCOUNT_TYPES as unknown as [string, ...string[]]).default('Current'),
  openingBalance: z.coerce.number().default(0),
  openingDateBs: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'BS dates must be YYYY-MM-DD').nullish(),
  isPrimary: z.boolean().default(false),
  reconciliationEnabled: z.boolean().default(false),
  lastReconciledDateBs: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'BS dates must be YYYY-MM-DD').nullish(),
});

/** Cash Counter extras. */
export const cashCounterExtraPayload = z.object({
  branchId: z.string().uuid('Branch id must be a valid UUID'),
  assignedUserId: uuidOrNull,
  glCashAccountId: uuidOrNull,
  openingBalance: z.coerce.number().default(0),
  maxCashLimit: z.coerce.number().min(0).nullish(),
});

/** Payment Method extras. */
export const paymentMethodExtraPayload = z.object({
  type: z.enum(PAYMENT_METHOD_TYPES as unknown as [string, ...string[]]).default('Other'),
  requiresReference: z.boolean().default(false),
  requiresBank: z.boolean().default(false),
  requiresChequeNumber: z.boolean().default(false),
  requiresTransactionId: z.boolean().default(false),
  glAccountId: uuidOrNull,
});

/** Full payload schema for a given entity type. */
export function accountingSettingPayloadFor(entityType: string) {
  switch (entityType) {
    case 'voucher-types':
      return accountingSettingBasePayload.extend(voucherTypeExtraPayload.shape);
    case 'cost-centers':
      return accountingSettingBasePayload.extend(costCenterExtraPayload.shape);
    case 'journal-templates':
      return accountingSettingBasePayload.extend(journalTemplateExtraPayload.shape);
    case 'financial-periods':
      return accountingSettingBasePayload.extend(financialPeriodExtraPayload.shape);
    case 'banks':
      return accountingSettingBasePayload.extend(bankExtraPayload.shape);
    case 'bank-accounts':
      return accountingSettingBasePayload.extend(bankAccountExtraPayload.shape);
    case 'cash-counters':
      return accountingSettingBasePayload.extend(cashCounterExtraPayload.shape);
    case 'payment-methods':
      return accountingSettingBasePayload.extend(paymentMethodExtraPayload.shape);
    default:
      return accountingSettingBasePayload;
  }
}

/** Full `{ body }` wrapper for a specific entity type. */
export function accountingSettingSchemaFor(entityType: string) {
  return z.object({ body: accountingSettingPayloadFor(entityType) });
}

/** Update (`PUT`) wrapper — inner fields partial so sparse bodies are accepted. */
export function accountingSettingUpdateSchemaFor(entityType: string) {
  return z.object({ body: accountingSettingPayloadFor(entityType).partial() });
}

/** COA — Account Group payload. */
export const accountGroupPayload = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  nameNepali: z.string().max(100).nullish(),
  type: z.enum(['Asset', 'Liability', 'Equity', 'Income', 'Expense']),
  parentId: uuidOrNull,
});

/** COA — Chart of Account payload. */
export const accountPayload = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  nameNepali: z.string().max(100).nullish(),
  type: z.enum(['Asset', 'Liability', 'Equity', 'Income', 'Expense']),
  parentCode: z.string().max(20).nullish(),
  normalBalance: z.enum(['debit', 'credit']).default('debit'),
  allowPosting: z.boolean().default(true),
  isControlAccount: z.boolean().default(false),
  cashBankAccount: z.boolean().default(false),
  reconciliationRequired: z.boolean().default(false),
  costCenterRequired: z.boolean().default(false),
  displayOrder: z.coerce.number().int().min(0).default(0),
  branchId: uuidOrNull,
  description: z.string().max(500).nullish(),
  isActive: z.boolean().default(true),
});

/** System account mapping payload (singular org setting). */
export const systemAccountMappingPayload = z.object({
  mappingKey: z.enum(SYSTEM_ACCOUNT_KEYS as unknown as [string, ...string[]]),
  accountId: z.string().uuid('Account id must be a valid UUID'),
  description: z.string().max(500).nullish(),
});

/** Financial period status transition payload. */
export const financialPeriodStatusPayload = z.object({
  status: z.enum(['open', 'locked', 'closed', 'reopen']),
  reason: z.string().max(500).optional(),
});

/** Full `{ body }` wrappers for the dedicated endpoints. */
export const financialPeriodStatusRequest = z.object({ body: financialPeriodStatusPayload });
export const accountCreateRequest = z.object({ body: accountPayload });
export const accountUpdateRequest = z.object({ body: accountPayload.partial() });
export const accountGroupCreateRequest = z.object({ body: accountGroupPayload });
export const accountGroupUpdateRequest = z.object({ body: accountGroupPayload.partial() });
export const systemMappingsRequest = z.object({
  body: z.object({
    mappings: z.array(z.object({
      mappingKey: z.string().min(1),
      accountId: z.string().uuid('Account id must be a valid UUID').nullish(),
      description: z.string().max(500).nullish(),
    })),
  }),
});

/** Per-entity validation middleware (drop-in for `validateRequest`). */
export const validateAccountingSettingRequest = (schemaFor: (entityType: string) => z.ZodSchema) => {
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
