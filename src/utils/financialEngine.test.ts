import { describe, it, expect } from 'vitest';
import {
  calculateDecliningEMI,
  calculateFlatEMI,
  calculateDiminishingEqualPrincipalEMI,
  generateLoanSchedule,
  addMonthsBS,
  daysBetweenBS,
  shiftToNextWorkingDay,
  verifyDoubleEntryBalance,
} from './financialEngine';
import { getDaysInBSMonth, convertBSToAD } from './nepaliCalendar';

describe('Financial Math Engine - SACCOS Compliance Tests', () => {
  it('should accurately calculate EMI schedules on a reducing balance method', () => {
    const principal = 100000; // NPR 1,00,000
    const annualRate = 14;     // 14% Interest Rate
    const tenureMonths = 12;   // 1 Year duration

    const emiResult = calculateDecliningEMI(principal, annualRate, tenureMonths);

    // Mathematical Expected Output Verification
    expect(emiResult.monthlyPayment).toBeCloseTo(8978.71, 1);
    expect(emiResult.totalInterest).toBeCloseTo(7744.54, 1);
  });

  it('should validate a balanced double-entry voucher array', () => {
    const balancedEntries = [
      { accountId: 'ACC-001', type: 'DEBIT' as const, amount: 5000 },
      { accountId: 'ACC-002', type: 'CREDIT' as const, amount: 5000 }
    ];

    expect(verifyDoubleEntryBalance(balancedEntries)).toBe(true);
  });

  it('should invalidate an unequal double-entry balance array', () => {
    const brokenEntries = [
      { accountId: 'ACC-001', type: 'DEBIT' as const, amount: 5000 },
      { accountId: 'ACC-002', type: 'CREDIT' as const, amount: 4950 } // 50 NPR discrepancy
    ];

    expect(verifyDoubleEntryBalance(brokenEntries)).toBe(false);
  });
});

describe('Flat-rate EMI (Module 6)', () => {
  it('charges interest on the full principal for the whole tenure', () => {
    const res = calculateFlatEMI(100000, 14, 12);
    expect(res.monthlyPayment).toBeCloseTo(9500.0, 1);
    expect(res.totalInterest).toBeCloseTo(14000.0, 1);
    expect(res.totalPayment).toBeCloseTo(114000.0, 1);
  });

  it('returns zeros for invalid inputs', () => {
    expect(calculateFlatEMI(0, 14, 12)).toEqual({ monthlyPayment: 0, totalInterest: 0, totalPayment: 0 });
    expect(calculateFlatEMI(100000, 14, 0).monthlyPayment).toBe(0);
  });
});

describe('Diminishing-Equal-Principal EMI (Module 6)', () => {
  it('reduces interest each month and undercuts flat total interest', () => {
    const res = calculateDiminishingEqualPrincipalEMI(100000, 14, 12);
    const flat = calculateFlatEMI(100000, 14, 12);
    expect(res.monthlyPayment).toBeCloseTo(9500.0, 1);
    expect(res.totalInterest).toBeGreaterThan(0);
    expect(res.totalInterest).toBeLessThan(flat.totalInterest);
    expect(res.totalPayment).toBeCloseTo(100000 + res.totalInterest, 1);
  });
});

describe('BS schedule date helpers (Module 6)', () => {
  it('adds months with day clamped to the target month length', () => {
    const next = addMonthsBS('2082-01-31', 1);
    const [, m, d] = next.split('-').map(Number);
    expect(m).toBe(2);
    expect(d).toBeLessThanOrEqual(getDaysInBSMonth(2082, 2));
  });

  it('rolls the BS year over when months overflow', () => {
    expect(addMonthsBS('2082-11-15', 2)).toBe('2083-01-15');
  });

  it('correctly handles negative month offsets', () => {
    expect(addMonthsBS('2082-04-15', -6)).toBe('2081-10-15');
    expect(addMonthsBS('2082-01-15', -1)).toBe('2081-12-15');
  });

  it('measures whole days between BS dates', () => {
    expect(daysBetweenBS('2082-01-01', '2082-01-31')).toBe(getDaysInBSMonth(2082, 1) - 1);
    expect(daysBetweenBS('2082-04-01', '2082-05-01')).toBeGreaterThan(25);
  });

  it('shifts a date to the next working day (Saturday off)', () => {
    const d = '2082-08-20';
    const shifted = shiftToNextWorkingDay(d, [0, 1, 2, 3, 4, 5]);
    const ad = convertBSToAD(shifted);
    const dow = new Date(ad).getDay();
    expect([0, 1, 2, 3, 4, 5]).toContain(dow);
  });

  it('returns the same date when every day is a working day', () => {
    expect(shiftToNextWorkingDay('2082-08-20', [0, 1, 2, 3, 4, 5, 6])).toBe('2082-08-20');
  });
});

describe('generateLoanSchedule (Module 6)', () => {
  const base = {
    principal: 100000,
    annualRatePct: 14,
    tenureMonths: 12,
    startDateBs: '2082-04-01',
    workingDayIndices: [0, 1, 2, 3, 4, 5],
    shiftToWorkingDay: false,
  };

  it('diminishing_emi matches the classic declining-balance formula', () => {
    const res = generateLoanSchedule({ ...base, method: 'diminishing_emi' });
    expect(res.installments).toHaveLength(12);
    expect(res.monthlyPayment).toBeCloseTo(8978.71, 1);
    expect(res.totalInterest).toBeCloseTo(7744.54, 1);
    expect(res.installments[11].balancePrincipal).toBe(0);
  });

  it('flat produces equal installments of principal + full-principal interest', () => {
    const res = generateLoanSchedule({ ...base, method: 'flat' });
    expect(res.installments).toHaveLength(12);
    expect(res.installments[0].totalEmi).toBeCloseTo(9500, 1);
    expect(res.installments[11].interest).toBeCloseTo(1166.67, 1);
    expect(res.totalInterest).toBeCloseTo(14000, 0);
    expect(res.installments[11].balancePrincipal).toBe(0);
  });

  it('diminishing_principal keeps a constant principal portion', () => {
    const res = generateLoanSchedule({ ...base, method: 'diminishing_principal' });
    const first = res.installments[0].principal;
    const second = res.installments[1].principal;
    expect(Math.abs(first - second)).toBeLessThanOrEqual(0.02);
    expect(res.installments[11].balancePrincipal).toBe(0);
  });

  it('bullet pays interest-only installments then principal at maturity', () => {
    const res = generateLoanSchedule({ ...base, method: 'bullet' });
    expect(res.installments[0].principal).toBe(0);
    expect(res.installments[10].principal).toBe(0);
    expect(res.installments[11].principal).toBeCloseTo(100000, 1);
    expect(res.installments[11].balancePrincipal).toBe(0);
    expect(res.totalInterest).toBeCloseTo(14000, 0);
  });

  it('daily_reducing accrues on actual days and honors the 365/360 convention', () => {
    const d365 = generateLoanSchedule({ ...base, method: 'daily_reducing', dayCount: '365' });
    const d360 = generateLoanSchedule({ ...base, method: 'daily_reducing', dayCount: '360' });
    expect(d365.installments).toHaveLength(12);
    expect(d365.installments[11].balancePrincipal).toBe(0);
    expect(d360.totalInterest).toBeGreaterThan(d365.totalInterest);
    expect(d365.totalInterest).toBeLessThan(14000);
  });

  it('shifts due dates to the next working day when enabled', () => {
    const shifted = generateLoanSchedule({
      ...base,
      method: 'flat',
      shiftToWorkingDay: true,
      workingDayIndices: [0, 1, 2, 3, 4, 5],
    });
    for (const inst of shifted.installments) {
      const dow = new Date(convertBSToAD(inst.dueDateBs)).getDay();
      expect([0, 1, 2, 3, 4, 5]).toContain(dow);
    }
  });

  it('returns an empty schedule for invalid inputs', () => {
    expect(generateLoanSchedule({ ...base, method: 'flat', principal: 0 }).installments).toHaveLength(0);
    expect(generateLoanSchedule({ ...base, method: 'flat', tenureMonths: 0 }).totalPayment).toBe(0);
  });
});
