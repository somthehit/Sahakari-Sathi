import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, Download, FileSpreadsheet, Printer, Loader2, RefreshCw, Filter } from 'lucide-react';
import { formatNPR } from '../../../utils/nepaliCalendar';
import { exportToPdf, exportToExcel } from '../../../utils/exportUtils';
import { fetchShareTransfers, type ShareTransfer } from '../../../api/shares';

export const ShareTransferReport: React.FC = () => {
  const [data, setData] = useState<ShareTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchShareTransfers({ limit: 500 });
      setData(result);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = data.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (t.fromMemberName || '').toLowerCase().includes(q) ||
      (t.toMemberName || '').toLowerCase().includes(q) ||
      (t.fromMemberNo || '').toLowerCase().includes(q) ||
      (t.toMemberNo || '').toLowerCase().includes(q);
  });

  const stats = {
    totalTransfers: filtered.length,
    totalShares: filtered.reduce((s, t) => s + t.numberOfShares, 0),
    totalAmount: filtered.reduce((s, t) => s + t.totalAmount, 0),
    completed: filtered.filter(t => t.status === 'Completed').length,
  };

  const handlePrint = () => window.print();

  const handleExportPdf = () => {
    const headers = ['Transfer No', 'Date (BS)', 'From Member', 'To Member', 'Share Type', 'Shares', 'Amount (NPR)', 'Status'];
    const rows = filtered.map(t => [t.transferNo, t.dateBs, `${t.fromMemberName} (${t.fromMemberNo})`, `${t.toMemberName} (${t.toMemberNo})`, t.shareTypeName, t.numberOfShares, t.totalAmount, t.status]);
    exportToPdf('Share_Transfer_Report', 'Share Transfer Report', `Total: ${stats.totalTransfers} transfers | ${stats.totalShares} shares`, headers, rows);
  };

  const handleExportExcel = () => {
    const headers = ['Transfer No', 'Date (BS)', 'From', 'To', 'Share Type', 'Shares', 'Amount', 'Status'];
    const rows = filtered.map(t => [t.transferNo, t.dateBs, t.fromMemberName, t.toMemberName, t.shareTypeName, t.numberOfShares, t.totalAmount, t.status]);
    exportToExcel('Share_Transfer_Report', 'Share_Transfers', headers, rows);
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Share Transfer Report</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
            Complete share transfer audit trail — from/to member transfers with status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
          <button onClick={handlePrint} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs"><Printer className="w-3.5 h-3.5" />Print</button>
          <button onClick={handleExportPdf} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><Download className="w-3.5 h-3.5" />PDF</button>
          <button onClick={handleExportExcel} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /><span className="ml-2 text-sm text-slate-500">Loading Share Transfers…</span></div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Transfers', value: String(stats.totalTransfers), color: 'sky' },
              { label: 'Shares Transferred', value: String(stats.totalShares), color: 'violet' },
              { label: 'Total Amount', value: formatNPR(stats.totalAmount), color: 'emerald' },
              { label: 'Completed', value: String(stats.completed), color: 'green' },
            ].map((c, i) => (
              <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{c.label}</p>
                <p className="text-lg font-black text-slate-900 mt-1">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Filter className="w-4 h-4 text-slate-500 shrink-0" />
            <input type="text" placeholder="Search from/to member name or no..." value={search} onChange={e => setSearch(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-w-[200px] flex-1" />
            <span className="text-[10px] text-slate-400 font-semibold">{filtered.length} transfers</span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Transfer No</th>
                    <th className="p-3">Date (BS)</th>
                    <th className="p-3">From Member</th>
                    <th className="p-3">To Member</th>
                    <th className="p-3">Share Type</th>
                    <th className="p-3 text-right">Shares</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filtered.map((t, idx) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono text-slate-500">{t.transferNo}</td>
                      <td className="p-3 font-mono text-slate-500">{t.dateBs}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{t.fromMemberName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{t.fromMemberNo}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{t.toMemberName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{t.toMemberNo}</div>
                      </td>
                      <td className="p-3">{t.shareTypeName}</td>
                      <td className="p-3 text-right font-mono font-semibold text-sky-700">{t.numberOfShares}</td>
                      <td className="p-3 text-right font-mono font-semibold text-emerald-700">{formatNPR(t.totalAmount)}</td>
                      <td className="p-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-slate-400">No share transfers found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
