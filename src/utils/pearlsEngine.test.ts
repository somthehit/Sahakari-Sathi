import { describe, it, expect } from 'vitest';
import { calculatePearlsMetrics } from './pearlsEngine';
import { PearlsLedgerInputs } from '../types/pearls';

describe('PEARLS Ratio Analysis Engine', () => {
  it('should accurately compute P1, P2, E1, E5, L1 and health score for compliant inputs', () => {
    const currentCoopBalances: PearlsLedgerInputs = {
      allowanceForPoorLoans: 50000,
      delinquentLoansMoreThan12Months: 50000, // Expected P1 = 100% (Compliant)
      allowanceForDoubtfulLoans: 10500,
      delinquentLoans1To12Months: 30000,     // Expected P2 = 35% (Compliant)
      totalAssets: 12000000,
      netLoanPortfolio: 9000000,             // Expected E1 = 75% (Compliant)
      savingsDeposits: 9000000,              // Expected E5 = 75% (Compliant, 70-80% target)
      shareCapital: 1000000,
      institutionalCapital: 800000,
      liquidAssets: 400000,
      shortTermObligations: 2500000          // Expected L1 = 16% (Compliant)
    };

    const finalReport = calculatePearlsMetrics(currentCoopBalances);

    expect(finalReport.ratios.P1.value).toBe(100);
    expect(finalReport.ratios.P1.isCompliant).toBe(true);

    expect(finalReport.ratios.P2.value).toBe(35);
    expect(finalReport.ratios.P2.isCompliant).toBe(true);

    expect(finalReport.ratios.E1.value).toBe(75);
    expect(finalReport.ratios.E1.isCompliant).toBe(true);

    expect(finalReport.ratios.E5.value).toBe(75);
    expect(finalReport.ratios.E5.isCompliant).toBe(true);

    expect(finalReport.ratios.L1.value).toBe(16);
    expect(finalReport.ratios.L1.isCompliant).toBe(true);

    expect(finalReport.overallHealthScore).toBe(100);
  });

  it('should handle zero denominator gracefully without crashing', () => {
    const emptyBalances: PearlsLedgerInputs = {
      allowanceForPoorLoans: 0,
      delinquentLoansMoreThan12Months: 0,
      allowanceForDoubtfulLoans: 0,
      delinquentLoans1To12Months: 0,
      totalAssets: 0,
      netLoanPortfolio: 0,
      savingsDeposits: 0,
      shareCapital: 0,
      institutionalCapital: 0,
      liquidAssets: 0,
      shortTermObligations: 0
    };

    const report = calculatePearlsMetrics(emptyBalances);
    expect(report.ratios.P1.value).toBe(0);
    expect(report.ratios.P1.targetDescription).toBe('N/A — no delinquency');
    expect(report.ratios.P1.isCompliant).toBe(true);
    expect(report.ratios.P2.targetDescription).toBe('N/A — no delinquency');
    expect(report.ratios.P2.isCompliant).toBe(true);
    expect(report.ratios.E5.targetDescription).toBe('N/A');
    expect(report.overallHealthScore).toBe(100);
  });
});
