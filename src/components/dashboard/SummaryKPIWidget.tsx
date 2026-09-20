import React, { useState, useEffect } from 'react';
import { useCoop } from '../../context/CoopContext';
import { 
  Users, 
  PiggyBank, 
  Landmark, 
  DollarSign, 
  ArrowUpRight, 
  Sparkles, 
  CheckCircle2, 
  ShieldCheck, 
  Coins, 
  Clock, 
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  RotateCcw,
  Settings2,
  Briefcase,
  Wallet,
  Check,
  BadgeAlert
} from 'lucide-react';
import { formatNPR } from '../../utils/nepaliCalendar';

export type UserRoleType = 'all' | 'executive' | 'branch_manager' | 'loan_officer' | 'teller' | 'accountant';

export interface MetricCardConfig {
  id: string;
  label: string;
  tabKey: string;
  tabTitle: string;
  iconName: string;
  colSpan: 'col-span-1' | 'col-span-1 sm:col-span-2';
  visible: boolean;
}

const DEFAULT_METRIC_CONFIGS: MetricCardConfig[] = [
  { id: 'members', label: 'Total Members', tabKey: 'member_directory', tabTitle: 'Member Directory', iconName: 'Users', colSpan: 'col-span-1', visible: true },
  { id: 'deposits', label: 'Total Deposits', tabKey: 'savings_deposit', tabTitle: 'Deposit & Savings Accounts', iconName: 'PiggyBank', colSpan: 'col-span-1', visible: true },
  { id: 'loans', label: 'Active Loans', tabKey: 'loan_portfolio', tabTitle: 'Loan Portfolio', iconName: 'Landmark', colSpan: 'col-span-1', visible: true },
  { id: 'revenue', label: 'Monthly Revenue', tabKey: 'accounts_income_stmt', tabTitle: 'Income & Profit Statement', iconName: 'Coins', colSpan: 'col-span-1', visible: true },
  { id: 'collection', label: "Today's Collection", tabKey: 'collection_agents', tabTitle: 'Collection Management', iconName: 'Wallet', colSpan: 'col-span-1', visible: true },
  { id: 'npl_ratio', label: 'NPL Portfolio Quality', tabKey: 'loan_npl', tabTitle: 'Loan Risk & NPL', iconName: 'BadgeAlert', colSpan: 'col-span-1', visible: true },
  { id: 'pending_approvals', label: 'Pending Approvals', tabKey: 'workflow_inbox', tabTitle: 'Approvals Queue', iconName: 'Clock', colSpan: 'col-span-1', visible: true },
  { id: 'vault_cash', label: 'Vault Cash Balance', tabKey: 'cash_vault', tabTitle: 'Cash & Vault Balance', iconName: 'DollarSign', colSpan: 'col-span-1', visible: true },
];

// Role Preset configurations
const ROLE_PRESETS: Record<UserRoleType, { title: string; activeIds: string[] }> = {
  all: {
    title: 'All Metrics (Full View)',
    activeIds: ['members', 'deposits', 'loans', 'revenue', 'collection', 'npl_ratio', 'pending_approvals', 'vault_cash']
  },
  executive: {
    title: 'Executive / Board View',
    activeIds: ['revenue', 'loans', 'deposits', 'members', 'npl_ratio']
  },
  branch_manager: {
    title: 'Branch Manager View',
    activeIds: ['deposits', 'members', 'loans', 'pending_approvals', 'collection']
  },
  loan_officer: {
    title: 'Loan / Credit Officer View',
    activeIds: ['loans', 'npl_ratio', 'pending_approvals', 'members']
  },
  teller: {
    title: 'Teller / Cashier View',
    activeIds: ['collection', 'deposits', 'vault_cash', 'members']
  },
  accountant: {
    title: 'Accountant / Auditor View',
    activeIds: ['revenue', 'vault_cash', 'loans', 'deposits', 'npl_ratio']
  }
};

const KPI_CONFIG_STORAGE_KEY = 'coop_summary_kpi_card_config_v2';

interface SummaryKPIWidgetProps {
  /** Optional override title */
  title?: string;
  /** Optional override to hide header when embedded in tight grids */
  showHeader?: boolean;
  /** Optional callback when clicking a metric card */
  onNavigateTab?: (tabKey: string, tabTitle: string, iconName?: string) => void;
  /** External edit mode override if passed from parent dashboard */
  isParentEditing?: boolean;
}

export const SummaryKPIWidget: React.FC<SummaryKPIWidgetProps> = ({
  title = "Cooperative Executive KPI Overview",
  showHeader = true,
  onNavigateTab,
  isParentEditing = false
}) => {
  const { 
    members = [], 
    savingsAccounts = [], 
    loanAccounts = [], 
    chartOfAccounts = [], 
    vouchers = [],
    approvalRequests = [],
    collectionRoutes = [],
    activeBranch,
    openTab 
  } = useCoop();

  const vaultBalance = activeBranch?.currentVaultCash ?? 0;

  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [selectedRole, setSelectedRole] = useState<UserRoleType>('all');
  const [isCustomizingCards, setIsCustomizingCards] = useState<boolean>(false);

  // Load saved metric card config
  const [metricCards, setMetricCards] = useState<MetricCardConfig[]>(() => {
    try {
      const saved = localStorage.getItem(KPI_CONFIG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Failed to parse saved KPI card config", e);
    }
    return DEFAULT_METRIC_CONFIGS;
  });

  // Drag and drop state within the widget
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

  // Save config changes
  useEffect(() => {
    try {
      localStorage.setItem(KPI_CONFIG_STORAGE_KEY, JSON.stringify(metricCards));
    } catch (e) {
      console.error("Failed to store KPI card config", e);
    }
  }, [metricCards]);

  // Safely calculate real-time metrics
  const safeMembers = members || [];
  const safeSavingsAccounts = savingsAccounts || [];
  const safeLoanAccounts = loanAccounts || [];
  const safeChart = chartOfAccounts || [];
  const safeVouchers = vouchers || [];
  const safeApprovals = approvalRequests || [];
  const safeCollectionRoutes = collectionRoutes || [];

  // Metrics Calculations (all from real context data)
  const totalMembersCount = safeMembers.length;
  const verifiedKycCount = safeMembers.filter(m => m.kycStatus === 'Verified').length;
  const kycRatio = totalMembersCount > 0 ? Math.round((verifiedKycCount / totalMembersCount) * 100) : 0;

  const totalDepositBalance = safeSavingsAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const activeDepositAccountsCount = safeSavingsAccounts.filter(a => a.status === 'Active').length;

  const activeLoansList = safeLoanAccounts.filter(l => l.status === 'Disbursed' || l.status === 'Approved');
  const activeLoansCount = activeLoansList.length;
  const totalLoanPrincipal = activeLoansList.reduce((sum, l) => sum + (l.outstandingPrincipal || 0), 0);
  const passLoanCount = safeLoanAccounts.filter(l => l.nplStatus === 'Pass').length;
  const performingRatio = safeLoanAccounts.length > 0 ? Math.round((passLoanCount / safeLoanAccounts.length) * 100) : 0;

  const overdueLoansList = safeLoanAccounts.filter(l => (l.daysOverdue || 0) > 0 || (l.overdueAmount || 0) > 0);
  const totalOverduePrincipal = overdueLoansList.reduce((sum, l) => sum + (l.overdueAmount || 0), 0);
  const overdueRatio = totalLoanPrincipal > 0 ? Math.round((totalOverduePrincipal / totalLoanPrincipal) * 1000) / 10 : 0;

  const incomeAccounts = safeChart.filter(c => c.type === 'Income');
  const totalIncomeFromCOA = incomeAccounts.reduce((sum, c) => sum + (c.balance || 0), 0);
  const voucherIncomeTotal = safeVouchers.reduce((acc, v) => {
    if (v.status === 'Cancelled') return acc;
    let vIncome = 0;
    v.entries?.forEach(e => {
      const matchIncome = incomeAccounts.some(inc => inc.code === e.accountCode || inc.id === e.accountId);
      if (matchIncome) {
        vIncome += (e.credit || 0) - (e.debit || 0);
      }
    });
    return acc + Math.max(0, vIncome);
  }, 0);

  const rawRevenue = Math.max(totalIncomeFromCOA, voucherIncomeTotal, 0);
  const monthlyRevenue = rawRevenue;

  const pendingApprovalsCount = safeApprovals.filter(a => a.status === 'Pending').length;
  const highPriorityPendingCount = safeApprovals.filter(a => a.status === 'Pending' && (a.requestType === 'Loan_Approval' || a.requestType === 'Expense_Claim')).length;

  // Field collection (from real collection routes)
  const totalCollectedToday = safeCollectionRoutes.reduce((sum, r) => sum + (r.todayCollectedAmount || 0), 0);
  const totalRoutesCount = safeCollectionRoutes.length;
  const reconciledRoutesCount = safeCollectionRoutes.filter(r => r.status === 'Reconciled').length;
  const routesReconciledRatio = totalRoutesCount > 0 ? Math.round((reconciledRoutesCount / totalRoutesCount) * 100) : 0;

  // Vault capacity
  const vaultCapacityRatio = (activeBranch?.vaultLimit || 0) > 0 ? Math.round(((activeBranch?.currentVaultCash || 0) / (activeBranch?.vaultLimit || 0)) * 1000) / 10 : 0;


  const handleCardClick = (tabKey: string, tabTitle: string, iconName: string) => {
    if (isCustomizingCards || isParentEditing) return;
    if (onNavigateTab) {
      onNavigateTab(tabKey, tabTitle, iconName);
    } else if (openTab) {
      openTab(tabKey, tabTitle, iconName);
    }
  };

  // Apply Role Preset Layout
  const applyRolePreset = (role: UserRoleType) => {
    setSelectedRole(role);
    if (role === 'all') {
      setMetricCards(prev => prev.map(c => ({ ...c, visible: true })));
      return;
    }

    const preset = ROLE_PRESETS[role];
    if (!preset) return;

    // Move preset active IDs to top and set visibility
    setMetricCards(prev => {
      const updated = [...prev];
      updated.sort((a, b) => {
        const indexA = preset.activeIds.indexOf(a.id);
        const indexB = preset.activeIds.indexOf(b.id);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return 0;
      });
      return updated.map(c => ({
        ...c,
        visible: preset.activeIds.includes(c.id)
      }));
    });
  };

  // Move Metric Card Position (Left / Right)
  const moveCard = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= metricCards.length) return;

    const updated = [...metricCards];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setMetricCards(updated);
  };

  // Toggle Metric Card Column Span Size (1-col vs 2-cols)
  const toggleCardSpan = (id: string) => {
    setMetricCards(prev => prev.map(c => {
      if (c.id === id) {
        const nextSpan = c.colSpan === 'col-span-1' ? 'col-span-1 sm:col-span-2' : 'col-span-1';
        return { ...c, colSpan: nextSpan };
      }
      return c;
    }));
  };

  // Toggle Metric Card Visibility
  const toggleCardVisibility = (id: string) => {
    setMetricCards(prev => prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
  };

  // Reset to default
  const handleResetMetricCards = () => {
    setMetricCards(DEFAULT_METRIC_CONFIGS);
    setSelectedRole('all');
  };

  // Drag and Drop within metric cards
  const handleCardDragStart = (e: React.DragEvent, id: string) => {
    setDraggedCardId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleCardDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (dragOverCardId !== id) {
      setDragOverCardId(id);
    }
  };

  const handleCardDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedCardId || draggedCardId === targetId) {
      setDraggedCardId(null);
      setDragOverCardId(null);
      return;
    }

    const currentIndex = metricCards.findIndex(c => c.id === draggedCardId);
    const targetIndex = metricCards.findIndex(c => c.id === targetId);

    if (currentIndex !== -1 && targetIndex !== -1) {
      const updated = [...metricCards];
      const [moved] = updated.splice(currentIndex, 1);
      updated.splice(targetIndex, 0, moved);
      setMetricCards(updated);
    }

    setDraggedCardId(null);
    setDragOverCardId(null);
  };

  const handleCardDragEnd = () => {
    setDraggedCardId(null);
    setDragOverCardId(null);
  };

  // Render individual card content
  const renderCardBody = (cardConfig: MetricCardConfig) => {
    switch (cardConfig.id) {
      case 'members':
        return (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 group-hover:text-emerald-800 transition-colors uppercase tracking-wider">
                  Total Members
                </span>
                <div className="p-2 bg-white text-emerald-700 rounded-lg border border-slate-200/80 shadow-2xs group-hover:bg-white group-hover:text-slate-800 group-hover:border-emerald-700 transition-all">
                  <Users className="w-4 h-4" />
                </div>
              </div>

              <div>
                <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                  {totalMembersCount.toLocaleString()}
                </div>

                <div className="flex items-center gap-1.5 mt-1">
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold font-mono">
                    <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                    {kycRatio}% KYC Verified
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">{verifiedKycCount} verified</span>
                </div>
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-200/70 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  KYC Verified
                </span>
                <span className="font-mono font-bold text-slate-800">{kycRatio}%</span>
              </div>
              <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-emerald-600 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${kycRatio}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                <span>{verifiedKycCount} Verified Accounts</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </>
        );

      case 'deposits':
        return (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 group-hover:text-emerald-800 transition-colors uppercase tracking-wider">
                  Total Deposits
                </span>
                <div className="p-2 bg-white text-emerald-800 rounded-lg border border-slate-200/80 shadow-2xs group-hover:bg-white group-hover:text-slate-800 group-hover:border-emerald-700 transition-all">
                  <PiggyBank className="w-4 h-4" />
                </div>
              </div>

              <div>
                <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight truncate">
                  NPR {formatNPR(totalDepositBalance)}
                </div>

                <div className="flex items-center gap-1.5 mt-1">
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold font-mono">
                    <PiggyBank className="w-3 h-3 text-emerald-700" />
                    {activeDepositAccountsCount} Active Accounts
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">deposit portfolio</span>
                </div>
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-200/70 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
                <span>Active Savings Accounts</span>
                <span className="font-mono font-bold text-slate-800">{activeDepositAccountsCount} Accounts</span>
              </div>
              <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                <div className="bg-emerald-600 h-full rounded-full transition-all duration-500" style={{ width: `${activeDepositAccountsCount > 0 ? Math.min(100, Math.round((activeDepositAccountsCount / Math.max(safeSavingsAccounts.length, 1)) * 100)) : 0}%` }} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                <span>Avg/Member: NPR {totalMembersCount > 0 ? formatNPR(Math.round(totalDepositBalance / totalMembersCount)) : formatNPR(0)}</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </>
        );

      case 'loans':
        return (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 group-hover:text-emerald-800 transition-colors uppercase tracking-wider">
                  Active Loans
                </span>
                <div className="p-2 bg-white text-emerald-700 rounded-lg border border-slate-200/80 shadow-2xs group-hover:bg-white group-hover:text-slate-800 group-hover:border-slate-300 transition-all">
                  <Landmark className="w-4 h-4" />
                </div>
              </div>

              <div>
                <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight truncate">
                  NPR {formatNPR(totalLoanPrincipal)}
                </div>

                <div className="flex items-center gap-1.5 mt-1">
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold font-mono">
                    <Landmark className="w-3 h-3 text-emerald-700" />
                    {activeLoansCount} Active Loans
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">outstanding principal</span>
                </div>
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-200/70 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Performing Portfolio
                </span>
                <span className="font-mono font-bold text-slate-800">{performingRatio}%</span>
              </div>
              <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-emerald-600 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${performingRatio}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                <span>{passLoanCount} Pass Grade Loans</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </>
        );

      case 'revenue':
        return (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 group-hover:text-amber-800 transition-colors uppercase tracking-wider">
                  {period === 'month' ? 'Monthly Revenue' : period === 'quarter' ? 'Quarterly Revenue' : 'Annual Revenue'}
                </span>
                <div className="p-2 bg-white text-amber-700 rounded-lg border border-slate-200/80 shadow-2xs group-hover:bg-amber-600 group-hover:text-white group-hover:border-amber-700 transition-all">
                  <Coins className="w-4 h-4" />
                </div>
              </div>

              <div>
                <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight truncate">
                  NPR {formatNPR(monthlyRevenue)}
                </div>

                <div className="flex items-center gap-1.5 mt-1">
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-bold font-mono border border-amber-200/60">
                    <Coins className="w-3 h-3 text-amber-700" />
                    {incomeAccounts.length} Income Accounts
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">COA + vouchers</span>
                </div>
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-200/70 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
                <span>Income from Chart of Accounts</span>
                <span className="font-mono font-bold text-amber-800">NPR {formatNPR(totalIncomeFromCOA)}</span>
              </div>
              <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${incomeAccounts.length > 0 ? Math.min(100, incomeAccounts.length * 8) : 0}%` }} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                <span>Voucher Income: NPR {formatNPR(voucherIncomeTotal)}</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </>
        );

      case 'collection':
        return (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 group-hover:text-emerald-800 transition-colors uppercase tracking-wider">
                  Today's Field Collection
                </span>
                <div className="p-2 bg-white text-emerald-700 rounded-lg border border-slate-200/80 shadow-2xs group-hover:bg-white group-hover:text-slate-800 transition-all">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>

              <div>
                <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight truncate">
                  NPR {formatNPR(totalCollectedToday)}
                </div>

                <div className="flex items-center gap-1.5 mt-1">
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold font-mono">
                    <Wallet className="w-3 h-3 text-emerald-700" />
                    {totalRoutesCount} Routes
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">collected today</span>
                </div>
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-200/70 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
                <span>Agent Route Reconciliation</span>
                <span className="font-mono font-bold text-slate-800">{reconciledRoutesCount} / {totalRoutesCount} Routes</span>
              </div>
              <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                <div className="bg-emerald-600 h-full rounded-full transition-all duration-500" style={{ width: `${routesReconciledRatio}%` }} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                <span>Today's Field Collections</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </>
        );

      case 'npl_ratio':
        return (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 group-hover:text-rose-800 transition-colors uppercase tracking-wider">
                  NPL Portfolio Quality
                </span>
                <div className="p-2 bg-white text-rose-700 rounded-lg border border-slate-200/80 shadow-2xs group-hover:bg-rose-600 group-hover:text-white transition-all">
                  <BadgeAlert className="w-4 h-4" />
                </div>
              </div>

              <div>
                <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight truncate">
                  {overdueRatio}% Overdue
                </div>

                <div className="flex items-center gap-1.5 mt-1">
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold font-mono">
                    <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                    {performingRatio}% Performing
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">of loan portfolio</span>
                </div>
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-200/70 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
                <span>Overdue Principal Risk</span>
                <span className="font-mono font-bold text-rose-800">NPR {formatNPR(totalOverduePrincipal)}</span>
              </div>
              <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, overdueRatio)}%` }} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                <span>{overdueLoansList.length} Overdue Loans</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </>
        );

      case 'pending_approvals':
        return (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 group-hover:text-amber-800 transition-colors uppercase tracking-wider">
                  Pending Approvals
                </span>
                <div className="p-2 bg-white text-amber-700 rounded-lg border border-slate-200/80 shadow-2xs group-hover:bg-amber-600 group-hover:text-white transition-all">
                  <Clock className="w-4 h-4" />
                </div>
              </div>

              <div>
                <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight truncate">
                  {pendingApprovalsCount} Requests
                </div>

                <div className="flex items-center gap-1.5 mt-1">
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-bold font-mono">
                    Maker-Checker
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Awaiting Authorization</span>
                </div>
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-200/70 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
                <span>High Priority Items</span>
                <span className="font-mono font-bold text-amber-800">{highPriorityPendingCount} Items</span>
              </div>
              <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${pendingApprovalsCount > 0 ? Math.min(100, Math.round((highPriorityPendingCount / pendingApprovalsCount) * 100)) : 0}%` }} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                <span>{safeApprovals.length} Total Approval Requests</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </>
        );

      case 'vault_cash':
        return (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 group-hover:text-emerald-800 transition-colors uppercase tracking-wider">
                  Vault Cash Balance
                </span>
                <div className="p-2 bg-white text-emerald-700 rounded-lg border border-slate-200/80 shadow-2xs group-hover:bg-white group-hover:text-slate-800 transition-all">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>

              <div>
                <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight truncate">
                  NPR {formatNPR(vaultBalance)}
                </div>

                <div className="flex items-center gap-1.5 mt-1">
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold font-mono">
                    <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                    {vaultCapacityRatio}% of Limit
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Main Vault No. 01</span>
                </div>
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-200/70 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
                <span>Vault Capacity Ratio</span>
                <span className="font-mono font-bold text-slate-800">{vaultCapacityRatio}%</span>
              </div>
              <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                <div className="bg-emerald-600 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, vaultCapacityRatio)}%` }} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                <span>Vault Limit: NPR {formatNPR(activeBranch?.vaultLimit || 0)}</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  const isEditingActive = isCustomizingCards || isParentEditing;
  const visibleCards = metricCards.filter(c => isEditingActive || c.visible);

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 h-full flex flex-col justify-between transition-all duration-200">
      {/* Widget Header */}
      {showHeader && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-[#006130] rounded-xl border border-emerald-200/60 shadow-2xs">
              <Sparkles className="w-5 h-5 text-[#006130]" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-800 tracking-tight flex items-center gap-2">
                <span>{title}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-bold rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Real-time
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Core membership, savings, credit portfolio, and revenue indicators
              </p>
            </div>
          </div>

          {/* Right Toolbar Controls: Role Presets, Customizer & Period Selector */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Role Preset Selector */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs">
              <Briefcase className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
              <select
                value={selectedRole}
                onChange={(e) => applyRolePreset(e.target.value as UserRoleType)}
                className="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-none cursor-pointer py-0.5 pr-1"
                title="Select Role View Preset"
              >
                <option value="all">Role Preset: All Metrics</option>
                <option value="executive">Role Preset: Executive / BOD</option>
                <option value="branch_manager">Role Preset: Branch Manager</option>
                <option value="loan_officer">Role Preset: Loan Officer</option>
                <option value="teller">Role Preset: Teller / Cashier</option>
                <option value="accountant">Role Preset: Accountant</option>
              </select>
            </div>

            {/* Metric Customization Button */}
            <button
              type="button"
              onClick={() => setIsCustomizingCards(prev => !prev)}
              className={`px-3 py-1 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${ isCustomizingCards ? 'bg-slate-50 text-slate-800 border-slate-200 shadow-2xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50' }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{isCustomizingCards ? 'Done Customizing' : 'Customize Cards'}</span>
            </button>

            {/* Time Period Filter Pills */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPeriod('month')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${ period === 'month' ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900' }`}
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => setPeriod('quarter')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${ period === 'quarter' ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900' }`}
              >
                Quarter
              </button>
              <button
                type="button"
                onClick={() => setPeriod('year')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${ period === 'year' ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900' }`}
              >
                Year
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Editing Info Banner */}
      {isEditingActive && (
        <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-2.5 px-3.5 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              <strong>KPI Card Customizer:</strong> Drag or use arrows to reorder. Toggle <Eye className="w-3.5 h-3.5 inline mx-0.5 text-emerald-700" /> to hide/show metrics, or expand <Maximize2 className="w-3.5 h-3.5 inline mx-0.5 text-emerald-700" /> card size.
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetMetricCards}
            className="text-emerald-800 hover:underline font-bold text-[11px] self-end sm:self-auto flex items-center gap-1 cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3 h-3" /> Reset Cards
          </button>
        </div>
      )}

      {/* KPI Cards Grid - Customizable & Reorderable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {visibleCards.map((cardConfig, index) => {
          const isBeingDragged = draggedCardId === cardConfig.id;
          const isDragOver = dragOverCardId === cardConfig.id;

          return (
            <div
              key={cardConfig.id}
              draggable={isEditingActive}
              onDragStart={(e) => handleCardDragStart(e, cardConfig.id)}
              onDragOver={(e) => handleCardDragOver(e, cardConfig.id)}
              onDrop={(e) => handleCardDrop(e, cardConfig.id)}
              onDragEnd={handleCardDragEnd}
              onClick={() => handleCardClick(cardConfig.tabKey, cardConfig.tabTitle, cardConfig.iconName)}
              className={`${cardConfig.colSpan} p-4 bg-white rounded-xl border border-slate-200 transition-all duration-200 cursor-pointer group flex flex-col justify-between shadow-sm hover:shadow-md hover:border-emerald-300 relative overflow-hidden ${ !cardConfig.visible ? 'opacity-40 bg-slate-100 border-dashed border-slate-300' : '' } ${ isBeingDragged ? 'opacity-30 scale-95' : '' } ${ isDragOver ? 'ring-2 ring-emerald-500 ring-offset-2 scale-[1.01]' : '' }`}
            >
              {/* Card Customization Toolbar Overlay when Editing */}
              {isEditingActive && (
                <div 
                  onClick={(e) => e.stopPropagation()} 
                  className="mb-2 p-1 px-2 bg-white/90 backdrop-blur-xs border border-slate-200 rounded-lg flex items-center justify-between text-xs text-slate-600 shadow-2xs"
                >
                  <div className="flex items-center gap-1 font-mono font-bold text-[11px]">
                    <GripVertical className="w-3.5 h-3.5 text-slate-500 cursor-grab active:cursor-grabbing" />
                    <span>#{index + 1}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Left Move */}
                    <button
                      type="button"
                      onClick={() => moveCard(index, 'left')}
                      disabled={index === 0}
                      className="p-1 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
                      title="Move Left"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    {/* Right Move */}
                    <button
                      type="button"
                      onClick={() => moveCard(index, 'right')}
                      disabled={index === visibleCards.length - 1}
                      className="p-1 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
                      title="Move Right"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    {/* Toggle Width Span */}
                    <button
                      type="button"
                      onClick={() => toggleCardSpan(cardConfig.id)}
                      className="p-1 hover:bg-slate-100 rounded cursor-pointer text-emerald-700"
                      title={cardConfig.colSpan === 'col-span-1' ? 'Expand to 2 Columns' : 'Shrink to 1 Column'}
                    >
                      {cardConfig.colSpan === 'col-span-1' ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                    </button>

                    {/* Hide / Show */}
                    <button
                      type="button"
                      onClick={() => toggleCardVisibility(cardConfig.id)}
                      className={`p-1 hover:bg-slate-100 rounded cursor-pointer ${cardConfig.visible ? 'text-slate-600' : 'text-rose-600'}`}
                      title={cardConfig.visible ? 'Hide Metric' : 'Show Metric'}
                    >
                      {cardConfig.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Render Metric Content */}
              {renderCardBody(cardConfig)}
            </div>
          );
        })}
      </div>
    </div>
  );
};
