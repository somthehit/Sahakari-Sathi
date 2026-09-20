/**
 * Shared Zod schemas for the SETUPS → Organization Settings domain (Module 1).
 *
 * This module is the SINGLE source of truth for request validation of settings
 * writes. Both the Express controllers (server-side) and the React forms
 * (client-side) import these schemas so validation can never drift into two
 * hand-maintained copies.
 *
 * Conventions:
 *  - Every schema is a `z.object({ body: ... })` wrapper that plugs directly
 *    into the `validateRequest` middleware.
 *  - `XxxPayload` exports are the plain `body` schema so the frontend can
 *    `safeParse` form state before submitting.
 *  - Tenant columns (organization_id, branch_id) are NEVER accepted on the
 *  - wire — they are always derived server-side from the authenticated JWT.
 *
 * Module 1 scope decisions (documented here so future modules inherit them):
 *  - Working days are ORG-WIDE ONLY. The `working_days` table has no
 *    `branch_id` column, so branch-level overrides are out of scope for this
 *    iteration. If per-branch hours are ever needed, add the column + a
 *    branch-scoped endpoint as a dedicated follow-up — do not half-implement
 *    it through the org-wide UI.
 *  - Fiscal-year change does NOT trigger any carryforward here. Auto
 *    carryforward (opening balances → new FY) is a separate scheduled process
 *    and is not wired into create/update FiscalYear.
 *  - Localization (BS/AD preference, date format, language) is DISPLAY-ONLY.
 *    It changes how dates render; it does not change the stored data format
 *    (BS dates stay BS in the DB).
 *  - Branch hierarchy is FLAT: `branches` has no `parent_id`; there is no
 *    branch tree/hierarchy feature.
 *  - Base currency is mutable only until the first financial transaction
 *    exists. Once `financial_activity` is present, ExchangeRateController
 *    returns 409 on base-currency change (see `baseCurrencyLocked`).
 */

import { z } from 'zod';

// =============================================
// 1. Organization Profile (PUT /org/profile)
// =============================================
export const orgProfilePayload = z.object({
  organizationName: z.string().min(2, 'Organization name is required').max(255).optional(),
  shortName: z.string().max(20).optional(),
  provinceId: z.string().uuid().nullable().optional(),
  districtId: z.string().uuid().nullable().optional(),
  municipalityId: z.string().uuid().nullable().optional(),
  wardNo: z.number().int().min(1).max(99).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  mobile: z.string().max(20).nullable().optional(),
  email: z.string().email('Invalid email address').nullable().optional(),
  website: z.string().url('Invalid website URL').nullable().optional(),
  pan: z.string().max(20).nullable().optional(),
  registrationNo: z.string().max(50).nullable().optional(),
  registrationDate: z.string().datetime().nullable().optional(),
  fiscalYear: z.string().max(20).nullable().optional(),
  logoUrl: z.string().max(1000).nullable().optional(),
  faviconUrl: z.string().max(1000).nullable().optional(),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Theme color must be a hex color (#RRGGBB)').nullable().optional(),
  timezone: z.string().max(100).nullable().optional(),
  locale: z.string().max(10).nullable().optional(),
  currencyCode: z.string().max(10).nullable().optional(),
  dateFormat: z.enum(['BS', 'AD']).nullable().optional(),
});

export const updateOrgProfileSchema = z.object({
  body: orgProfilePayload,
});

// =============================================
// 2. Working Days & Hours (PUT /working-days)
// =============================================
export const workingDaysPayload = z.object({
  days: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    isWorkingDay: z.boolean().optional(),
    openTime: z.string().optional().or(z.literal('')).or(z.null()),
    closeTime: z.string().optional().or(z.literal('')).or(z.null()),
    halfDay: z.boolean().optional(),
  })).min(1).max(7),
});

export const workingDaysSchema = z.object({ body: workingDaysPayload });

/** Alias kept for route/controller compatibility with the original name. */
export const updateWorkingDaysSchema = workingDaysSchema;

// =============================================
// 3. Fiscal Years (POST/PUT /fiscal-years)
// =============================================
export const fiscalYearPayload = z.object({
  code: z.string().min(1, 'Fiscal year code is required').max(20),
  startDateBS: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date (BS) must be YYYY-MM-DD').optional(),
  endDateBS: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date (BS) must be YYYY-MM-DD').optional(),
  startDateAD: z.string().optional(),
  endDateAD: z.string().optional(),
  isCurrent: z.boolean().optional(),
  status: z.enum(['active', 'closed']).optional(),
});

export const createFiscalYearSchema = z.object({
  body: fiscalYearPayload
    .extend({
      startDateBS: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date (BS) is required'),
      endDateBS: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date (BS) is required'),
    }),
});

export const updateFiscalYearSchema = z.object({ body: fiscalYearPayload.partial() });

// =============================================
// 4. Exchange Rates & Financial Settings
// =============================================
export const exchangeRatePayload = z.object({
  baseCurrency: z.string().default('USD'),
  targetCurrency: z.string().default('NPR'),
  buyRate: z.coerce.number().positive('Buy rate must be positive'),
  sellRate: z.coerce.number().positive('Sell rate must be positive'),
  officialMiddleRate: z.coerce.number().positive('Official middle rate must be positive'),
  effectiveDate: z.string().optional(),
});

export const createExchangeRateSchema = z.object({ body: exchangeRatePayload });

export const financialSettingsPayload = z.object({
  defaultCurrency: z.enum(['NPR', 'USD']).optional(),
  allowedCurrencies: z.array(z.string()).optional(),
  defaultForexMarkupPercent: z.coerce.number().min(0).optional(),
  isTaxEnabled: z.boolean().optional(),
  taxName: z.string().optional(),
  defaultTaxRatePercent: z.coerce.number().min(0).optional(),
  taxNumber: z.string().nullable().optional(),
});

export const updateFinancialSettingsSchema = z.object({ body: financialSettingsPayload });

// =============================================
// 5. Localization Settings (PATCH /org/localization-settings)
// =============================================
export const localizationSettingsPayload = z.object({
  defaultLanguage: z.enum(['ne', 'en']).optional(),
  supportedLanguages: z.array(z.enum(['ne', 'en'])).optional(),
  primaryCalendarSystem: z.enum(['BS', 'AD']).optional(),
  dateDisplayFormat: z.enum([
    'YYYY-MM-DD', 'DD-MM-YYYY', 'MM-DD-YYYY',
    'YYYY/MM/DD', 'DD/MM/YYYY', 'MM/DD/YYYY',
    'MMMM D, YYYY', 'DD MMMM, YYYY',
  ]).optional(),
  numberFormatStyle: z.enum(['IN', 'US']).optional(),
  currencySymbol: z.string().max(16).optional(),
  currencySymbolPosition: z.enum(['prefix', 'suffix']).optional(),
  enableAutoTransliteration: z.boolean().optional(),
});

export const updateLocalizationSettingsSchema = z.object({ body: localizationSettingsPayload });

// =============================================
// 6. Branches (POST/PUT /branches)
// =============================================
export const branchPayload = z.object({
  name: z.string().min(2, 'Branch name is required').max(255),
  code: z.string().min(1, 'Branch code is required').max(50),
  branchType: z.string().max(50).optional(),
  isHeadOffice: z.boolean().optional(),
  address: z.string().optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  municipality: z.string().optional(),
  ward: z.string().optional(),
  tole: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  managerName: z.string().optional(),
  openingDateBs: z.string().optional(),
  status: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  googleMapLink: z.string().optional(),
  logoUrl: z.string().nullable().optional(),
  workingDays: z.string().optional(),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
  vaultLimit: z.number().optional(),
  currentVaultCash: z.number().optional(),
  remarks: z.string().optional(),
});

export const createBranchSchema = z.object({ body: branchPayload });
export const updateBranchSchema = z.object({ body: branchPayload.partial() });

// =============================================
// 7. Security Policy (GET/PUT /org/security-settings)
// =============================================
/**
 * Org-wide security policy.
 *
 * Enforcement is partial by design and the API reports which fields are live
 * (see AuthController.getSecuritySettings → `enforcement`). Password rules,
 * expiry and session timeout are applied; `enforce2fa` and `ipWhitelist` are
 * stored intent only. Bounds below exist to stop a policy that would lock an
 * org out of its own installation — e.g. a 128-character minimum password, or
 * a 1-minute idle timeout.
 */
export const securitySettingsPayload = z.object({
  minPasswordLength: z.number().int().min(6, 'Minimum password length cannot be below 6').max(64).optional(),
  requireSpecialChar: z.boolean().optional(),
  requireNumber: z.boolean().optional(),
  requireUppercase: z.boolean().optional(),
  requireLowercase: z.boolean().optional(),
  /** 0 = passwords never expire. */
  passwordExpiryDays: z.number().int().min(0).max(3650).optional(),
  /** 0 = no idle timeout; otherwise at least 5 minutes to stay usable. */
  sessionTimeoutMinutes: z.number().int().min(0).max(1440)
    .refine(v => v === 0 || v >= 5, 'Session timeout must be 0 (disabled) or at least 5 minutes')
    .optional(),
  enforce2fa: z.boolean().optional(),
  ipWhitelist: z.string().max(4000).nullable().optional(),
  ipWhitelistEnabled: z.boolean().optional(),
});

export const updateSecuritySettingsSchema = z.object({ body: securitySettingsPayload });

// =============================================
// 8. Security Setup Wizard (POST /auth/security-setup/complete)
// =============================================
export const securitySetupPayload = z.object({
  mobileNumber: z.string().regex(/^\d{10}$/, 'Mobile number must be 10 digits').optional(),
  answers: z.array(z.object({
    questionId: z.string().uuid('Invalid security question'),
    answer: z.string().min(3, 'Answer must be at least 3 characters').max(200),
  })).optional(),
});

export const completeSecuritySetupSchema = z.object({ body: securitySetupPayload });
