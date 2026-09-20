import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  CalendarDays, 
  Clock, 
  Search, 
  Filter, 
  X, 
  Download, 
  FileSpreadsheet, 
  AlertCircle, 
  Minus, 
  ArrowRight,
  Maximize2,
  Minimize2,
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { formatNPR, getDaysInBSMonth, getTodayBS } from '../../utils/nepaliCalendar';
import { exportToExcel } from '../../utils/exportUtils';
import { exportProfitLossPdf } from '../../utils/financialReportExport';
import { useCoop } from '../../context/CoopContext';
import { ProfitLossD3Chart, PLHeadData } from './ProfitLossD3Chart';

interface ProfitLossViewProps {
  chartOfAccounts: any[];
  vouchers: any[];
}

export const ProfitLossView: React.FC<ProfitLossViewProps> = ({
  chartOfAccounts = [],
  vouchers = [],
}) => {
  const safeChart = chartOfAccounts || [];
  const safeVouchers = vouchers || [];

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hideZeroBalance, setHideZeroBalance] = useState<boolean>(false);
  const [onlySignificantVariances, setOnlySignificantVariances] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const { fiscalYears = [] } = useCoop();
  const activeFY = fiscalYears.find(f => f.isCurrent) || fiscalYears[0];
  const fyStartDate = activeFY?.startDateBS || '2083-04-01';
  const fyEndDateDefault = activeFY?.endDateBS || '2084-03-31';
  const fyStartYear = parseInt(fyStartDate.split('-')[0], 10) || 2083;
  const fyEndYear = fyStartYear + 1;
  const fyCodeLabel = activeFY?.code ? activeFY.code.replace('/', '/') : `${fyStartYear}/${String(fyEndYear).slice(-2)}`;

  const [startDateBS, setStartDateBS] = useState<string>(fyStartDate);
  const [endDateBS, setEndDateBS] = useState<string>(fyEndDateDefault);
  const [fiscalPreset, setFiscalPreset] = useState<string>('FY');

  const handleApplyPreset = (preset: string) => {
    setFiscalPreset(preset);
    const ashadhDays = getDaysInBSMonth(fyEndYear, 3);
    const fyEndDate = `${fyEndYear}-03-${String(ashadhDays).padStart(2, '0')}`;
    const q1EndDate = `${fyStartYear}-06-${String(getDaysInBSMonth(fyStartYear, 6)).padStart(2, '0')}`;
    const q2EndDate = `${fyStartYear}-09-${String(getDaysInBSMonth(fyStartYear, 9)).padStart(2, '0')}`;
    const q3EndDate = `${fyStartYear}-12-${String(getDaysInBSMonth(fyStartYear, 12)).padStart(2, '0')}`;
    if (preset === 'FY') {
      setStartDateBS(fyStartDate);
      setEndDateBS(fyEndDate);
    } else if (preset === 'Q1') {
      setStartDateBS(fyStartDate);
      setEndDateBS(q1EndDate);
    } else if (preset === 'Q2') {
      setStartDateBS(`${fyStartYear}-07-01`);
      setEndDateBS(q2EndDate);
    } else if (preset === 'Q3') {
      setStartDateBS(`${fyStartYear}-10-01`);
      setEndDateBS(q3EndDate);
    } else if (preset === 'Q4') {
      setStartDateBS(`${fyEndYear}-01-01`);
      setEndDateBS(fyEndDate);
    } else if (preset === 'THIS_MONTH') {
      const todayBs = getTodayBS();
      const curYear = parseInt(todayBs.slice(0, 4), 10);
      const curMonth = parseInt(todayBs.slice(5, 7), 10);
      const curMonthDays = getDaysInBSMonth(curYear, curMonth);
      setStartDateBS(`${curYear}-${String(curMonth).padStart(2, '0')}-01`);
      setEndDateBS(`${curYear}-${String(curMonth).padStart(2, '0')}-${String(curMonthDays).padStart(2, '0')}`);
    } else if (preset === 'ALL') {
      setStartDateBS('');
      setEndDateBS('');
    }
  };

  // Compute Head movements dynamically based on selected date range
  const getPLHeadData = (head: any): PLHeadData => {
    let priorAmount = 0;
    let periodAmount = 0;

    safeVouchers.forEach(v => {
      if (v.status === 'Cancelled') return;
      const vDate = v.dateBS || '';

      v.entries?.forEach((e: any) => {
        if (e.accountCode === head.code || e.accountId === head.id) {
          const debit = e.debit || 0;
          const credit = e.credit || 0;
          // For Income: Credit is positive. For Expense: Debit is positive.
          const movement = head.type === 'Income' ? (credit - debit) : (debit - credit);

          if (startDateBS && vDate && vDate < startDateBS) {
            priorAmount += movement;
          } else if (
            (!startDateBS || !vDate || vDate >= startDateBS) &&
            (!endDateBS || !vDate || vDate <= endDateBS)
          ) {
            periodAmount += movement;
          }
        }
      });
    });

    // If no voucher movements at all, use COA balance as period amount
    if (priorAmount === 0 && periodAmount === 0 && (head.balance || 0) !== 0) {
      periodAmount = head.balance || 0;
    }

    const varAmt = periodAmount - priorAmount;
    const varPct = priorAmount !== 0 ? (varAmt / Math.abs(priorAmount)) * 100 : (periodAmount !== 0 ? 100 : 0);
    const isSignificant = Math.abs(varPct) >= 10 || Math.abs(varAmt) >= 5000;

    return {
      id: head.id,
      code: head.code,
      name: head.name,
      type: head.type,
      priorBalance: priorAmount,
      periodAmount: periodAmount,
      closingAmount: priorAmount + periodAmount,
      varAmount: varAmt,
      varPercent: varPct,
      isSignificant,
    };
  };

  // Filter Income and Expense heads
  const incomeHeads = safeChart
    .filter(c => c.type === 'Income')
    .map(getPLHeadData)
    .filter(h => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!h.name.toLowerCase().includes(q) && !h.code.toLowerCase().includes(q)) return false;
      }
      if (hideZeroBalance && h.periodAmount === 0 && h.priorBalance === 0) return false;
      if (onlySignificantVariances) {
        const varPct = h.priorBalance > 0 ? Math.abs((h.varAmount / h.priorBalance) * 100) : 0;
        if (varPct < 10 && Math.abs(h.varAmount) < 5000) return false;
      }
      return true;
    });

  const expenseHeads = safeChart
    .filter(c => c.type === 'Expense')
    .map(getPLHeadData)
    .filter(h => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!h.name.toLowerCase().includes(q) && !h.code.toLowerCase().includes(q)) return false;
      }
      if (hideZeroBalance && h.periodAmount === 0 && h.priorBalance === 0) return false;
      if (onlySignificantVariances) {
        const varPct = h.priorBalance > 0 ? Math.abs((h.varAmount / h.priorBalance) * 100) : 0;
        if (varPct < 10 && Math.abs(h.varAmount) < 5000) return false;
      }
      return true;
    });

  const totalIncome = incomeHeads.reduce((acc, h) => acc + h.periodAmount, 0);
  const priorIncome = incomeHeads.reduce((acc, h) => acc + h.priorBalance, 0);

  const totalExpense = expenseHeads.reduce((acc, h) => acc + h.periodAmount, 0);
  const priorExpense = expenseHeads.reduce((acc, h) => acc + h.priorBalance, 0);

  const netProfit = totalIncome - totalExpense;
  const priorNetProfit = priorIncome - priorExpense;
  const netProfitVar = netProfit - priorNetProfit;

  // PDF Export (Enhanced)
  const handleExportPdf = () => {
    exportProfitLossPdf(
      `P_and_L_Statement_${startDateBS}_to_${endDateBS}`,
      '', '',
      startDateBS || '', endDateBS || '',
      incomeHeads.map(h => ({ code: h.code, name: h.name, periodAmount: h.periodAmount, priorBalance: h.priorBalance, varAmount: h.varAmount, varPercent: h.varPercent })),
      totalIncome, priorIncome,
      expenseHeads.map(h => ({ code: h.code, name: h.name, periodAmount: h.periodAmount, priorBalance: h.priorBalance, varAmount: h.varAmount, varPercent: h.varPercent })),
      totalExpense, priorExpense,
    );
  };

  // Excel Export
  const handleExportExcel = () => {
    const headers = ['Account Code', 'Account Name', 'Type', 'Prior Period (NPR)', 'Current Period Amount (NPR)', 'Variance Amount (NPR)', 'Variance (%)'];
    const rows: (string | number)[][] = [];

    incomeHeads.forEach(h => {
      rows.push([h.code, h.name, 'Income', h.priorBalance, h.periodAmount, h.varAmount, parseFloat(h.varPercent.toFixed(2))]);
    });
    rows.push(['TOTAL_INCOME', 'Total Revenue Income', 'Income', priorIncome, totalIncome, totalIncome - priorIncome, 0]);

    expenseHeads.forEach(h => {
      rows.push([h.code, h.name, 'Expense', h.priorBalance, h.periodAmount, h.varAmount, parseFloat(h.varPercent.toFixed(2))]);
    });
    rows.push(['TOTAL_EXPENSE', 'Total Operating Expenses', 'Expense', priorExpense, totalExpense, totalExpense - priorExpense, 0]);

    rows.push(['NET_PROFIT', 'Net Surplus / Profit', 'SUMMARY', priorNetProfit, netProfit, netProfitVar, 0]);

    exportToExcel(
      'Profit_and_Loss_Statement_Report',
      'P_and_L_Report',
      headers,
      rows
    );
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-100 rounded-xl border border-emerald-300 text-emerald-800">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <span>नाफा नोक्सान हिसाब (Profit & Loss Statement)</span>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                P&L Statement
              </span>
            </h2>
            <p className="text-slate-500 text-xs">
              Income, operational expenditure, net surplus margin and fiscal period variance analytics.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportPdf}
            className="px-3 py-1.5 bg-emerald-900 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF Export</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel Export</span>
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Date Range Picker and Fiscal Presets */}
      {isExpanded && (
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
                    {startDateBS || 'प्रारम्भ देखि'} ~ {endDateBS || 'अन्तिम सम्म'}
                  </span>
                </h3>
              </div>
            </div>

            {(startDateBS || endDateBS) && (
              <button
                type="button"
                onClick={() => handleApplyPreset('ALL')}
                className="text-[11px] font-semibold text-slate-600 hover:text-red-700 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>मिति रिसेट (Reset)</span>
              </button>
            )}
          </div>

          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-600 mr-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Quick Presets:</span>
              </span>
              <button
                type="button"
                onClick={() => handleApplyPreset('FY')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border ${ fiscalPreset === 'FY' ? 'bg-emerald-700 text-white border-emerald-800' : 'bg-white text-slate-700 border-slate-200' }`}
              >
                {`आ.व. ${fyCodeLabel}`}
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('THIS_MONTH')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border ${ fiscalPreset === 'THIS_MONTH' ? 'bg-emerald-700 text-white border-emerald-800' : 'bg-white text-slate-700 border-slate-200' }`}
              >
                चालु महिना
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('Q1')}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition border ${ fiscalPreset === 'Q1' ? 'bg-emerald-700 text-white border-emerald-800 font-bold' : 'bg-white text-slate-700 border-slate-200' }`}
              >
                Q1 (श्रावण-असोज)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('Q2')}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition border ${ fiscalPreset === 'Q2' ? 'bg-emerald-700 text-white border-emerald-800 font-bold' : 'bg-white text-slate-700 border-slate-200' }`}
              >
                Q2 (कार्तिक-पुस)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('Q3')}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition border ${ fiscalPreset === 'Q3' ? 'bg-emerald-700 text-white border-emerald-800 font-bold' : 'bg-white text-slate-700 border-slate-200' }`}
              >
                Q3 (माघ-चैत)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('Q4')}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition border ${ fiscalPreset === 'Q4' ? 'bg-emerald-700 text-white border-emerald-800 font-bold' : 'bg-white text-slate-700 border-slate-200' }`}
              >
                Q4 (वैशाख-असार)
              </button>
            </div>

            <div className="flex items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-lg">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-600 pl-1">देखि:</span>
                <input
                  type="text"
                  value={startDateBS}
                  onChange={(e) => {
                    setStartDateBS(e.target.value);
                    setFiscalPreset('CUSTOM');
                  }}
                  className="w-24 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-900 font-mono font-bold"
                />
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-600">सम्म:</span>
                <input
                  type="text"
                  value={endDateBS}
                  onChange={(e) => {
                    setEndDateBS(e.target.value);
                    setFiscalPreset('CUSTOM');
                  }}
                  className="w-24 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-900 font-mono font-bold"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      {isExpanded && (
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search P&L account code or title (खाता नाम वा कोड खोज्नुहोस्)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium text-xs">
              <input
                type="checkbox"
                checked={hideZeroBalance}
                onChange={(e) => setHideZeroBalance(e.target.checked)}
                className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer"
              />
              <span>शून्य मौज्दात लुकाउनुहोस् (Hide Zero)</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium text-xs">
              <input
                type="checkbox"
                checked={onlySignificantVariances}
                onChange={(e) => setOnlySignificantVariances(e.target.checked)}
                className="w-3.5 h-3.5 accent-amber-600 rounded cursor-pointer"
              />
              <span className={`px-2 py-0.5 rounded-md font-bold transition flex items-center gap-1 text-[11px] ${ onlySignificantVariances ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-700' }`}>
                <AlertCircle className="w-3 h-3 text-amber-600" />
                <span>Significant Shifts Only (±10%+)</span>
              </span>
            </label>
          </div>
        </div>
      )}

      {/* P&L Tables Grid */}
      {isExpanded && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Revenue / Income Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="bg-emerald-800 text-white p-3 font-bold text-xs flex justify-between items-center">
              <span>आम्दानी शीर्षकहरू (Revenue / Income Heads)</span>
              <span className="font-mono text-emerald-200">{incomeHeads.length} Heads</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px] uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Code & Head Name</th>
                    <th className="p-2.5 text-right">Prior Amount</th>
                    <th className="p-2.5 text-right">Current Period</th>
                    <th className="p-2.5 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {incomeHeads.map(h => (
                    <tr key={h.id} className="hover:bg-emerald-50/40 transition-colors">
                      <td className="p-2.5">
                        <span className="font-mono text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mr-2 text-[10px]">
                          {h.code}
                        </span>
                        <span className="font-semibold text-slate-900">{h.name}</span>
                      </td>
                      <td className="p-2.5 text-right font-mono text-slate-500">
                        {h.priorBalance > 0 ? formatNPR(h.priorBalance) : '-'}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                        {h.periodAmount > 0 ? formatNPR(h.periodAmount) : '-'}
                      </td>
                      <td className="p-2.5 text-right font-mono">
                        {h.varAmount > 0 ? (
                          <span className="text-emerald-700 font-bold text-[10px] bg-emerald-100 px-1.5 py-0.5 rounded">
                            +{h.varPercent.toFixed(1)}%
                          </span>
                        ) : h.varAmount < 0 ? (
                          <span className="text-rose-700 font-bold text-[10px] bg-rose-100 px-1.5 py-0.5 rounded">
                            {h.varPercent.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">0.0%</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {incomeHeads.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center italic text-slate-500">
                        No income heads found matching filter criteria
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-emerald-50 text-slate-800 font-extrabold border-t border-emerald-200">
                  <tr>
                    <td className="p-3 text-left">कुल आम्दानी (TOTAL REVENUE INCOME)</td>
                    <td className="p-3 text-right font-mono text-slate-500">{formatNPR(priorIncome)}</td>
                    <td className="p-3 text-right font-mono text-emerald-700 font-bold text-sm">{formatNPR(totalIncome)}</td>
                    <td className="p-3 text-right font-mono text-xs text-emerald-600">
                      {totalIncome > priorIncome ? `+${formatNPR(totalIncome - priorIncome)}` : formatNPR(totalIncome - priorIncome)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Operating Expense Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="bg-rose-800 text-white p-3 font-bold text-xs flex justify-between items-center">
              <span>सञ्चालन खर्च शीर्षकहरू (Operating Expenses)</span>
              <span className="font-mono text-rose-200">{expenseHeads.length} Heads</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px] uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Code & Head Name</th>
                    <th className="p-2.5 text-right">Prior Amount</th>
                    <th className="p-2.5 text-right">Current Period</th>
                    <th className="p-2.5 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {expenseHeads.map(h => (
                    <tr key={h.id} className="hover:bg-rose-50/40 transition-colors">
                      <td className="p-2.5">
                        <span className="font-mono text-rose-800 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 mr-2 text-[10px]">
                          {h.code}
                        </span>
                        <span className="font-semibold text-slate-900">{h.name}</span>
                      </td>
                      <td className="p-2.5 text-right font-mono text-slate-500">
                        {h.priorBalance > 0 ? formatNPR(h.priorBalance) : '-'}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-rose-700">
                        {h.periodAmount > 0 ? formatNPR(h.periodAmount) : '-'}
                      </td>
                      <td className="p-2.5 text-right font-mono">
                        {h.varAmount > 0 ? (
                          <span className="text-rose-700 font-bold text-[10px] bg-rose-100 px-1.5 py-0.5 rounded">
                            +{h.varPercent.toFixed(1)}%
                          </span>
                        ) : h.varAmount < 0 ? (
                          <span className="text-emerald-700 font-bold text-[10px] bg-emerald-100 px-1.5 py-0.5 rounded">
                            {h.varPercent.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">0.0%</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {expenseHeads.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center italic text-slate-500">
                        No expense heads found matching filter criteria
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-rose-50 text-slate-800 font-extrabold border-t border-rose-200">
                  <tr>
                    <td className="p-3 text-left">कुल खर्च (TOTAL OPERATING EXPENSES)</td>
                    <td className="p-3 text-right font-mono text-slate-500">{formatNPR(priorExpense)}</td>
                    <td className="p-3 text-right font-mono text-rose-700 font-bold text-sm">{formatNPR(totalExpense)}</td>
                    <td className="p-3 text-right font-mono text-xs text-rose-600">
                      {totalExpense > priorExpense ? `+${formatNPR(totalExpense - priorExpense)}` : formatNPR(totalExpense - priorExpense)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Net Surplus Summary Bar */}
      {isExpanded && (
        <div className="p-4 bg-white text-slate-800 rounded-xl border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-xl border border-emerald-300 text-emerald-700">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="font-extrabold text-sm uppercase tracking-wider text-emerald-800">
                खुद बचत / नाफा (NET SURPLUS / NET PROFIT FOR PERIOD)
              </div>
              <p className="text-[11px] text-slate-500">
                Calculated as Total Revenue Income ({formatNPR(totalIncome)}) minus Operating Expenses ({formatNPR(totalExpense)})
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="font-mono text-2xl font-black text-emerald-700">
              {formatNPR(netProfit)}
            </div>
            <div className="text-[10px] text-emerald-600 font-medium">
              Net Profit Margin: {totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : '0.0'}%
            </div>
          </div>
        </div>
      )}

      {/* D3.js Chart Section */}
      {isExpanded && (
        <div className="pt-2">
          <ProfitLossD3Chart
            incomeHeads={incomeHeads}
            expenseHeads={expenseHeads}
            totalIncome={totalIncome}
            totalExpense={totalExpense}
            netProfit={netProfit}
          />
        </div>
      )}

    </div>
  );
};
