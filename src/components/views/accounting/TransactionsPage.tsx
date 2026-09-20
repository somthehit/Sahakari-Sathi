import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useCoop } from '../../../context/CoopContext';
import { fetchVouchers } from '../../../api/accounting';
import {
  ArrowRightLeft,
  CreditCard,
  Wallet,
  Landmark,
  RefreshCw,
  Search,
  TrendingUp,
  TrendingDown,
  Banknote,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Printer,
  Download,
} from 'lucide-react';

/* ─── Types ─── */
interface VoucherRow {
  id: string;
  voucherNo: string;
  voucherType: string;
  dateBs: string;
  dateAd: string;
  status: string;
  totalAmount: string;
  narration: string;
  preparedBy: string;
  approvedBy: string | null;
}

interface QuickLinkConfig {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

/* ─── Quick Link Definitions ─── */
const QUICK_LINKS: QuickLinkConfig[] = [
  {
    key: 'share_issue',
    label: 'Issue Share',
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    description: 'Issue new share certificates to a member',
  },
  {
    key: 'share_return',
    label: 'Return Share',
    icon: <TrendingDown className="w-5 h-5" />,
    color: 'text-rose-700',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    description: 'Surrender / return existing shares',
  },
  {
    key: 'deposit',
    label: 'Deposit',
    icon: <Wallet className="w-5 h-5" />,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'Cash or bank deposit to savings',
  },
  {
    key: 'withdraw',
    label: 'Withdraw',
    icon: <Banknote className="w-5 h-5" />,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    description: 'Teller cash withdrawal for member',
  },
  {
    key: 'loan_repayment',
    label: 'Loan Repayment',
    icon: <Landmark className="w-5 h-5" />,
    color: 'text-violet-700',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    description: 'Repay loan principal + interest',
  },
  {
    key: 'manual_voucher',
    label: 'Manual Voucher',
    icon: <FileText className="w-5 h-5" />,
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    description: 'Post a manual journal / payment / receipt',
  },
];

/* ─── Main Component ─── */
export const TransactionsPage: React.FC = () => {
  const { openTab } = useCoop();
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchVouchers({ limit: 200 });
      setVouchers(result.data || []);
    } catch (err: any) {
      console.error('Failed to load vouchers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleQuickLinkClick = (key: string) => {
    if (key === 'manual_voucher') {
      openTab('accounts_gl', 'New Journal Voucher', 'FileText');
    } else if (key === 'share_issue' || key === 'share_return') {
      openTab('shares_issue', 'Share Issue & Transfer', 'TrendingUp');
    } else if (key === 'deposit') {
      openTab('savings_deposit', 'Savings Deposit', 'Wallet');
    } else if (key === 'withdraw') {
      openTab('savings_withdraw', 'Teller Withdrawal', 'Banknote');
    } else if (key === 'loan_repayment') {
      openTab('loan_accounts_deposit', 'Loan Repayment', 'Landmark');
    }
  };

  const filteredVouchers = vouchers.filter(v => {
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      if (!v.voucherNo?.toLowerCase().includes(s) && !v.narration?.toLowerCase().includes(s) && !v.preparedBy?.toLowerCase().includes(s)) return false;
    }
    if (filterType !== 'all' && v.voucherType !== filterType) return false;
    if (filterStatus !== 'all' && v.status !== filterStatus) return false;
    if (filterDateFrom && v.dateBs < filterDateFrom) return false;
    if (filterDateTo && v.dateBs > filterDateTo) return false;
    return true;
  });

  const totalAmount = filteredVouchers.reduce((s, v) => s + (parseFloat(String(v.totalAmount)) || 0), 0);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Transactions Report</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 20px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        h2 { font-size: 13px; color: #64748b; font-weight: normal; margin-bottom: 16px; }
        .summary { display: flex; gap: 24px; margin-bottom: 16px; }
        .summary-card { border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px; }
        .summary-card .label { font-size: 11px; color: #94a3b8; }
        .summary-card .value { font-size: 18px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; font-size: 11px; }
        th { background: #f8fafc; font-weight: 600; }
        td.amount { text-align: right; font-family: monospace; }
        .badge { display: inline-block; padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: 600; }
        .badge-journal { background: #f1f5f9; color: #475569; }
        .badge-payment { background: #ffe4e6; color: #be123c; }
        .badge-receipt { background: #d1fae5; color: #047857; }
        .badge-contra { background: #dbeafe; color: #1d4ed8; }
        .badge-posted { color: #047857; }
        .badge-draft { color: #d97706; }
        .badge-cancelled { color: #dc2626; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>Sahakari Sathi — Transactions Report</h1>
      <h2>Generated: ${new Date().toLocaleString()} ${filterDateFrom ? `| From: ${filterDateFrom}` : ''} ${filterDateTo ? `| To: ${filterDateTo}` : ''} ${filterType !== 'all' ? `| Type: ${filterType}` : ''} ${filterStatus !== 'all' ? `| Status: ${filterStatus}` : ''}</h2>
      <div class="summary">
        <div class="summary-card"><div class="label">Transactions</div><div class="value">${filteredVouchers.length}</div></div>
        <div class="summary-card"><div class="label">Total Amount</div><div class="value">रु.${totalAmount.toLocaleString()}</div></div>
        <div class="summary-card"><div class="label">Posted</div><div class="value badge-posted">${filteredVouchers.filter(v => v.status === 'Posted').length}</div></div>
        <div class="summary-card"><div class="label">Draft/Cancelled</div><div class="value badge-draft">${filteredVouchers.filter(v => v.status !== 'Posted').length}</div></div>
      </div>
      <table>
        <thead><tr><th>Voucher No</th><th>Type</th><th>Date (BS)</th><th>Status</th><th style="text-align:right">Amount</th><th>Narration</th><th>Prepared By</th></tr></thead>
        <tbody>
          ${filteredVouchers.map(v => `<tr>
            <td>${v.voucherNo}</td>
            <td><span class="badge badge-${v.voucherType.toLowerCase()}">${v.voucherType}</span></td>
            <td>${v.dateBs}</td>
            <td><span class="badge badge-${v.status.toLowerCase()}">${v.status}</span></td>
            <td class="amount">रु.${parseFloat(String(v.totalAmount)).toLocaleString()}</td>
            <td>${v.narration || ''}</td>
            <td>${v.preparedBy}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <script>window.onload=function(){window.print();}</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  const handleExportCSV = () => {
    const headers = ['Voucher No', 'Type', 'Date (BS)', 'Date (AD)', 'Status', 'Amount', 'Narration', 'Prepared By', 'Approved By'];
    const rows = filteredVouchers.map(v => [
      v.voucherNo,
      v.voucherType,
      v.dateBs,
      v.dateAd,
      v.status,
      String(v.totalAmount),
      `"${(v.narration || '').replace(/"/g, '""')}"`,
      v.preparedBy,
      v.approvedBy || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transactions_${filterDateFrom || 'all'}_${filterDateTo || 'all'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const statusIcon = (status: string) => {
    if (status === 'Posted') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
    if (status === 'Cancelled') return <XCircle className="w-3.5 h-3.5 text-red-500" />;
    return <Clock className="w-3.5 h-3.5 text-amber-500" />;
  };

  const typeColor = (t: string) => {
    if (t === 'Payment') return 'bg-rose-100 text-rose-700';
    if (t === 'Receipt') return 'bg-emerald-100 text-emerald-700';
    if (t === 'Contra') return 'bg-blue-100 text-blue-700';
    return 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="bg-slate-50/50 p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-emerald-600" />
            Transactions & Quick Links
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">All vouchers and one-click actions</p>
        </div>
        <button onClick={loadData} disabled={loading}
          className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition flex items-center gap-2 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-emerald-600" />
          Quick Links
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {QUICK_LINKS.map(link => (
            <button key={link.key} onClick={() => handleQuickLinkClick(link.key)}
              className={`group flex flex-col items-center gap-2 p-4 rounded-xl border ${link.borderColor} ${link.bgColor} hover:shadow-md transition cursor-pointer`}>
              <div className={`p-2 rounded-lg bg-white shadow-sm ${link.color} group-hover:scale-110 transition`}>
                {link.icon}
              </div>
              <span className={`text-xs font-semibold ${link.color}`}>{link.label}</span>
              <span className="text-[10px] text-slate-500 text-center leading-tight">{link.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search voucher number, narration, prepared by..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
              placeholder="From BS date"
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white w-[150px]" />
            <span className="text-slate-400 text-xs">to</span>
            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
              placeholder="To BS date"
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white w-[150px]" />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white">
            <option value="all">All Types</option>
            <option value="Journal">Journal</option>
            <option value="Payment">Payment</option>
            <option value="Receipt">Receipt</option>
            <option value="Contra">Contra</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white">
            <option value="all">All Status</option>
            <option value="Posted">Posted</option>
            <option value="Draft">Draft</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <button onClick={handlePrint}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition flex items-center gap-1.5">
            <Printer className="w-4 h-4 text-slate-600" />
            Print
          </button>
          <button onClick={handleExportCSV}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition flex items-center gap-1.5">
            <Download className="w-4 h-4 text-slate-600" />
            Export CSV
          </button>
          {(filterDateFrom || filterDateTo || filterType !== 'all' || filterStatus !== 'all' || searchTerm) && (
            <button onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); setFilterType('all'); setFilterStatus('all'); setSearchTerm(''); }}
              className="px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-xl transition">
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Total Transactions</div>
          <div className="text-2xl font-bold text-slate-800">{filteredVouchers.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Total Amount</div>
          <div className="text-2xl font-bold text-emerald-600">रु.{totalAmount.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Posted</div>
          <div className="text-2xl font-bold text-emerald-600">{filteredVouchers.filter(v => v.status === 'Posted').length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500">Draft / Cancelled</div>
          <div className="text-2xl font-bold text-amber-600">{filteredVouchers.filter(v => v.status !== 'Posted').length}</div>
        </div>
      </div>

      {/* Voucher Table */}
      <div ref={printRef} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            All Transactions ({filteredVouchers.length})
          </h3>
        </div>
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading...
          </div>
        ) : filteredVouchers.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p>No transactions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs">
                  <th className="text-left px-5 py-3 font-semibold">Voucher No</th>
                  <th className="text-left px-5 py-3 font-semibold">Type</th>
                  <th className="text-left px-5 py-3 font-semibold">Date (BS)</th>
                  <th className="text-left px-5 py-3 font-semibold">Status</th>
                  <th className="text-right px-5 py-3 font-semibold">Amount</th>
                  <th className="text-left px-5 py-3 font-semibold">Narration</th>
                  <th className="text-left px-5 py-3 font-semibold">Prepared By</th>
                </tr>
              </thead>
              <tbody>
                {filteredVouchers.map(v => (
                  <tr key={v.id} className="border-t border-slate-100 hover:bg-slate-50/50 transition">
                    <td className="px-5 py-3 font-mono font-semibold text-slate-800">{v.voucherNo}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${typeColor(v.voucherType)}`}>
                        {v.voucherType}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{v.dateBs}</td>
                    <td className="px-5 py-3 flex items-center gap-1.5">
                      {statusIcon(v.status)}
                      <span className="text-xs font-medium">{v.status}</span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-semibold text-slate-800">रु.{parseFloat(String(v.totalAmount)).toLocaleString()}</td>
                    <td className="px-5 py-3 text-slate-600 max-w-xs truncate" title={v.narration}>{v.narration}</td>
                    <td className="px-5 py-3 text-slate-500">{v.preparedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
