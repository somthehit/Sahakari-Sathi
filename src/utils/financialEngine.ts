/**
 * Financial Calculation Engine - Nepalese SACCOS Compliance
 */
import { addDaysBS, getDaysInBSMonth, convertBSToAD } from './nepaliCalendar';

export interface EmiCalculationResult {
  monthlyPayment: number;
  totalInterest: number;
  totalPayment: number;
}

export type LoanInterestMethod =
  | 'flat'                // Flat rate — interest on full principal for the whole tenure
  | 'diminishing_emi'     // Diminishing-Equal EMI — reducing balance, equal installments
  | 'diminishing_principal' // Diminishing-Equal Principal — constant principal + reducing interest
  | 'daily_reducing'      // Daily reducing — interest accrued on actual days (365/360)
  | 'bullet';             // Bullet — interest-only installments, full principal at maturity

export interface EmiInstallment {
  installmentNo: number;
  dueDateBs: string;
  principal: number;
  interest: number;
  totalEmi: number;
  balancePrincipal: number;
}

export interface LoanScheduleResult {
  installments: EmiInstallment[];
  totalInterest: number;
  totalPayment: number;
  /** Nominal fixed (or first) installment — used for display/quoting. */
  monthlyPayment: number;
  method: LoanInterestMethod;
}

export interface LoanScheduleOptions {
  principal: number;
  annualRatePct: number;
  tenureMonths: number;
  method: LoanInterestMethod;
  /** Disbursement date (BS, YYYY-MM-DD) — anchor for the schedule. */
  startDateBs: string;
  /** Day of the BS month installments fall due on (clamped to month length). Default 1. */
  installmentDayOfMonth?: number;
  /** Day-count convention for daily accrual. Default '365'. */
  dayCount?: '365' | '360';
  /** Per-installment rounding. Default 'round'. */
  rounding?: 'round' | 'floor' | 'ceil';
  /** JS getDay() indices treated as working days. Default [0..5] = Sun–Fri. */
  workingDayIndices?: number[];
  /** Shift due dates falling on a non-working day forward. Default true. */
  shiftToWorkingDay?: boolean;
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

const applyRounding = (v: number, mode: 'round' | 'floor' | 'ceil'): number => {
  if (mode === 'floor') return Math.floor(v * 100) / 100;
  if (mode === 'ceil') return Math.ceil(v * 100) / 100;
  return Math.round(v * 100) / 100;
};

const zeroResult = (): EmiCalculationResult => ({ monthlyPayment: 0, totalInterest: 0, totalPayment: 0 });

// ---------------------------------------------------------------------------
// BS date helpers (schedule generation)
// ---------------------------------------------------------------------------
function parseBs(bsDate: string): { y: number; m: number; d: number } {
  const parts = String(bsDate).split('-').map((p) => parseInt(p, 10));
  return { y: parts[0] || 2083, m: parts[1] || 4, d: parts[2] || 1 };
}

/** Adds whole BS months to a date; clamps the day to the target month's length. */
export function addMonthsBS(bsDate: string, months: number, dayOfMonth?: number): string {
  const { y, m, d } = parseBs(bsDate);
  const total = m - 1 + months;
  const ny = y + Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12 + 1;
  const maxDay = getDaysInBSMonth(ny, nm);
  const nd = Math.min(dayOfMonth || d, maxDay);
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

function bsToAdMs(bsDate: string): number {
  const ad = convertBSToAD(bsDate);
  const p = ad.split('-').map((x) => parseInt(x, 10));
  if (p.length !== 3 || isNaN(p[0])) return 0;
  return new Date(p[0], p[1] - 1, p[2]).getTime();
}

/** Whole days between two BS dates (positive when toBs is later). */
export function daysBetweenBS(fromBs: string, toBs: string): number {
  return Math.round((bsToAdMs(toBs) - bsToAdMs(fromBs)) / 86400000);
}

/** JS getDay() index (0=Sunday … 6=Saturday) for a BS date. */
function getDayOfWeekBS(bsDate: string): number {
  const ad = convertBSToAD(bsDate);
  const p = ad.split('-').map((x) => parseInt(x, 10));
  if (p.length !== 3 || isNaN(p[0])) return 0;
  return new Date(p[0], p[1] - 1, p[2]).getDay();
}

/** Shifts a BS date forward to the next working day (bounded loop). */
export function shiftToNextWorkingDay(bsDate: string, workingDayIndices: number[]): string {
  let cur = bsDate;
  let guard = 0;
  while (!workingDayIndices.includes(getDayOfWeekBS(cur)) && guard < 15) {
    cur = addDaysBS(cur, 1);
    guard += 1;
  }
  return cur;
}

/**
 * Calculates monthly EMI payments based on reducing/declining balance method.
 * Formula: EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
 * where r = annualRate / (12 * 100)
 */
export const calculateDecliningEMI = (
  principal: number,
  annualRatePct: number,
  tenureMonths: number
): EmiCalculationResult => {
  if (principal <= 0 || tenureMonths <= 0) {
    return { monthlyPayment: 0, totalInterest: 0, totalPayment: 0 };
  }

  if (annualRatePct <= 0) {
    const monthlyPayment = principal / tenureMonths;
    return {
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      totalInterest: 0,
      totalPayment: principal,
    };
  }

  const monthlyRate = annualRatePct / (12 * 100);
  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  const monthlyPayment = (principal * monthlyRate * factor) / (factor - 1);
  const totalPayment = monthlyPayment * tenureMonths;
  const totalInterest = totalPayment - principal;

  return {
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalPayment: Math.round(totalPayment * 100) / 100,
  };
};

/**
 * Flat-rate EMI: interest is charged on the FULL principal for the whole
 * tenure, so the monthly payment is constant and independent of the
 * outstanding balance.
 *   monthlyInterest = P * r / (12 * 100);  monthlyPayment = P/n + monthlyInterest
 */
export const calculateFlatEMI = (
  principal: number,
  annualRatePct: number,
  tenureMonths: number
): EmiCalculationResult => {
  if (principal <= 0 || tenureMonths <= 0) return zeroResult();
  const totalInterestExact = (principal * annualRatePct * tenureMonths) / 1200;
  const totalPaymentExact = principal + totalInterestExact;
  const monthlyPayment = round2(totalPaymentExact / tenureMonths);
  const totalPayment = round2(totalPaymentExact);
  return {
    monthlyPayment,
    totalInterest: round2(totalInterestExact),
    totalPayment,
  };
};

/**
 * Diminishing-Equal-Principal: principal repaid in equal monthly instalments;
 * interest accrues on the reducing balance each month, so installments decline.
 */
export const calculateDiminishingEqualPrincipalEMI = (
  principal: number,
  annualRatePct: number,
  tenureMonths: number
): EmiCalculationResult => {
  if (principal <= 0 || tenureMonths <= 0) return zeroResult();
  const monthlyRate = annualRatePct / 1200;
  const principalShare = round2(principal / tenureMonths);
  let balance = principal;
  let totalInterest = 0;
  let first = 0;
  for (let k = 0; k < tenureMonths; k++) {
    const interest = round2(balance * monthlyRate);
    const p = k === tenureMonths - 1 ? balance : Math.min(principalShare, balance);
    if (k === 0) first = round2(p + interest);
    totalInterest += interest;
    balance = round2(balance - p);
  }
  const totalPayment = round2(principal + totalInterest);
  return { monthlyPayment: first, totalInterest: round2(totalInterest), totalPayment };
};

/**
 * Full BS installment schedule generator — the single source of truth for the
 * Module 6 EMI Schedule Settings preview and future origination engine.
 *
 * Supports all five methods. Due dates are computed on the BS calendar,
 * clamped to each month's length, and optionally shifted forward to the next
 * working day (Module 1 working_days). `daily_reducing` accrues interest on
 * the actual days elapsed between due dates using the 365/360 convention.
 */
export const generateLoanSchedule = (options: LoanScheduleOptions): LoanScheduleResult => {
  const {
    principal, annualRatePct, tenureMonths, method,
    startDateBs, installmentDayOfMonth = 1, dayCount = '365',
    rounding = 'round', shiftToWorkingDay = true,
  } = options;

  const empty: LoanScheduleResult = {
    installments: [], totalInterest: 0, totalPayment: 0, monthlyPayment: 0, method,
  };
  if (principal <= 0 || tenureMonths <= 0) return empty;

  const workingDays = options.workingDayIndices && options.workingDayIndices.length
    ? [...new Set(options.workingDayIndices)]
    : [0, 1, 2, 3, 4, 5]; // Sunday..Friday, Saturday off (default Nepal)

  // 1. Raw due dates (BS month arithmetic, day clamped to month length).
  const rawDates: string[] = [];
  for (let i = 1; i <= tenureMonths; i++) {
    rawDates.push(addMonthsBS(startDateBs, i, installmentDayOfMonth));
  }

  // 2. Shift non-working-day due dates forward.
  const dueDates = shiftToWorkingDay
    ? rawDates.map((d) => shiftToNextWorkingDay(d, workingDays))
    : rawDates;

  // 3. Actual days per period (daily_reducing uses these).
  const periodDays: number[] = [];
  let prev = startDateBs;
  for (const d of dueDates) {
    periodDays.push(daysBetweenBS(prev, d));
    prev = d;
  }

  const r = annualRatePct / 100;
  const monthlyRate = r / 12;
  const principalShare = round2(principal / tenureMonths);

  // Fixed installment for equal-EMI methods (computed once).
  let equalEmi = 0;
  if (method === 'diminishing_emi') {
    equalEmi = annualRatePct > 0
      ? applyRounding((principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths))
        / (Math.pow(1 + monthlyRate, tenureMonths) - 1), rounding)
      : applyRounding(principal / tenureMonths, rounding);
  }

  const installments: EmiInstallment[] = [];
  let balance = principal;

  for (let k = 0; k < tenureMonths; k++) {
    const last = k === tenureMonths - 1;
    let interest = 0;
    let pPart = 0;

    if (method === 'flat') {
      interest = applyRounding(principal * monthlyRate, rounding);
      pPart = last ? balance : applyRounding(principalShare, rounding);
    } else if (method === 'diminishing_emi') {
      interest = applyRounding(balance * monthlyRate, rounding);
      pPart = last ? balance : Math.min(Math.max(equalEmi - interest, 0), balance);
    } else if (method === 'diminishing_principal') {
      interest = applyRounding(balance * monthlyRate, rounding);
      pPart = last ? balance : Math.min(principalShare, balance);
    } else if (method === 'daily_reducing') {
      const dailyRate = r / (dayCount === '360' ? 360 : 365);
      interest = applyRounding(balance * dailyRate * periodDays[k], rounding);
      pPart = last ? balance : Math.min(principalShare, balance);
    } else if (method === 'bullet') {
      interest = applyRounding(principal * monthlyRate, rounding);
      pPart = last ? balance : 0;
    }

    if (last) pPart = balance;
    pPart = Math.min(pPart, balance);
    balance = round2(balance - pPart);
    if (balance < 0) balance = 0;

    installments.push({
      installmentNo: k + 1,
      dueDateBs: dueDates[k],
      principal: round2(pPart),
      interest: round2(interest),
      totalEmi: round2(pPart + interest),
      balancePrincipal: balance,
    });
  }

  const totalPayment = round2(installments.reduce((s, i) => s + i.totalEmi, 0));
  const totalInterest = round2(installments.reduce((s, i) => s + i.interest, 0));

  return {
    installments,
    totalInterest,
    totalPayment,
    monthlyPayment: installments[0]?.totalEmi ?? 0,
    method,
  };
};

export interface DoubleEntryItem {
  type?: 'DEBIT' | 'CREDIT';
  debit?: number;
  credit?: number;
  amount?: number;
  accountId?: string;
}

/**
 * Real-time Diminishing Day-to-Day Interest Breakdown.
 *
 * Used at repayment time to compute the exact accrued interest based on
 * the number of days elapsed since the last payment, then splits the
 * repayment amount into interest + principal + excess.
 *
 * Formula: Accrued Interest = Outstanding × Rate% × Days / 365
 */
export interface RealtimeBreakdownInput {
  outstandingPrincipal: number;
  annualRatePct: number;
  lastPaymentDateBs: string;
  currentPaymentDateBs: string;
  paymentAmount: number;
  /** Interest calculation method. Default 'diminishing_daily'. */
  method?: 'diminishing_daily' | 'flat';
  /** Original disbursed principal — only needed for flat-rate method. */
  originalPrincipal?: number;
  /** Total tenure in months — only needed for flat-rate method. */
  tenureMonths?: number;
}

export interface RealtimeBreakdownResult {
  daysElapsed: number;
  accruedInterest: number;
  principalPaid: number;
  excessToSavings: number;
  newOutstandingPrincipal: number;
  /** Daily interest rate used (for display). */
  dailyRatePct: number;
  /** Active method used for this calculation. */
  method: 'diminishing_daily' | 'flat';
  /** Shortfall when payment doesn't cover interest (positive = interest unpaid). */
  interestShortfall: number;
}

export function calculateRealtimeEmiBreakdown(
  input: RealtimeBreakdownInput,
): RealtimeBreakdownResult {
  const {
    outstandingPrincipal,
    annualRatePct,
    lastPaymentDateBs,
    currentPaymentDateBs,
    paymentAmount,
    method = 'diminishing_daily',
    originalPrincipal,
    tenureMonths,
  } = input;

  const daysElapsed = Math.max(0, daysBetweenBS(lastPaymentDateBs, currentPaymentDateBs));

  let accruedInterest: number;
  let dailyRatePct: number;

  if (method === 'flat') {
    // Flat rate: interest on ORIGINAL principal for the full tenure,
    // then pro-rated by days elapsed / total days in tenure.
    // dailyRatePct displayed as the effective daily charge on original principal.
    const origPrincipal = originalPrincipal || outstandingPrincipal;
    const tenureDays = (tenureMonths || 12) * 30; // approximate BS year: 12×30 = 360 days
    const totalFlatInterest = origPrincipal * (annualRatePct / 100) * (tenureMonths || 12) / 12;
    dailyRatePct = annualRatePct / 100 / 365;
    // Pro-rata: fraction of total flat interest for days elapsed
    accruedInterest = Math.round(totalFlatInterest * (daysElapsed / Math.max(tenureDays, 1)));
  } else {
    // Diminishing daily: interest on CURRENT outstanding only
    dailyRatePct = annualRatePct / 100 / 365;
    accruedInterest = Math.round(outstandingPrincipal * dailyRatePct * daysElapsed);
  }

  let principalPaid = 0;
  let excessToSavings = 0;
  let interestShortfall = 0;

  if (paymentAmount >= accruedInterest) {
    principalPaid = paymentAmount - accruedInterest;
    if (principalPaid > outstandingPrincipal) {
      excessToSavings = principalPaid - outstandingPrincipal;
      principalPaid = outstandingPrincipal;
    }
  } else {
    // Payment doesn't fully cover interest
    interestShortfall = accruedInterest - paymentAmount;
  }

  const newOutstandingPrincipal = outstandingPrincipal - principalPaid;

  return {
    daysElapsed,
    accruedInterest,
    principalPaid,
    excessToSavings,
    newOutstandingPrincipal,
    dailyRatePct: round2(dailyRatePct * 100), // as percentage
    method,
    interestShortfall,
  };
}

/**
 * Verifies if sum of Debits equals sum of Credits in a double-entry voucher.
 * Accepts either { debit, credit } style or { type, amount } style entries.
 */
export const verifyDoubleEntryBalance = (entries: DoubleEntryItem[]): boolean => {
  if (!entries || entries.length === 0) return false;

  let totalDebit = 0;
  let totalCredit = 0;

  for (const entry of entries) {
    if (typeof entry.debit === 'number' || typeof entry.credit === 'number') {
      totalDebit += entry.debit || 0;
      totalCredit += entry.credit || 0;
    } else if (entry.type && typeof entry.amount === 'number') {
      if (entry.type === 'DEBIT') {
        totalDebit += entry.amount;
      } else if (entry.type === 'CREDIT') {
        totalCredit += entry.amount;
      }
    }
  }

  return Math.abs(totalDebit - totalCredit) < 0.001;
};
