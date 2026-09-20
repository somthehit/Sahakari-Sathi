/**
 * Structural input parameters representing aggregated ledger balances
 * required to calculate target PEARLS ratios accurately.
 */
export interface PearlsLedgerInputs {
  // Protection Metrics
  allowanceForPoorLoans: number;       // Provision for Non-Performing Loans (> 12 months)
  delinquentLoansMoreThan12Months: number; // Total loan volume overdue by > 12 months
  allowanceForDoubtfulLoans: number;   // Provision for Sub-Standard Loans (1 - 12 months)
  delinquentLoans1To12Months: number;  // Total loan volume overdue by 1 to 12 months

  // Asset & Structure Metrics
  totalAssets: number;                 // Total assets of the cooperative
  netLoanPortfolio: number;            // Gross Loan Portfolio minus Loan Loss Provisions
  savingsDeposits: number;             // Total member savings deposits
  shareCapital: number;                // Total member institutional share capital
  institutionalCapital: number;        // Retained earnings + core reserves (un-withdrawable)

  // Liquidity Metrics
  liquidAssets: number;                // Cash in hand + Bank balances + Short-term risk-free investments
  shortTermObligations: number;        // Immediate short-term liabilities / payable deposits
}

export interface RatioResult {
  code: string;
  name: string;
  value: number;            // Calculated percentage or ratio value
  targetDescription: string;
  isCompliant: boolean;     // Automatically flagged against regulatory bounds
}

export interface PearlsReport {
  generatedAt: string;
  ratios: {
    P1: RatioResult;
    P2: RatioResult;
    E1: RatioResult;
    E5: RatioResult;
    L1: RatioResult;
  };
  overallHealthScore: number; // Percentage of metrics meeting target guidelines
}
