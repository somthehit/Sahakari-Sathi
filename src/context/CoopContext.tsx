import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  UserRole,
  Branch,
  FiscalYear,
  Department,
  Designation,
  TabItem,
  Member,
  SavingsAccount,
  SavingsTransaction,
  LoanAccount,
  ShareHolding,
  ChartOfAccount,
  Voucher,
  CollectionAgent,
  CollectionRoute,
  FieldCollectionEntry,
  BudgetLine,
  FixedAsset,
  ApprovalRequest,
  AuditLog,
  NotificationItem,
  CustomerTicket,
} from '../types/coop';
import { Staff } from '../api/staff';
import { useAuthStore } from '../stores/authStore';
import { getTodayBS, getTodayBSFormatted, getTodayADFormatted, getCurrentFiscalYearCode, formatNPR } from '../utils/nepaliCalendar';
import { calculateRealtimeEmiBreakdown } from '../utils/financialEngine';
import { CurrencyConfig } from '../types/coop';
import { fetchMasterData } from '../api/masterData';
import { fetchFiscalYears, createFiscalYear, normalizeFiscalYear } from '../api/fiscalYears';
import { fetchFinancialSettings, syncLatestExchangeRate, fetchExchangeRates } from '../api/exchangeRates';
import { fetchDepartments, createDepartment, updateDepartment as updateDepartmentApi, deleteDepartment as deleteDepartmentApi } from '../api/departments';
import { fetchDesignations, createDesignation, updateDesignation as updateDesignationApi, deleteDesignation as deleteDesignationApi } from '../api/designations';
import { createBranch as createBranchApi, updateBranch as updateBranchApi, fetchBranches as fetchBranchesApi } from '../api/branches';
import { createMember as createMemberApi, updateMember as updateMemberApi, deleteMember as deleteMemberApi, fetchMembers, type MemberInput } from '../api/members';
import { recordSavingsTransaction } from '../api/savings';
import { postDeposit, postWithdrawal } from '../api/savingsDeposits';
import { recordLoanRepayment, disburseLoan as disburseLoanApi, fetchLoanDue } from '../api/loanServicing';
import type { LoanDueBreakdown } from '../api/loanServicing';
import { createAccount } from '../api/accountingSettings';
import { useToast } from './ToastContext';

export type MenuViewMode = 'list' | 'split' | 'tree';

/** Status of a single workspace-init step shown on the post-login boot screen. */
export type BootstrapStepStatus = 'pending' | 'loading' | 'done' | 'error';

export interface BootstrapStep {
  key: string;
  label: string;
  status: BootstrapStepStatus;
}

export interface RepaymentResult {
  receiptNo: string;
  voucherNo: string;
  loanNo: string;
  memberName: string;
  memberNo: string;
  loanId: string;
  amount: number;
  principalPortion: number;
  interestPortion: number;
  outstandingAfter: number;
  closed: boolean;
  paymentMode: string;
  dateBS: string;
  dateAD: string;
  collectedBy: string;
  branchName: string;
  branchAddress: string;
  glEntries?: Array<{
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    narration: string;
  }>;
}

/**
 * Smart-selects the active fiscal year for "today":
 * 1. The fiscal year whose BS date range [startDateBS, endDateBS] contains today.
 * 2. Otherwise the one explicitly flagged isCurrent.
 * 3. Otherwise the latest fiscal year in the registry.
 */
const pickActiveFiscalYear = (rows: FiscalYear[]): FiscalYear | undefined => {
  if (rows.length === 0) return undefined;
  const todayBS = getTodayBS();
  const byRange = rows.find(f => todayBS >= f.startDateBS && todayBS <= f.endDateBS);
  if (byRange) return byRange;
  const flagged = rows.find(f => f.isCurrent);
  if (flagged) return flagged;
  return rows[rows.length - 1];
};

interface CoopContextType {
  // Navigation & User State
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  activeBranchId: string;
  setActiveBranchId: (branchId: string) => void;
  activeBranch: Branch;
  branches: Branch[];
  activeFiscalYearCode: string;
  setActiveFiscalYearCode: (code: string) => void;
  fiscalYears: FiscalYear[];
  fiscalYearsStatus: 'loading' | 'loaded' | 'error';
  reloadFiscalYears: () => void;
  isFiscalYearModalOpen: boolean;
  setIsFiscalYearModalOpen: (open: boolean) => void;
  currencyConfig: CurrencyConfig;
  updateCurrencyConfig: (config: Partial<CurrencyConfig>) => void;
  convertToNPR: (amountInBaseCurrency: number) => number;
  menuViewMode: MenuViewMode;
  setMenuViewMode: (mode: MenuViewMode) => void;

  // Virtual Tab Manager State
  tabs: TabItem[];
  activeTabId: string;
  openTab: (moduleKey: string, title: string, iconName?: string, recordId?: string, data?: any) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  setActiveTabId: (tabId: string) => void;
  markTabDirty: (tabId: string, isDirty: boolean) => void;
  isTabMaximized: boolean;
  toggleMaximizeTab: () => void;

  // Unsaved Confirmation Modal State
  pendingCloseTabId: string | null;
  setPendingCloseTabId: (id: string | null) => void;
  confirmCloseDirtyTab: () => void;

  // Notifications
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  addNotification: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'alert' | 'error') => void;
  markNotificationRead: (id: string) => void;
  clearAllNotifications: () => void;

  // Application bootstrap progress (shown after successful login while the
  // workspace data is being prepared in the background).
  bootstrapSteps: BootstrapStep[];
  bootstrapReady: boolean;

  // Domain Store Data
  members: Member[];
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  reloadMembers: () => Promise<void>;
  reloadMasterData: () => Promise<void>;
  departments: Department[];
  departmentsStatus: 'loading' | 'loaded' | 'error';
  reloadDepartments: () => void;
  designations: Designation[];
  designationsStatus: 'loading' | 'loaded' | 'error';
  reloadDesignations: () => void;
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

  // Modals & Selected View Records
  isGlobalSearchOpen: boolean;
  setIsGlobalSearchOpen: (open: boolean) => void;
  isShortcutModalOpen: boolean;
  setIsShortcutModalOpen: (open: boolean) => void;
  selectedMemberForDetail: Member | null;
  setSelectedMemberForDetail: (member: Member | null) => void;
  memberEditMode: boolean;
  setMemberEditMode: (editMode: boolean) => void;
  selectedVoucherForDetail: Voucher | null;
  setSelectedVoucherForDetail: (voucher: Voucher | null) => void;
  selectedAccountForPassbook: SavingsAccount | null;
  setSelectedAccountForPassbook: (account: SavingsAccount | null) => void;

  // Savings transaction ledger (local mirror used by Account Statements in prototype mode)
  savingsTxnHistory: SavingsTransaction[];

  // Staff Form State
  staffFormOpen: boolean;
  staffFormMode: 'add' | 'edit';
  staffFormTarget: Staff | null;
  staffRefreshKey: number;
  openStaffForm: (mode?: 'add' | 'edit', target?: Staff) => void;
  closeStaffForm: () => void;
  bumpStaffRefresh: () => void;

  // Branch Form State
  branchFormOpen: boolean;
  branchFormMode: 'add' | 'edit' | 'view';
  branchFormTarget: Branch | null;
  openBranchForm: (mode?: 'add' | 'edit' | 'view', target?: Branch) => void;
  closeBranchForm: () => void;
  saveBranch: (data: Partial<Branch>) => Promise<Branch | null>;

  // Domain Mutations
  processDeposit: (accountId: string, amount: number, paymentMode?: 'Cash' | 'Bank_Transfer' | 'Collection_Agent', remarks?: string) => Promise<void>;
  processWithdrawal: (accountId: string, amount: number, remarks?: string, chequeDetails?: {
    bankAccountId: string;
    chequeLeafId: string;
    payeeName: string;
    voucherDateBS: string;
    voucherDateAD: string;
  }) => Promise<void>;
  disburseLoan: (loanId: string, remarks?: string, paymentAccountId?: string, disbursementMethod?: 'Cash' | 'Bank', chequeLeafId?: string, paymentChannel?: 'CASH' | 'SAVINGS_TRANSFER' | 'CHEQUE', referenceId?: string) => Promise<import('../api/loanServicing').DisbursementResult | null>;
  processLoanRepayment: (
    loanId: string,
    amount: number,
    paymentMode?: 'Cash' | 'Bank_Transfer' | 'Auto_Debit' | string,
    paymentDetails?: {
      sourceSavingsAccountId?: string;
      depositBankAccountId?: string;
      chequeNumber?: string;
      issuerBankName?: string;
      payerName?: string;
      chequeDate?: string;
      denominations?: Record<string | number, number>;
      remarks?: string;
    }
  ) => Promise<RepaymentResult | null>;
  processApprovalDecision: (requestId: string, status: 'Approved' | 'Rejected', remarks?: string) => Promise<void>;
  reconcileAgentRoute: (routeId: string) => void;
  addNewMember: (memberData: MemberInput) => Promise<Member>;
  updateMember: (id: string, updates: Partial<Member>) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  createNewLoanApplication: (loanData: { memberId: string; productType: any; amount: number; tenureMonths: number; collateralType: string; collateralValuation: number; interestMethod: 'declining' | 'flat' }) => LoanAccount;
  postManualVoucher: (voucherData: Omit<Voucher, 'id' | 'voucherNo' | 'status'>) => Promise<Voucher>;
  postExpenseClaim: (title: string, category: string, amount: number, description: string) => void;
  runInterestPosting: () => void;
  runDepreciation: () => void;
  addChartOfAccount: (accountData: Omit<ChartOfAccount, 'id'>) => Promise<ChartOfAccount | null>;
  addDepartment: (deptData: Omit<Department, 'id' | 'createdAtBS'>) => Promise<Department | null>;
  updateDepartment: (id: string, updates: Partial<Department>) => Promise<Department | null>;
  deleteDepartment: (id: string) => Promise<boolean>;
  addDesignation: (departmentId: string, data: Omit<Designation, 'id' | 'departmentId'>) => Promise<Designation | null>;
  updateDesignation: (id: string, updates: Partial<Designation>) => Promise<Designation | null>;
  deleteDesignation: (id: string) => Promise<boolean>;
  addFiscalYear: (fyData: Omit<FiscalYear, 'id'>) => Promise<FiscalYear | null>;
}

const CoopContext = createContext<CoopContextType | undefined>(undefined);

export const CoopProvider: React.FC<{ children: React.ReactNode; dataEnabled?: boolean }> = ({ children, dataEnabled = true }) => {
  // Toast feedback for user-facing domain actions (ToastProvider is an ancestor of CoopProvider)
  const { showSuccess, showError, showWarning, showInfo } = useToast();

  // Auth user drives the initial branch context. Branch staff are pinned to their
  // assigned branch; org admins resume their persisted active branch.
  const authUser = useAuthStore((s) => s.user);
  // Tenant bootstrap fetches only run with a tenant JWT, and never in the
  // super-admin portal (dataEnabled=false there). Otherwise the provider would
  // fire tenant API calls with no tenant token (401 "No token provided").
  const authToken = useAuthStore((s) => s.token);
  const bootstrapEnabled = dataEnabled && !!authToken;

  // Top Level Navigation State
  const [activeRole, setActiveRole] = useState<UserRole>('branch_manager');
  const [activeBranchId, setActiveBranchId] = useState<string>('');
  const [activeFiscalYearCode, setActiveFiscalYearCode] = useState<string>(getCurrentFiscalYearCode());
  const [menuViewMode, setMenuViewModeState] = useState<MenuViewMode>(() => {
    const saved = localStorage.getItem('coop_menu_view_mode');
    return (saved === 'split' || saved === 'tree' || saved === 'list') ? (saved as MenuViewMode) : 'list';
  });

  const setMenuViewMode = (mode: MenuViewMode) => {
    setMenuViewModeState(mode);
    localStorage.setItem('coop_menu_view_mode', mode);
  };

  // Master Data State
  const [branches, setBranches] = useState<Branch[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [fiscalYearsStatus, setFiscalYearsStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [fiscalYearsReloadKey, setFiscalYearsReloadKey] = useState(0);
  const [isFiscalYearModalOpen, setIsFiscalYearModalOpen] = useState<boolean>(false);
  const [currencyConfig, setCurrencyConfig] = useState<CurrencyConfig>({ baseCurrency: 'NPR', exchangeRate: 0, forexMarkupPct: 0, applyGST: false, gstPct: 0 });
  const updateCurrencyConfig = (config: Partial<CurrencyConfig>) => {
    setCurrencyConfig(prev => {
      const next = { ...prev, ...config };
      if (config.baseCurrency === 'NPR') {
        next.exchangeRate = 0;
        next.forexMarkupPct = 0;
        next.applyGST = false;
        next.gstPct = 0;
      }
      return next;
    });
  };
  const convertToNPR = (amountInBaseCurrency: number): number => {
    if (currencyConfig.baseCurrency === 'NPR' || currencyConfig.exchangeRate <= 0) return amountInBaseCurrency;
    let converted = amountInBaseCurrency * currencyConfig.exchangeRate;
    converted *= 1 + (currencyConfig.forexMarkupPct || 0) / 100;
    if (currencyConfig.applyGST) converted *= 1 + (currencyConfig.gstPct || 0) / 100;
    return converted;
  };
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentsStatus, setDepartmentsStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [departmentsReloadKey, setDepartmentsReloadKey] = useState(0);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [designationsStatus, setDesignationsStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [designationsReloadKey, setDesignationsReloadKey] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccount[]>([]);
  const [loanAccounts, setLoanAccounts] = useState<LoanAccount[]>([]);
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccount[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [collectionAgents, setCollectionAgents] = useState<CollectionAgent[]>([]);
  const [collectionRoutes, setCollectionRoutes] = useState<CollectionRoute[]>([]);
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [customerTickets, setCustomerTickets] = useState<CustomerTicket[]>([]);
  const [masterDataStatus, setMasterDataStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [orgSettingsStatus, setOrgSettingsStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  // Selected Detail & Global Modal State
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState<boolean>(false);
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState<boolean>(false);
  const [selectedMemberForDetail, setSelectedMemberForDetail] = useState<Member | null>(null);
  const [memberEditMode, setMemberEditMode] = useState<boolean>(false);
  const [selectedVoucherForDetail, setSelectedVoucherForDetail] = useState<Voucher | null>(null);
  const [selectedAccountForPassbook, setSelectedAccountForPassbook] = useState<SavingsAccount | null>(null);
  const [savingsTxnHistory, setSavingsTxnHistory] = useState<SavingsTransaction[]>([]);

  // Added Form States
  const [staffFormOpen, setStaffFormOpen] = useState(false);
  const [staffFormMode, setStaffFormMode] = useState<'add' | 'edit'>('add');
  const [staffFormTarget, setStaffFormTarget] = useState<Staff | null>(null);
  const [staffRefreshKey, setStaffRefreshKey] = useState(0);

  const openStaffForm = (mode: 'add' | 'edit' = 'add', target?: Staff) => {
    setStaffFormMode(mode);
    setStaffFormTarget(target || null);
    setStaffFormOpen(true);
  };
  const closeStaffForm = () => {
    setStaffFormOpen(false);
    setStaffFormTarget(null);
  };
  const bumpStaffRefresh = () => setStaffRefreshKey(prev => prev + 1);

  const [branchFormOpen, setBranchFormOpen] = useState(false);
  const [branchFormMode, setBranchFormMode] = useState<'add' | 'edit' | 'view'>('add');
  const [branchFormTarget, setBranchFormTarget] = useState<Branch | null>(null);

  const openBranchForm = (mode: 'add' | 'edit' | 'view' = 'add', target?: Branch) => {
    setBranchFormMode(mode);
    setBranchFormTarget(target || null);
    setBranchFormOpen(true);
  };
  const closeBranchForm = () => {
    setBranchFormOpen(false);
    setBranchFormTarget(null);
  };
  
  // Branch CRUD — API-backed (src/api/branches.ts). On success the local branch
  // list is refreshed so the SETUPS → Branches view and branch pickers stay in
  // sync with the database (single source of truth).
  const saveBranch = async (data: Partial<Branch>): Promise<Branch | null> => {
    try {
      const payload: any = { ...data };
      if (payload.latitude === undefined) delete payload.latitude;
      if (payload.longitude === undefined) delete payload.longitude;
      if (payload.logoUrl === '' ) payload.logoUrl = null;

      let saved: Branch;
      if (branchFormMode === 'edit' && branchFormTarget?.id) {
        saved = await updateBranchApi(branchFormTarget.id, payload);
      } else {
        const { id, ...rest } = payload as any;
        saved = await createBranchApi(rest);
      }

      // Refresh from the API so all consumers (setup view, header picker, etc.)
      // see the persisted row with normalized numeric fields.
      const fresh = await fetchBranchesApi();
      if (fresh.length > 0) setBranches(fresh);

      return saved;
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Unknown error';
      console.error('[saveBranch] failed:', message);
      addNotification('Branch Save Failed', message, 'alert');
      throw error;
    }
  };

  // Virtual Tab Manager State
  const HOME_TAB: TabItem = {
    id: 'home',
    moduleKey: 'home',
    title: 'Dashboard Home',
    iconName: 'Home',
  };

  const [tabs, setTabs] = useState<TabItem[]>(() => {
    try {
      const saved = localStorage.getItem('coop_open_tabs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasHome = parsed.some((t: TabItem) => t.id === 'home');
          return hasHome ? parsed : [HOME_TAB, ...parsed];
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [HOME_TAB];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('coop_active_tab_id');
      if (saved) return saved;
    } catch (e) {
      console.error(e);
    }
    return 'home';
  });

  // Load fiscal years from the backend on mount. No mock fallback: the app
  // requires an initial fiscal year to be configured before use.
  useEffect(() => {
    if (!bootstrapEnabled) return;
    let active = true;
    setFiscalYearsStatus('loading');
    fetchFiscalYears()
      .then((rows) => {
        if (active) {
          if (rows === null) {
            setFiscalYearsStatus('error');
            return;
          }
          setFiscalYears(rows);
          setFiscalYearsStatus('loaded');
          const smart = pickActiveFiscalYear(rows);
          if (smart) setActiveFiscalYearCode(smart.code);
        }
      })
      .catch(() => { if (active) setFiscalYearsStatus('error'); });
    return () => { active = false; };
  }, [fiscalYearsReloadKey, bootstrapEnabled]);

  const reloadFiscalYears = () => { if (bootstrapEnabled) setFiscalYearsReloadKey(k => k + 1); };

  // Load departments from the real backend API. No mock fallback: the department
  // registry is sourced from the database so setup and HR modules stay in sync.
  useEffect(() => {
    if (!bootstrapEnabled) return;
    let active = true;
    setDepartmentsStatus('loading');
    fetchDepartments()
      .then((rows) => {
        if (!active) return;
        setDepartments(rows);
        setDepartmentsStatus('loaded');
      })
      .catch(() => { if (active) setDepartmentsStatus('error'); });
    return () => { active = false; };
  }, [departmentsReloadKey, bootstrapEnabled]);

  const reloadDepartments = () => { if (bootstrapEnabled) setDepartmentsReloadKey(k => k + 1); };

  // Load all designations (joined via departments) from the backend API.
  useEffect(() => {
    if (!bootstrapEnabled) return;
    let active = true;
    setDesignationsStatus('loading');
    fetchDesignations()
      .then((rows) => {
        if (!active) return;
        setDesignations(rows);
        setDesignationsStatus('loaded');
      })
      .catch(() => { if (active) setDesignationsStatus('error'); });
    return () => { active = false; };
  }, [designationsReloadKey, bootstrapEnabled]);

  const reloadDesignations = () => { if (bootstrapEnabled) setDesignationsReloadKey(k => k + 1); };

  // Reload members from the API and sync into context state.
  // Memoized: MembersView depends on this reference, and a stable identity
  // prevents an effect loop (fetch -> setMembers -> re-render -> refetch).
  const reloadMembers = useCallback(async (): Promise<void> => {
    if (!bootstrapEnabled) return;
    try {
      const data = await fetchMembers();
      setMembers(data);
    } catch (e) {
      console.error('[reloadMembers] failed to fetch members:', e);
    }
  }, [bootstrapEnabled]);

  // Load all master data (members, branches, savings/loan accounts, chart of
  // accounts, vouchers, collections, budgets, assets, approvals, audit
  // logs, tickets) from the real database API. No mock fallback: the app is a
  // thin client over the backend, so state hydrates from the DB on mount.
  const reloadMasterData = useCallback(async (): Promise<void> => {
    if (!bootstrapEnabled) return;
    try {
      const data = await fetchMasterData();
      if (data === null) return;
      setMasterDataStatus('loaded');
      setBranches(data.branches);
      setMembers(data.members);
      setSavingsAccounts(data.savingsAccounts);
      setLoanAccounts(data.loanAccounts);
      setChartOfAccounts(data.chartOfAccounts);
      setVouchers(data.vouchers);
      setCollectionAgents(data.collectionAgents);
      setCollectionRoutes(data.collectionRoutes);
      setBudgetLines(data.budgetLines);
      setFixedAssets(data.fixedAssets);
      setApprovalRequests(data.approvalRequests);
      setAuditLogs(data.auditLogs);
      setCustomerTickets(data.customerTickets);
      if (data.branches.length > 0) {
        // Branch staff are pinned to their assigned branch (server-enforced).
        if (authUser && !authUser.isOrgAdmin && authUser.branchId) {
          setActiveBranchId(authUser.branchId);
        } else if (authUser?.isOrgAdmin && authUser.activeBranchId) {
          setActiveBranchId(prev => data.branches.some((b) => b.id === authUser.activeBranchId) ? authUser.activeBranchId : prev);
        } else {
          setActiveBranchId(prev => data.branches.some((b) => b.id === prev) ? prev : (authUser?.branchIds?.[0] ?? data.branches[0].id));
        }
      } else {
        setActiveBranchId('');
      }
    } catch (e) {
      setMasterDataStatus('error');
      console.error('[reloadMasterData] failed:', e);
    }
  }, [bootstrapEnabled, authUser]);

  useEffect(() => {
    if (!bootstrapEnabled) return;
    let active = true;
    setMasterDataStatus('loading');
    (async () => {
      try {
        const data = await fetchMasterData();
        if (!active || data === null) return;
        setMasterDataStatus('loaded');
        setBranches(data.branches);
        setMembers(data.members);
        setSavingsAccounts(data.savingsAccounts);
        setLoanAccounts(data.loanAccounts);
        setChartOfAccounts(data.chartOfAccounts);
        setVouchers(data.vouchers);
        setCollectionAgents(data.collectionAgents);
        setCollectionRoutes(data.collectionRoutes);
        setBudgetLines(data.budgetLines);
        setFixedAssets(data.fixedAssets);
        setApprovalRequests(data.approvalRequests);
        setAuditLogs(data.auditLogs);
        setCustomerTickets(data.customerTickets);
        if (data.branches.length > 0) {
          // Branch staff are pinned to their assigned branch (server-enforced).
          if (authUser && !authUser.isOrgAdmin && authUser.branchId) {
            setActiveBranchId(authUser.branchId);
          } else if (authUser?.isOrgAdmin && authUser.activeBranchId) {
            setActiveBranchId(prev => data.branches.some((b) => b.id === authUser.activeBranchId) ? authUser.activeBranchId : prev);
          } else {
            setActiveBranchId(prev => data.branches.some((b) => b.id === prev) ? prev : (authUser?.branchIds?.[0] ?? data.branches[0].id));
          }
        } else {
          setActiveBranchId('');
        }
      } catch {
        // keep empty state; UI surfaces empty-record states
        setMasterDataStatus('error');
      }
    })();
    return () => { active = false; };
  }, [bootstrapEnabled, reloadMasterData]);

  // Auto-load currency config at app start. If the org's operating currency is
  // USD, auto-fetch the official NRB rate once per day (guarded via localStorage).
  useEffect(() => {
    if (!bootstrapEnabled) return;
    let active = true;
    setOrgSettingsStatus('loading');
    (async () => {
      try {
        const settings = await fetchFinancialSettings();
        if (!settings || !active) return;
        setOrgSettingsStatus('loaded');
        const markup = Number(settings.defaultForexMarkupPercent ?? 0);
        const gst = Number(settings.defaultTaxRatePercent ?? 0);

        if (settings.defaultCurrency !== 'USD') {
          updateCurrencyConfig({
            baseCurrency: 'NPR',
            exchangeRate: 0,
            forexMarkupPct: markup,
            applyGST: !!settings.isTaxEnabled,
            gstPct: gst,
          });
          return;
        }

        const today = new Date().toISOString().slice(0, 10);
        let synced: Awaited<ReturnType<typeof syncLatestExchangeRate>> | null = null;
        if (localStorage.getItem('coop_forex_last_sync') !== today) {
          try {
            synced = await syncLatestExchangeRate();
            if (!active) return;
            localStorage.setItem('coop_forex_last_sync', today);
          } catch (e) {
            console.warn('[forex auto-sync] NRB fetch failed; falling back to last stored rate.', e);
          }
        }

        if (active) {
          if (synced) {
            updateCurrencyConfig({
              baseCurrency: 'USD',
              exchangeRate: Number(synced.rate.officialMiddleRate),
              forexMarkupPct: Number(synced.settings.defaultForexMarkupPercent ?? markup),
              applyGST: synced.settings.isTaxEnabled,
              gstPct: Number(synced.settings.defaultTaxRatePercent ?? gst),
            });
          } else {
            const rates = await fetchExchangeRates();
            const latest = rates?.[0];
            updateCurrencyConfig({
              baseCurrency: 'USD',
              exchangeRate: latest ? Number(latest.officialMiddleRate) : 0,
              forexMarkupPct: markup,
              applyGST: !!settings.isTaxEnabled,
              gstPct: gst,
            });
          }
        }
      } catch (e) {
        console.error('[forex auto-sync] failed to load currency config:', e);
        setOrgSettingsStatus('error');
      }
    })();
    return () => { active = false; };
  }, [bootstrapEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem('coop_open_tabs', JSON.stringify(tabs));
      localStorage.setItem('coop_active_tab_id', activeTabId);
    } catch (e) {
      console.error(e);
    }
  }, [tabs, activeTabId]);
  const [isTabMaximized, setIsTabMaximized] = useState<boolean>(false);
  const [pendingCloseTabId, setPendingCloseTabId] = useState<string | null>(null);

  // Notifications State
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'n1',
      title: 'Loan Approval Pending',
      message: 'Loan Officer submitted Business Expansion Loan (NPR 500,000) for Bishnu Prasad Sharma.',
      type: 'info',
      timestampBS: '10:15 AM',
      isRead: false,
    },
    {
      id: 'n2',
      title: 'Daily Field Collection Reconciled',
      message: 'Route B (Kalanki) Agent Anil Thapa reconciled NPR 35,000 with vault cashier.',
      type: 'success',
      timestampBS: '09:45 AM',
      isRead: false,
    }
  ]);

  const activeBranch = branches.find(b => b.id === activeBranchId) || branches[0];

  const addNotification = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'alert' | 'error' = 'info') => {
    const newItem: NotificationItem = {
      id: `notif_${Date.now()}`,
      title,
      message,
      type,
      timestampBS: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isRead: false,
    };
    setNotifications(prev => [newItem, ...prev]);
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const unreadNotificationCount = notifications.filter(n => !n.isRead).length;

  // Virtual Tab Functions
  const openTab = (moduleKey: string, title: string, iconName: string = 'FileText', recordId?: string, data?: any) => {
    const tabId = recordId ? `${moduleKey}_${recordId}` : moduleKey;

    setTabs(prev => {
      const existing = prev.find(t => t.id === tabId);
      if (existing) {
        return prev;
      }
      return [...prev, { id: tabId, moduleKey, title, iconName, recordId, isDirty: false, data }];
    });

    setActiveTabId(tabId);
  };

  const closeTab = (tabId: string) => {
    if (tabId === 'home') return; // Cannot close Home tab

    const targetTab = tabs.find(t => t.id === tabId);
    if (targetTab?.isDirty) {
      setPendingCloseTabId(tabId);
      return;
    }

    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId) {
        const lastTab = filtered[filtered.length - 1] || HOME_TAB;
        setActiveTabId(lastTab.id);
      }
      return filtered;
    });
  };

  const confirmCloseDirtyTab = () => {
    if (!pendingCloseTabId) return;
    const tabIdToClose = pendingCloseTabId;
    setPendingCloseTabId(null);

    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabIdToClose);
      if (activeTabId === tabIdToClose) {
        const lastTab = filtered[filtered.length - 1] || HOME_TAB;
        setActiveTabId(lastTab.id);
      }
      return filtered;
    });
  };

  const closeOtherTabs = (currentTabId: string) => {
    setTabs(prev => prev.filter(t => t.id === 'home' || t.id === currentTabId));
    setActiveTabId(currentTabId);
  };

  const markTabDirty = (tabId: string, isDirty: boolean) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, isDirty } : t));
  };

  const toggleMaximizeTab = () => {
    setIsTabMaximized(prev => !prev);
  };

  const logAudit = (module: string, action: string, details: string) => {
    const newLog: AuditLog = {
      id: `log_${Date.now()}`,
      timestampBS: `${getTodayBS()} ${new Date().toLocaleTimeString()}`,
      timestampAD: new Date().toLocaleString(),
      userName: activeRole === 'branch_manager' ? 'Rajesh Manandhar' : activeRole.toUpperCase(),
      userRole: activeRole,
      module,
      action,
      details,
      ipAddress: '192.168.1.100',
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  // Helper for double-entry GL posting
  const postAutoGLVoucher = (
    type: 'Journal' | 'Payment' | 'Receipt' | 'Contra',
    narration: string,
    entries: { accountCode: string; debit: number; credit: number }[],
    moduleRef: string
  ): Voucher => {
    const vchNo = `VCH-2083-${Math.floor(1000 + Math.random() * 9000)}`;
    const fullEntries = entries.map(e => {
      const coa = chartOfAccounts.find(c => c.code === e.accountCode) || { id: e.accountCode, name: 'General Ledger Account' };
      return {
        accountId: coa.id,
        accountCode: e.accountCode,
        accountName: coa.name,
        debit: e.debit,
        credit: e.credit,
      };
    });

    const totalAmt = entries.reduce((acc, curr) => acc + curr.debit, 0);

    const newVoucher: Voucher = {
      id: `vch_${Date.now()}`,
      voucherNo: vchNo,
      voucherType: type,
      dateBS: getTodayBS(),
      dateAD: new Date().toISOString().split('T')[0],
      branchId: activeBranchId,
      preparedBy: activeRole,
      status: 'Posted',
      totalAmount: totalAmt,
      narration,
      entries: fullEntries,
      moduleReference: moduleRef,
    };

    setVouchers(prev => [newVoucher, ...prev]);

    // Update COA balances
    setChartOfAccounts(prev => prev.map(acc => {
      const entry = entries.find(e => e.accountCode === acc.code);
      if (!entry) return acc;
      let diff = 0;
      if (acc.type === 'Asset' || acc.type === 'Expense') {
        diff = entry.debit - entry.credit;
      } else {
        diff = entry.credit - entry.debit;
      }
      return { ...acc, balance: acc.balance + diff };
    }));

    return newVoucher;
  };

  // Shared savings transaction recorder: keeps a local ledger mirror (used by
  // Account Statements in prototype mode) and best-effort persists to the
  // backend so statements reflect real deposits/withdrawals when a DB is linked.
  const recordSavingsTxn = (input: {
    account: SavingsAccount;
    type: 'Deposit' | 'Withdrawal' | 'Interest_Posting';
    amount: number;
    balanceAfter: number;
    voucherNo: string;
    remarks: string;
    paymentMode: 'Cash' | 'Bank_Transfer' | 'Collection_Agent';
    persist?: boolean;
  }) => {
    const txn: SavingsTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      accountId: input.account.id,
      accountNo: input.account.accountNo,
      memberId: input.account.memberId,
      memberName: input.account.memberName,
      type: input.type,
      amount: input.amount,
      balanceAfter: input.balanceAfter,
      voucherNo: input.voucherNo,
      dateBS: getTodayBS(),
      dateAD: getTodayADFormatted(),
      tellerName: activeRole === 'branch_manager' ? 'Branch Manager' : activeRole,
      remarks: input.remarks,
      paymentMode: input.paymentMode,
      branchId: activeBranchId,
    };
    setSavingsTxnHistory(prev => [txn, ...prev]);

    if (input.persist) {
      recordSavingsTransaction({
        accountId: txn.accountId,
        memberId: txn.memberId,
        type: txn.type,
        amount: txn.amount,
        voucherNo: txn.voucherNo,
        dateBs: txn.dateBS,
        dateAd: txn.dateAD,
        tellerName: txn.tellerName,
        paymentMode: txn.paymentMode,
        branchId: txn.branchId,
        remarks: txn.remarks,
      }).catch(() => {
        // Best-effort: local ledger still reflects the entry in prototype mode.
      });
    }
  };

  // 1. Process Savings Deposit (wired to real API)
  const processDeposit = async (accountId: string, amount: number, paymentMode: 'Cash' | 'Bank_Transfer' | 'Collection_Agent' = 'Cash', remarks: string = 'Deposit') => {
    const account = savingsAccounts.find(a => a.id === accountId);
    if (!account) return;

    try {
      const mode = paymentMode === 'Bank_Transfer' ? 'bank_transfer' : 'cash';
      const result = await postDeposit({
        accountId,
        amount,
        mode,
        bsDate: getTodayBS(),
        remarks,
      });

      const newBalance = result.newBalance;

      // Update local state with server-returned balance
      setSavingsAccounts(prev => prev.map(a => a.id === accountId ? {
        ...a,
        balance: newBalance,
        lastTransactionDateBS: getTodayBS(),
      } : a));

      // Update Member total savings
      setMembers(prev => prev.map(m => m.id === account.memberId ? {
        ...m,
        totalSavingsBalance: m.totalSavingsBalance + amount
      } : m));

      // Vault Cash update if cash
      if (paymentMode === 'Cash') {
        setBranches(prev => prev.map(b => b.id === activeBranchId ? {
          ...b,
          currentVaultCash: b.currentVaultCash + amount
        } : b));
      }

      addNotification(
        'Deposit Successful',
        `NPR ${amount.toLocaleString()} deposited into A/C ${account.accountNo} (${account.memberName}). Voucher: ${result.voucherNo}`,
        'success'
      );

      showSuccess(`NPR ${amount.toLocaleString()} deposited into A/C ${account.accountNo} (${account.memberName}). Voucher: ${result.voucherNo}`, 'Deposit Successful');

      logAudit('Savings', 'Deposit Entry', `Deposited NPR ${amount} to ${account.accountNo}`);
    } catch (error: any) {
      addNotification('Deposit Failed', error.message || 'Failed to process deposit', 'alert');
      showError(error.message || 'Failed to process deposit', 'Deposit Failed');
    }
  };

  // 2. Process Savings Withdrawal (wired to real API)
  const processWithdrawal = async (accountId: string, amount: number, remarks: string = 'Withdrawal', chequeDetails?: {
    bankAccountId: string;
    chequeLeafId: string;
    payeeName: string;
    voucherDateBS: string;
    voucherDateAD: string;
  }) => {
    const account = savingsAccounts.find(a => a.id === accountId);
    if (!account) return;

    if (account.balance - amount < account.minBalance) {
      addNotification('Withdrawal Failed', `Insufficient balance! Minimum balance NPR ${account.minBalance} required.`, 'alert');
      showError(`Insufficient balance! Minimum balance NPR ${account.minBalance.toLocaleString()} is required.`, 'Withdrawal Failed');
      return;
    }

    try {
      let result: { voucherNo: string; newBalance?: number; newSavingsBalance?: number; newBankBalance?: number };

      if (chequeDetails) {
        // Bank cheque withdrawal — cooperative pays from its own bank account
        const { postSavingsChequeWithdrawal } = await import('../api/savingsDeposits');
        const chequeResult = await postSavingsChequeWithdrawal({
          savingsAccountId: accountId,
          amount,
          bankAccountId: chequeDetails.bankAccountId,
          chequeLeafId: chequeDetails.chequeLeafId,
          payeeName: chequeDetails.payeeName,
          voucherDateBS: chequeDetails.voucherDateBS,
          voucherDateAD: chequeDetails.voucherDateAD,
          particulars: remarks,
        });
        result = {
          voucherNo: chequeResult.voucherNo,
          newSavingsBalance: chequeResult.newSavingsBalance,
        };
      } else {
        // Cash / regular withdrawal
        const cashResult = await postWithdrawal({
          accountId,
          amount,
          payoutMode: 'cash',
          bsDate: getTodayBS(),
          instrument: {
            type: 'passbook',
            signatureVerified: true,
          },
        });
        result = {
          voucherNo: cashResult.voucherNo,
          newBalance: cashResult.newBalance,
        };
      }

      const newBalance = chequeDetails ? result.newSavingsBalance! : result.newBalance!;

      setSavingsAccounts(prev => prev.map(a => a.id === accountId ? {
        ...a,
        balance: newBalance,
        lastTransactionDateBS: getTodayBS(),
      } : a));

      setMembers(prev => prev.map(m => m.id === account.memberId ? {
        ...m,
        totalSavingsBalance: Math.max(0, m.totalSavingsBalance - amount)
      } : m));

      if (!chequeDetails) {
        // Deduct Vault Cash (only for cash withdrawals)
        setBranches(prev => prev.map(b => b.id === activeBranchId ? {
          ...b,
          currentVaultCash: Math.max(0, b.currentVaultCash - amount)
        } : b));
      }

      addNotification(
        'Withdrawal Processed',
        `NPR ${amount.toLocaleString()} withdrawn from A/C ${account.accountNo}. Voucher: ${result.voucherNo}`,
        'success'
      );

      showSuccess(`NPR ${amount.toLocaleString()} withdrawn from A/C ${account.accountNo}. Voucher: ${result.voucherNo}`, 'Withdrawal Processed');

      logAudit('Savings', 'Withdrawal Entry', `Withdrew NPR ${amount} from ${account.accountNo}${chequeDetails ? ' via bank cheque' : ''}`);
    } catch (error: any) {
      addNotification('Withdrawal Failed', error.message || 'Failed to process withdrawal', 'alert');
      showError(error.message || 'Failed to process withdrawal', 'Withdrawal Failed');
    }
  };

  // 3. Disburse Loan
  const disburseLoan = async (loanId: string, remarks: string = 'Loan Disbursement', paymentAccountId?: string, disbursementMethod: 'Cash' | 'Bank' = 'Cash', chequeLeafId?: string, paymentChannel?: 'CASH' | 'SAVINGS_TRANSFER' | 'CHEQUE', referenceId?: string) => {
    const loan = loanAccounts.find(l => l.id === loanId);
    if (!loan) return null;

    const result = await disburseLoanApi({
      loanId,
      narration: remarks,
      paymentAccountId: paymentAccountId || null,
      disbursementMethod,
      chequeLeafId: chequeLeafId || null,
      disbursementPaymentMethod: paymentChannel || null,
      disbursementReferenceId: referenceId || null,
    });

    if (!result.success) {
      showWarning(result.error || 'Disbursement failed.', 'Disbursement Failed');
      return null;
    }

    // Refresh loan data from server
    const refreshed = await fetchMasterData();
    if (refreshed) {
      setLoanAccounts(refreshed.loanAccounts);
      setMembers(refreshed.members);
    }

    const branch = branches.find(b => b.id === activeBranchId);

    const disbursementResult = {
      ...result.data!,
      loanNo: result.data!.loanNo || loan.loanNo,
      memberName: result.data!.memberName || loan.memberName,
      memberNo: result.data!.memberNo || loan.memberNo,
      dateBs: result.data!.dateBs || getTodayBS(),
      dateAd: result.data!.dateAd || getTodayADFormatted(),
      disbursedBy: activeRole === 'branch_manager' ? 'Branch Manager' : activeRole,
      branchName: branch?.name || '',
      branchAddress: [branch?.address, branch?.district].filter(Boolean).join(', '),
    };

    addNotification(
      'Loan Disbursed',
      `Loan NPR ${loan.approvedAmount.toLocaleString()} disbursed to ${loan.memberName}. Voucher: ${result.data?.voucherNo}`,
      'success'
    );

    showSuccess(`Loan NPR ${loan.approvedAmount.toLocaleString()} disbursed to ${loan.memberName}. Voucher: ${result.data?.voucherNo}`, 'Loan Disbursed');

    logAudit('Loans', 'Disbursement', `Disbursed NPR ${loan.approvedAmount} for ${loan.loanNo}`);

    return disbursementResult;
  };

  // 4. Process Loan EMI Repayment
  const processLoanRepayment = async (
    loanId: string,
    amount: number,
    paymentMode: 'Cash' | 'Bank_Transfer' | 'Auto_Debit' | string = 'Cash',
    paymentDetails?: {
      sourceSavingsAccountId?: string;
      chequeLeafId?: string;
      chequeNumber?: string;
      payeeName?: string;
      chequeDateBs?: string;
      chequeDateAd?: string;
      denominations?: Record<string | number, number>;
      remarks?: string;
      payerSavingsAccountId?: string;
      payerMemberId?: string;
      isThirdParty?: boolean;
      chequeAmount?: number;
    }
  ): Promise<RepaymentResult | null> => {
    const loan = loanAccounts.find(l => l.id === loanId);
    if (!loan) return null;

    // Check savings account balance if auto-debit
    const isAutoDebit = paymentMode === 'Auto_Debit' || paymentMode === 'SAVINGS_AUTO_DEBIT' || Boolean(paymentDetails?.sourceSavingsAccountId);
    if (isAutoDebit && paymentDetails?.sourceSavingsAccountId) {
      const acc = savingsAccounts.find(s => s.id === paymentDetails.sourceSavingsAccountId);
      if (acc) {
        const avail = Math.max(0, acc.balance - (acc.minBalance || 0));
        if (avail < amount) {
          showWarning('Insufficient Savings Balance to Auto-Debit EMI', 'Repayment Failed');
          return null;
        }
      }
    }

    // Internal cheque repayment: split cheque + cash shortfall
    const isInternalCheque = paymentMode === 'CHEQUE' && paymentDetails?.chequeLeafId && paymentDetails?.payerSavingsAccountId;
    const chequeAmount = paymentDetails?.chequeAmount || amount;
    const shortfall = Math.max(0, amount - chequeAmount);
    const cashAmount = shortfall > 0 ? (paymentDetails?.denominations ? Object.entries(paymentDetails.denominations).reduce((sum, [note, qty]) => sum + Number(note) * qty, 0) : 0) : 0;

    if (isInternalCheque) {
      // Compute interest/principal split using day-by-day engine
      const lastPayDate = loan.lastRepaymentDateBS || loan.disbursedDateBS || '';
      const paymentDate = paymentDetails?.chequeDateBs || getTodayBS();
      const breakdown = lastPayDate
        ? calculateRealtimeEmiBreakdown({
            outstandingPrincipal: loan.outstandingPrincipal,
            annualRatePct: loan.interestRate,
            lastPaymentDateBs: lastPayDate,
            currentPaymentDateBs: paymentDate,
            paymentAmount: amount,
            originalPrincipal: loan.approvedAmount || loan.outstandingPrincipal,
            tenureMonths: loan.tenureMonths,
          })
        : null;

      const interestDue = breakdown?.accruedInterest ?? 0;
      const principalDue = Math.max(0, amount - interestDue);

      // 1. Process cheque portion via internal cheque API
      try {
        const { postInternalChequeRepayment } = await import('../api/loanServicing');
        const chequeResult = await postInternalChequeRepayment({
          borrowerLoanId: loanId,
          payerSavingsAccountId: paymentDetails!.payerSavingsAccountId!,
          payerMemberId: paymentDetails?.payerMemberId,
          chequeLeafId: paymentDetails!.chequeLeafId!,
          chequeNumber: paymentDetails?.chequeNumber,
          payeeName: paymentDetails!.payeeName || loan.memberName,
          chequeDateBs: paymentDetails!.chequeDateBs || getTodayBS(),
          chequeDateAd: paymentDetails?.chequeDateAd,
          principalPaid: Math.min(principalDue, chequeAmount),
          interestPaid: Math.min(interestDue, chequeAmount),
          penaltyPaid: 0,
          isThirdParty: paymentDetails?.isThirdParty,
        });

        if (!chequeResult.success) {
          showWarning(chequeResult.message || 'Internal cheque repayment failed.', 'Repayment Failed');
          return null;
        }

        // 2. If there's a cash shortfall, process it separately
        if (shortfall > 0 && cashAmount >= shortfall) {
          // Recompute split for the shortfall portion (remaining interest after cheque covers some)
          const remainingInterest = Math.max(0, interestDue - Math.min(interestDue, chequeAmount));
          const remainingPrincipal = Math.max(0, shortfall - remainingInterest);

          const { recordLoanRepayment } = await import('../api/loanServicing');
          const cashResult = await recordLoanRepayment({
            loanId,
            principalPaid: remainingPrincipal,
            interestPaid: remainingInterest,
            penaltyPaid: 0,
            paymentMode: 'Cash',
            dateBs: getTodayBS(),
          });

          if (!cashResult.success) {
            showWarning(cashResult.error || 'Cash portion posting failed.', 'Repayment Failed');
            return null;
          }
        }

        // Refresh loan data from server
        const refreshed = await fetchMasterData();
        if (refreshed) {
          setLoanAccounts(refreshed.loanAccounts);
          setMembers(refreshed.members);
          setSavingsAccounts(refreshed.savingsAccounts);
        }

        const branch = branches.find(b => b.id === activeBranchId);

        const repaymentResult: RepaymentResult = {
          receiptNo: chequeResult.repaymentId,
          voucherNo: chequeResult.voucherNo,
          loanNo: loan.loanNo,
          memberName: loan.memberName,
          memberNo: loan.memberNo,
          loanId: loan.id,
          amount,
          principalPortion: breakdown?.principalPaid ?? amount,
          interestPortion: breakdown?.accruedInterest ?? 0,
          outstandingAfter: breakdown?.newOutstandingPrincipal ?? Math.max(0, loan.outstandingPrincipal - (breakdown?.principalPaid ?? amount)),
          closed: (breakdown?.newOutstandingPrincipal ?? 0) <= 0.01,
          paymentMode: `Internal Cheque${shortfall > 0 ? ' + Cash' : ''}`,
          dateBS: getTodayBS(),
          dateAD: getTodayADFormatted(),
          collectedBy: activeRole === 'branch_manager' ? 'Branch Manager' : activeRole,
          branchName: branch?.name || '',
          branchAddress: [branch?.address, branch?.district].filter(Boolean).join(', '),
          glEntries: chequeResult.glEntries,
        };

        addNotification(
          'Repayment Posted',
          `${loan.loanNo}: EMI of ${formatNPR(amount)} paid via Internal Cheque${shortfall > 0 ? ' + Cash' : ''}`,
          'success',
        );

        return repaymentResult;
      } catch (err: any) {
        showWarning(err.message || 'Internal cheque repayment failed.', 'Repayment Failed');
        return null;
      }
    }

    // Co-operative cheque (bank cheque) — not internal
    const isCoopCheque = paymentMode === 'CHEQUE' && paymentDetails?.chequeLeafId && !paymentDetails?.payerSavingsAccountId;
    if (isCoopCheque) {
      try {
        const { markChequeLeafIssued } = await import('../api/loanServicing');
        await markChequeLeafIssued({
          leafId: paymentDetails!.chequeLeafId!,
          payeeName: paymentDetails!.payeeName || loan.memberName,
          amount,
          chequeDateBs: paymentDetails!.chequeDateBs || getTodayBS(),
          chequeDateAd: paymentDetails!.chequeDateAd || new Date().toISOString().slice(0, 10),
        });
      } catch (err: any) {
        showWarning(err.message || 'Failed to mark co-operative cheque as issued.', 'Cheque Posting Failed');
        return null;
      }
    }

    // Fetch real due breakdown to split payment correctly
    let interestPortion = 0;
    let principalPortion = amount;
    let penaltyPortion = 0;

    try {
      const due: LoanDueBreakdown = await fetchLoanDue(loanId);
      // Interest first, then penalty, rest goes to principal
      if (due.interestDue > 0) {
        interestPortion = Math.min(amount, due.interestDue);
      }
      if (due.penaltyDue > 0) {
        penaltyPortion = Math.min(amount - interestPortion, due.penaltyDue);
      }
      principalPortion = Math.max(0, amount - interestPortion - penaltyPortion);
      // Cap principal to outstanding
      principalPortion = Math.min(principalPortion, due.outstandingPrincipal);
    } catch {
      // Fallback: 25% interest, 75% principal
      interestPortion = Math.min(amount * 0.25, loan.outstandingPrincipal * 0.012);
      principalPortion = amount - interestPortion;
    }

    const backendPaymentMode = isCoopCheque ? 'Bank_Transfer' : (paymentMode === 'Cash' ? 'Cash' : 'Bank_Transfer');

    const result = await recordLoanRepayment({
      loanId,
      principalPaid: principalPortion,
      interestPaid: interestPortion,
      penaltyPaid: penaltyPortion,
      paymentMode: backendPaymentMode,
      paymentAccountId: null,
      dateBs: paymentDetails?.chequeDateBs || getTodayBS(),
      receiptNo: paymentDetails?.chequeNumber ? `COOP-CHQ-${paymentDetails.chequeNumber}` : null,
      narration: paymentDetails?.remarks || (isCoopCheque ? `EMI Repayment via Co-operative Cheque ${paymentDetails?.chequeNumber}` : isAutoDebit ? 'EMI Auto-Debit from Member Savings A/C' : undefined),
    });

    if (!result.success) {
      showWarning(result.error || 'Repayment failed.', 'Repayment Failed');
      return null;
    }

    // Deduct from savings balance if auto-debit
    if (isAutoDebit && paymentDetails?.sourceSavingsAccountId) {
      setSavingsAccounts(prev => prev.map(s => s.id === paymentDetails.sourceSavingsAccountId ? {
        ...s,
        balance: Math.max(0, s.balance - amount),
        lastTransactionDateBS: getTodayBS(),
      } : s));
    }

    // Refresh loan data from server
    const refreshed = await fetchMasterData();
    if (refreshed) {
      setLoanAccounts(refreshed.loanAccounts);
      setMembers(refreshed.members);
      if (!isAutoDebit) {
        setSavingsAccounts(refreshed.savingsAccounts);
      }
    }

    const branch = branches.find(b => b.id === activeBranchId);

    const displayPaymentMode = isAutoDebit
      ? 'Savings Auto-Debit'
      : paymentMode === 'Bank_Transfer' || paymentMode === 'CHEQUE'
      ? 'Bank Wire / Cheque'
      : 'Cash at Counter';

    const repaymentResult: RepaymentResult = {
      receiptNo: result.data!.receiptNo,
      voucherNo: result.data!.voucherNo,
      loanNo: loan.loanNo,
      memberName: loan.memberName,
      memberNo: loan.memberNo,
      loanId: loan.id,
      amount,
      principalPortion,
      interestPortion,
      outstandingAfter: result.data!.outstandingAfter,
      closed: result.data!.closed,
      paymentMode: displayPaymentMode,
      dateBS: getTodayBS(),
      dateAD: getTodayADFormatted(),
      collectedBy: activeRole === 'branch_manager' ? 'Branch Manager' : activeRole,
      branchName: branch?.name || '',
      branchAddress: [branch?.address, branch?.district].filter(Boolean).join(', '),
      glEntries: result.data!.glEntries,
    };

    addNotification(
      'Loan Repayment Received',
      `Received NPR ${amount.toLocaleString()} for Loan ${loan.loanNo}. Outstanding: NPR ${result.data!.outstandingAfter.toLocaleString()}. Voucher: ${result.data!.voucherNo}`,
      'success'
    );

    showSuccess(`Received NPR ${amount.toLocaleString()} for Loan ${loan.loanNo}. Outstanding: NPR ${result.data!.outstandingAfter.toLocaleString()}. Voucher: ${result.data!.voucherNo}`, 'Loan Repayment Received');

    logAudit('Loans', 'Repayment', `Repaid NPR ${amount} for Loan ${loan.loanNo}`);

    return repaymentResult;
  };

  // 5. Approval Decision
  const processApprovalDecision = async (requestId: string, status: 'Approved' | 'Rejected', remarks: string = '') => {
    const req = approvalRequests.find(r => r.id === requestId);
    if (!req) return;

    setApprovalRequests(prev => prev.map(r => r.id === requestId ? {
      ...r,
      status,
      approvedBy: activeRole === 'branch_manager' ? 'Branch Manager (Rajesh Manandhar)' : activeRole,
      remarks,
    } : r));

    if (status === 'Approved') {
      if (req.requestType === 'Loan_Approval') {
        const loan = loanAccounts.find(l => l.loanNo === req.referenceNo);
        if (loan) {
          await disburseLoan(loan.id, 'Disbursed automatically on Board/Manager Approval');
        }
      }
    }

    addNotification(
      `Approval Request ${status}`,
      `Request ${req.referenceNo} (${req.requestType}) was ${(status || '').toLowerCase()} by ${activeRole}.`,
      status === 'Approved' ? 'success' : 'warning'
    );

    if (status === 'Approved') {
      showSuccess(`Request ${req.referenceNo} (${req.requestType}) was approved by ${activeRole}.`, 'Request Approved');
    } else {
      showWarning(`Request ${req.referenceNo} (${req.requestType}) was rejected by ${activeRole}.`, 'Request Rejected');
    }

    logAudit('Workflow', `Approval ${status}`, `Decision on ${req.referenceNo}: ${status}`);
  };

  // 6. Reconcile Agent Field Collection
  const reconcileAgentRoute = (routeId: string) => {
    const route = collectionRoutes.find(r => r.id === routeId);
    if (!route) return;

    setCollectionRoutes(prev => prev.map(r => r.id === routeId ? {
      ...r,
      status: 'Reconciled',
    } : r));

    // Deposit agent cash into vault
    setBranches(prev => prev.map(b => b.id === activeBranchId ? {
      ...b,
      currentVaultCash: b.currentVaultCash + route.todayCollectedAmount
    } : b));

    const voucher = postAutoGLVoucher(
      'Receipt',
      `Field Agent Collection Reconciliation for ${route.routeName} (Agent: ${route.agentName})`,
      [
        { accountCode: '1001', debit: route.todayCollectedAmount, credit: 0 },
        { accountCode: '2004', debit: 0, credit: route.todayCollectedAmount } // Daily Micro savings
      ],
      `CollectionRoute ${route.code}`
    );

    addNotification(
      'Field Collection Reconciled',
      `Agent ${route.agentName} cash NPR ${route.todayCollectedAmount.toLocaleString()} deposited to Vault. Voucher: ${voucher.voucherNo}`,
      'success'
    );

    showSuccess(`Agent ${route.agentName} cash NPR ${route.todayCollectedAmount.toLocaleString()} deposited to Vault. Voucher: ${voucher.voucherNo}`, 'Field Collection Reconciled');

    logAudit('Collection', 'Route Reconciliation', `Reconciled NPR ${route.todayCollectedAmount} for ${route.code}`);
  };

  // 7. Add New Member
  const addNewMember = async (memberData: MemberInput): Promise<Member> => {
    try {
      const branchId = memberData.branchId || activeBranchId;
      if (!branchId) {
        showError('No active branch is set. Please refresh and try again.', 'Registration Failed');
        throw new Error('No active branch is set.');
      }

      const newMember = await createMemberApi({ ...memberData, branchId });

      setMembers(prev => [newMember, ...prev]);

      addNotification(
        'New Member Registered',
        `Member ${newMember.fullName} (${newMember.memberNo}) registered successfully.`,
        'success'
      );

      showSuccess(
        `Member ${newMember.fullName} (${newMember.memberNo}) registered successfully.`,
        'Member Registered'
      );

      logAudit('Members', 'Add Member', `Registered new member ${newMember.fullName}`);

      return newMember;
    } catch (error: any) {
      showError(
        error?.response?.data?.error || error?.message || 'Failed to register member. Please try again.',
        'Registration Failed'
      );
      throw error;
    }
  };

  // Update Member details (e.g. photo, documents, status)
  const updateMember = async (id: string, updates: Partial<Member>): Promise<void> => {
    try {
      const updated = await updateMemberApi(id, updates);
      setMembers(prev => prev.map(m => {
        if (m.id === id) {
          const merged = { ...m, ...updated };
          if (selectedMemberForDetail?.id === id) {
            setSelectedMemberForDetail(merged);
          }
          return merged;
        }
        return m;
      }));
      logAudit('Members', 'Update Member', `Updated member details for ID: ${id}`);
    } catch (error: any) {
      showError(
        error?.response?.data?.error || error?.message || 'Failed to update member.',
        'Update Failed'
      );
    }
  };

  // Delete Member (org_admin only). Removes the member from local state and
  // closes the detail modal if it was showing the deleted record.
  const deleteMember = async (id: string): Promise<void> => {
    try {
      await deleteMemberApi(id);
      setMembers(prev => prev.filter(m => m.id !== id));
      if (selectedMemberForDetail?.id === id) {
        setSelectedMemberForDetail(null);
      }
      logAudit('Members', 'Delete Member', `Deleted member ID: ${id}`);
    } catch (error: any) {
      showError(
        error?.response?.data?.error || error?.message || 'Failed to delete member.',
        'Delete Failed'
      );
      throw error;
    }
  };

  // 8. Create Loan Application
  const createNewLoanApplication = (loanData: {
    memberId: string;
    productType: any;
    amount: number;
    tenureMonths: number;
    collateralType: string;
    collateralValuation: number;
    interestMethod: 'declining' | 'flat';
  }): LoanAccount => {
    const member = members.find(m => m.id === loanData.memberId);
    const loanNo = `LN-2083-${Math.floor(1000 + Math.random() * 9000)}`;

    const monthlyRate = 0.135 / 12;
    const emi = Math.round((loanData.amount * monthlyRate * Math.pow(1 + monthlyRate, loanData.tenureMonths)) / (Math.pow(1 + monthlyRate, loanData.tenureMonths) - 1));

    const newLoan: LoanAccount = {
      id: `ln_${Date.now()}`,
      loanNo,
      memberId: loanData.memberId,
      memberName: member?.fullName || 'Member',
      memberNo: member?.memberNo || 'MBR-000',
      productType: loanData.productType,
      productName: `${loanData.productType.toUpperCase()} Sahakari Loan`,
      appliedAmount: loanData.amount,
      approvedAmount: loanData.amount,
      outstandingPrincipal: loanData.amount,
      interestRate: 13.5,
      interestMethod: loanData.interestMethod,
      tenureMonths: loanData.tenureMonths,
      monthlyEMI: emi,
      disbursedDateBS: getTodayBS(),
      maturityDateBS: '2085-04-01',
      collateralType: loanData.collateralType,
      collateralValuation: loanData.collateralValuation,
      branchId: activeBranchId,
      status: 'Applied',
      nplStatus: 'Pass',
      daysOverdue: 0,
      overdueAmount: 0,
      provisionAmount: Math.round(loanData.amount * 0.01),
    };

    setLoanAccounts(prev => [newLoan, ...prev]);

    // Send to Workflow Approval Queue
    const approvalReq: ApprovalRequest = {
      id: `appr_${Date.now()}`,
      requestType: 'Loan_Approval',
      referenceNo: loanNo,
      requestedBy: 'Loan Officer',
      requestedDateBS: getTodayBS(),
      amount: loanData.amount,
      description: `Loan Application for ${newLoan.memberName} (${loanData.collateralType})`,
      branchId: activeBranchId,
      status: 'Pending',
    };

    setApprovalRequests(prev => [approvalReq, ...prev]);

    addNotification(
      'Loan Application Submitted',
      `Loan Application ${loanNo} for ${newLoan.memberName} (NPR ${loanData.amount.toLocaleString()}) sent to Board/Manager approval queue.`,
      'info'
    );

    showInfo(`Loan Application ${loanNo} for ${newLoan.memberName} (NPR ${loanData.amount.toLocaleString()}) was submitted to the approval queue.`, 'Loan Application Submitted');

    logAudit('Loans', 'Application Entry', `Created loan application ${loanNo}`);

    return newLoan;
  };

  // 9. Manual Voucher Posting
  const postManualVoucher = async (voucherData: Omit<Voucher, 'id' | 'voucherNo' | 'status'>): Promise<Voucher> => {
    const { createVoucher, postVoucher } = await import('../api/accounting');
    const activeFY = fiscalYears.find(f => f.isCurrent) || fiscalYears[0];

    // 1. Create voucher via real API
    const created = await createVoucher({
      voucher: {
        voucherType: voucherData.voucherType,
        dateBs: voucherData.dateBS,
        dateAd: voucherData.dateAD,
        branchId: voucherData.branchId || activeBranchId,
        fiscalYearCode: activeFY?.code || '',
        preparedBy: voucherData.preparedBy,
        totalAmount: voucherData.totalAmount,
        narration: voucherData.narration,
        status: 'Draft',
      },
      entries: voucherData.entries.map(e => ({
        accountId: e.accountId,
        accountCode: e.accountCode,
        accountName: e.accountName,
        debit: e.debit,
        credit: e.credit,
        narration: e.narration,
      })),
    });

    // 2. Post voucher (update COA balances)
    const posted = await postVoucher(created.id);

    const newVoucher: Voucher = {
      id: posted.id,
      voucherNo: posted.voucherNo,
      voucherType: posted.voucherType as Voucher['voucherType'],
      dateBS: posted.dateBs,
      dateAD: posted.dateAd,
      branchId: voucherData.branchId || activeBranchId,
      preparedBy: voucherData.preparedBy,
      status: 'Posted',
      totalAmount: Number(posted.totalAmount),
      narration: posted.narration,
      entries: posted.entries.map(e => ({
        accountId: e.accountId,
        accountCode: e.accountCode,
        accountName: e.accountName,
        debit: Number(e.debit),
        credit: Number(e.credit),
      })),
    };

    setVouchers(prev => [newVoucher, ...prev]);
    addNotification('Voucher Posted', `Voucher ${posted.voucherNo} posted successfully.`, 'success');
    showSuccess(`Voucher ${posted.voucherNo} was posted successfully.`, 'Voucher Posted');
    logAudit('Accounts', 'Manual Voucher', `Posted voucher ${posted.voucherNo}`);

    return newVoucher;
  };

  // 10. Post Expense Claim
  const postExpenseClaim = (title: string, category: string, amount: number, description: string) => {
    const approvalReq: ApprovalRequest = {
      id: `appr_${Date.now()}`,
      requestType: 'Expense_Claim',
      referenceNo: `EXP-${Math.floor(100 + Math.random() * 900)}`,
      requestedBy: activeRole,
      requestedDateBS: getTodayBS(),
      amount,
      description: `${title} (${category}): ${description}`,
      branchId: activeBranchId,
      status: 'Pending',
    };

    setApprovalRequests(prev => [approvalReq, ...prev]);
    addNotification('Expense Claim Submitted', `Claim NPR ${amount.toLocaleString()} for ${title} submitted for approval.`, 'info');
    showInfo(`Claim NPR ${amount.toLocaleString()} for ${title} was submitted for approval.`, 'Expense Claim Submitted');
  };

  // 11. Interest Posting Engine Batch
  const runInterestPosting = () => {
    let totalPosted = 0;
    const postings: SavingsTransaction[] = [];
    setSavingsAccounts(prev => prev.map(acc => {
      if (acc.balance <= 0) return acc;
      const accruedInterest = Math.round((acc.balance * (acc.interestRate / 100)) / 4); // Quarterly
      totalPosted += accruedInterest;
      const txn: SavingsTransaction = {
        id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        accountId: acc.id,
        accountNo: acc.accountNo,
        memberId: acc.memberId,
        memberName: acc.memberName,
        type: 'Interest_Posting',
        amount: accruedInterest,
        balanceAfter: acc.balance + accruedInterest,
        voucherNo: `INT-${getCurrentFiscalYearCode().replace('/', '-')}-${Date.now().toString().slice(-4)}`,
        dateBS: getTodayBS(),
        dateAD: getTodayADFormatted(),
        tellerName: 'System',
        remarks: 'Quarterly Interest Posting',
        paymentMode: 'Cash',
        branchId: activeBranchId,
      };
      postings.push(txn);
      return {
        ...acc,
        balance: acc.balance + accruedInterest,
      };
    }));

    if (postings.length > 0) {
      setSavingsTxnHistory(prev => [...postings.slice().reverse(), ...prev]);
      postings.forEach(p => {
        recordSavingsTransaction({
          accountId: p.accountId,
          memberId: p.memberId,
          type: 'Interest_Posting',
          amount: p.amount,
          voucherNo: p.voucherNo,
          dateBs: p.dateBS,
          dateAd: p.dateAD,
          tellerName: p.tellerName,
          paymentMode: 'Cash',
          branchId: p.branchId,
          remarks: p.remarks,
        }).catch(() => {});
      });
    }

    postAutoGLVoucher(
      'Journal',
      `Quarterly Savings Interest Posting Engine Run across active accounts`,
      [
        { accountCode: '5001', debit: totalPosted, credit: 0 }, // Interest expense
        { accountCode: '2001', debit: 0, credit: totalPosted } // Savings liability
      ],
      'Batch Interest Posting'
    );

    addNotification('Batch Interest Posting Complete', `Total Interest NPR ${totalPosted.toLocaleString()} posted across all member savings accounts.`, 'success');
    showSuccess(`Total interest of NPR ${totalPosted.toLocaleString()} was posted across all member savings accounts.`, 'Batch Interest Posting Complete');
  };

  // 12. Depreciation Run
  const runDepreciation = () => {
    let totalDep = 0;
    setFixedAssets(prev => prev.map(asset => {
      const dep = Math.round((asset.currentBookValue * asset.depreciationRatePercent) / 100 / 12);
      totalDep += dep;
      return {
        ...asset,
        accumulatedDepreciation: asset.accumulatedDepreciation + dep,
        currentBookValue: Math.max(0, asset.currentBookValue - dep),
      };
    }));

    postAutoGLVoucher(
      'Journal',
      `Monthly Fixed Assets Depreciation Run`,
      [
        { accountCode: '5004', debit: totalDep, credit: 0 },
        { accountCode: '1005', debit: 0, credit: totalDep }
      ],
      'Depreciation Run'
    );

    addNotification('Depreciation Run Completed', `Total Depreciation NPR ${totalDep.toLocaleString()} posted to GL.`, 'success');
    showSuccess(`Total depreciation of NPR ${totalDep.toLocaleString()} was posted to the GL.`, 'Depreciation Run Completed');
  };

  // 13. Add Chart of Account / Ledger Group
  /**
   * Persists a new GL account, then mirrors the server row into local state.
   *
   * This used to be setState + a success toast + an audit entry with no API
   * call at all: the account disappeared on the next refresh, and the audit log
   * recorded a creation that never happened. The account id now comes from the
   * database rather than `c_${Date.now()}`, so it can be referenced by voucher
   * entries and system mappings.
   *
   * Note `balance` is not sent — the server always inserts an account at zero
   * and opening balances are established by posting an opening journal, not by
   * declaring them on the account row.
   */
  const addChartOfAccount = async (accountData: Omit<ChartOfAccount, 'id'>): Promise<ChartOfAccount | null> => {
    try {
      // `ChartOfAccount.type` tolerates 'ASSETS'/'ASSET'/'Asset' but the API
      // enum only accepts title case, so normalize rather than let a caller
      // that read the type off an existing row hit a validation error.
      const t = String(accountData.type || '').trim().toLowerCase();
      const type = t.startsWith('asset') ? 'Asset'
        : t.startsWith('liabilit') ? 'Liability'
        : t.startsWith('equity') ? 'Equity'
        : t.startsWith('income') || t.startsWith('revenue') ? 'Income'
        : t.startsWith('expens') ? 'Expense'
        : accountData.type;

      const row = await createAccount({
        code: accountData.code,
        name: accountData.name,
        type,
        parentCode: accountData.parentCode || null,
        description: accountData.Description || null,
      });

      const newAccount: ChartOfAccount = {
        ...accountData,
        id: String(row?.id ?? ''),
        code: String(row?.code ?? accountData.code),
        name: String(row?.name ?? accountData.name),
        type: row?.type ?? type,
        parentCode: row?.parentCode ?? accountData.parentCode,
        balance: Number(row?.balance ?? 0),
      };

      setChartOfAccounts(prev => [...prev, newAccount]);
      addNotification('Ledger Group/Account Created', `Created ${newAccount.code} - ${newAccount.name} successfully.`, 'success');
      showSuccess(`Created ${newAccount.code} - ${newAccount.name} successfully.`, 'Ledger Group/Account Created');
      logAudit('COA Setup', 'Add Account', `Created COA account ${newAccount.code} (${newAccount.name})`);
      return newAccount;
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Unknown error';
      console.error('[addChartOfAccount] failed:', message);
      addNotification('Account Creation Failed', message, 'alert');
      showError(message, 'Account Creation Failed');
      return null;
    }
  };

  // 14. Department Management Functions (API-backed, sourced from the database)
  const addDepartment = async (deptData: Omit<Department, 'id' | 'createdAtBS'>): Promise<Department | null> => {
    try {
      const created = await createDepartment(deptData);
      setDepartments(prev => [created, ...prev.filter(d => d.id !== created.id)]);
      addNotification('Department Created', `New department "${created.name}" (${created.code}) configured successfully.`, 'success');
      showSuccess(`New department "${created.name}" (${created.code}) was configured successfully.`, 'Department Created');
      logAudit('Organization Setup', 'Add Department', `Created department ${created.code} (${created.name})`);
      return created;
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Unknown error';
      console.error('[addDepartment] failed:', message);
      addNotification('Department Failed', message, 'alert');
      showError(message, 'Department Creation Failed');
      return null;
    }
  };

  const updateDepartment = async (id: string, updates: Partial<Department>): Promise<Department | null> => {
    try {
      const updated = await updateDepartmentApi(id, updates);
      setDepartments(prev => prev.map(dept => dept.id === id ? { ...dept, ...updated } : dept));
      addNotification('Department Updated', 'Department details and configuration saved.', 'info');
      showSuccess('Department details and configuration were saved.', 'Department Updated');
      logAudit('Organization Setup', 'Update Department', `Updated department ID ${id}`);
      return updated;
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Unknown error';
      console.error('[updateDepartment] failed:', message);
      addNotification('Department Update Failed', message, 'alert');
      showError(message, 'Department Update Failed');
      return null;
    }
  };

  const deleteDepartment = async (id: string): Promise<boolean> => {
    const target = departments.find(d => d.id === id);
    try {
      await deleteDepartmentApi(id);
      setDepartments(prev => prev.filter(dept => dept.id !== id));
      setDesignations(prev => prev.filter(d => d.departmentId !== id));
      addNotification('Department Deleted', `Department "${target?.name || id}" removed from registry.`, 'warning');
      showWarning(`Department "${target?.name || id}" was removed from the registry.`, 'Department Deleted');
      logAudit('Organization Setup', 'Delete Department', `Deleted department ${target?.code || id}`);
      return true;
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Unknown error';
      console.error('[deleteDepartment] failed:', message);
      addNotification('Department Delete Failed', message, 'alert');
      showError(message, 'Department Delete Failed');
      return false;
    }
  };

  // 15. Designation Management Functions (nested under departments)
  const addDesignation = async (
    departmentId: string,
    data: Omit<Designation, 'id' | 'departmentId'>
  ): Promise<Designation | null> => {
    try {
      const created = await createDesignation(departmentId, data);
      setDesignations(prev => [created, ...prev]);
      addNotification('Designation Created', `Designation "${created.name}" added to the department.`, 'success');
      showSuccess(`Designation "${created.name}" was added to the department.`, 'Designation Created');
      logAudit('Organization Setup', 'Add Designation', `Created designation ${created.name} (department ${departmentId})`);
      return created;
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Unknown error';
      console.error('[addDesignation] failed:', message);
      addNotification('Designation Failed', message, 'alert');
      showError(message, 'Designation Creation Failed');
      return null;
    }
  };

  const updateDesignation = async (id: string, updates: Partial<Designation>): Promise<Designation | null> => {
    try {
      const updated = await updateDesignationApi(id, updates);
      setDesignations(prev => prev.map(d => d.id === id ? { ...d, ...updated } : d));
      addNotification('Designation Updated', 'Designation details saved.', 'info');
      showSuccess('Designation details were saved.', 'Designation Updated');
      logAudit('Organization Setup', 'Update Designation', `Updated designation ${updated.name}`);
      return updated;
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Unknown error';
      console.error('[updateDesignation] failed:', message);
      addNotification('Designation Update Failed', message, 'alert');
      showError(message, 'Designation Update Failed');
      return null;
    }
  };

  const deleteDesignation = async (id: string): Promise<boolean> => {
    const target = designations.find(d => d.id === id);
    try {
      await deleteDesignationApi(id);
      setDesignations(prev => prev.filter(d => d.id !== id));
      addNotification('Designation Deleted', `Designation "${target?.name || id}" removed.`, 'warning');
      showWarning(`Designation "${target?.name || id}" was removed.`, 'Designation Deleted');
      logAudit('Organization Setup', 'Delete Designation', `Deleted designation ${target?.name || id}`);
      return true;
    } catch (error: any) {
      const message = error?.response?.data?.error || error?.message || 'Unknown error';
      console.error('[deleteDesignation] failed:', message);
      addNotification('Designation Delete Failed', message, 'alert');
      showError(message, 'Designation Delete Failed');
      return false;
    }
  };

  const addFiscalYear = async (fyData: Omit<FiscalYear, 'id'>): Promise<FiscalYear | null> => {
    try {
      const created = await createFiscalYear(fyData);
      const newFY = normalizeFiscalYear(created);
      setFiscalYears(prev => {
        if (fyData.isCurrent) {
          return prev.map(f => ({ ...f, isCurrent: false })).concat(newFY);
        }
        return [...prev, newFY];
      });
      if (fyData.isCurrent) setActiveFiscalYearCode(newFY.code);
      addNotification('Fiscal Year Created', `Fiscal Year ${newFY.code} registered successfully.`, 'success');
      showSuccess(`Fiscal Year ${newFY.code} was registered successfully.`, 'Fiscal Year Created');
      logAudit('Organization Setup', 'Add Fiscal Year', `Created fiscal year ${newFY.code}`);
      return newFY;
    } catch (error: any) {
      const isConflict = error?.response?.status === 409;
      const message = error?.response?.data?.error || error?.message || 'Unknown error';
      console.error('[addFiscalYear] POST failed:', message);
      addNotification('Fiscal Year Failed', message, 'alert');
      if (isConflict) {
        fetchFiscalYears()
          .then(rows => { if (rows !== null) setFiscalYears(rows); })
          .catch(() => {});
      }
      throw new Error(message);
    }
  };

  // Derived bootstrap progress surfaced to the post-login boot screen.
  // Every step must reach a terminal state (done/error) before the workspace
  // is considered "ready" — the grouping mirrors the parallel fetches above.
  const bootstrapSteps: BootstrapStep[] = React.useMemo(() => {
    if (!bootstrapEnabled) {
      return [
        { key: 'org', label: 'Loading organization profile & settings', status: 'done' },
        { key: 'fiscal', label: 'Loading branches & fiscal years', status: 'done' },
        { key: 'structure', label: 'Loading departments & designations', status: 'done' },
        { key: 'domain', label: 'Loading members, savings & loan accounts', status: 'done' },
      ];
    }
    const toStep = (s: 'loading' | 'loaded' | 'error'): BootstrapStepStatus =>
      s === 'loaded' ? 'done' : s;
    const structureStatus: BootstrapStepStatus =
      departmentsStatus === 'loaded' && designationsStatus === 'loaded'
        ? 'done'
        : departmentsStatus === 'error' || designationsStatus === 'error'
          ? 'error'
          : 'loading';
    return [
      { key: 'org', label: 'Loading organization profile & settings', status: toStep(orgSettingsStatus) },
      { key: 'fiscal', label: 'Loading branches & fiscal years', status: toStep(fiscalYearsStatus) },
      { key: 'structure', label: 'Loading departments & designations', status: structureStatus },
      { key: 'domain', label: 'Loading members, savings & loan accounts', status: toStep(masterDataStatus) },
    ];
  }, [bootstrapEnabled, orgSettingsStatus, fiscalYearsStatus, departmentsStatus, designationsStatus, masterDataStatus]);

  const bootstrapReady = React.useMemo(
    () => bootstrapSteps.every((s) => s.status === 'done' || s.status === 'error'),
    [bootstrapSteps]
  );

  return (
    <CoopContext.Provider value={{
      activeRole,
      setActiveRole,
      activeBranchId,
      setActiveBranchId,
      activeBranch,
      branches,
      activeFiscalYearCode,
      setActiveFiscalYearCode,
      fiscalYears,
      fiscalYearsStatus,
      reloadFiscalYears,
      isFiscalYearModalOpen,
      setIsFiscalYearModalOpen,
      currencyConfig,
      updateCurrencyConfig,
      convertToNPR,
      departments,
      departmentsStatus,
      reloadDepartments,
      designations,
      designationsStatus,
      reloadDesignations,
      menuViewMode,
      setMenuViewMode,
      tabs,
      activeTabId,
      openTab,
      closeTab,
      closeOtherTabs,
      setActiveTabId,
      markTabDirty,
      isTabMaximized,
      toggleMaximizeTab,
      pendingCloseTabId,
      setPendingCloseTabId,
      confirmCloseDirtyTab,
      notifications,
      unreadNotificationCount,
      addNotification,
      markNotificationRead,
clearAllNotifications,
  bootstrapSteps,
  bootstrapReady,
  members,
      setMembers,
      reloadMembers,
      reloadMasterData,
      savingsAccounts,
      loanAccounts,
      chartOfAccounts,
      vouchers,
      collectionAgents,
      collectionRoutes,
      budgetLines,
      fixedAssets,
      approvalRequests,
      auditLogs,
      customerTickets,
      isGlobalSearchOpen,
      setIsGlobalSearchOpen,
      isShortcutModalOpen,
      setIsShortcutModalOpen,
      selectedMemberForDetail,
      setSelectedMemberForDetail,
      memberEditMode,
      setMemberEditMode,
      selectedVoucherForDetail,
      setSelectedVoucherForDetail,
      selectedAccountForPassbook,
      setSelectedAccountForPassbook,
      savingsTxnHistory,
      staffFormOpen,
      staffFormMode,
      staffFormTarget,
      staffRefreshKey,
      openStaffForm,
      closeStaffForm,
      bumpStaffRefresh,
      branchFormOpen,
      branchFormMode,
      branchFormTarget,
      openBranchForm,
      closeBranchForm,
      saveBranch,
      processDeposit,
      processWithdrawal,
      disburseLoan,
      processLoanRepayment,
      processApprovalDecision,
      reconcileAgentRoute,
      addNewMember,
      updateMember,
      deleteMember,
      createNewLoanApplication,
      postManualVoucher,
      postExpenseClaim,
      runInterestPosting,
      runDepreciation,
      addChartOfAccount,
      addDepartment,
      updateDepartment,
      deleteDepartment,
      addDesignation,
      updateDesignation,
      deleteDesignation,
      addFiscalYear,
    }}>
      {children}
    </CoopContext.Provider>
  );
};

export const useCoop = () => {
  const context = useContext(CoopContext);
  if (!context) {
    throw new Error('useCoop must be used within a CoopProvider');
  }
  return context;
};
