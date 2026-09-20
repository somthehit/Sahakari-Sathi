import { apiClient } from '../lib/apiClient';
import type {
  Branch,
  FiscalYear,
  Member,
  SavingsAccount,
  LoanAccount,
  ChartOfAccount,
  Voucher,
  CollectionAgent,
  CollectionRoute,
  BudgetLine,
  FixedAsset,
  ApprovalRequest,
  AuditLog,
  CustomerTicket,
} from '../types/coop';

export interface MasterData {
  branches: Branch[];
  fiscalYears: FiscalYear[];
  members: Member[];
  savingsAccounts: SavingsAccount[];
  loanAccounts: LoanAccount[];
  chartOfAccounts: ChartOfAccount[];
  vouchers: Voucher[];
  collectionAgents: CollectionAgent[];
  collectionRoutes: CollectionRoute[];
  budgetLines: BudgetLine[];
  fixedAssets: FixedAsset[];
  approvalRequests: ApprovalRequest[];
  auditLogs: AuditLog[];
  customerTickets: CustomerTicket[];
}

/**
 * Fetch all master/registry data from the backend API.
 * The backend already maps rows to the camelCase frontend shape.
 */
export const fetchMasterData = async (): Promise<MasterData> => {
  const { data } = await apiClient.get<MasterData>('/master-data');
  return data;
};
