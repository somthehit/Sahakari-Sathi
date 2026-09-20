import { apiClient } from '../lib/apiClient';

export type LoanSettingsEntityType = 'loan-products' | 'loan-categories' | 'collateral-types' | 'guarantor-types';

export interface EligibilityCheckResult {
  key: string;
  label: string;
  ok: boolean;
  required: string;
  actual: string;
}

export interface LoanEligibilityResult {
  eligible: boolean;
  allowOverride: boolean;
  reasons: string[];
  checks: EligibilityCheckResult[];
}

export const LOAN_INTEREST_METHOD_LABELS: Record<string, string> = {
  flat: 'Flat',
  diminishing_emi: 'Diminishing (Equal EMI)',
  diminishing_principal: 'Diminishing (Equal Principal)',
  daily_reducing: 'Daily Reducing Balance',
  bullet: 'Bullet (Interest-Only)',
};

export interface LoanSettingBase {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  nameNepali: string | null;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoanProduct extends LoanSettingBase {
  productType: string;
  categoryId: string | null;
  categoryCode: string | null;
  categoryName: string | null;
  interestRate: number;
  interestMethod: string;
  minAmount: number;
  maxAmount: number;
  minTenureMonths: number;
  maxTenureMonths: number;
  penaltyRate: number;
  processingFeePercent: number;
  minMembershipMonths: number;
  minShareAmount: number;
  requireActiveSavings: boolean;
  minSavingsBalance: number;
  requireVerifiedKyc: boolean;
  allowEligibilityOverride: boolean;
  eligibleMemberTypeIds: string[];
  eligibleMemberCategoryIds: string[];
  rateHistory: { id: string; rate: number; effectiveFromBs: string; effectiveToBs: string | null }[];
  guarantorRules: LoanGuarantorRule[];
  usageCount: number;
}

export interface LoanCategory extends LoanSettingBase {
  usageCount: number;
}

export interface GuarantorType extends LoanSettingBase {
  usageCount: number;
}

export interface LoanGuarantorRule {
  guarantorTypeId: string;
  code: string;
  name: string;
  minCount: number;
  maxCount: number | null;
  coveragePercent: number;
}

export interface CollateralType extends LoanSettingBase {
  valuationRequired: boolean;
  usageCount: number;
}

export interface GuarantorSettings {
  id: string;
  minGuarantors: number;
  maxGuarantors: number | null;
  requiredCoveragePercent: number;
  allowMemberGuarantors: boolean;
}

export interface EmiScheduleSettings {
  id: string;
  defaultInterestMethod: string;
  enabledMethods: string[];
  dayCountConvention: '365' | '360';
  installmentDayOfMonth: number;
  roundingMode: 'round' | 'floor' | 'ceil';
  shiftToWorkingDay: boolean;
}

const toNum = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toInt = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : 0;
};

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

const normalizeBase = (row: any): LoanSettingBase => ({
  id: str(row.id),
  organizationId: str(row.organizationId),
  code: str(row.code),
  name: str(row.name),
  nameNepali: row.nameNepali ? str(row.nameNepali) : null,
  description: row.description ? str(row.description) : null,
  isActive: row.isActive !== false,
  sortOrder: toInt(row.sortOrder),
  isSystem: row.isSystem === true,
  createdAt: str(row.createdAt),
  updatedAt: str(row.updatedAt),
});

const normalizeProduct = (row: any): LoanProduct => ({
  ...normalizeBase(row),
  productType: str(row.productType) || 'general',
  categoryId: row.categoryId ? str(row.categoryId) : null,
  categoryCode: row.categoryCode ? str(row.categoryCode) : null,
  categoryName: row.categoryName ? str(row.categoryName) : null,
  interestRate: toNum(row.interestRate),
  interestMethod: str(row.interestMethod) || 'diminishing_emi',
  minAmount: toNum(row.minAmount),
  maxAmount: toNum(row.maxAmount),
  minTenureMonths: toInt(row.minTenureMonths),
  maxTenureMonths: toInt(row.maxTenureMonths),
  penaltyRate: toNum(row.penaltyRate),
  processingFeePercent: toNum(row.processingFeePercent),
  minMembershipMonths: toInt(row.minMembershipMonths),
  minShareAmount: toNum(row.minShareAmount),
  requireActiveSavings: row.requireActiveSavings === true,
  minSavingsBalance: toNum(row.minSavingsBalance),
  requireVerifiedKyc: row.requireVerifiedKyc === undefined ? true : row.requireVerifiedKyc === true,
  allowEligibilityOverride: row.allowEligibilityOverride === true,
  eligibleMemberTypeIds: Array.isArray(row.eligibleMemberTypeIds) ? row.eligibleMemberTypeIds : [],
  eligibleMemberCategoryIds: Array.isArray(row.eligibleMemberCategoryIds) ? row.eligibleMemberCategoryIds : [],
  rateHistory: Array.isArray(row.rateHistory)
    ? row.rateHistory.map((r: any) => ({
        id: str(r.id),
        rate: toNum(r.rate),
        effectiveFromBs: str(r.effectiveFromBs),
        effectiveToBs: r.effectiveToBs ? str(r.effectiveToBs) : null,
      }))
    : [],
  guarantorRules: Array.isArray(row.guarantorRules)
    ? row.guarantorRules.map((r: any) => ({
        guarantorTypeId: str(r.guarantorTypeId),
        code: str(r.code),
        name: str(r.name),
        minCount: toInt(r.minCount),
        maxCount: r.maxCount !== null && r.maxCount !== undefined ? toInt(r.maxCount) : null,
        coveragePercent: toNum(r.coveragePercent),
      }))
    : [],
  usageCount: toInt(row.usageCount),
});

export const fetchLoanSettings = async (entityType: LoanSettingsEntityType): Promise<any[]> => {
  try {
    const { data } = await apiClient.get(`/loan-settings/${entityType}`);
    const rows = Array.isArray(data) ? data : [];
    if (entityType === 'loan-products') return rows.map(normalizeProduct);
    if (entityType === 'collateral-types') {
      return rows.map((row: any) => ({
        ...normalizeBase(row),
        valuationRequired: row.valuationRequired !== false,
        usageCount: toInt(row.usageCount),
      }));
    }
    return rows.map((row: any) => ({ ...normalizeBase(row), usageCount: toInt(row.usageCount) }));
  } catch (error: any) {
    console.error(`[fetchLoanSettings:${entityType}] failed:`, error?.response?.data || error?.message);
    return [];
  }
};

export const fetchGuarantorSettings = async (): Promise<GuarantorSettings | null> => {
  try {
    const { data } = await apiClient.get('/loan-settings/guarantor-settings');
    return {
      id: str(data.id),
      minGuarantors: toInt(data.minGuarantors),
      maxGuarantors: data.maxGuarantors !== null && data.maxGuarantors !== undefined ? toInt(data.maxGuarantors) : null,
      requiredCoveragePercent: toNum(data.requiredCoveragePercent),
      allowMemberGuarantors: data.allowMemberGuarantors !== false,
    };
  } catch (error: any) {
    console.error('[fetchGuarantorSettings] failed:', error?.response?.data || error?.message);
    return null;
  }
};

export const fetchEmiScheduleSettings = async (): Promise<EmiScheduleSettings | null> => {
  try {
    const { data } = await apiClient.get('/loan-settings/emi-schedule-settings');
    return {
      id: str(data.id),
      defaultInterestMethod: str(data.defaultInterestMethod) || 'diminishing_emi',
      enabledMethods: Array.isArray(data.enabledMethods) ? data.enabledMethods : [],
      dayCountConvention: data.dayCountConvention === '360' ? '360' : '365',
      installmentDayOfMonth: toInt(data.installmentDayOfMonth),
      roundingMode: data.roundingMode === 'floor' || data.roundingMode === 'ceil' ? data.roundingMode : 'round',
      shiftToWorkingDay: data.shiftToWorkingDay !== false,
    };
  } catch (error: any) {
    console.error('[fetchEmiScheduleSettings] failed:', error?.response?.data || error?.message);
    return null;
  }
};

/** Pre-flight eligibility gate for a member + loan product (loan application wizard). */
export const checkLoanEligibility = async (memberId: string, productId: string): Promise<LoanEligibilityResult | null> => {
  try {
    const { data } = await apiClient.get(`/loans/eligibility/${memberId}/${productId}`);
    if (!data || typeof data !== 'object') return null;
    return {
      eligible: data.eligible === true,
      allowOverride: data.allowOverride === true,
      reasons: Array.isArray(data.reasons) ? data.reasons : [],
      checks: Array.isArray(data.checks)
        ? data.checks.map((c: any) => ({
            key: str(c.key),
            label: str(c.label),
            ok: c.ok === true,
            required: str(c.required),
            actual: str(c.actual),
          }))
        : [],
    };
  } catch (error: any) {
    console.error('[checkLoanEligibility] failed:', error?.response?.data || error?.message);
    return null;
  }
};

/** Submits a credit-appraisal application through the eligibility-gated endpoint. */
export const applyForLoan = async (payload: {
  memberId: string;
  productType: string;
  loanProductId?: string | null;
  appliedAmount: number;
  tenureMonths?: number;
  branchId: string;
  overrideReason?: string;
}): Promise<{ success: boolean; error?: string; reasons?: string[]; code?: string }> => {
  try {
    await apiClient.post('/loans/apply', {
      memberId: payload.memberId,
      productType: payload.productType,
      loanProductId: payload.loanProductId || null,
      appliedAmount: String(payload.appliedAmount),
      tenureMonths: payload.tenureMonths || 24,
      branchId: payload.branchId,
      overrideReason: payload.overrideReason,
    });
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.error || error?.message || 'Loan application failed.',
      reasons: error?.response?.data?.reasons,
      code: error?.response?.data?.code,
    };
  }
};
