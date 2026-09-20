import React, { useState } from 'react';
import { useCoop } from '../../context/CoopContext';
import { 
  BookOpen, 
  FileSpreadsheet, 
  TrendingUp, 
  Landmark, 
  Plus, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  FileCheck,
  Calculator,
  Download,
  Layers,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Maximize2,
  Minimize2,
  Search,
  Filter,
  X,
  RefreshCw,
  CalendarDays,
  Clock,
  ArrowRight,
  TrendingDown,
  Minus
} from 'lucide-react';
import { formatNPR, getTodayBS, getTodayADFormatted } from '../../utils/nepaliCalendar';
import { exportToPdf, exportToExcel } from '../../utils/exportUtils';
import { exportTrialBalancePdf } from '../../utils/financialReportExport';
import { useAutoSaveDraft } from '../../hooks/useAutoSaveDraft';
import { AutoSaveBanner } from '../common/AutoSaveBanner';
import { LedgerBookSheets } from '../accounting/LedgerBookSheets';
import { TrialBalanceD3Chart, CategorySummaryData } from '../accounting/TrialBalanceD3Chart';
import { ProfitLossView } from '../accounting/ProfitLossView';
import { BalanceSheetView } from '../accounting/BalanceSheetView';
import { CashFlowView } from '../accounting/CashFlowView';
import { FinancialRatiosView } from '../accounting/FinancialRatiosView';
import { ManualJournalVoucherEntry } from '../accounting/ManualJournalVoucherEntry';
import { SubsidiaryBooksView } from '../accounting/SubsidiaryBooksView';

interface Props {
  activeSubKey?: string;
  standalone?: boolean;
}

export const AccountsView: React.FC<Props> = ({ activeSubKey, standalone }) => {
  const { 
    chartOfAccounts = [], 
    vouchers = [], 
    postManualVoucher, 
    setSelectedVoucherForDetail, 
    activeBranchId,
    fiscalYears = []
  } = useCoop();

  const safeChart = chartOfAccounts || [];
  const safeVouchers = vouchers || [];
  const activeFY = fiscalYears.find(f => f.isCurrent) || fiscalYears[0];
  const activeFYStartDate = activeFY?.startDateBS || '2083-04-01';
  const activeFYEndDate = activeFY?.endDateBS || '2084-03-31';
  const activeFYStartYear = parseInt(activeFYStartDate.split('-')[0], 10) || 2083;
  const activeFYEndYear = activeFYStartYear + 1;
  const activeFYCodeLabel = activeFY?.code ? activeFY.code.replace('/', '/') : `${activeFYStartYear}/${String(activeFYEndYear).slice(-2)}`;

  const [activeSubTab, setActiveSubTab] = useState<'vouchers' | 'ledger_sheets' | 'subsidiary_books' | 'trial_balance' | 'pl_statement' | 'balance_sheet' | 'cash_flow' | 'financial_ratios' | 'manual_voucher' | 'closing'>('ledger_sheets');

  React.useEffect(() => {
    if (activeSubKey === 'accounts_vouchers') setActiveSubTab('vouchers');
    else if (activeSubKey === 'accounts_subsidiary') setActiveSubTab('subsidiary_books');
    else if (activeSubKey === 'accounts_trial') setActiveSubTab('trial_balance');
    else if (activeSubKey === 'accounts_income_stmt') setActiveSubTab('pl_statement');
    else if (activeSubKey === 'accounts_balance_sheet') setActiveSubTab('balance_sheet');
    else if (activeSubKey === 'accounts_gl') setActiveSubTab('manual_voucher');
    else if (activeSubKey === 'accounts_ledger') setActiveSubTab('ledger_sheets');
    else if (activeSubKey === 'accounts_cashflow') setActiveSubTab('cash_flow');
    else if (activeSubKey === 'accounts_financial_ratios') setActiveSubTab('financial_ratios');
  }, [activeSubKey]);

  // Trial Balance Expand / Collapse States
  const [isTbCardExpanded, setIsTbCardExpanded] = useState<boolean>(true);
  const [expandedTbCategories, setExpandedTbCategories] = useState<Record<string, boolean>>({
    Asset: true,
    Liability: true,
    Equity: true,
    Income: true,
    Expense: true,
  });

  const toggleTbCategory = (category: string) => {
    setExpandedTbCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const expandAllTbCategories = () => {
    setExpandedTbCategories({
      Asset: true,
      Liability: true,
      Equity: true,
      Income: true,
      Expense: true,
    });
    setIsTbCardExpanded(true);
  };

  const collapseAllTbCategories = () => {
    setExpandedTbCategories({
      Asset: false,
      Liability: false,
      Equity: false,
      Income: false,
      Expense: false,
    });
  };

  const tbCategories = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'] as const;
  const categoryNepaliMap: Record<string, string> = {
    Asset: 'सम्पत्ति (Assets)',
    Liability: 'दायित्व (Liabilities)',
    Equity: 'सेयर पूँजी र कोष (Share Equity & Reserves)',
    Income: 'आम्दानी (Revenue / Income)',
    Expense: 'खर्च (Operating Expenses)',
  };

  // Trial Balance Search, Filter, Date Range & Live Totals States
  const [tbSearchQuery, setTbSearchQuery] = useState<string>('');
  const [tbSelectedCategory, setTbSelectedCategory] = useState<string>('ALL');
  const [tbHideZeroBalance, setTbHideZeroBalance] = useState<boolean>(false);
  const [tbIncludeCollapsedInTotals, setTbIncludeCollapsedInTotals] = useState<boolean>(true);
  const [tbOnlySignificantVariances, setTbOnlySignificantVariances] = useState<boolean>(false);

  // Date Range Filter States
  const [tbStartDateBS, setTbStartDateBS] = useState<string>(activeFYStartDate);
  const [tbEndDateBS, setTbEndDateBS] = useState<string>(activeFYEndDate);
  const [tbFiscalPreset, setTbFiscalPreset] = useState<string>('FY');

  const handleApplyFiscalPreset = (preset: string) => {
    setTbFiscalPreset(preset);
    if (preset === 'FY') {
      setTbStartDateBS(activeFYStartDate);
      setTbEndDateBS(activeFYEndDate);
    } else if (preset === 'Q1') {
      setTbStartDateBS(activeFYStartDate);
      setTbEndDateBS(`${activeFYStartYear}-06-31`);
    } else if (preset === 'Q2') {
      setTbStartDateBS(`${activeFYStartYear}-07-01`);
      setTbEndDateBS(`${activeFYStartYear}-09-30`);
    } else if (preset === 'Q3') {
      setTbStartDateBS(`${activeFYStartYear}-10-01`);
      setTbEndDateBS(`${activeFYStartYear}-12-30`);
    } else if (preset === 'Q4') {
      setTbStartDateBS(`${activeFYEndYear}-01-01`);
      setTbEndDateBS(`${activeFYEndYear}-03-31`);
    } else if (preset === 'THIS_MONTH') {
      setTbStartDateBS(activeFYStartDate);
      setTbEndDateBS(`${activeFYStartYear}-04-32`);
    } else if (preset === 'ALL') {
      setTbStartDateBS('');
      setTbEndDateBS('');
    }
  };

  // Financial values calculation helper for individual accounts (Date Range aware)
  const getAccountFinancials = (c: typeof safeChart[0]) => {
    const isDebitCat = c.type === 'Asset' || c.type === 'Expense';
    const closingBalance = c.balance || 0;

    let priorDebit = 0;
    let priorCredit = 0;
    let periodDebit = 0;
    let periodCredit = 0;

    safeVouchers.forEach(v => {
      if (v.status === 'Cancelled') return;
      const vDate = v.dateBS || '';

      v.entries?.forEach(e => {
        if (e.accountCode === c.code || e.accountId === c.id) {
          const d = e.debit || 0;
          const cr = e.credit || 0;

          if (tbStartDateBS && vDate && vDate < tbStartDateBS) {
            priorDebit += d;
            priorCredit += cr;
          } else if (
            (!tbStartDateBS || !vDate || vDate >= tbStartDateBS) &&
            (!tbEndDateBS || !vDate || vDate <= tbEndDateBS)
          ) {
            periodDebit += d;
            periodCredit += cr;
          }
        }
      });
    });

    let debit = periodDebit;
    let credit = periodCredit;

    // Opening balance = closing balance minus period movements (reverse the period effect)
    const totalVoucherDebit = priorDebit + periodDebit;
    const totalVoucherCredit = priorCredit + periodCredit;

    let openingBalance = 0;
    if (isDebitCat) {
      // Asset/Expense: closing = opening + totalDr - totalCr → opening = closing - totalDr + totalCr
      openingBalance = closingBalance - totalVoucherDebit + totalVoucherCredit;
    } else {
      // Liability/Equity/Income: closing = opening + totalCr - totalDr → opening = closing - totalCr + totalDr
      openingBalance = closingBalance - totalVoucherCredit + totalVoucherDebit;
    }

    // Period closing balance (opening + period Dr/Cr)
    let calcClosing = 0;
    if (isDebitCat) {
      calcClosing = openingBalance + debit - credit;
    } else {
      calcClosing = openingBalance + credit - debit;
    }

    const varAmount = calcClosing - openingBalance;
    const varPercent = openingBalance !== 0 ? (varAmount / Math.abs(openingBalance)) * 100 : (calcClosing !== 0 ? 100 : 0);
    const isSignificant = Math.abs(varPercent) >= 10 || Math.abs(varAmount) >= 5000;

    return {
      isDebitCat,
      openingBalance,
      debit,
      credit,
      closingBalance: calcClosing,
      varAmount,
      varPercent,
      isSignificant
    };
  };

  // Manual Voucher Form State
  const [voucherFormData, setVoucherFormData] = useState({
    voucherType: 'Journal' as 'Journal' | 'Payment' | 'Receipt' | 'Contra',
    narration: '',
    debitAccountCode: '5003', // Office Rent
    creditAccountCode: '1001', // Cash in Vault
    amount: '15000',
  });

  const isVoucherModified = (data: typeof voucherFormData) => {
    return (
      (data.narration && data.narration.trim() !== '') ||
      (data.amount !== '' && data.amount !== '15000') ||
      data.debitAccountCode !== '5003' ||
      data.creditAccountCode !== '1001'
    );
  };

  const {
    draftTimestamp: voucherDraftTime,
    draftBannerVisible: voucherDraftBanner,
    restoreDraft: restoreVoucherDraft,
    clearDraft: clearVoucherDraft,
    setDraftBannerVisible: setVoucherBannerVisible,
  } = useAutoSaveDraft('sahakarisathi_voucher_form_draft', voucherFormData, setVoucherFormData, isVoucherModified, 2500);

  const handlePostVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = parseFloat(voucherFormData.amount);
    if (isNaN(numAmt) || numAmt <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    if (voucherFormData.debitAccountCode === voucherFormData.creditAccountCode) {
      alert('Debit and Credit accounts must be different.');
      return;
    }

    const debitCoa = chartOfAccounts.find(c => c.code === voucherFormData.debitAccountCode);
    const creditCoa = chartOfAccounts.find(c => c.code === voucherFormData.creditAccountCode);

    postManualVoucher({
      voucherType: voucherFormData.voucherType,
      dateBS: getTodayBS(),
      dateAD: getTodayADFormatted(),
      branchId: activeBranchId,
      preparedBy: 'Accountant',
      totalAmount: numAmt,
      narration: voucherFormData.narration || `Manual ${voucherFormData.voucherType} Voucher Posting`,
      entries: [
        { accountId: debitCoa?.id || voucherFormData.debitAccountCode, accountCode: voucherFormData.debitAccountCode, accountName: debitCoa?.name || 'Debit Acc', debit: numAmt, credit: 0 },
        { accountId: creditCoa?.id || voucherFormData.creditAccountCode, accountCode: voucherFormData.creditAccountCode, accountName: creditCoa?.name || 'Credit Acc', debit: 0, credit: numAmt },
      ],
    });

    setVoucherFormData({
      voucherType: 'Journal',
      narration: '',
      debitAccountCode: '5003',
      creditAccountCode: '1001',
      amount: '15000',
    });
    clearVoucherDraft();
    setActiveSubTab('vouchers');
  };

  // Trial Balance Total
  const totalAssets = safeChart.filter(c => c.type === 'Asset').reduce((sum, c) => sum + (c.balance || 0), 0);
  const totalLiabilities = safeChart.filter(c => c.type === 'Liability').reduce((sum, c) => sum + (c.balance || 0), 0);
  const totalEquity = safeChart.filter(c => c.type === 'Equity').reduce((sum, c) => sum + (c.balance || 0), 0);
  const totalIncome = safeChart.filter(c => c.type === 'Income').reduce((sum, c) => sum + (c.balance || 0), 0);
  const totalExpense = safeChart.filter(c => c.type === 'Expense').reduce((sum, c) => sum + (c.balance || 0), 0);

  const grandTotalDebit = safeChart.reduce((sum, c) => {
    const isDebit = c.type === 'Asset' || c.type === 'Expense';
    return sum + (isDebit ? Math.max(0, c.balance) : 0);
  }, 0);

  const grandTotalCredit = safeChart.reduce((sum, c) => {
    const isDebit = c.type === 'Asset' || c.type === 'Expense';
    return sum + (!isDebit ? Math.max(0, c.balance) : 0);
  }, 0);

  const netSurplusProfit = totalIncome - totalExpense;

  const handleExportVouchersPdf = () => {
    const headers = ['Voucher No', 'Type', 'Date (BS)', 'Narration', 'Amount (NPR)'];
    const rows = safeVouchers.map(v => [
      v.voucherNo,
      v.voucherType,
      `${v.dateBS} BS`,
      v.narration,
      `NPR ${v.totalAmount.toLocaleString()}`
    ]);

    exportToPdf(
      'Voucher_Register_2083',
      'Accounting Voucher Register Ledger',
      `Total Posted Vouchers: ${safeVouchers.length} | SahakariSathi Financial System`,
      headers,
      rows
    );
  };

  const handleExportVouchersExcel = () => {
    const headers = ['Voucher No', 'Voucher Type', 'Date (BS)', 'Date (AD)', 'Narration', 'Total Amount (NPR)', 'Prepared By'];
    const rows = safeVouchers.map(v => [
      v.voucherNo,
      v.voucherType,
      v.dateBS,
      v.dateAD || '',
      v.narration,
      v.totalAmount,
      v.preparedBy || 'Accountant'
    ]);

    exportToExcel(
      'Voucher_Register_2083',
      'Voucher_Register',
      headers,
      rows
    );
  };

  const handleExportTrialBalancePdf = (
    customAccounts?: typeof safeChart,
    customTotals?: { openingBalance: number; debit: number; credit: number; closingBalance: number; count: number }
  ) => {
    const list = customAccounts || safeChart;

    const tbAccounts = list.map(c => {
      const fin = getAccountFinancials(c);
      return {
        code: c.code, name: c.name, category: c.type,
        openingBalance: fin.openingBalance, debitMovement: fin.debit,
        creditMovement: fin.credit, closingBalance: fin.closingBalance,
        variance: fin.varAmount,
      };
    });

    const finalTotOpening = customTotals ? customTotals.openingBalance : tbAccounts.reduce((s, a) => s + a.openingBalance, 0);
    const finalTotDebit = customTotals ? customTotals.debit : tbAccounts.reduce((s, a) => s + a.debitMovement, 0);
    const finalTotCredit = customTotals ? customTotals.credit : tbAccounts.reduce((s, a) => s + a.creditMovement, 0);
    const finalTotClosing = customTotals ? customTotals.closingBalance : tbAccounts.reduce((s, a) => s + a.closingBalance, 0);

    exportTrialBalancePdf(
      'Trial_Balance_Report',
      '', '',
      '', '',
      tbAccounts,
      { opening: finalTotOpening, debit: finalTotDebit, credit: finalTotCredit, closing: finalTotClosing, variance: finalTotClosing - finalTotOpening },
    );
  };

  const handleExportTrialBalanceExcel = (
    customAccounts?: typeof safeChart,
    customTotals?: { openingBalance: number; debit: number; credit: number; closingBalance: number; count: number }
  ) => {
    const list = customAccounts || safeChart;
    const headers = ['Account Code', 'Account Name', 'Category', 'Opening Balance (NPR)', 'Debit Movement (NPR)', 'Credit Movement (NPR)', 'Closing Balance (NPR)', 'Period Variance (NPR)', 'Variance (%)'];
    
    let totalOpening = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    let totalClosing = 0;

    const rows: (string | number)[][] = list.map(c => {
      const fin = getAccountFinancials(c);
      totalOpening += fin.openingBalance;
      totalDebit += fin.debit;
      totalCredit += fin.credit;
      totalClosing += fin.closingBalance;

      return [
        c.code,
        c.name,
        c.type,
        fin.openingBalance,
        fin.debit,
        fin.credit,
        fin.closingBalance,
        fin.varAmount,
        parseFloat(fin.varPercent.toFixed(2))
      ];
    });

    const finalTotOpening = customTotals ? customTotals.openingBalance : totalOpening;
    const finalTotDebit = customTotals ? customTotals.debit : totalDebit;
    const finalTotCredit = customTotals ? customTotals.credit : totalCredit;
    const finalTotClosing = customTotals ? customTotals.closingBalance : totalClosing;
    const totVar = finalTotClosing - finalTotOpening;
    const totPct = finalTotOpening > 0 ? (totVar / finalTotOpening) * 100 : 0;

    rows.push([
      'TOTALS',
      'Grand Total Summary',
      'TRIAL BALANCE',
      finalTotOpening,
      finalTotDebit,
      finalTotCredit,
      finalTotClosing,
      totVar,
      parseFloat(totPct.toFixed(2))
    ]);

    exportToExcel(
      'Trial_Balance_Report_2083',
      'Trial_Balance',
      headers,
      rows
    );
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800">
      
      {/* Auto-Save Restoration Banner */}
      {!standalone && (
      <AutoSaveBanner
        isVisible={voucherDraftBanner}
        timestamp={voucherDraftTime}
        formName="Journal Voucher Posting Form"
        onRestore={() => {
          restoreVoucherDraft();
          setActiveSubTab('manual_voucher');
        }}
        onDiscard={clearVoucherDraft}
        onDismiss={() => setVoucherBannerVisible(false)}
      />
      )}

      {/* Header */}
      {!standalone && (
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">


        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            onClick={() => setActiveSubTab('manual_voucher')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${ activeSubTab === 'manual_voucher' ? 'bg-emerald-800 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/70' }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Voucher</span>
          </button>

          <button
            onClick={() => setActiveSubTab('vouchers')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${ activeSubTab === 'vouchers' ? 'bg-emerald-800 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/70' }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Voucher Register</span>
          </button>

          <button
            onClick={() => setActiveSubTab('ledger_sheets')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${ activeSubTab === 'ledger_sheets' ? 'bg-emerald-800 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/70' }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>4 Ledger Sheets</span>
          </button>

          <button
            onClick={() => setActiveSubTab('subsidiary_books')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${ activeSubTab === 'subsidiary_books' ? 'bg-emerald-800 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/70' }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Three Subsidiary Books</span>
          </button>

          <button
            onClick={() => setActiveSubTab('cash_flow')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${ activeSubTab === 'cash_flow' ? 'bg-emerald-800 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/70' }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Cash Flow</span>
          </button>

          <button
            onClick={() => setActiveSubTab('trial_balance')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${ activeSubTab === 'trial_balance' ? 'bg-emerald-800 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/70' }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Trial Balance</span>
          </button>

          <button
            onClick={() => setActiveSubTab('pl_statement')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${ activeSubTab === 'pl_statement' ? 'bg-emerald-800 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/70' }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Profit & Loss (P&L)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('balance_sheet')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${ activeSubTab === 'balance_sheet' ? 'bg-emerald-800 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/70' }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>Balance Sheet</span>
          </button>

          <button
            onClick={() => setActiveSubTab('financial_ratios')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${ activeSubTab === 'financial_ratios' ? 'bg-emerald-800 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/70' }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Financial Ratios (PEARLS)</span>
          </button>
        </div>
      </div>
      )}

      {/* 4 LEDGER BOOK SHEETS */}
      {activeSubTab === 'ledger_sheets' && (
        <LedgerBookSheets vouchers={vouchers} />
      )}

      {/* THREE SUBSIDIARY BOOKS (सहायक खाताहरू) */}
      {activeSubTab === 'subsidiary_books' && (
        <SubsidiaryBooksView />
      )}

      {/* ALL VOUCHERS LIST */}
      {activeSubTab === 'vouchers' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h2 className="font-bold text-slate-900 text-base">Accounting Voucher Register</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportVouchersPdf}
                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                title="Download Vouchers PDF"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700" />
                <span>Download PDF</span>
              </button>
              <button
                type="button"
                onClick={handleExportVouchersExcel}
                className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-800 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                title="Download Vouchers Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
                <tr>
                  <th className="p-3">Voucher No</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Date (BS)</th>
                  <th className="p-3">Narration</th>
                  <th className="p-3 text-right">Balanced Amount (रु.)</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {safeVouchers.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50/80">
                    <td className="p-3 font-mono font-bold text-emerald-700">{v.voucherNo}</td>
                    <td className="p-3">
                      <span className="bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-[10px] px-2 py-0.5 rounded">
                        {v.voucherType}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">{v.dateBS} BS</td>
                    <td className="p-3 text-slate-800 truncate max-w-sm">{v.narration}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">{formatNPR(v.totalAmount)}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => setSelectedVoucherForDetail(v)}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-xs transition cursor-pointer flex items-center gap-1 mx-auto font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Voucher</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MANUAL VOUCHER ENTRY FORM */}
      {activeSubTab === 'manual_voucher' && (
        <ManualJournalVoucherEntry onVoucherPosted={() => setActiveSubTab('vouchers')} />
      )}

      {/* TRIAL BALANCE */}
      {activeSubTab === 'trial_balance' && (() => {
        // Calculate filtered accounts
        const filteredChart = safeChart.filter(c => {
          if (tbSelectedCategory !== 'ALL' && c.type !== tbSelectedCategory) {
            return false;
          }
          if (tbSearchQuery.trim() !== '') {
            const q = tbSearchQuery.toLowerCase().trim();
            const matchCode = c.code.toLowerCase().includes(q);
            const matchName = c.name.toLowerCase().includes(q);
            const matchType = c.type.toLowerCase().includes(q);
            if (!matchCode && !matchName && !matchType) return false;
          }
          if (tbHideZeroBalance) {
            const fin = getAccountFinancials(c);
            if (fin.closingBalance === 0 && fin.openingBalance === 0 && fin.debit === 0 && fin.credit === 0) {
              return false;
            }
          }
          if (tbOnlySignificantVariances) {
            const fin = getAccountFinancials(c);
            if (!fin.isSignificant) return false;
          }
          return true;
        });

        // Calculate accounts considered for live footer totals
        const accountsForFooter = filteredChart.filter(c => {
          if (!tbIncludeCollapsedInTotals) {
            const isCatExpanded = expandedTbCategories[c.type] ?? true;
            return isCatExpanded;
          }
          return true;
        });

        // Compute footer totals dynamically
        const footerTotals = accountsForFooter.reduce((acc, c) => {
          const fin = getAccountFinancials(c);
          return {
            openingBalance: acc.openingBalance + fin.openingBalance,
            debit: acc.debit + fin.debit,
            credit: acc.credit + fin.credit,
            closingBalance: acc.closingBalance + fin.closingBalance,
            count: acc.count + 1
          };
        }, { openingBalance: 0, debit: 0, credit: 0, closingBalance: 0, count: 0 });

        // Compute D3 Category Summaries dynamically
        const categorySummaries: CategorySummaryData[] = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'].map(cat => {
          const catAccounts = accountsForFooter.filter(c => c.type === cat);
          const totals = catAccounts.reduce((acc, c) => {
            const fin = getAccountFinancials(c);
            return {
              opening: acc.opening + fin.openingBalance,
              debit: acc.debit + fin.debit,
              credit: acc.credit + fin.credit,
              closing: acc.closing + fin.closingBalance,
              count: acc.count + 1
            };
          }, { opening: 0, debit: 0, credit: 0, closing: 0, count: 0 });

          return {
            category: cat,
            type: (cat === 'Asset' || cat === 'Expense') ? 'Debit' : 'Credit',
            opening: totals.opening,
            debit: totals.debit,
            credit: totals.credit,
            closing: totals.closing,
            count: totals.count
          };
        }).filter(c => c.count > 0 || !tbHideZeroBalance);

        return (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs">
            {/* Header & Main Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsTbCardExpanded(!isTbCardExpanded)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition cursor-pointer flex items-center gap-1 border border-slate-200 bg-slate-50"
                  title={isTbCardExpanded ? "Collapse Trial Balance Section" : "Expand Trial Balance Section"}
                >
                  {isTbCardExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-700" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-700" />
                  )}
                  <span className="text-xs font-semibold text-slate-700 sm:hidden">
                    {isTbCardExpanded ? 'Collapse' : 'Expand'}
                  </span>
                </button>
                <div>
                  <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <span>Live Trial Balance Statement</span>
                    <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      परीक्षण सन्तुलन
                    </span>
                  </h2>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Double-entry balanced account summaries with sticky totals footer that updates automatically on expand/collapse and filtering.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={expandAllTbCategories}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 border border-slate-200"
                  title="Expand All Categories"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-slate-600" />
                  <span>सबै खोल्नुहोस् (Expand All)</span>
                </button>

                <button
                  type="button"
                  onClick={collapseAllTbCategories}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 border border-slate-200"
                  title="Collapse All Categories"
                >
                  <Minimize2 className="w-3.5 h-3.5 text-slate-600" />
                  <span>सबै बन्द गर्नुहोस् (Collapse All)</span>
                </button>

                <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

                <button
                  type="button"
                  onClick={() => handleExportTrialBalancePdf(accountsForFooter, footerTotals)}
                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                  title="Download Trial Balance PDF"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportTrialBalanceExcel(accountsForFooter, footerTotals)}
                  className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-800 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                  title="Download Trial Balance Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export Excel</span>
                </button>
              </div>
            </div>

            {/* Date Range Picker and Fiscal Period Preset Bar */}
            {isTbCardExpanded && (
              <div className="bg-emerald-950/5 border border-emerald-200/80 p-4 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-100/80 rounded-lg text-emerald-800">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                        <span>वित्तीय अवधि छनोट (Fiscal Period & Date Range Filter)</span>
                        <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                          {tbStartDateBS || 'प्रारम्भ देखि'} ~ {tbEndDateBS || 'अन्तिम सम्म'}
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Choose a preset fiscal period or set custom dates to calculate opening, movements, and closing balances in real-time.
                      </p>
                    </div>
                  </div>

                  {(tbStartDateBS || tbEndDateBS) && (
                    <button
                      type="button"
                      onClick={() => handleApplyFiscalPreset('ALL')}
                      className="self-start sm:self-auto text-[11px] font-semibold text-slate-600 hover:text-red-700 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                      title="Clear date range filters"
                    >
                      <X className="w-3.5 h-3.5 text-slate-500" />
                      <span>मिति रिसेट (Reset Dates)</span>
                    </button>
                  )}
                </div>

                {/* Preset Buttons & Custom Inputs */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                  {/* Preset Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-600 mr-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>Quick Presets:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleApplyFiscalPreset('FY')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${ tbFiscalPreset === 'FY' ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs' : 'bg-white text-slate-700 hover:bg-emerald-50 border-slate-200' }`}
                    >
                      {`आ.व. ${activeFYCodeLabel}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyFiscalPreset('THIS_MONTH')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${ tbFiscalPreset === 'THIS_MONTH' ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs' : 'bg-white text-slate-700 hover:bg-emerald-50 border-slate-200' }`}
                    >
                      चालु महिना (This Month)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyFiscalPreset('Q1')}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${ tbFiscalPreset === 'Q1' ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs font-bold' : 'bg-white text-slate-700 hover:bg-emerald-50 border-slate-200' }`}
                    >
                      Q1 (श्रावण-असोज)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyFiscalPreset('Q2')}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${ tbFiscalPreset === 'Q2' ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs font-bold' : 'bg-white text-slate-700 hover:bg-emerald-50 border-slate-200' }`}
                    >
                      Q2 (कार्तिक-पुस)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyFiscalPreset('Q3')}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${ tbFiscalPreset === 'Q3' ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs font-bold' : 'bg-white text-slate-700 hover:bg-emerald-50 border-slate-200' }`}
                    >
                      Q3 (माघ-चैत)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyFiscalPreset('Q4')}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${ tbFiscalPreset === 'Q4' ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs font-bold' : 'bg-white text-slate-700 hover:bg-emerald-50 border-slate-200' }`}
                    >
                      Q4 (वैशाख-असार)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyFiscalPreset('ALL')}
                      className={`px-2 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${ tbFiscalPreset === 'ALL' ? 'bg-slate-50 text-slate-800 border-slate-200 shadow-xs font-bold' : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200' }`}
                    >
                      सबै मिति (All Time)
                    </button>
                  </div>

                  {/* Custom Date Inputs */}
                  <div className="flex items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-lg shadow-2xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-600 pl-1">देखि:</span>
                      <input
                        type="text"
                        value={tbStartDateBS}
                        onChange={(e) => {
                          setTbStartDateBS(e.target.value);
                          setTbFiscalPreset('CUSTOM');
                        }}
                        placeholder="2083-04-01"
                        className="w-24 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-900 font-mono font-bold focus:border-emerald-500 focus:bg-white focus:outline-none"
                      />
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-600">सम्म:</span>
                      <input
                        type="text"
                        value={tbEndDateBS}
                        onChange={(e) => {
                          setTbEndDateBS(e.target.value);
                          setTbFiscalPreset('CUSTOM');
                        }}
                        placeholder="2083-04-32"
                        className="w-24 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-900 font-mono font-bold focus:border-emerald-500 focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Filter and Search Bar */}
            {isTbCardExpanded && (
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-2xs">
                <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1">
                    <label htmlFor="tbRealtimeSearchInput" className="sr-only">Search Trial Balance Accounts</label>
                    <Search className="w-4 h-4 text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="tbRealtimeSearchInput"
                      type="text"
                      value={tbSearchQuery}
                      onChange={(e) => setTbSearchQuery(e.target.value)}
                      placeholder="Real-time search by GL Code (e.g., 1001) or Account Name (e.g., Cash)..."
                      className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-20 py-2 text-xs text-slate-900 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all font-medium"
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      {tbSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setTbSearchQuery('')}
                          className="p-1 text-slate-500 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
                          title="Clear search filter"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                        {filteredChart.length}/{safeChart.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-2xs">
                    <Filter className="w-3.5 h-3.5 text-slate-500" />
                    <select
                      value={tbSelectedCategory}
                      onChange={(e) => setTbSelectedCategory(e.target.value)}
                      className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">All Categories (सबै वर्ग)</option>
                      <option value="Asset">Asset (सम्पत्ति)</option>
                      <option value="Liability">Liability (दायित्व)</option>
                      <option value="Equity">Equity (सेयर पूँजी)</option>
                      <option value="Income">Income (आम्दानी)</option>
                      <option value="Expense">Expense (खर्च)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t md:border-t-0 md:border-l border-slate-200 pt-2 md:pt-0 md:pl-3">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-700 font-medium text-xs">
                    <input
                      type="checkbox"
                      checked={tbHideZeroBalance}
                      onChange={(e) => setTbHideZeroBalance(e.target.checked)}
                      className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer"
                    />
                    <span>Hide Zero Balances</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-700 font-medium text-xs" title="When unchecked, collapsing a category removes it from the sticky footer total calculations">
                    <input
                      type="checkbox"
                      checked={tbIncludeCollapsedInTotals}
                      onChange={(e) => setTbIncludeCollapsedInTotals(e.target.checked)}
                      className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer"
                    />
                    <span>Sum Collapsed Categories</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-700 font-medium text-xs" title="Show only accounts with significant balance shifts (±10%+ or ≥NPR 5,000 variance)">
                    <input
                      type="checkbox"
                      checked={tbOnlySignificantVariances}
                      onChange={(e) => setTbOnlySignificantVariances(e.target.checked)}
                      className="w-3.5 h-3.5 accent-amber-600 rounded cursor-pointer"
                    />
                    <span className={`px-2 py-0.5 rounded-md font-bold transition flex items-center gap-1 text-[11px] ${ tbOnlySignificantVariances ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs' : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-800' }`}>
                      <AlertCircle className="w-3 h-3 text-amber-600" />
                      <span>Significant Variances Only (±10%+)</span>
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Scrollable Table with Sticky Footer */}
            {isTbCardExpanded && (
              <div className="border border-slate-200 rounded-xl overflow-auto max-h-[600px] bg-white shadow-xs relative">
                <table className="w-full text-left border-collapse min-w-[950px]">
                  <thead className="bg-slate-50 text-slate-800 border-b border-slate-300 font-semibold text-[11px] uppercase tracking-wider sticky top-0 z-20 shadow-xs">
                    <tr>
                      <th className="p-3">GL Code & Account Name (खाता शीर्षक)</th>
                      <th className="p-3">Category (वर्ग)</th>
                      <th className="p-3 text-right">Opening Balance (प्रारम्भिक मौज्दात रु.)</th>
                      <th className="p-3 text-right">Debit Movement (डेबिट रु.)</th>
                      <th className="p-3 text-right">Credit Movement (क्रेडिट रु.)</th>
                      <th className="p-3 text-right">Closing Balance (अन्तिम मौज्दात रु.)</th>
                      <th className="p-3 text-right">Period Variance (परिवर्तन/भिन्नता)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800 text-xs">
                    {tbCategories.map(cat => {
                      const catAccounts = filteredChart.filter(c => c.type === cat);
                      
                      // Skip category header if category filter selected another category or search empty
                      if (tbSelectedCategory !== 'ALL' && tbSelectedCategory !== cat) {
                        return null;
                      }
                      if (catAccounts.length === 0 && (tbSearchQuery || tbHideZeroBalance || tbOnlySignificantVariances)) {
                        return null;
                      }

                      // Compute Category Summaries
                      const catTotals = catAccounts.reduce((acc, c) => {
                        const fin = getAccountFinancials(c);
                        return {
                          opening: acc.opening + fin.openingBalance,
                          debit: acc.debit + fin.debit,
                          credit: acc.credit + fin.credit,
                          closing: acc.closing + fin.closingBalance,
                        };
                      }, { opening: 0, debit: 0, credit: 0, closing: 0 });

                      const catVarAmt = catTotals.closing - catTotals.opening;
                      const catVarPct = catTotals.opening > 0 ? (catVarAmt / catTotals.opening) * 100 : (catTotals.closing > 0 ? 100 : 0);

                      const isExpanded = (expandedTbCategories[cat] ?? true) || tbSearchQuery.trim() !== '';

                      return (
                        <React.Fragment key={cat}>
                          {/* Category Group Header Row */}
                          <tr
                            onClick={() => toggleTbCategory(cat)}
                            className="bg-slate-100 hover:bg-slate-200/90 cursor-pointer font-bold text-slate-900 transition-colors select-none border-t border-b border-slate-300"
                          >
                            <td className="p-3 flex items-center gap-2">
                              <div className="p-1 bg-white rounded border border-slate-300 shadow-2xs">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-emerald-700" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-slate-500" />
                                )}
                              </div>
                              <span className="font-extrabold text-slate-900 text-xs">
                                {categoryNepaliMap[cat] || cat}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-300 ml-1">
                                {catAccounts.length} {catAccounts.length === 1 ? 'account' : 'accounts'}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600 font-semibold">{cat}</td>
                            <td className="p-3 text-right font-mono font-bold text-slate-900 bg-slate-50/50">
                              {catTotals.opening > 0 ? formatNPR(catTotals.opening) : '-'}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-900 bg-slate-50/50">
                              {catTotals.debit > 0 ? formatNPR(catTotals.debit) : '-'}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-900 bg-slate-50/50">
                              {catTotals.credit > 0 ? formatNPR(catTotals.credit) : '-'}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-emerald-900 bg-slate-50/50">
                              {catTotals.closing > 0 ? formatNPR(catTotals.closing) : '-'}
                            </td>
                            <td className="p-3 text-right bg-slate-50/50">
                              {catVarAmt > 0 ? (
                                <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                                  <TrendingUp className="w-3 h-3 text-emerald-700" />
                                  <span>+{catVarPct.toFixed(1)}% (+{formatNPR(catVarAmt)})</span>
                                </span>
                              ) : catVarAmt < 0 ? (
                                <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded border border-rose-300">
                                  <TrendingDown className="w-3 h-3 text-rose-700" />
                                  <span>{catVarPct.toFixed(1)}% (-{formatNPR(Math.abs(catVarAmt))})</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-slate-600 bg-slate-200 px-2 py-0.5 rounded border border-slate-300">
                                  <Minus className="w-3 h-3 text-slate-500" />
                                  <span>0.0% (Stable)</span>
                                </span>
                              )}
                            </td>
                          </tr>

                          {/* Child Account Rows */}
                          {isExpanded && catAccounts.length > 0 && catAccounts.map(c => {
                            const fin = getAccountFinancials(c);

                            return (
                              <tr 
                                key={c.id} 
                                className={`transition-colors ${ fin.isSignificant ? 'bg-amber-50/30 hover:bg-amber-100/40' : 'hover:bg-emerald-50/40' }`}
                              >
                                <td className="p-3 pl-9">
                                  <span className="font-mono text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mr-2 text-[11px]">
                                    {c.code}
                                  </span>
                                  <span className="font-semibold text-slate-900">{c.name}</span>
                                  {fin.isSignificant && (
                                    <span className="ml-2 text-[9px] font-extrabold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-full border border-amber-300 inline-flex items-center gap-0.5">
                                      <AlertCircle className="w-2.5 h-2.5 text-amber-600" />
                                      Significant Shift
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-slate-500 text-[11px]">{c.type}</td>
                                <td className="p-3 text-right font-mono font-medium text-slate-700">
                                  {fin.openingBalance > 0 ? formatNPR(fin.openingBalance) : '-'}
                                </td>
                                <td className="p-3 text-right font-mono font-medium text-slate-700">
                                  {fin.debit > 0 ? formatNPR(fin.debit) : '-'}
                                </td>
                                <td className="p-3 text-right font-mono font-medium text-slate-700">
                                  {fin.credit > 0 ? formatNPR(fin.credit) : '-'}
                                </td>
                                <td className="p-3 text-right font-mono font-bold text-slate-900">
                                  {fin.closingBalance > 0 ? formatNPR(fin.closingBalance) : '-'}
                                </td>
                                <td className="p-3 text-right font-mono">
                                  {fin.varAmount > 0 ? (
                                    <div className="inline-flex flex-col items-end">
                                      <span className={`inline-flex items-center gap-1 font-bold text-[11px] px-2 py-0.5 rounded-md border ${ fin.isSignificant ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-extrabold shadow-2xs' : 'bg-emerald-50 text-emerald-800 border-emerald-200' }`}>
                                        <TrendingUp className="w-3 h-3 text-emerald-600" />
                                        <span>+{fin.varPercent.toFixed(1)}%</span>
                                      </span>
                                      <span className="text-[10px] text-emerald-700 font-medium mt-0.5">
                                        +{formatNPR(fin.varAmount)}
                                      </span>
                                    </div>
                                  ) : fin.varAmount < 0 ? (
                                    <div className="inline-flex flex-col items-end">
                                      <span className={`inline-flex items-center gap-1 font-bold text-[11px] px-2 py-0.5 rounded-md border ${ fin.isSignificant ? 'bg-rose-100 text-rose-900 border-rose-300 font-extrabold shadow-2xs' : 'bg-rose-50 text-rose-800 border-rose-200' }`}>
                                        <TrendingDown className="w-3 h-3 text-rose-600" />
                                        <span>{fin.varPercent.toFixed(1)}%</span>
                                      </span>
                                      <span className="text-[10px] text-rose-700 font-medium mt-0.5">
                                        -{formatNPR(Math.abs(fin.varAmount))}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 font-medium text-[10px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                      <Minus className="w-3 h-3 text-slate-500" />
                                      <span>0.0%</span>
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}

                          {isExpanded && catAccounts.length === 0 && (
                            <tr>
                              <td colSpan={7} className="p-3 pl-9 italic text-slate-500 text-center">
                                No accounts matching current filter criteria in this category
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>

                  {/* STICKY FOOTER THAT UPDATES AUTOMATICALLY */}
                  <tfoot className="bg-white text-slate-800 font-extrabold border-t-2 border-emerald-500 sticky bottom-0 z-20 shadow-lg">
                    <tr>
                      <td colSpan={2} className="p-3.5 text-left bg-white">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-300 font-extrabold text-xs uppercase tracking-wider">
                            जम्मा (TRIAL BALANCE TOTALS):
                          </span>
                          <span className="text-[10px] font-semibold bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-800">
                            {footerTotals.count} {footerTotals.count === 1 ? 'account' : 'accounts'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                          {tbIncludeCollapsedInTotals ? 'Filtered Accounts Total' : 'Expanded Rows Only'}
                        </div>
                      </td>
                      <td className="p-3.5 text-right font-mono text-xs sm:text-sm text-cyan-300 bg-white border-l border-slate-200">
                        <div className="text-[9px] uppercase tracking-wider text-slate-500 font-sans font-normal">Total Opening</div>
                        {formatNPR(footerTotals.openingBalance)}
                      </td>
                      <td className="p-3.5 text-right font-mono text-xs sm:text-sm text-emerald-300 bg-white border-l border-slate-200">
                        <div className="text-[9px] uppercase tracking-wider text-slate-500 font-sans font-normal">Total Debit</div>
                        {formatNPR(footerTotals.debit)}
                      </td>
                      <td className="p-3.5 text-right font-mono text-xs sm:text-sm text-emerald-300 bg-white border-l border-slate-200">
                        <div className="text-[9px] uppercase tracking-wider text-slate-500 font-sans font-normal">Total Credit</div>
                        {formatNPR(footerTotals.credit)}
                      </td>
                      <td className="p-3.5 text-right font-mono text-xs sm:text-sm text-amber-300 bg-white border-l border-slate-200">
                        <div className="text-[9px] uppercase tracking-wider text-amber-500/80 font-sans font-normal">Total Closing</div>
                        {formatNPR(footerTotals.closingBalance)}
                      </td>
                      <td className="p-3.5 text-right font-mono text-xs sm:text-sm bg-white border-l border-slate-200">
                        <div className="text-[9px] uppercase tracking-wider text-slate-500 font-sans font-normal">Total Variance</div>
                        {(() => {
                          const totVar = footerTotals.closingBalance - footerTotals.openingBalance;
                          const totPct = footerTotals.openingBalance > 0 ? (totVar / footerTotals.openingBalance) * 100 : 0;
                          return totVar > 0 ? (
                            <span className="text-emerald-400 font-bold">+{totPct.toFixed(1)}% (+{formatNPR(totVar)})</span>
                          ) : totVar < 0 ? (
                            <span className="text-rose-400 font-bold">{totPct.toFixed(1)}% (-{formatNPR(Math.abs(totVar))})</span>
                          ) : (
                            <span className="text-slate-500">0.0%</span>
                          );
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* D3.js Visualization Chart in Trial Balance Footer */}
            {isTbCardExpanded && (
              <div className="pt-2">
                <TrialBalanceD3Chart
                  categorySummaries={categorySummaries}
                  totalDebit={footerTotals.debit}
                  totalCredit={footerTotals.credit}
                  totalOpening={footerTotals.openingBalance}
                  totalClosing={footerTotals.closingBalance}
                />
              </div>
            )}
          </div>
        );
      })()}

      {/* PROFIT & LOSS STATEMENT */}
      {activeSubTab === 'pl_statement' && (
        <ProfitLossView
          chartOfAccounts={safeChart}
          vouchers={safeVouchers}
        />
      )}

      {/* BALANCE SHEET */}
      {activeSubTab === 'balance_sheet' && (
        <BalanceSheetView
          chartOfAccounts={safeChart}
          vouchers={safeVouchers}
        />
      )}

      {/* CASH FLOW / RECEIPTS & PAYMENTS */}
      {activeSubTab === 'cash_flow' && (
        <CashFlowView
          chartOfAccounts={safeChart}
          vouchers={safeVouchers}
        />
      )}

      {/* FINANCIAL RATIOS & PEARLS */}
      {activeSubTab === 'financial_ratios' && (
        <FinancialRatiosView
          chartOfAccounts={safeChart}
          vouchers={safeVouchers}
        />
      )}

    </div>
  );
};
