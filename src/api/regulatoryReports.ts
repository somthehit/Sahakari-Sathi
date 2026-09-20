import { apiClient } from '../lib/apiClient';

export interface DocAnnualReturn {
  organization: { name: string; registrationNo: string; address: string; phone: string };
  fiscalYear: { code: string; startDate: string; endDate: string } | null;
  summary: {
    totalMembers: number; activeMembers: number; totalShareCapital: number;
    totalSavings: number; totalLoanOutstanding: number; totalLoanDisbursed: number; activeLoans: number;
  };
  financialPosition: {
    totalAssets: number; totalLiabilities: number; totalEquity: number;
    totalIncome: number; totalExpense: number; netSurplus: number;
  };
  generatedAt: string;
}

export interface DocStatisticalReturn {
  organization: { name: string; registrationNo: string };
  fiscalYear: { code: string; startDate: string; endDate: string } | null;
  memberStatistics: { totalMembers: number; activeMembers: number; inactiveMembers: number; pendingMembers: number };
  financialVolume: {
    totalShareCapital: number; shareAccountCount: number; totalSavings: number;
    savingsAccountCount: number; totalLoanDisbursed: number; activeLoans: number; outstandingLoanBalance: number;
  };
  operational: { totalBranches: number; loanApplicationsReceived: number; totalAssets: number; totalLiabilities: number };
  generatedAt: string;
}

export interface IrdTaxReturnSummary {
  organization: { name: string; registrationNo: string; panNumber: string };
  fiscalYear: { code: string; startDate: string; endDate: string } | null;
  incomeBreakdown: { code: string; name: string; amount: number }[];
  expenseBreakdown: { code: string; name: string; amount: number }[];
  summary: { totalIncome: number; totalExpense: number; netProfit: number; taxableIncome: number; taxRate: number; estimatedTax: number };
  generatedAt: string;
}

export interface TdsDeductionReport {
  organization: { name: string; registrationNo: string };
  fiscalYear: { code: string; startDate: string; endDate: string } | null;
  dateRange: { startDate: string; endDate: string };
  entries: { voucherNo: string; dateBs: string; narration: string; debit: number; credit: number }[];
  summary: { totalEntries: number; totalTdsDebit: number; totalTdsCredit: number };
  generatedAt: string;
}

export const fetchDocAnnualReturn = async (): Promise<DocAnnualReturn> => {
  const { data } = await apiClient.get('/reports/doc-annual-return');
  return data;
};

export const fetchDocStatisticalReturn = async (): Promise<DocStatisticalReturn> => {
  const { data } = await apiClient.get('/reports/doc-statistical-return');
  return data;
};

export const fetchIrdTaxReturnSummary = async (): Promise<IrdTaxReturnSummary> => {
  const { data } = await apiClient.get('/reports/ird-tax-return');
  return data;
};

export const fetchTdsDeductionReport = async (startDate?: string, endDate?: string): Promise<TdsDeductionReport> => {
  const params: Record<string, string> = {};
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  const { data } = await apiClient.get('/reports/tds-deduction', { params });
  return data;
};
