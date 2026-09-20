import { PearlsLedgerInputs, PearlsReport, RatioResult } from '../types/pearls';

/**
 * Computes individual compliance statuses based on standard WOCCU / Department of Cooperatives benchmarks.
 * When the denominator is zero (nothing to measure), the ratio is vacuously
 * compliant — the cooperative is not failing a metric it does not have.
 */
const evaluateCompliance = (code: string, value: number | null): boolean => {
  if (value === null) return true; // vacuously compliant — nothing to measure
  switch (code) {
    case 'P1': return Math.abs(value - 100) < 0.001; // Must be exactly 100%
    case 'P2': return Math.abs(value - 35) < 0.001;  // Recommended 35% for remaining risk pool
    case 'E1': return value >= 70 && value <= 80;    // Ideal structure: 70% - 80% of assets in loans
    case 'E5': return value >= 70 && value <= 80;    // Savings deposits should be 70-80% of assets (WOCCU standard)
    case 'L1': return value >= 15 && value <= 20;    // 15% - 20% liquid reserve threshold
    default: return false;
  }
};

/**
 * PEARLS Financial Analysis Engine
 */
export const calculatePearlsMetrics = (inputs: PearlsLedgerInputs): PearlsReport => {
  const safeDivide = (numerator: number, denominator: number): number | null => {
    if (denominator === 0) return null; // nothing to measure
    return (numerator / denominator) * 100;
  };

  // --- Formula P1: Protection 1 ---
  // Formula: (Allowance for Poor Loans / Delinquent Loans > 12 Months) * 100
  // Target: 100% allowance provision coverage for severe long-term delinquency.
  const p1Value = safeDivide(inputs.allowanceForPoorLoans, inputs.delinquentLoansMoreThan12Months);
  const P1: RatioResult = {
    code: 'P1',
    name: 'Allowance for Severe Delinquency (>12M) Coverage',
    value: p1Value !== null ? parseFloat(p1Value.toFixed(2)) : 0,
    targetDescription: p1Value !== null ? 'Exactly 100%' : 'N/A — no delinquency',
    isCompliant: evaluateCompliance('P1', p1Value)
  };

  // --- Formula P2: Protection 2 ---
  // Formula: (Allowance for Doubtful Loans / Delinquent Loans 1-12 Months) * 100
  // Target: 35% allowance provision coverage for mid-tier risk portfolio.
  const p2Value = safeDivide(inputs.allowanceForDoubtfulLoans, inputs.delinquentLoans1To12Months);
  const P2: RatioResult = {
    code: 'P2',
    name: 'Allowance for Moderate Delinquency (1-12M) Coverage',
    value: p2Value !== null ? parseFloat(p2Value.toFixed(2)) : 0,
    targetDescription: p2Value !== null ? 'Exactly 35%' : 'N/A — no delinquency',
    isCompliant: evaluateCompliance('P2', p2Value)
  };

  // --- Formula E1: Effective Financial Structure 1 ---
  // Formula: (Net Loan Portfolio / Total Assets) * 100
  // Target: 70% - 80% of total assets should be out generating high yield in active member loans.
  const e1Value = safeDivide(inputs.netLoanPortfolio, inputs.totalAssets);
  const E1: RatioResult = {
    code: 'E1',
    name: 'Net Loan Portfolio to Total Assets Ratio',
    value: e1Value !== null ? parseFloat(e1Value.toFixed(2)) : 0,
    targetDescription: e1Value !== null ? '70% - 80%' : 'N/A',
    isCompliant: evaluateCompliance('E1', e1Value)
  };

  // --- Formula E5: Effective Financial Structure 5 ---
  // Formula: (Savings Deposits / Total Assets) * 100
  // Target: 70-80% (WOCCU standard — member savings should be the dominant funding source).
  const e5Value = safeDivide(inputs.savingsDeposits, inputs.totalAssets);
  const E5: RatioResult = {
    code: 'E5',
    name: 'Savings Deposits to Total Assets Ratio',
    value: e5Value !== null ? parseFloat(e5Value.toFixed(2)) : 0,
    targetDescription: e5Value !== null ? '70% - 80%' : 'N/A',
    isCompliant: evaluateCompliance('E5', e5Value)
  };

  // --- Formula L1: Liquidity 1 ---
  // Formula: (Liquid Assets / Total Short-Term Obligations) * 100
  // Target: 15% to 20% kept readily extractable to meet daily cash withdrawal demands.
  const l1Value = safeDivide(inputs.liquidAssets, inputs.shortTermObligations);
  const L1: RatioResult = {
    code: 'L1',
    name: 'Liquid Assets to Short-Term Obligations Ratio',
    value: l1Value !== null ? parseFloat(l1Value.toFixed(2)) : 0,
    targetDescription: l1Value !== null ? '15% - 20%' : 'N/A',
    isCompliant: evaluateCompliance('L1', l1Value)
  };

  // Calculate Aggregated Health Score metric
  const metricsList = [P1, P2, E1, E5, L1];
  const compliantCount = metricsList.filter(m => m.isCompliant).length;
  const overallHealthScore = parseFloat(((compliantCount / metricsList.length) * 100).toFixed(1));

  return {
    generatedAt: new Date().toISOString(),
    ratios: { P1, P2, E1, E5, L1 },
    overallHealthScore
  };
};
