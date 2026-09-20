import React, { useState, useEffect } from 'react';
import { BookOpen, Download, FileSpreadsheet, Printer, Loader2, RefreshCw, Filter } from 'lucide-react';
import { formatNPR } from '../../../utils/nepaliCalendar';
import { exportToPdf, exportToExcel } from '../../../utils/exportUtils';
import { fetchShareRegister, type ShareRegisterRow } from '../../../api/shares';

export const ShareRegisterReport: React.FC = () => {
  const [data, setData] = useState<ShareRegisterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchShareRegister({ search: search || undefined, status: statusFilter === 'All' ? undefined : statusFilter });
      setData(result);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const stats = {
    totalMembers: data.length,
    totalShares: data.reduce((s, r) => s + r.totalShares, 0),
    totalCapital: data.reduce((s, r) => s + r.totalCapital, 0),
    avgShares: data.length > 0 ? Math.round(data.reduce((s, r) => s + r.totalShares, 0) / data.length) : 0,
  };

  const handlePrint = () => window.print();

  const handleExportPdf = () => {
    const headers = ['Account No', 'Member No', 'Name', 'Type', 'Total Shares', 'Capital (NPR)', 'Status'];
    const rows = data.map(r => [r.accountNo, r.memberNo, r.memberName, r.membershipType, r.totalShares, r.totalCapital, r.status]);
    exportToPdf('Share_Register', 'Share Register Report', `Total: ${data.length} members | ${stats.totalShares} shares`, headers, rows);
  };

  const handleExportExcel = () => {
    const headers = ['Account No', 'Member No', 'Name', 'Type', 'Total Shares', 'Capital', 'Status'];
    const rows = data.map(r => [r.accountNo, r.memberNo, r.memberName, r.membershipType, r.totalShares, r.totalCapital, r.status]);
    exportToExcel('Share_Register', 'Share_Register', headers, rows);
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Share Register Report</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <BookOpen className="w-3.5 h-3.5 text-slate-500" />
            Complete share register with member holdings, capital invested, and account status
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
        <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /><span className="ml-2 text-sm text-slate-500">Loading Share Register…</span></div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Members', value: String(stats.totalMembers), color: 'emerald' },
              { label: 'Total Shares', value: String(stats.totalShares), color: 'sky' },
              { label: 'Total Capital', value: formatNPR(stats.totalCapital), color: 'violet' },
              { label: 'Avg Shares/Member', value: String(stats.avgShares), color: 'amber' },
            ].map((c, i) => (
              <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{c.label}</p>
                <p className="text-lg font-black text-slate-900 mt-1">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Filter className="w-4 h-4 text-slate-500 shrink-0" />
            <input type="text" placeholder="Search member name or no..." value={search} onChange={e => setSearch(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-w-[200px] flex-1" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <button onClick={load} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs cursor-pointer">Apply</button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Account No</th>
                    <th className="p-3">Member No</th>
                    <th className="p-3">Member Name</th>
                    <th className="p-3">Membership Type</th>
                    <th className="p-3 text-right">Total Shares</th>
                    <th className="p-3 text-right">Capital (NPR)</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {data.map((r, idx) => (
                    <tr key={r.accountId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono text-slate-500">{r.accountNo}</td>
                      <td className="p-3 font-mono text-slate-500">{r.memberNo}</td>
                      <td className="p-3 font-bold text-slate-900">{r.memberName}</td>
                      <td className="p-3">{r.membershipType}</td>
                      <td className="p-3 text-right font-mono font-semibold text-sky-700">{r.totalShares.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono font-semibold text-emerald-700">{formatNPR(r.totalCapital)}</td>
                      <td className="p-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {data.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-400">No share register data found.</td></tr>}
                </tbody>
                {data.length > 0 && (
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900">
                    <tr>
                      <td colSpan={5} className="p-3 text-right">Totals:</td>
                      <td className="p-3 text-right font-mono text-sky-700">{stats.totalShares.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono text-emerald-700">{formatNPR(stats.totalCapital)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
