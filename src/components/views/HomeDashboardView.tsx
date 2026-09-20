import React, { useState, useEffect, useMemo } from 'react';
import { useCoop } from '../../context/CoopContext';
import { useLocalization } from '../../context/LocalizationContext';
import { 
  Building2, 
  Wallet, 
  PiggyBank, 
  Landmark, 
  PieChart as PieIcon, 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Plus, 
  FileText, 
  Truck, 
  ShieldCheck,
  Sparkles,
  LayoutGrid,
  GripVertical,
  X,
  RotateCcw,
  Edit2,
  Check,
  Inbox,
  ChevronUp,
  ChevronDown,
  Briefcase
} from 'lucide-react';
import { getTodayBS, NEPALI_MONTHS } from '../../utils/nepaliCalendar';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { SummaryKPIWidget } from '../dashboard/SummaryKPIWidget';

// Widget Metadata Catalog
export interface WidgetDef {
  id: string;
  title: string;
  category: 'KPI' | 'Chart' | 'Feed' | 'Table';
  colSpanClass: string; // e.g. "col-span-1", "col-span-1 lg:col-span-2"
}

const WIDGET_CATALOG: WidgetDef[] = [
  { id: 'summary_kpi_metrics', title: "Summary KPI Widget (Real-time Members, Deposits, Loans & Revenue)", category: 'KPI', colSpanClass: 'col-span-1 lg:col-span-4' },
  { id: 'quick_report_summary', title: "Quick Report (Members, Deposits, Loans & Cash)", category: 'KPI', colSpanClass: 'col-span-1 lg:col-span-4' },
  { id: 'kpi_today_collection', title: "Today's Collection KPI", category: 'KPI', colSpanClass: 'col-span-1' },
  { id: 'kpi_disbursements', title: "Total Disbursements KPI", category: 'KPI', colSpanClass: 'col-span-1' },
  { id: 'kpi_active_members', title: "Active Members KPI", category: 'KPI', colSpanClass: 'col-span-1' },
  { id: 'kpi_overdue_loans', title: "Overdue Loans KPI", category: 'KPI', colSpanClass: 'col-span-1' },
  { id: 'kpi_total_deposits', title: "Total Deposit Balance KPI", category: 'KPI', colSpanClass: 'col-span-1' },
  { id: 'kpi_total_loans', title: "Total Loan Balance KPI", category: 'KPI', colSpanClass: 'col-span-1' },
  { id: 'kpi_pending_approvals', title: "Pending Approvals Queue KPI", category: 'KPI', colSpanClass: 'col-span-1' },
  { id: 'recent_transactions', title: "Recent Transactions (5 Operations)", category: 'Table', colSpanClass: 'col-span-1 lg:col-span-2' },
  { id: 'chart_collection_disbursement', title: "Monthly Collection vs Disbursement Chart", category: 'Chart', colSpanClass: 'col-span-1 lg:col-span-2' },
  { id: 'chart_npl_breakdown', title: "Loan Portfolio Quality & NPL Pie Chart", category: 'Chart', colSpanClass: 'col-span-1 lg:col-span-2' },
  { id: 'feed_recent_activity', title: "Recent Activity Timeline", category: 'Feed', colSpanClass: 'col-span-1' },
  { id: 'routes_field_collection', title: "Daily Field Collection Routes", category: 'Table', colSpanClass: 'col-span-1 lg:col-span-2' },
  { id: 'vouchers_recent_ledger', title: "Recent Ledger Vouchers", category: 'Table', colSpanClass: 'col-span-1 lg:col-span-2' },
  { id: 'quick_approvals_inbox', title: "Quick Approvals Queue", category: 'Feed', colSpanClass: 'col-span-1 lg:col-span-2' },
];

const DEFAULT_WIDGET_IDS = [
  'summary_kpi_metrics',
  'quick_report_summary',
  'kpi_today_collection',
  'kpi_disbursements',
  'kpi_active_members',
  'kpi_overdue_loans',
  'recent_transactions',
  'chart_collection_disbursement',
  'feed_recent_activity',
  'routes_field_collection',
  'vouchers_recent_ledger',
  'chart_npl_breakdown'
];

const LOCAL_STORAGE_KEY = 'coop_dashboard_custom_widgets_v2';
const LOCAL_STORAGE_SPANS_KEY = 'coop_dashboard_widget_spans_v2';

export const HomeDashboardView: React.FC = () => {
  const { formatCurrency } = useLocalization();
  const { 
    members = [], 
    savingsAccounts = [], 
    loanAccounts = [], 
    vouchers = [], 
    collectionRoutes = [], 
    approvalRequests = [], 
    activeBranch, 
    activeFiscalYearCode,
    setIsFiscalYearModalOpen,
    openTab, 
    setSelectedMemberForDetail, 
    setSelectedVoucherForDetail,
    processDeposit,
    processApprovalDecision
  } = useCoop();

  const safeMembers = members || [];
  const safeSavingsAccounts = savingsAccounts || [];
  const safeLoanAccounts = loanAccounts || [];
  const safeVouchers = vouchers || [];
  const safeCollectionRoutes = collectionRoutes || [];
  const safeApprovalRequests = approvalRequests || [];

  // Widget Edit & Customization State
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [activeWidgetIds, setActiveWidgetIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Error reading saved widgets", e);
    }
    return DEFAULT_WIDGET_IDS;
  });

  const [widgetSpans, setWidgetSpans] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_SPANS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
      }
    } catch (e) {
      console.error("Error reading saved widget spans", e);
    }
    return {};
  });

  const [selectedWidgetToAdd, setSelectedWidgetToAdd] = useState<string>('');
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState<string | null>(null);

  // Save changes to local storage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(activeWidgetIds));
    } catch (e) {
      console.error("Error saving widgets to local storage", e);
    }
  }, [activeWidgetIds]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_SPANS_KEY, JSON.stringify(widgetSpans));
    } catch (e) {
      console.error("Error saving widget spans to local storage", e);
    }
  }, [widgetSpans]);

  // Metrics Calculations (all from real context data)
  const totalDepositBalance = safeSavingsAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalLoanBalance = safeLoanAccounts.reduce((sum, l) => sum + (l.outstandingPrincipal || 0), 0);
  const totalMembers = safeMembers.length;
  const verifiedKycMembers = safeMembers.filter(m => m.kycStatus === 'Verified').length;
  const pendingApprovalsCount = safeApprovalRequests.filter(a => a.status === 'Pending').length;

  const nplPassLoans = safeLoanAccounts.filter(l => l.nplStatus === 'Pass').length;
  const nplWatchlistLoans = safeLoanAccounts.filter(l => l.nplStatus === 'Watchlist').length;
  const nplSubstandardLoans = safeLoanAccounts.filter(l => l.nplStatus === 'Substandard' || l.nplStatus === 'Doubtful' || l.nplStatus === 'Loss').length;
  const totalLoansCount = safeLoanAccounts.length;

  const nplData = [
    { name: 'Pass (0-30d)', value: nplPassLoans, color: '#10b981' },
    { name: 'Watchlist (31-90d)', value: nplWatchlistLoans, color: '#f59e0b' },
    { name: 'Substandard (>90d)', value: nplSubstandardLoans, color: '#f43f5e' },
  ];

  // Today's field collection (real routes)
  const todayCollectedAmount = safeCollectionRoutes.reduce((sum, r) => sum + (r.todayCollectedAmount || 0), 0);

  // Total disbursements (real loan disbursements)
  const totalDisbursedAmount = safeLoanAccounts
    .filter(l => l.status === 'Disbursed')
    .reduce((sum, l) => sum + (l.approvedAmount || l.appliedAmount || 0), 0);

  // Overdue loans (real)
  const overdueLoansList = safeLoanAccounts.filter(l => (l.daysOverdue || 0) > 0 || (l.overdueAmount || 0) > 0);
  const totalOverdueAmount = overdueLoansList.reduce((sum, l) => sum + (l.overdueAmount || 0), 0);

  // Monthly collection vs disbursement built from real posted vouchers
  const financialTrendData = useMemo(() => {
    const todayBS = getTodayBS(); // "YYYY-MM-DD"
    const currentYear = parseInt(todayBS.slice(0, 4), 10);
    const currentMonth = parseInt(todayBS.slice(5, 7), 10);
    if (isNaN(currentYear) || isNaN(currentMonth)) return [];

    const monthKeys: { key: string; label: string }[] = [];
    let y = currentYear;
    let m = currentMonth;
    for (let i = 0; i < 6; i++) {
      monthKeys.unshift({ key: `${y}-${String(m).padStart(2, '0')}`, label: NEPALI_MONTHS[m - 1] || String(m) });
      m -= 1;
      if (m < 1) { m = 12; y -= 1; }
    }

    return monthKeys.map(({ key, label }) => {
      let deposit = 0;
      let loan = 0;
      safeVouchers.forEach(v => {
        if (v.status === 'Cancelled' || !v.dateBS) return;
        if (!v.dateBS.startsWith(key)) return;
        const amount = v.totalAmount || 0;
        if (v.voucherType === 'Receipt') deposit += amount;
        else if (v.voucherType === 'Payment') loan += amount;
      });
      return { month: label, deposit, loan };
    });
  }, [safeVouchers]);

  // Real recent activity feed (latest vouchers, members & loan disbursements)
  const recentActivityItems = useMemo(() => {
    type ActivityItem = { id: string; icon: 'voucher' | 'member' | 'loan'; title: string; subtitle: string; dateBS: string; dateLabel: string };

    const items: ActivityItem[] = [];

    safeVouchers.filter(v => v.status !== 'Cancelled').slice(0, 3).forEach(v => {
      items.push({
        id: `voucher-${v.id}`,
        icon: 'voucher',
        title: `${v.voucherType} voucher ${v.voucherNo} posted`,
        subtitle: `NPR ${(v.totalAmount || 0).toLocaleString()}`,
        dateBS: v.dateBS || '',
        dateLabel: `${v.dateBS || ''} BS`,
      });
    });

    safeMembers.slice(0, 3).forEach(m => {
      items.push({
        id: `member-${m.id}`,
        icon: 'member',
        title: `New member registered: ${m.fullName}`,
        subtitle: `Member No: ${m.memberNo}`,
        dateBS: m.membershipDateBS || '',
        dateLabel: `${m.membershipDateBS || ''} BS`,
      });
    });

    safeLoanAccounts.filter(l => l.status === 'Disbursed').slice(0, 3).forEach(l => {
      items.push({
        id: `loan-${l.id}`,
        icon: 'loan',
        title: `Loan disbursed for ${l.memberName}`,
        subtitle: `NPR ${(l.approvedAmount || l.appliedAmount || 0).toLocaleString()} • ${l.productName}`,
        dateBS: l.disbursedDateBS || '',
        dateLabel: `${l.disbursedDateBS || ''} BS`,
      });
    });

    items.sort((a, b) => b.dateBS.localeCompare(a.dateBS));
    return items.slice(0, 6);
  }, [safeVouchers, safeMembers, safeLoanAccounts]);

  // Available widgets that are not yet added
  const availableWidgetsToAdd = WIDGET_CATALOG.filter(w => !activeWidgetIds.includes(w.id));

  // Add Widget
  const handleAddWidget = () => {
    if (!selectedWidgetToAdd) return;
    setActiveWidgetIds(prev => [...prev, selectedWidgetToAdd]);
    setSelectedWidgetToAdd('');
  };

  // Remove Widget
  const handleRemoveWidget = (widgetId: string) => {
    setActiveWidgetIds(prev => prev.filter(id => id !== widgetId));
  };

  // Reset to default
  const handleResetWidgets = () => {
    setActiveWidgetIds(DEFAULT_WIDGET_IDS);
    setWidgetSpans({});
    setSelectedWidgetToAdd('');
  };

  // Get current widget span class
  const getWidgetSpanClass = (widgetId: string) => {
    if (widgetSpans[widgetId]) return widgetSpans[widgetId];
    const widgetDef = WIDGET_CATALOG.find(w => w.id === widgetId);
    return widgetDef ? widgetDef.colSpanClass : 'col-span-1';
  };

  // Update widget column span (resize)
  const updateWidgetSpan = (widgetId: string, spanClass: string) => {
    setWidgetSpans(prev => ({
      ...prev,
      [widgetId]: spanClass
    }));
  };

  // Move Widget Position Up/Down
  const moveWidget = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeWidgetIds.length) return;

    const updated = [...activeWidgetIds];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setActiveWidgetIds(updated);
  };

  // Role Preset Dashboard Layouts
  const applyDashboardRolePreset = (rolePreset: string) => {
    switch (rolePreset) {
      case 'executive':
        setActiveWidgetIds(['summary_kpi_metrics', 'quick_report_summary', 'chart_collection_disbursement', 'chart_npl_breakdown', 'vouchers_recent_ledger']);
        break;
      case 'branch_manager':
        setActiveWidgetIds(['summary_kpi_metrics', 'kpi_pending_approvals', 'kpi_today_collection', 'recent_transactions', 'routes_field_collection', 'quick_approvals_inbox']);
        break;
      case 'loan_officer':
        setActiveWidgetIds(['summary_kpi_metrics', 'kpi_overdue_loans', 'kpi_total_loans', 'chart_npl_breakdown', 'recent_transactions', 'quick_approvals_inbox']);
        break;
      case 'teller':
        setActiveWidgetIds(['kpi_today_collection', 'summary_kpi_metrics', 'routes_field_collection', 'recent_transactions', 'kpi_total_deposits']);
        break;
      case 'accountant':
        setActiveWidgetIds(['summary_kpi_metrics', 'vouchers_recent_ledger', 'chart_collection_disbursement', 'quick_report_summary', 'kpi_disbursements']);
        break;
      default:
        setActiveWidgetIds(DEFAULT_WIDGET_IDS);
        break;
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedWidgetId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverWidgetId !== id) {
      setDragOverWidgetId(id);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedWidgetId || draggedWidgetId === targetId) {
      setDraggedWidgetId(null);
      setDragOverWidgetId(null);
      return;
    }

    const currentIndex = activeWidgetIds.indexOf(draggedWidgetId);
    const targetIndex = activeWidgetIds.indexOf(targetId);

    if (currentIndex !== -1 && targetIndex !== -1) {
      const updated = [...activeWidgetIds];
      const [movedItem] = updated.splice(currentIndex, 1);
      updated.splice(targetIndex, 0, movedItem);
      setActiveWidgetIds(updated);
    }

    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
  };

  const handleDragEnd = () => {
    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
  };

  // Render individual widget content based on widget ID
  const renderWidgetContent = (widgetId: string) => {
    switch (widgetId) {
      case 'summary_kpi_metrics':
        return (
          <SummaryKPIWidget 
            title="Cooperative Summary Metrics" 
            showHeader={true} 
            onNavigateTab={(tabKey, tabTitle, iconName) => openTab(tabKey, tabTitle, iconName)} 
            isParentEditing={isEditing}
          />
        );

      case 'quick_report_summary':
        return (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 h-full">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                  <PieIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-slate-800">Quick Report Dashboard</h2>
                  <p className="text-xs text-slate-500">Key financial and operational metrics at a glance</p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>Live Branch Summary</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Member Count Summary Card */}
              <div 
                onClick={() => openTab('members', 'Member Registry', 'Users')}
                className="p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 transition-all duration-200 cursor-pointer group flex flex-col justify-between shadow-sm hover:shadow-md"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-600 group-hover:text-emerald-800">Total Members</span>
                  <div className="p-2 bg-white text-emerald-700 rounded-lg shadow-2xs group-hover:bg-emerald-700 group-hover:text-white transition">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold font-mono text-slate-800 tracking-tight">
                    {totalMembers.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium mt-1 flex items-center justify-between">
                    <span>{verifiedKycMembers} Verified KYC</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>

              {/* Total Deposits Summary Card */}
              <div 
                onClick={() => openTab('savings_accounts', 'Savings Accounts', 'PiggyBank')}
                className="p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 transition-all duration-200 cursor-pointer group flex flex-col justify-between shadow-sm hover:shadow-md"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-600 group-hover:text-emerald-800">Total Deposits</span>
                  <div className="p-2 bg-white text-emerald-800 rounded-lg shadow-2xs group-hover:bg-emerald-800 group-hover:text-white transition">
                    <PiggyBank className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold font-mono text-slate-800 tracking-tight">
                    {formatCurrency(totalDepositBalance)}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium mt-1 flex items-center justify-between">
                    <span>{safeSavingsAccounts.length} Active Accounts</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>

              {/* Total Loans Summary Card */}
              <div 
                onClick={() => openTab('loans', 'Loan Accounts', 'Landmark')}
                className="p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 transition-all duration-200 cursor-pointer group flex flex-col justify-between shadow-sm hover:shadow-md"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-600 group-hover:text-emerald-800">Total Loans</span>
                  <div className="p-2 bg-white text-emerald-700 rounded-lg shadow-2xs group-hover:bg-emerald-700 group-hover:text-white transition">
                    <Landmark className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold font-mono text-slate-800 tracking-tight">
                    {formatCurrency(totalLoanBalance)}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium mt-1 flex items-center justify-between">
                    <span>{safeLoanAccounts.length} Active Loans</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>

              {/* Cash-In-Hand Summary Card */}
              <div 
                onClick={() => openTab('cash_vault', 'Cash & Vault Mgmt', 'Wallet')}
                className="p-4 bg-white rounded-xl border border-slate-200 hover:border-amber-300 transition-all duration-200 cursor-pointer group flex flex-col justify-between shadow-sm hover:shadow-md"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-600 group-hover:text-amber-800">Cash-in-Hand</span>
                  <div className="p-2 bg-white text-amber-700 rounded-lg shadow-2xs group-hover:bg-amber-700 group-hover:text-white transition">
                    <Wallet className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold font-mono text-slate-800 tracking-tight">
                    {formatCurrency(activeBranch?.currentVaultCash || 0)}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium mt-1 flex items-center justify-between">
                    <span>Vault Limit: {formatCurrency(activeBranch?.vaultLimit || 0)}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'kpi_today_collection':
        return (
          <div 
            onClick={() => openTab('collection', 'Collection Management', 'Wallet')}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all duration-200 cursor-pointer relative overflow-hidden h-full flex flex-col justify-between group"
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider group-hover:text-emerald-800 transition-colors">Today's Collection</h3>
              <div className="p-2 rounded-lg bg-white text-[#006130] group-hover:bg-white group-hover:text-slate-800 transition-colors">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800 tracking-tight font-mono">
                {formatCurrency(todayCollectedAmount)}
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1 text-[#006130] font-semibold text-xs">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>{safeCollectionRoutes.length} Field Routes</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
        );

      case 'kpi_disbursements':
        return (
          <div 
            onClick={() => openTab('loans', 'Loan Accounts', 'Landmark')}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer relative overflow-hidden h-full flex flex-col justify-between group"
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider group-hover:text-blue-800 transition-colors">Total Disbursements</h3>
              <div className="p-2 rounded-lg bg-white text-[#115cb9] group-hover:bg-white group-hover:text-slate-800 transition-colors">
                <Landmark className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800 tracking-tight font-mono">
                {formatCurrency(totalDisbursedAmount)}
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1 text-slate-500 font-semibold text-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#115cb9]" />
                  <span>FY {activeFiscalYearCode || '—'} Portfolio</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
        );

      case 'kpi_active_members':
        return (
          <div 
            onClick={() => openTab('members', 'Member Registry', 'Users')}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer relative overflow-hidden h-full flex flex-col justify-between group"
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider group-hover:text-emerald-800 transition-colors">Active Members</h3>
              <div className="p-2 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-emerald-700 group-hover:text-white transition-colors">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800 tracking-tight font-mono">
                {totalMembers.toLocaleString()}
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1 text-[#006130] font-semibold text-xs">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>{verifiedKycMembers} KYC Verified</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
        );

      case 'kpi_overdue_loans':
        return (
          <div 
            onClick={() => openTab('collection', 'Collection Management', 'AlertCircle')}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-rose-300 transition-all duration-200 cursor-pointer relative overflow-hidden h-full flex flex-col justify-between group"
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider group-hover:text-rose-800 transition-colors">Overdue Loans</h3>
              <div className="p-2 rounded-lg bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800 tracking-tight font-mono">
                {formatCurrency(totalOverdueAmount)}
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1 text-rose-600 font-semibold text-xs">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{overdueLoansList.length} Loans overdue</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
        );

      case 'kpi_total_deposits':
        return (
          <div 
            onClick={() => openTab('savings_accounts', 'Savings Accounts', 'PiggyBank')}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all duration-200 cursor-pointer relative overflow-hidden h-full flex flex-col justify-between group"
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider group-hover:text-emerald-800 transition-colors">Deposit Portfolio</h3>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-emerald-700 group-hover:text-white transition-colors">
                <PiggyBank className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800 tracking-tight font-mono">
                {formatCurrency(totalDepositBalance)}
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1 text-emerald-700 font-semibold text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{safeSavingsAccounts.length} Active Accounts</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
        );

      case 'kpi_total_loans':
        return (
          <div 
            onClick={() => openTab('loans', 'Loan Accounts', 'Landmark')}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer relative overflow-hidden h-full flex flex-col justify-between group"
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider group-hover:text-emerald-800 transition-colors">Total Loan Portfolio</h3>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800 group-hover:bg-emerald-800 group-hover:text-white transition-colors">
                <Landmark className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800 tracking-tight font-mono">
                {formatCurrency(totalLoanBalance)}
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1 text-emerald-800 font-semibold text-xs">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{safeLoanAccounts.length} Outstanding Loans</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
        );

      case 'kpi_pending_approvals':
        return (
          <div 
            onClick={() => openTab('workflow_approvals', 'Workflow Approvals', 'Inbox')}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-amber-300 transition-all duration-200 cursor-pointer relative overflow-hidden h-full flex flex-col justify-between group"
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider group-hover:text-amber-800 transition-colors">Pending Approvals</h3>
              <div className="p-2 rounded-lg bg-amber-50 text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <Inbox className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800 tracking-tight font-mono">
                {pendingApprovalsCount} Requests
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1 text-amber-700 font-semibold text-xs">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Awaiting Checker Review</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
        );

      case 'chart_collection_disbursement':
        return (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base text-slate-800">Monthly Collection vs Disbursement</h2>
                <p className="text-xs text-slate-500 font-medium">Trailing 6 months (NPR Millions)</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono font-semibold">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <span className="w-3 h-3 rounded-full bg-white" /> Collection
                </span>
                <span className="flex items-center gap-1.5 text-slate-700">
                  <span className="w-3 h-3 rounded-full bg-white" /> Disbursement
                </span>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financialTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={10} tickFormatter={(v) => `NPR ${(v/100000).toFixed(0)}L`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} 
                    formatter={(value: any) => [`NPR ${Number(value).toLocaleString()}`, '']}
                  />
                  <Bar dataKey="deposit" name="Collection" fill="#006130" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="loan" name="Disbursement" fill="#115cb9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'chart_npl_breakdown':
        return (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base text-slate-800">Loan Portfolio NPL Classification</h2>
                <p className="text-xs text-slate-500 font-medium">Risk profile according to Nepal Rastra Bank guidelines</p>
              </div>
              <div className="p-2 rounded-lg bg-teal-50 text-teal-600">
                <PieIcon className="w-5 h-5" />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="h-48 w-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie data={nplData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                      {nplData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3 text-xs w-full">
                {nplData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-semibold text-slate-800">{item.name}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-800">{item.value} Accounts</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'feed_recent_activity':
        return (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base text-slate-800">Recent Activity</h2>
              <button 
                onClick={() => openTab('workflow_inbox', 'Approvals Queue', 'Inbox')}
                className="text-xs text-[#006130] hover:underline font-mono font-semibold cursor-pointer"
              >
                View All
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {recentActivityItems.map(item => (
                <div key={item.id} className="flex gap-3 relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${ item.icon === 'loan' ? 'bg-white text-[#115cb9]' : item.icon === 'member' ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-[#006130]' }`}>
                    {item.icon === 'loan' ? <Landmark className="w-4 h-4" /> :
                     item.icon === 'member' ? <Users className="w-4 h-4" /> :
                     <FileText className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{item.title}</p>
                    <p className="text-slate-500 text-[11px] mt-0.5 font-medium">{item.subtitle}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-1">{item.dateLabel}</p>
                  </div>
                </div>
              ))}

              {recentActivityItems.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-500 font-medium">
                  No activity recorded yet. Start by registering members or posting vouchers.
                </div>
              )}
            </div>
          </div>
        );

      case 'routes_field_collection':
        return (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-teal-600" />
                <div>
                  <h2 className="font-bold text-base text-slate-800">Daily Field Collection Routes</h2>
                  <p className="text-xs text-slate-500">Door-to-door agent collections & vault reconciliation</p>
                </div>
              </div>
              <button
                onClick={() => openTab('collection_sheet', 'Field Collection Sheet', 'Truck')}
                className="text-xs text-[#006130] hover:underline font-bold cursor-pointer"
              >
                View Routes →
              </button>
            </div>

            <div className="space-y-2.5">
              {safeCollectionRoutes.map(r => (
                <div key={r.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{r.routeName}</div>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      Agent: <span className="text-teal-700 font-semibold">{r.agentName}</span> • {r.assignedMembersCount} merchants assigned
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-slate-500 text-[10px] font-medium">Collected / Target</div>
                    <div className="font-mono font-bold text-[#006130] text-sm">
                      रु. {r.todayCollectedAmount.toLocaleString()} / {r.todayTargetAmount.toLocaleString()}
                    </div>
                    <span className={`inline-block mt-1 text-[10px] px-2 py-0.2 rounded-full font-bold ${ r.status === 'Reconciled' ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-amber-100 text-amber-700 border border-amber-300' }`}>
                      {r.status}
                    </span>
                  </div>
                </div>
              ))}

              {safeCollectionRoutes.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-500 font-medium">
                  No field collection routes assigned yet.
                </div>
              )}
            </div>
          </div>
        );

      case 'vouchers_recent_ledger':
        return (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#006130]" />
                <div>
                  <h2 className="font-bold text-base text-slate-800">Recent Ledger Vouchers</h2>
                  <p className="text-xs text-slate-500">Double-entry auto-posted accounting vouchers</p>
                </div>
              </div>
              <button
                onClick={() => openTab('accounts_vouchers', 'Voucher Ledger', 'BookOpen')}
                className="text-xs text-[#006130] hover:underline font-bold cursor-pointer"
              >
                All Vouchers →
              </button>
            </div>

            <div className="space-y-2">
              {safeVouchers.slice(0, 3).map(v => (
                <div 
                  key={v.id} 
                  onClick={() => setSelectedVoucherForDetail(v)}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 hover:border-slate-300 transition cursor-pointer flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-mono font-bold text-[#006130] flex items-center gap-2">
                      <span>{v.voucherNo}</span>
                      <span className="text-[10px] bg-slate-200 text-slate-700 font-sans px-1.5 py-0.2 rounded font-bold">{v.voucherType}</span>
                    </div>
                    <div className="text-slate-700 mt-1 truncate max-w-xs font-medium">{v.narration}</div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-bold text-slate-800 text-sm">NPR {v.totalAmount.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-500 font-medium">{v.dateBS} BS</div>
                  </div>
                </div>
              ))}

              {safeVouchers.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-500 font-medium">
                  No vouchers posted yet.
                </div>
              )}
            </div>
          </div>
        );

      case 'recent_transactions':
        return (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
                  <Wallet className="w-5 h-5 text-[#006130]" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-slate-800">Recent Transactions</h2>
                  <p className="text-xs text-slate-500">Last 5 financial operations with quick voucher inspection</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openTab('accounts_vouchers', 'Voucher Ledger', 'BookOpen')}
                className="text-xs text-[#006130] hover:underline font-bold cursor-pointer flex items-center gap-1"
              >
                <span>Full Ledger</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {safeVouchers.slice(0, 5).map(v => {
                const isReceipt = v.voucherType === 'Receipt' || (v.voucherNo || '').startsWith('CR') || (v.voucherNo || '').startsWith('RV');
                const isPayment = v.voucherType === 'Payment' || (v.voucherNo || '').startsWith('CP') || (v.voucherNo || '').startsWith('PV');
                return (
                  <div 
                    key={v.id} 
                    onClick={() => setSelectedVoucherForDetail(v)}
                    className="p-3 bg-slate-50 hover:bg-emerald-50/60 rounded-xl border border-slate-200 hover:border-emerald-300 transition cursor-pointer flex items-center justify-between text-xs group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-lg shrink-0 ${ isReceipt ? 'bg-emerald-100 text-emerald-800' : isPayment ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-800' }`}>
                        {isReceipt ? <ArrowDownLeft className="w-4 h-4" /> :
                         isPayment ? <ArrowUpRight className="w-4 h-4" /> :
                         <FileText className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#006130] group-hover:underline">{v.voucherNo}</span>
                          <span className={`text-[10px] font-sans px-1.5 py-0.2 rounded font-bold ${ isReceipt ? 'bg-emerald-100 text-emerald-800' : isPayment ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700' }`}>
                            {v.voucherType}
                          </span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.2 rounded font-mono font-medium">
                            {v.status || 'Posted'}
                          </span>
                        </div>
                        <div className="text-slate-700 mt-0.5 truncate font-medium max-w-sm">{v.narration}</div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2">
                      <div className="font-mono font-bold text-slate-800 text-sm">NPR {v.totalAmount.toLocaleString()}</div>
                      <div className="text-[10px] text-slate-500 font-medium flex items-center justify-end gap-1">
                        <span>{v.dateBS} BS</span>
                        <span className="text-emerald-700 font-bold group-hover:translate-x-0.5 transition-transform">→ Voucher</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {safeVouchers.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-500 font-medium">
                  No recent financial transactions logged yet.
                </div>
              )}
            </div>
          </div>
        );

      case 'quick_approvals_inbox':
        return (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Inbox className="w-5 h-5 text-emerald-600" />
                <div>
                  <h2 className="font-bold text-base text-slate-800">Quick Approvals Queue</h2>
                  <p className="text-xs text-slate-500">Multi-tier maker-checker authorization requests</p>
                </div>
              </div>
              <button
                onClick={() => openTab('workflow_inbox', 'Approvals Queue', 'Inbox')}
                className="text-xs text-emerald-600 hover:underline font-bold cursor-pointer"
              >
                Go to Inbox ({safeApprovalRequests.filter(a => a.status === 'Pending').length}) →
              </button>
            </div>

            <div className="space-y-2">
              {safeApprovalRequests.filter(a => a.status === 'Pending').slice(0, 3).map(req => (
                <div key={req.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-800">{req.description || req.referenceNo}</div>
                    <div className="text-slate-500 text-[11px]">Requested by: <span className="font-semibold text-slate-700">{req.requestedBy}</span> ({req.requestedDateBS})</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => processApprovalDecision(req.id, 'Approved')}
                      className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold hover:bg-emerald-700 cursor-pointer"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => processApprovalDecision(req.id, 'Rejected')}
                      className="px-2.5 py-1 bg-rose-600 text-white rounded text-[11px] font-bold hover:bg-rose-700 cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
              {safeApprovalRequests.filter(a => a.status === 'Pending').length === 0 && (
                <div className="text-center py-6 text-xs text-slate-500 font-medium">
                  No pending authorization requests!
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800">
      
      {/* Edit Banner - matching image precisely */}
      {isEditing && (
        <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3.5 px-4 text-xs md:text-sm text-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-2.5 shadow-2xs transition-all">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-xs">
              ℹ
            </div>
            <div className="font-medium text-slate-700">
              You're in <strong className="font-bold text-slate-900">Dashboard Layout Editor Mode</strong>. Drag <GripVertical className="w-3.5 h-3.5 inline text-slate-500" /> to reorder, use <ChevronUp className="w-3.5 h-3.5 inline text-slate-500" />/<ChevronDown className="w-3.5 h-3.5 inline text-slate-500" /> arrows, or resize widget width using the column span options.
            </div>
          </div>

          {/* Quick Role Layout Preset Buttons */}
          <div className="flex items-center gap-1.5 self-start md:self-auto flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5 text-emerald-700" /> Role Presets:
            </span>
            <select
              onChange={(e) => applyDashboardRolePreset(e.target.value)}
              defaultValue=""
              className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 shadow-2xs focus:outline-none cursor-pointer"
            >
              <option value="" disabled>-- Choose Role Preset --</option>
              <option value="all">Default Overview</option>
              <option value="executive">Executive / BOD</option>
              <option value="branch_manager">Branch Manager</option>
              <option value="loan_officer">Loan / Credit Officer</option>
              <option value="teller">Teller / Cashier</option>
              <option value="accountant">Accountant / Auditor</option>
            </select>
          </div>
        </div>
      )}

      {/* Main Page Header & Customization Toolbar - matching prompt image layout */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        
        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-700 text-white shadow-xs">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              MY DASHBOARD
            </h1>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-2 mt-0.5">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Branch: {activeBranch?.name || 'Head Office'}</span>
              <span className="text-slate-600">|</span>
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>FY {activeFiscalYearCode} (BS)</span>
            </p>
          </div>
        </div>

        {/* Right Toolbar Controls matching image */}
        <div className="flex items-center gap-2.5 flex-wrap">
          
          <button
            type="button"
            onClick={() => setIsFiscalYearModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#006130] border border-emerald-300 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-[#006130]" />
            <span>Add Fiscal Year</span>
          </button>
          
          {isEditing ? (
            <>
              {/* Select Widget Dropdown */}
              <div className="relative">
                <select
                  value={selectedWidgetToAdd}
                  onChange={(e) => setSelectedWidgetToAdd(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium bg-white text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[200px] cursor-pointer"
                >
                  <option value="">-- Add New Widget --</option>
                  {availableWidgetsToAdd.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.title} ({w.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Add Button */}
              <button
                onClick={handleAddWidget}
                disabled={!selectedWidgetToAdd}
                className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-500 text-white rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>

              {/* Refresh / Reset Button */}
              <button
                onClick={handleResetWidgets}
                title="Reset to default dashboard layout"
                className="px-3 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Reset</span>
              </button>

              {/* Done Button */}
              <button
                onClick={() => setIsEditing(false)}
                className="px-3.5 py-1.5 border border-slate-200 bg-slate-50 hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Done</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => openTab('savings_deposit', 'Teller Deposit Entry', 'CreditCard')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-white text-slate-800 rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer"
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>New Deposit</span>
              </button>

              <button
                onClick={() => openTab('loan_appraisal', 'Loan Appraisal Entry', 'Landmark')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-white text-slate-800 rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Apply Loan</span>
              </button>

              {/* Edit / Customize Dashboard Button */}
              <button
                onClick={() => setIsEditing(true)}
                className="px-3.5 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-bold shadow-2xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Customize Grid</span>
              </button>
            </>
          )}

        </div>
      </div>

      {/* Grid of Dynamic Drag-and-Drop & Resizable Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 transition-all">
        {activeWidgetIds.map((widgetId, index) => {
          const widgetDef = WIDGET_CATALOG.find(w => w.id === widgetId);
          const colSpan = getWidgetSpanClass(widgetId);
          const isBeingDragged = draggedWidgetId === widgetId;
          const isDragOver = dragOverWidgetId === widgetId;

          return (
            <div
              key={widgetId}
              draggable={isEditing}
              onDragStart={(e) => handleDragStart(e, widgetId)}
              onDragOver={(e) => handleDragOver(e, widgetId)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, widgetId)}
              onDragEnd={handleDragEnd}
              className={`${colSpan} relative group transition-all duration-200 ${ isEditing ? 'cursor-grab active:cursor-grabbing' : '' } ${ isBeingDragged ? 'opacity-40 scale-98 shadow-2xl' : 'opacity-100' } ${ isDragOver ? 'ring-2 ring-emerald-500 ring-offset-2 scale-[1.01]' : '' }`}
            >
              {/* Edit Overlay Handle matching image design with reorder & resize controls */}
              {isEditing && (
                <div className="absolute top-2 left-2 right-2 z-20 flex flex-wrap items-center justify-between bg-white/95 backdrop-blur-xs border border-slate-300 rounded-lg p-1 px-2.5 shadow-md gap-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 select-none">
                    <GripVertical className="w-4 h-4 text-slate-500 group-hover:text-emerald-700 transition" />
                    <span className="text-[11px] text-slate-600 font-mono">#{index + 1} {widgetDef?.title || widgetId}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Move Up */}
                    <button
                      onClick={() => moveWidget(index, 'up')}
                      disabled={index === 0}
                      title="Move Up"
                      className="p-1 text-slate-500 hover:text-emerald-800 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>

                    {/* Move Down */}
                    <button
                      onClick={() => moveWidget(index, 'down')}
                      disabled={index === activeWidgetIds.length - 1}
                      title="Move Down"
                      className="p-1 text-slate-500 hover:text-emerald-800 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Resize Column Width Selector */}
                    <select
                      value={colSpan}
                      onChange={(e) => updateWidgetSpan(widgetId, e.target.value)}
                      title="Change Widget Size / Column Span"
                      className="px-1.5 py-0.5 text-[11px] font-semibold border border-slate-300 bg-white text-slate-700 rounded shadow-2xs focus:outline-none cursor-pointer"
                    >
                      <option value="col-span-1">1 Col (25%)</option>
                      <option value="col-span-1 lg:col-span-2">2 Cols (50%)</option>
                      <option value="col-span-1 lg:col-span-3">3 Cols (75%)</option>
                      <option value="col-span-1 lg:col-span-4">Full Width (100%)</option>
                    </select>

                    {/* Remove Widget */}
                    <button
                      onClick={() => handleRemoveWidget(widgetId)}
                      title="Remove Widget"
                      className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Dashed Edit Border wrapper when editing */}
              <div className={`h-full ${isEditing ? 'pt-9 p-1 border-2 border-dashed border-emerald-300/80 rounded-2xl bg-emerald-50/20' : ''}`}>
                {renderWidgetContent(widgetId)}
              </div>
            </div>
          );
        })}

        {activeWidgetIds.length === 0 && (
          <div className="col-span-1 md:col-span-2 lg:col-span-4 p-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300 space-y-3">
            <LayoutGrid className="w-10 h-10 text-slate-500 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">Your Dashboard is Empty</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Click the dropdown above to select widgets and add them to your custom home dashboard.
            </p>
            <button
              onClick={handleResetWidgets}
              className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-xs font-bold hover:bg-emerald-800 transition"
            >
              Restore Default Widgets
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
