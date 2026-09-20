import React, { useState } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  CalendarDays, 
  Clock, 
  Search, 
  X, 
  Download, 
  FileSpreadsheet, 
  Maximize2, 
  Minimize2, 
  Wallet,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { formatNPR, getDaysInBSMonth, getTodayBS } from '../../utils/nepaliCalendar';
import { exportToExcel } from '../../utils/exportUtils';
import { exportCashFlowPdf } from '../../utils/financialReportExport';
import { useCoop } from '../../context/CoopContext';
import { CashFlowD3Chart } from './CashFlowD3Chart';

interface CashFlowViewProps {
  chartOfAccounts: any[];
  vouchers: any[];
}

export const CashFlowView: React.FC<CashFlowViewProps> = ({
  chartOfAccounts = [],
  vouchers = [],
}) => {
  const safeChart = chartOfAccounts || [];
  const safeVouchers = vouchers || [];

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Date Range States
  const { fiscalYears = [] } = useCoop();
  const activeFY = fiscalYears.find(f => f.isCurrent) || fiscalYears[0];
  const fyStartDate = activeFY?.startDateBS || '2083-04-01';
  const fyEndDateDefault = activeFY?.endDateBS || '2084-03-31';
  const fyStartYear = parseInt(fyStartDate.split('-')[0], 10) || 2083;
  const fyEndYear = fyStartYear + 1;
  const fyCodeLabel = activeFY?.code ? activeFY.code.replace('/', '/') : `${fyStartYear}/${String(fyEndYear).slice(-2)}`;

  const initialEndDate = `${fyEndYear}-03-${String(getDaysInBSMonth(fyEndYear, 3)).padStart(2, '0')}`;

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
    } else if (preset === 'THIS_MONTH') {
      const todayBs = getTodayBS();
      const curYear = parseInt(todayBs.slice(0, 4), 10);
      const curMonth = parseInt(todayBs.slice(5, 7), 10);
      const curMonthDays = getDaysInBSMonth(curYear, curMonth);
      setStartDateBS(`${curYear}-${String(curMonth).padStart(2, '0')}-01`);
      setEndDateBS(`${curYear}-${String(curMonth).padStart(2, '0')}-${String(curMonthDays).padStart(2, '0')}`);
    } else if (preset === 'Q1') {
      setStartDateBS(`${fyStartYear}-04-01`);
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
    } else if (preset === 'ALL') {
      setStartDateBS('');
      setEndDateBS('');
    }
  };

  // Find Cash & Bank Accounts
  const cashAccounts = safeChart.filter(c => 
    c.cashBankAccount === true ||
    c.name.toLowerCase().includes('cash') || 
    c.name.toLowerCase().includes('bank') || 
    c.code.startsWith('101') ||
    c.code.startsWith('102')
  );

  // Compute Receipts (Inflow) and Payments (Outflow) from vouchers
  const receipts: any[] = [];
  const payments: any[] = [];

  safeVouchers.forEach(v => {
    if (v.status === 'Cancelled') return;
    const vDate = v.dateBS || '';

    if (startDateBS && vDate && vDate < startDateBS) {
      return;
    }
    if (endDateBS && vDate && vDate > endDateBS) {
      return;
    }

    v.entries?.forEach((e: any) => {
      const isCashAcc = cashAccounts.some(ca => ca.code === e.accountCode || ca.id === e.accountId);
      if (!isCashAcc) {
        if (e.credit > 0) {
          receipts.push({
            id: `${v.id}-${e.accountCode}`,
            voucherNo: v.voucherNo,
            dateBS: v.dateBS,
            head: e.accountName || e.accountCode,
            type: e.type || 'Inflow',
            amount: e.credit
          });
        }
        if (e.debit > 0) {
          payments.push({
            id: `${v.id}-${e.accountCode}`,
            voucherNo: v.voucherNo,
            dateBS: v.dateBS,
            head: e.accountName || e.accountCode,
            type: e.type || 'Outflow',
            amount: e.debit
          });
        }
      }
    });
  });

  const totalInflow = receipts.reduce((acc, r) => acc + r.amount, 0);
  const totalOutflow = payments.reduce((acc, p) => acc + p.amount, 0);
  const netCashFlow = totalInflow - totalOutflow;

  // Current cash balance from COA (authoritative)
  const closingCash = cashAccounts.reduce((acc, c) => acc + (c.balance || 0), 0);
  // Opening = closing - net flow during period
  const openingCash = closingCash - netCashFlow;

  const filteredReceipts = receipts.filter(r => 
    !searchQuery.trim() || r.head.toLowerCase().includes(searchQuery.toLowerCase()) || r.voucherNo?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPayments = payments.filter(p => 
    !searchQuery.trim() || p.head.toLowerCase().includes(searchQuery.toLowerCase()) || p.voucherNo?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // PDF Export (Enhanced)
  const handleExportPdf = () => {
    exportCashFlowPdf(
      `Cash_Flow_${startDateBS}_to_${endDateBS}`,
      '', '',
      startDateBS || '', endDateBS || '',
      filteredReceipts.map(r => ({ voucherNo: r.voucherNo, dateBs: r.dateBS, particulars: r.head, amount: r.amount })),
      totalInflow,
      filteredPayments.map(p => ({ voucherNo: p.voucherNo, dateBs: p.dateBS, particulars: p.head, amount: p.amount })),
      totalOutflow,
      closingCash,
    );
  };

  // Excel Export
  const handleExportExcel = () => {
    const headers = ['Voucher No', 'Date (BS)', 'Particulars', 'Category', 'Receipt Amount (NPR)', 'Payment Amount (NPR)'];
    const rows: (string | number)[][] = [];

    filteredReceipts.forEach(r => {
      rows.push([r.voucherNo, r.dateBS, r.head, 'Receipt', r.amount, 0]);
    });

    filteredPayments.forEach(p => {
      rows.push([p.voucherNo, p.dateBS, p.head, 'Payment', 0, p.amount]);
    });

    rows.push(['SUMMARY', 'Final Summary', 'Cash Position', 'SUMMARY', totalInflow, totalOutflow]);

    exportToExcel(
      'Cash_Flow_Receipts_and_Payments_Report',
      'Cash_Flow',
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
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <span>नगद प्रवाह तथा प्राप्ति-भुक्तानी हिसाब (Cash Flow & Receipts/Payments)</span>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                Cash Flow
              </span>
            </h2>
            <p className="text-slate-500 text-xs">
              Statement of cash receipts, disbursements, bank liquidity reserves, and net operating cash flow.
            </p>
          </div>
        </div>

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

      {/* Date Range & Presets */}
      {isExpanded && (
        <div className="bg-emerald-950/5 border border-emerald-200/80 p-4 rounded-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-100/80 rounded-lg text-emerald-800">
                <CalendarDays className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 text-xs">
                नगद प्रवाह मिति दायरा (Cash Flow Filter Range): {startDateBS || 'प्रारम्भ देखि'} ~ {endDateBS || 'अन्तिम सम्म'}
              </h3>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-600 mr-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Presets:</span>
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
            </div>

            <div className="flex items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-lg">
              <span className="text-[11px] font-bold text-slate-600 pl-1">देखि:</span>
              <input
                type="text"
                value={startDateBS}
                onChange={(e) => setStartDateBS(e.target.value)}
                className="w-24 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-900 font-mono font-bold"
              />
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[11px] font-bold text-slate-600">सम्म:</span>
              <input
                type="text"
                value={endDateBS}
                onChange={(e) => setEndDateBS(e.target.value)}
                className="w-24 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-900 font-mono font-bold"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tables Grid */}
      {isExpanded && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Receipts */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="bg-emerald-800 text-white p-3 font-bold text-xs flex justify-between items-center">
              <span className="flex items-center gap-1.5">
                <ArrowUpRight className="w-4 h-4 text-emerald-300" />
                <span>नगद प्राप्तिहरू (Cash Receipts / Inflows)</span>
              </span>
              <span className="font-mono text-emerald-200">{filteredReceipts.length} Entries</span>
            </div>
            <div className="overflow-x-auto max-h-[350px]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px] uppercase tracking-wider border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-2.5">Voucher & Date</th>
                    <th className="p-2.5">Particulars / Account</th>
                    <th className="p-2.5 text-right">Amount (NPR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filteredReceipts.map(r => (
                    <tr key={r.id} className="hover:bg-emerald-50/40 transition-colors">
                      <td className="p-2.5">
                        <span className="font-mono font-bold text-slate-800">{r.voucherNo}</span>
                        <div className="text-[10px] text-slate-500 font-mono">{r.dateBS}</div>
                      </td>
                      <td className="p-2.5 font-semibold text-slate-900">{r.head}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                        {formatNPR(r.amount)}
                      </td>
                    </tr>
                  ))}
                  {filteredReceipts.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-4 text-center italic text-slate-500">
                        No cash receipts recorded in this period
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-emerald-950 text-slate-800 font-extrabold border-t border-emerald-800">
                  <tr>
                    <td colSpan={2} className="p-3 text-left">कुल प्राप्ति (TOTAL CASH RECEIPTS)</td>
                    <td className="p-3 text-right font-mono text-emerald-300 font-bold text-sm">{formatNPR(totalInflow)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Payments */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="bg-rose-800 text-white p-3 font-bold text-xs flex justify-between items-center">
              <span className="flex items-center gap-1.5">
                <ArrowDownRight className="w-4 h-4 text-rose-300" />
                <span>नगद भुक्तानीहरू (Cash Payments / Outflows)</span>
              </span>
              <span className="font-mono text-rose-200">{filteredPayments.length} Entries</span>
            </div>
            <div className="overflow-x-auto max-h-[350px]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-semibold text-[11px] uppercase tracking-wider border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-2.5">Voucher & Date</th>
                    <th className="p-2.5">Particulars / Account</th>
                    <th className="p-2.5 text-right">Amount (NPR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filteredPayments.map(p => (
                    <tr key={p.id} className="hover:bg-rose-50/40 transition-colors">
                      <td className="p-2.5">
                        <span className="font-mono font-bold text-slate-800">{p.voucherNo}</span>
                        <div className="text-[10px] text-slate-500 font-mono">{p.dateBS}</div>
                      </td>
                      <td className="p-2.5 font-semibold text-slate-900">{p.head}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-rose-700">
                        {formatNPR(p.amount)}
                      </td>
                    </tr>
                  ))}
                  {filteredPayments.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-4 text-center italic text-slate-500">
                        No cash disbursements recorded in this period
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-rose-950 text-slate-800 font-extrabold border-t border-rose-800">
                  <tr>
                    <td colSpan={2} className="p-3 text-left">कुल भुक्तानी (TOTAL CASH PAYMENTS)</td>
                    <td className="p-3 text-right font-mono text-rose-300 font-bold text-sm">{formatNPR(totalOutflow)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Summary Bar */}
      {isExpanded && (
        <div className="p-4 bg-white text-slate-800 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
          <div>
            <div className="font-extrabold text-xs uppercase tracking-wider text-emerald-400">
              अन्तिम नगद तथा बैंक मौज्दात (CLOSING CASH & BANK BALANCE)
            </div>
            <p className="text-[11px] text-slate-500">
              Opening Balance ({formatNPR(openingCash)}) + Net Cash Movement ({formatNPR(netCashFlow)})
            </p>
          </div>
          <div className="text-right font-mono text-2xl font-black text-emerald-400">
            {formatNPR(closingCash)}
          </div>
        </div>
      )}

      {/* D3.js Chart */}
      {isExpanded && (
        <div className="pt-2">
          <CashFlowD3Chart
            totalInflow={totalInflow}
            totalOutflow={totalOutflow}
            netCashFlow={netCashFlow}
            openingCash={openingCash}
            closingCash={closingCash}
          />
        </div>
      )}

    </div>
  );
};
