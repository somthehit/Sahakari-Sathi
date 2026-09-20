/**
 * Loan Servicing API client
 * ---------------------------------------------------------------------------
 * Frontend surface for the ledger-posting loan lifecycle: disbursement,
 * repayment collection, arrears/penalties, reschedule, write-off, and NPL
 * classification & provisioning.
 *
 * ON ERROR HANDLING — a deliberate departure from loanSettings.ts
 * The read helpers here THROW on failure instead of catching and returning
 * `[]` / `null`. The older pattern makes a 403 or a 500 indistinguishable from
 * "this loan has no installments", which on a loan screen means an outage can
 * render as a fully-paid loan with no arrears. Callers (TanStack Query, or a
 * try/catch in the component) can tell the two apart only if the failure
 * actually propagates.
 *
 * Write helpers return a `{ success, error }` result rather than throwing,
 * matching applyForLoan in loanSettings.ts, because the calling forms need to
 * render the server's validation message inline.
 */
import { apiClient } from '../lib/apiClient';

// ---------------------------------------------------------------------------
// Coercers. The API returns Postgres numerics as strings; every numeric field
// is normalized here so components never do arithmetic on a string.
// ---------------------------------------------------------------------------
const toNum = (v: any): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const toInt = (v: any): number => Math.trunc(toNum(v));
const str = (v: any): string => (v === null || v === undefined ? '' : String(v));
const nullableStr = (v: any): string | null => (v === null || v === undefined || v === '' ? null : String(v));

/** Normalizes an axios/network failure into a readable message. */
const messageOf = (error: any, fallback: string): string =>
  error?.response?.data?.error
  || (Array.isArray(error?.response?.data?.details)
    ? error.response.data.details.map((d: any) => d.message).join('; ')
    : null)
  || error?.message
  || fallback;

export interface MutationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LoanInstallmentStatus = 'Paid' | 'Due' | 'Overdue';
export type NplStatus = 'Pass' | 'Watchlist' | 'Substandard' | 'Doubtful' | 'Loss';

export interface LoanInstallment {
  id: string;
  installmentNo: number;
  dueDateBs: string;
  principal: number;
  interest: number;
  totalEmi: number;
  balancePrincipal: number;
  status: LoanInstallmentStatus;
  paidDateBs: string | null;
  paidAmount: number | null;
  daysLate: number;
}

export interface DisbursementPreview {
  loanId: string;
  loanNo: string;
  memberName: string;
  memberNo: string;
  status: string;
  canDisburse: boolean;
  principal: number;
  annualRatePct: number;
  interestMethod: string;
  tenureMonths: number;
  startDateBs: string;
  maturityDateBs: string | null;
  monthlyEmi: number;
  totalInterest: number;
  totalPayment: number;
  processingFeePercent: number;
  processingFee: number;
  netDisbursable: number;
  installments: Array<{
    installmentNo: number;
    dueDateBs: string;
    principal: number;
    interest: number;
    totalEmi: number;
    balancePrincipal: number;
  }>;
}

export interface LoanDueBreakdown {
  loanId: string;
  loanNo: string;
  memberName: string;
  memberNo: string;
  status: string;
  outstandingPrincipal: number;
  installmentsDue: number;
  principalDue: number;
  interestDue: number;
  penaltyDue: number;
  totalDue: number;
  nextDueDateBs: string | null;
  daysOverdue: number;
  nplStatus: NplStatus;
  asOfDateBs: string;
}

export interface LoanPenalty {
  id: string;
  penaltyDateBs: string;
  daysOverdue: number;
  penaltyRate: number;
  penaltyAmount: number;
  isPaid: boolean;
  paidDateBs: string | null;
  waived: boolean;
  waivedReason: string | null;
}

export interface LoanRescheduleRecord {
  id: string;
  rescheduledDateBs: string;
  previousTenure: number;
  newTenure: number;
  previousRate: number;
  newRate: number;
  previousEmi: number;
  newEmi: number;
  reason: string;
}

export interface LoanStatementEntry {
  id: string;
  voucherNo: string;
  transactionDateBs: string;
  principalDebit: number;
  principalCredit: number;
  interestCredit: number;
  penaltyCredit: number;
  remainingPrincipal: number;
}

export interface LoanStatement {
  loanId: string;
  loanNo: string;
  memberName: string;
  memberNo: string;
  outstandingPrincipal: number;
  entries: LoanStatementEntry[];
}

export interface LoanRepaymentRecord {
  id: string;
  receiptNo: string;
  principalPaid: number;
  interestPaid: number;
  penaltyPaid: number;
  totalPaid: number;
  outstandingAfter: number;
  paymentMode: string;
  dateBs: string;
  dateAd: string;
  collectedBy: string;
  voucherNo: string | null;
  createdAt: string;
}

export interface PortfolioRiskBand {
  nplStatus: NplStatus;
  loanCount: number;
  outstandingPrincipal: number;
  overdueAmount: number;
  provisionAmount: number;
  provisionPercent: number;
}

export interface PortfolioRisk {
  bands: PortfolioRiskBand[];
  loanCount: number;
  totalOutstanding: number;
  totalOverdue: number;
  totalProvision: number;
  nonPerformingAmount: number;
  nplRatioPercent: number;
  policy: {
    watchlistMinDays: number;
    substandardMinDays: number;
    doubtfulMinDays: number;
    lossMinDays: number;
    penaltyGraceDays: number;
    autoClassifyOnAccrual: boolean;
  };
}

export interface ProvisioningSettings {
  id: string;
  watchlistMinDays: number;
  substandardMinDays: number;
  doubtfulMinDays: number;
  lossMinDays: number;
  penaltyGraceDays: number;
  passProvisionPercent: number;
  watchlistProvisionPercent: number;
  substandardProvisionPercent: number;
  doubtfulProvisionPercent: number;
  lossProvisionPercent: number;
  autoClassifyOnAccrual: boolean;
}

export interface DisbursementResult {
  voucherNo: string;
  principal: number;
  processingFee: number;
  netDisbursed: number;
  maturityDateBs: string;
  monthlyEmi: number;
  totalInterest: number;
  installmentCount: number;
  chequeLeaf?: { chequeNumber: string; chequeLeafId: string } | null;
  loanNo?: string;
  memberName?: string;
  memberNo?: string;
  dateBs?: string;
  dateAd?: string;
  disbursedBy?: string;
  branchName?: string;
  branchAddress?: string;
  glEntries?: Array<{
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    narration: string;
  }>;
}

export interface RepaymentResult {
  voucherNo: string;
  receiptNo: string;
  totalPaid: number;
  outstandingAfter: number;
  closed: boolean;
  installmentsClosed: number[];
  penaltiesSettled: number;
  glEntries?: Array<{
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    narration: string;
  }>;
}

export interface ArrearsResult {
  loanId: string;
  loanNo: string;
  skipped: boolean;
  reason?: string;
  daysOverdue: number;
  overdueAmount: number;
  penaltyAccrued: number;
  nplStatus?: NplStatus;
  provisionAmount?: number;
}

export interface BatchRunResult<T> {
  processed: number;
  succeeded: number;
  failed: number;
  results: T[];
  errors: Array<{ loanId: string; error: string }>;
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

const normalizeInstallment = (row: any): LoanInstallment => ({
  id: str(row.id),
  installmentNo: toInt(row.installmentNo),
  dueDateBs: str(row.dueDateBs),
  principal: toNum(row.principal),
  interest: toNum(row.interest),
  totalEmi: toNum(row.totalEmi),
  balancePrincipal: toNum(row.balancePrincipal),
  status: (row.status === 'Paid' || row.status === 'Overdue' ? row.status : 'Due') as LoanInstallmentStatus,
  paidDateBs: nullableStr(row.paidDateBs),
  paidAmount: row.paidAmount === null || row.paidAmount === undefined ? null : toNum(row.paidAmount),
  daysLate: toInt(row.daysLate),
});

const normalizeProvisioning = (data: any): ProvisioningSettings => ({
  id: str(data?.id),
  watchlistMinDays: toInt(data?.watchlistMinDays),
  substandardMinDays: toInt(data?.substandardMinDays),
  doubtfulMinDays: toInt(data?.doubtfulMinDays),
  lossMinDays: toInt(data?.lossMinDays),
  penaltyGraceDays: toInt(data?.penaltyGraceDays),
  passProvisionPercent: toNum(data?.passProvisionPercent),
  watchlistProvisionPercent: toNum(data?.watchlistProvisionPercent),
  substandardProvisionPercent: toNum(data?.substandardProvisionPercent),
  doubtfulProvisionPercent: toNum(data?.doubtfulProvisionPercent),
  lossProvisionPercent: toNum(data?.lossProvisionPercent),
  autoClassifyOnAccrual: data?.autoClassifyOnAccrual !== false,
});

// ---------------------------------------------------------------------------
// Reads — these THROW on failure. See the file header for why.
// ---------------------------------------------------------------------------

export const fetchDisbursementPreview = async (
  loanId: string,
  dateBs?: string,
): Promise<DisbursementPreview> => {
  try {
    const { data } = await apiClient.get(`/loans/${loanId}/preview-disbursement`, {
      params: dateBs ? { dateBs } : undefined,
    });
    return {
      loanId: str(data.loanId),
      loanNo: str(data.loanNo),
      memberName: str(data.memberName),
      memberNo: str(data.memberNo),
      status: str(data.status),
      canDisburse: data.canDisburse === true,
      principal: toNum(data.principal),
      annualRatePct: toNum(data.annualRatePct),
      interestMethod: str(data.interestMethod),
      tenureMonths: toInt(data.tenureMonths),
      startDateBs: str(data.startDateBs),
      maturityDateBs: nullableStr(data.maturityDateBs),
      monthlyEmi: toNum(data.monthlyEmi),
      totalInterest: toNum(data.totalInterest),
      totalPayment: toNum(data.totalPayment),
      processingFeePercent: toNum(data.processingFeePercent),
      processingFee: toNum(data.processingFee),
      netDisbursable: toNum(data.netDisbursable),
      installments: Array.isArray(data.installments)
        ? data.installments.map((i: any) => ({
            installmentNo: toInt(i.installmentNo),
            dueDateBs: str(i.dueDateBs),
            principal: toNum(i.principal),
            interest: toNum(i.interest),
            totalEmi: toNum(i.totalEmi),
            balancePrincipal: toNum(i.balancePrincipal),
          }))
        : [],
    };
  } catch (error: any) {
    throw new Error(messageOf(error, 'Could not load the disbursement preview.'));
  }
};

export const fetchLoanSchedule = async (
  loanId: string,
  asOfDateBs?: string,
): Promise<LoanInstallment[]> => {
  try {
    const { data } = await apiClient.get(`/loans/${loanId}/schedule`, {
      params: asOfDateBs ? { asOfDateBs } : undefined,
    });
    return Array.isArray(data) ? data.map(normalizeInstallment) : [];
  } catch (error: any) {
    throw new Error(messageOf(error, 'Could not load the installment schedule.'));
  }
};

export const fetchLoanDue = async (
  loanId: string,
  asOfDateBs?: string,
): Promise<LoanDueBreakdown> => {
  try {
    const { data } = await apiClient.get(`/loans/${loanId}/due`, {
      params: asOfDateBs ? { asOfDateBs } : undefined,
    });
    return {
      loanId: str(data.loanId),
      loanNo: str(data.loanNo),
      memberName: str(data.memberName),
      memberNo: str(data.memberNo),
      status: str(data.status),
      outstandingPrincipal: toNum(data.outstandingPrincipal),
      installmentsDue: toInt(data.installmentsDue),
      principalDue: toNum(data.principalDue),
      interestDue: toNum(data.interestDue),
      penaltyDue: toNum(data.penaltyDue),
      totalDue: toNum(data.totalDue),
      nextDueDateBs: nullableStr(data.nextDueDateBs),
      daysOverdue: toInt(data.daysOverdue),
      nplStatus: (data.nplStatus ?? 'Pass') as NplStatus,
      asOfDateBs: str(data.asOfDateBs),
    };
  } catch (error: any) {
    throw new Error(messageOf(error, 'Could not load the amount due.'));
  }
};

export const fetchLoanPenalties = async (loanId: string): Promise<LoanPenalty[]> => {
  try {
    const { data } = await apiClient.get(`/loans/${loanId}/penalties`);
    return (Array.isArray(data) ? data : []).map((row: any) => ({
      id: str(row.id),
      penaltyDateBs: str(row.penaltyDateBs),
      daysOverdue: toInt(row.daysOverdue),
      penaltyRate: toNum(row.penaltyRate),
      penaltyAmount: toNum(row.penaltyAmount),
      isPaid: row.isPaid === true,
      paidDateBs: nullableStr(row.paidDateBs),
      waived: row.waived === true,
      waivedReason: nullableStr(row.waivedReason),
    }));
  } catch (error: any) {
    throw new Error(messageOf(error, 'Could not load penalties.'));
  }
};

export const fetchLoanReschedules = async (loanId: string): Promise<LoanRescheduleRecord[]> => {
  try {
    const { data } = await apiClient.get(`/loans/${loanId}/reschedules`);
    return (Array.isArray(data) ? data : []).map((row: any) => ({
      id: str(row.id),
      rescheduledDateBs: str(row.rescheduledDateBs),
      previousTenure: toInt(row.previousTenure),
      newTenure: toInt(row.newTenure),
      previousRate: toNum(row.previousRate),
      newRate: toNum(row.newRate),
      previousEmi: toNum(row.previousEmi),
      newEmi: toNum(row.newEmi),
      reason: str(row.reason),
    }));
  } catch (error: any) {
    throw new Error(messageOf(error, 'Could not load the reschedule history.'));
  }
};

export const fetchLoanStatement = async (loanId: string): Promise<LoanStatement> => {
  try {
    const { data } = await apiClient.get(`/loans/${loanId}/statement`);
    return {
      loanId: str(data.loanId),
      loanNo: str(data.loanNo),
      memberName: str(data.memberName),
      memberNo: str(data.memberNo),
      outstandingPrincipal: toNum(data.outstandingPrincipal),
      entries: (Array.isArray(data.entries) ? data.entries : []).map((row: any) => ({
        id: str(row.id),
        voucherNo: str(row.voucherNo),
        transactionDateBs: str(row.transactionDateBs),
        principalDebit: toNum(row.principalDebit),
        principalCredit: toNum(row.principalCredit),
        interestCredit: toNum(row.interestCredit),
        penaltyCredit: toNum(row.penaltyCredit),
        remainingPrincipal: toNum(row.remainingPrincipal),
      })),
    };
  } catch (error: any) {
    throw new Error(messageOf(error, 'Could not load the loan statement.'));
  }
};

export const fetchLoanRepayments = async (loanId: string): Promise<LoanRepaymentRecord[]> => {
  try {
    const { data } = await apiClient.get(`/loans/${loanId}/repayments`);
    return (Array.isArray(data) ? data : []).map((row: any) => ({
      id: str(row.id),
      receiptNo: str(row.receiptNo),
      principalPaid: toNum(row.principalPaid),
      interestPaid: toNum(row.interestPaid),
      penaltyPaid: toNum(row.penaltyPaid),
      totalPaid: toNum(row.totalPaid),
      outstandingAfter: toNum(row.outstandingAfter),
      paymentMode: str(row.paymentMode),
      dateBs: str(row.dateBs),
      dateAd: str(row.dateAd),
      collectedBy: str(row.collectedBy),
      voucherNo: row.voucherNo ? str(row.voucherNo) : null,
      createdAt: str(row.createdAt),
    }));
  } catch (error: any) {
    throw new Error(messageOf(error, 'Could not load EMI repayments.'));
  }
};

export const fetchPortfolioRisk = async (): Promise<PortfolioRisk> => {
  try {
    const { data } = await apiClient.get('/loans/portfolio-risk');
    return {
      bands: (Array.isArray(data.bands) ? data.bands : []).map((b: any) => ({
        nplStatus: (b.nplStatus ?? 'Pass') as NplStatus,
        loanCount: toInt(b.loanCount),
        outstandingPrincipal: toNum(b.outstandingPrincipal),
        overdueAmount: toNum(b.overdueAmount),
        provisionAmount: toNum(b.provisionAmount),
        provisionPercent: toNum(b.provisionPercent),
      })),
      loanCount: toInt(data.loanCount),
      totalOutstanding: toNum(data.totalOutstanding),
      totalOverdue: toNum(data.totalOverdue),
      totalProvision: toNum(data.totalProvision),
      nonPerformingAmount: toNum(data.nonPerformingAmount),
      nplRatioPercent: toNum(data.nplRatioPercent),
      policy: {
        watchlistMinDays: toInt(data.policy?.watchlistMinDays),
        substandardMinDays: toInt(data.policy?.substandardMinDays),
        doubtfulMinDays: toInt(data.policy?.doubtfulMinDays),
        lossMinDays: toInt(data.policy?.lossMinDays),
        penaltyGraceDays: toInt(data.policy?.penaltyGraceDays),
        autoClassifyOnAccrual: data.policy?.autoClassifyOnAccrual !== false,
      },
    };
  } catch (error: any) {
    throw new Error(messageOf(error, 'Could not load the portfolio risk summary.'));
  }
};

export const fetchProvisioningSettings = async (): Promise<ProvisioningSettings> => {
  try {
    const { data } = await apiClient.get('/loans/provisioning-settings');
    return normalizeProvisioning(data);
  } catch (error: any) {
    throw new Error(messageOf(error, 'Could not load the provisioning policy.'));
  }
};

// ---------------------------------------------------------------------------
// Writes — return { success, error } so forms can show the message inline.
// ---------------------------------------------------------------------------

export const disburseLoan = async (payload: {
  loanId: string;
  dateBs?: string;
  disbursementMethod?: 'Cash' | 'Bank';
  paymentAccountId?: string | null;
  chequeLeafId?: string | null;
  deductProcessingFee?: boolean;
  narration?: string | null;
  disbursementPaymentMethod?: 'CASH' | 'SAVINGS_TRANSFER' | 'CHEQUE' | null;
  disbursementReferenceId?: string | null;
}): Promise<MutationResult<DisbursementResult>> => {
  try {
    const { data } = await apiClient.post('/loans/disburse', payload);
    return {
      success: true,
      data: {
        voucherNo: str(data.voucherNo),
        principal: toNum(data.principal),
        processingFee: toNum(data.processingFee),
        netDisbursed: toNum(data.netDisbursed),
        maturityDateBs: str(data.maturityDateBs),
        monthlyEmi: toNum(data.monthlyEmi),
        totalInterest: toNum(data.totalInterest),
        installmentCount: toInt(data.installmentCount),
        chequeLeaf: data.chequeLeaf || null,
        loanNo: data.loanNo || data.loan?.loanNo || '',
        memberName: data.memberName || data.loan?.memberName || '',
        memberNo: data.memberNo || data.loan?.memberNo || '',
        dateBs: data.dateBs || '',
        dateAd: data.dateAd || '',
        disbursedBy: data.disbursedBy || '',
        branchName: data.branchName || '',
        branchAddress: data.branchAddress || '',
        glEntries: data.glEntries || [],
      },
    };
  } catch (error: any) {
    return { success: false, error: messageOf(error, 'Disbursement failed.') };
  }
};

export const recordLoanRepayment = async (payload: {
  loanId: string;
  principalPaid: number | string;
  interestPaid: number | string;
  penaltyPaid?: number | string;
  paymentMode?: 'Cash' | 'Bank_Transfer';
  dateBs?: string;
  receiptNo?: string | null;
  paymentAccountId?: string | null;
  narration?: string | null;
}): Promise<MutationResult<RepaymentResult>> => {
  try {
    const { data } = await apiClient.post('/loans/repayment', payload);
    return {
      success: true,
      data: {
        voucherNo: str(data.voucherNo),
        receiptNo: str(data.receiptNo),
        totalPaid: toNum(data.totalPaid),
        outstandingAfter: toNum(data.outstandingAfter),
        closed: data.closed === true,
        installmentsClosed: Array.isArray(data.installmentsClosed)
          ? data.installmentsClosed.map(toInt)
          : [],
        penaltiesSettled: toInt(data.penaltiesSettled),
      },
    };
  } catch (error: any) {
    return { success: false, error: messageOf(error, 'Repayment could not be recorded.') };
  }
};

export const accrueLoanPenalty = async (payload: {
  loanId: string;
  asOfDateBs?: string;
}): Promise<MutationResult<ArrearsResult>> => {
  try {
    const { data } = await apiClient.post('/loans/penalties/accrue', payload);
    return { success: true, data: data as ArrearsResult };
  } catch (error: any) {
    return { success: false, error: messageOf(error, 'Penalty accrual failed.') };
  }
};

export const waiveLoanPenalty = async (payload: {
  penaltyId: string;
  reason: string;
}): Promise<MutationResult> => {
  try {
    const { data } = await apiClient.post('/loans/penalties/waive', payload);
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: messageOf(error, 'The penalty could not be waived.') };
  }
};

export const runArrearsBatch = async (
  asOfDateBs?: string,
): Promise<MutationResult<BatchRunResult<ArrearsResult>>> => {
  try {
    const { data } = await apiClient.post('/loans/arrears-run', asOfDateBs ? { asOfDateBs } : {});
    return { success: true, data: data as BatchRunResult<ArrearsResult> };
  } catch (error: any) {
    return { success: false, error: messageOf(error, 'The arrears run failed.') };
  }
};

export const runClassificationBatch = async (
  asOfDateBs?: string,
): Promise<MutationResult<BatchRunResult<any>>> => {
  try {
    const { data } = await apiClient.post('/loans/classification-run', asOfDateBs ? { asOfDateBs } : {});
    return { success: true, data: data as BatchRunResult<any> };
  } catch (error: any) {
    return { success: false, error: messageOf(error, 'The classification run failed.') };
  }
};

export const classifyLoan = async (
  loanId: string,
  asOfDateBs?: string,
): Promise<MutationResult> => {
  try {
    const { data } = await apiClient.post(`/loans/${loanId}/classify`, asOfDateBs ? { asOfDateBs } : {});
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: messageOf(error, 'Classification failed.') };
  }
};

export const rescheduleLoan = async (payload: {
  loanId: string;
  newTenureMonths: number;
  newRatePct: number | string;
  effectiveDateBs?: string;
  reason: string;
}): Promise<MutationResult> => {
  try {
    const { data } = await apiClient.post('/loans/reschedule', payload);
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: messageOf(error, 'The loan could not be rescheduled.') };
  }
};

export const writeOffLoan = async (payload: {
  loanId: string;
  dateBs?: string;
  principalAmount?: number | string | null;
  interestAmount?: number | string;
  reason: string;
}): Promise<MutationResult> => {
  try {
    const { data } = await apiClient.post('/loans/write-off', payload);
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: messageOf(error, 'The write-off failed.') };
  }
};

export const saveProvisioningSettings = async (
  payload: Partial<Omit<ProvisioningSettings, 'id'>>,
): Promise<MutationResult<ProvisioningSettings>> => {
  try {
    const { data } = await apiClient.put('/loans/provisioning-settings', payload);
    return { success: true, data: normalizeProvisioning(data) };
  } catch (error: any) {
    return { success: false, error: messageOf(error, 'The provisioning policy could not be saved.') };
  }
};

/**
 * Submit a loan write-off request for approval workflow.
 * Creates an approval request that will appear in WorkflowApprovalView.
 */
export const submitWriteOffRequest = async (payload: {
  loanId: string;
  loanNo: string;
  memberName: string;
  memberNo: string;
  outstandingPrincipal: number;
  principalAmount?: number | null;
  interestAmount?: number;
  reason: string;
  dateBs: string;
}): Promise<MutationResult> => {
  try {
    const { data } = await apiClient.post('/loans/write-off/request', payload);
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: messageOf(error, 'Failed to submit write-off request.') };
  }
};

/** Display labels for the classification bands, in deteriorating order. */
export const NPL_STATUS_ORDER: NplStatus[] = ['Pass', 'Watchlist', 'Substandard', 'Doubtful', 'Loss'];

export const NPL_STATUS_LABELS: Record<NplStatus, string> = {
  Pass: 'Pass (Good)',
  Watchlist: 'Watchlist',
  Substandard: 'Substandard',
  Doubtful: 'Doubtful',
  Loss: 'Loss',
};

// ---------------------------------------------------------------------------
// Bank Cheque Leaves (cooperative's own bank cheques for disbursement)
// ---------------------------------------------------------------------------
export interface BankChequeLeaf {
  id: string;
  chequeNumber: string;
  leafNo: number;
  chequeBookId: string;
  bankAccountId?: string;
  status?: string;
  payeeName?: string | null;
  amount?: number | null;
  chequeDateBs?: string | null;
  loanId?: string | null;
  voucherId?: string | null;
  usedAt?: string | null;
  clearedAt?: string | null;
  bookNumber: string;
  prefix: string | null;
}

export interface BankChequeBook {
  id: string;
  bookNumber: string;
  prefix: string | null;
  leafStartNumber: number;
  leafEndNumber: number;
  leafCount: number;
  issuedDateBs: string;
  status: string;
}

export const fetchBankChequeLeaves = async (bankAccountId: string): Promise<BankChequeLeaf[]> => {
  const { data } = await apiClient.get('/bank-cheques/leaves', { params: { bankAccountId } });
  return data;
};

export const fetchBankChequeBooks = async (bankAccountId: string): Promise<BankChequeBook[]> => {
  const { data } = await apiClient.get('/bank-cheques/books', { params: { bankAccountId } });
  return data;
};

export type IssueChequeBookInput =
  | { bankAccountId: string; mode: 'range'; startingLeafNo: number; totalLeaves: number; issuedDateBs: string; issuedDateAd: string; purpose?: string }
  | { bankAccountId: string; mode: 'individual'; leafNumbers: number[]; issuedDateBs: string; issuedDateAd: string; purpose?: string };

export const issueBankChequeBook = async (payload: IssueChequeBookInput): Promise<{ book: BankChequeBook; leafCount: number; chequeRange: string; mode: string }> => {
  const { data } = await apiClient.post('/bank-cheques/issue', payload);
  return data;
};

// ── Bank Cheque Voucher Posting ──────────────────────────────────────────────

export interface BankChequeVoucherPayload {
  bankAccountId: string;
  chequeLeafId: string;
  payeeName: string;
  amount: number;
  voucherDateBS: string;
  voucherDateAD: string;
  particulars: string;
  debitLedgerId: string;
}

export interface BankChequeVoucherResult {
  success: boolean;
  voucherId: string;
  voucherNo: string;
  chequeNumber: string;
  amount: number;
  payeeName: string;
  newBankBalance: number;
}

export const postBankChequeVoucher = async (payload: BankChequeVoucherPayload): Promise<BankChequeVoucherResult> => {
  const { data } = await apiClient.post('/bank-cheques/voucher', payload);
  return data;
};

// ─────────────────────────────────────────────────────────────
// Mark cheque leaf as issued (no GL voucher — just status change)
// ─────────────────────────────────────────────────────────────
export interface MarkChequeIssuedPayload {
  leafId: string;
  payeeName: string;
  amount?: number;
  chequeDateBs?: string;
  chequeDateAd?: string;
}

export const markChequeLeafIssued = async (payload: MarkChequeIssuedPayload): Promise<{ success: boolean; chequeNumber: string }> => {
  const { data } = await apiClient.post('/bank-cheques/mark-issued', payload);
  return data;
};

// ─────────────────────────────────────────────────────────────
// Internal Cheque Repayment (member savings cheque → loan EMI)
// ─────────────────────────────────────────────────────────────
export interface InternalChequeRepaymentPayload {
  borrowerLoanId: string;
  payerSavingsAccountId: string;
  payerMemberId?: string;
  chequeLeafId: string;
  chequeNumber?: string;
  payeeName: string;
  chequeDateBs: string;
  chequeDateAd?: string;
  principalPaid: number;
  interestPaid: number;
  penaltyPaid: number;
  isThirdParty?: boolean;
}

export interface InternalChequeRepaymentResult {
  success: boolean;
  voucherNo: string;
  repaymentId: string;
  chequeNumber: string;
  payerNewSavingsBalance: number;
  message: string;
  glEntries?: Array<{
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    narration: string;
  }>;
}

export const postInternalChequeRepayment = async (payload: InternalChequeRepaymentPayload): Promise<InternalChequeRepaymentResult> => {
  const { data } = await apiClient.post('/bank-cheques/internal-repayment', payload);
  return data;
};

// ---- Active Loan Portfolio (for amortization simulator) ----

export interface ActiveLoanAccount {
  id: string;
  loanNo: string;
  memberName: string;
  memberNo: string;
  productName: string;
  approvedAmount: string;
  outstandingPrincipal: string;
  interestRate: string;
  interestMethod: string;
  tenureMonths: number;
  monthlyEmi: string;
  disbursedDateBs: string;
  maturityDateBs: string;
  status: string;
  daysOverdue: number;
}

export const fetchActiveLoanPortfolio = async (): Promise<ActiveLoanAccount[]> => {
  const { data } = await apiClient.get('/loans/active-portfolio');
  return data;
};

// ---- Loan Detail ----

export interface LoanDetailRecord {
  id: string;
  loanNo: string;
  memberId: string;
  memberName: string;
  memberNo: string;
  loanProductId: string | null;
  productType: string;
  productName: string;
  appliedAmount: number;
  approvedAmount: number;
  outstandingPrincipal: number;
  interestRate: number;
  interestMethod: string;
  tenureMonths: number;
  monthlyEmi: number;
  disbursedDateBs: string;
  maturityDateBs: string;
  status: string;
  nplStatus: string;
  daysOverdue: number;
  overdueAmount: number;
  provisionAmount: number;
  lastRepaymentDateBs: string | null;
  disbursedAmount: number | null;
  disbursementPaymentMethod: string | null;
  createdAt: string;
}

export const fetchLoanById = async (loanId: string): Promise<LoanDetailRecord> => {
  try {
    const { data } = await apiClient.get(`/loans/${loanId}`);
    return {
      id: str(data.id),
      loanNo: str(data.loanNo),
      memberId: str(data.memberId),
      memberName: str(data.memberName),
      memberNo: str(data.memberNo),
      loanProductId: nullableStr(data.loanProductId),
      productType: str(data.productType),
      productName: str(data.productName),
      appliedAmount: toNum(data.appliedAmount),
      approvedAmount: toNum(data.approvedAmount),
      outstandingPrincipal: toNum(data.outstandingPrincipal),
      interestRate: toNum(data.interestRate),
      interestMethod: str(data.interestMethod),
      tenureMonths: toInt(data.tenureMonths),
      monthlyEmi: toNum(data.monthlyEmi),
      disbursedDateBs: str(data.disbursedDateBs),
      maturityDateBs: str(data.maturityDateBs),
      status: str(data.status),
      nplStatus: str(data.nplStatus),
      daysOverdue: toInt(data.daysOverdue),
      overdueAmount: toNum(data.overdueAmount),
      provisionAmount: toNum(data.provisionAmount),
      lastRepaymentDateBs: nullableStr(data.lastRepaymentDateBs),
      disbursedAmount: data.disbursedAmount != null ? toNum(data.disbursedAmount) : null,
      disbursementPaymentMethod: nullableStr(data.disbursementPaymentMethod),
      createdAt: str(data.createdAt),
    };
  } catch (error: any) {
    throw new Error(messageOf(error, 'Could not load loan details.'));
  }
};
