import React, { useState, useEffect } from 'react';
import { BookOpen, Download, FileSpreadsheet, Printer, Loader2, RefreshCw, Filter, Search } from 'lucide-react';
import { formatNPR } from '../../../utils/nepaliCalendar';
import { exportToPdf, exportToExcel } from '../../../utils/exportUtils';
import { fetchShareAccountDetail, fetchShareMembers, type ShareAccountDetail, type ShareMemberOption } from '../../../api/shares';

export const ShareLedgerReport: React.FC = () => {
  const [members, setMembers] = useState<ShareMemberOption[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [detail, setDetail] = useState<ShareAccountDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadMembers = async () => {
      try {
        setMembersLoading(true);
        const result = await fetchShareMembers();
        setMembers(result);
      } catch { } finally {
        setMembersLoading(false);
      }
    };
    loadMembers();
  }, []);

  const loadDetail = async (memberId: string) => {
    if (!memberId) { setDetail(null); return; }
    try {
      setLoading(true);
      setError(null);
      const result = await fetchShareAccountDetail(memberId);
      setDetail(result);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (selectedMemberId) loadDetail(selectedMemberId); }, [selectedMemberId]);

  const filteredMembers = members.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.fullName.toLowerCase().includes(q) || m.memberNo.toLowerCase().includes(q);
  });

  const handlePrint = () => window.print();

  const handleExportPdf = () => {
    if (!detail) return;
    const headers = ['Date (BS)', 'Voucher No', 'Type', 'Shares', 'Face Value', 'Debit', 'Credit', 'Balance'];
    const rows = detail.history.map(h => [h.transactionDateBs, h.voucherNo, h.transactionType, h.shareQuantity, h.faceValue, h.debitAmount, h.creditAmount, h.balanceAmount]);
    exportToPdf(`Share_Ledger_${detail.account.memberNo}`, 'Share Ledger Report', `${detail.account.memberName} (${detail.account.memberNo}) | Total: ${detail.account.totalShares} shares`, headers, rows);
  };

  const handleExportExcel = () => {
    if (!detail) return;
    const headers = ['Date (BS)', 'Voucher No', 'Type', 'Shares', 'Face Value', 'Debit', 'Credit', 'Balance'];
    const rows = detail.history.map(h => [h.transactionDateBs, h.voucherNo, h.transactionType, h.shareQuantity, h.faceValue, h.debitAmount, h.creditAmount, h.balanceAmount]);
    exportToExcel(`Share_Ledger_${detail.account.memberNo}`, 'Share_Ledger', headers, rows);
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Share Ledger Report</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <BookOpen className="w-3.5 h-3.5 text-slate-500" />
            Individual member share account ledger with transaction history and kitta ranges
          </p>
        </div>
        <div className="flex items-center gap-2">
          {detail && (
            <>
              <button onClick={handlePrint} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs"><Printer className="w-3.5 h-3.5" />Print</button>
              <button onClick={handleExportPdf} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><Download className="w-3.5 h-3.5" />PDF</button>
              <button onClick={handleExportExcel} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</button>
            </>
          )}
        </div>
      </div>

      {/* Member Selector */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Search className="w-4 h-4 text-slate-500 shrink-0" />
        <input type="text" placeholder="Search member..." value={search} onChange={e => { setSearch(e.target.value); }}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-w-[200px] flex-1" />
        <select value={selectedMemberId} onChange={e => setSelectedMemberId(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-w-[250px]">
          <option value="">-- Select Member --</option>
          {filteredMembers.map(m => (
            <option key={m.id} value={m.id}>{m.fullName} ({m.memberNo}) — {m.totalShares} shares</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /><span className="ml-2 text-sm text-slate-500">Loading Share Ledger…</span></div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
      ) : detail ? (
        <>
          {/* Account Info */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
              <div><span className="text-slate-500 font-semibold">Account No</span><p className="font-bold text-slate-900 font-mono">{detail.account.accountNo}</p></div>
              <div><span className="text-slate-500 font-semibold">Member</span><p className="font-bold text-slate-900">{detail.account.memberName}</p></div>
              <div><span className="text-slate-500 font-semibold">Member No</span><p className="font-bold text-slate-900 font-mono">{detail.account.memberNo}</p></div>
              <div><span className="text-slate-500 font-semibold">Total Shares</span><p className="font-bold text-sky-700">{detail.account.totalShares}</p></div>
              <div><span className="text-slate-500 font-semibold">Total Capital</span><p className="font-bold text-emerald-700">{formatNPR(detail.account.totalCapital)}</p></div>
            </div>
          </div>

          {/* Certificate Register */}
          {detail.panels.certificateRegister.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
                <h2 className="font-bold text-slate-900 text-sm">Certificate / Kitta Register</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
                    <tr>
                      <th className="p-3">Share Type</th>
                      <th className="p-3">Kitta Range</th>
                      <th className="p-3 text-right">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {detail.panels.certificateRegister.map((cr, i) => (
                      <tr key={i} className="hover:bg-slate-50/80">
                        <td className="p-3 font-bold">{cr.shareTypeName || '-'}</td>
                        <td className="p-3 font-mono">{cr.formattedRange}</td>
                        <td className="p-3 text-right font-mono font-semibold text-sky-700">{cr.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Transaction History */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
              <h2 className="font-bold text-slate-900 text-sm">Transaction History ({detail.history.length} entries)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Date (BS)</th>
                    <th className="p-3">Voucher No</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Share Type</th>
                    <th className="p-3 text-right">Shares</th>
                    <th className="p-3 text-right">Face Value</th>
                    <th className="p-3 text-right">Debit</th>
                    <th className="p-3 text-right">Credit</th>
                    <th className="p-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {detail.history.map((h, idx) => (
                    <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-mono text-slate-500">{h.transactionDateBs}</td>
                      <td className="p-3 font-mono text-slate-500">{h.voucherNo}</td>
                      <td className="p-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${h.transactionType === 'Purchase' ? 'bg-emerald-100 text-emerald-800' : h.transactionType === 'Return' ? 'bg-rose-100 text-rose-800' : 'bg-sky-100 text-sky-800'}`}>
                          {h.transactionType}
                        </span>
                      </td>
                      <td className="p-3">{h.shareTypeName || '-'}</td>
                      <td className="p-3 text-right font-mono font-semibold text-sky-700">{h.shareQuantity}</td>
                      <td className="p-3 text-right font-mono text-slate-600">{formatNPR(h.faceValue)}</td>
                      <td className="p-3 text-right font-mono text-emerald-700">{h.debitAmount > 0 ? formatNPR(h.debitAmount) : '-'}</td>
                      <td className="p-3 text-right font-mono text-rose-700">{h.creditAmount > 0 ? formatNPR(h.creditAmount) : '-'}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">{formatNPR(h.balanceAmount)}</td>
                    </tr>
                  ))}
                  {detail.history.length === 0 && <tr><td colSpan={10} className="p-8 text-center text-slate-400">No transactions found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center text-slate-400">
          Select a member from the dropdown above to view their share ledger.
        </div>
      )}
    </div>
  );
};
