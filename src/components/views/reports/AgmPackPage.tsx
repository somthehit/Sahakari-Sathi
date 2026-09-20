import React, { useState, useEffect } from 'react';
import { Award, Download, FileSpreadsheet, Printer, Loader2, RefreshCw, CalendarDays, Users, Gavel, BookOpen } from 'lucide-react';
import { formatNPR } from '../../../utils/nepaliCalendar';
import { exportToPdf, exportToExcel } from '../../../utils/exportUtils';
import { fetchAgmPack, type AgmPackResponse } from '../../../api/agmGovernance';

export const AgmPackPage: React.FC = () => {
  const { activeBranchId } = useCoop();
  const [data, setData] = useState<AgmPackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try { setLoading(true); setError(null); setData(await fetchAgmPack()); }
    catch (e: any) { setError(e.response?.data?.error || e.message || 'Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handlePdf = () => {
    if (!data) return;
    const o = data.overview; const f = data.financials;
    const headers = ['Category', 'Parameter', 'Value'];
    const rows = [
      ['Overview', 'Total Members', o.totalMembers], ['Overview', 'Active Members', o.activeMembers],
      ['Overview', 'Share Capital', formatNPR(o.totalShareCapital)], ['Overview', 'Total Savings', formatNPR(o.totalSavings)],
      ['Overview', 'Loans Disbursed', formatNPR(o.totalLoanDisbursed)], ['Overview', 'Loan Outstanding', formatNPR(o.loanOutstanding)],
      ['Financial', 'Total Assets', formatNPR(f.totalAssets)], ['Financial', 'Total Liabilities', formatNPR(f.totalLiabilities)],
      ['Financial', 'Net Surplus', formatNPR(f.netSurplus)],
      ...(data.resolutions || []).map(r => ['Resolution #'+r.resolutionNo, r.title, r.status]),
    ];
    exportToPdf('AGM_Presentation_Pack', `${data.organization.name} — AGM Presentation Pack`, `FY: ${data.fiscalYear?.code || 'N/A'}`, headers, rows);
  };

  const handleExcel = () => {
    if (!data) return;
    const o = data.overview; const f = data.financials;
    const headers = ['Parameter', 'Value'];
    const rows: (string | number)[][] = [
      ['Total Members', o.totalMembers], ['Active Members', o.activeMembers],
      ['Share Capital', o.totalShareCapital], ['Savings', o.totalSavings],
      ['Assets', f.totalAssets], ['Liabilities', f.totalLiabilities], ['Net Surplus', f.netSurplus],
    ];
    exportToExcel('AGM_Pack', 'AGM_Presentation_Pack', headers, rows);
  };

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /><span className="ml-2 text-sm text-slate-500">Loading…</span></div>;
  if (error) return <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>;
  if (!data) return null;

  const o = data.overview; const f = data.financials;
  const statusColor = (s: string) => {
    const m: Record<string, string> = { Scheduled: 'bg-sky-100 text-sky-700', Completed: 'bg-emerald-100 text-emerald-700', In_Progress: 'bg-amber-100 text-amber-700', Approved: 'bg-emerald-100 text-emerald-700', Rejected: 'bg-red-100 text-red-700', Deferred: 'bg-amber-100 text-amber-700', Proposed: 'bg-sky-100 text-sky-700' };
    return m[s] || 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">AGM Presentation Pack (साधारण सभा प्रस्तुतीकरण)</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <Award className="w-3.5 h-3.5 text-slate-500" />
            Comprehensive Annual Report for Annual General Meeting
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
          <button onClick={handlePdf} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><Printer className="w-3.5 h-3.5" />PDF</button>
          <button onClick={handleExcel} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</button>
        </div>
      </div>

      {/* Org Info */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div><span className="text-slate-500 font-semibold">Cooperative</span><p className="font-bold text-slate-900">{data.organization.name}</p></div>
          <div><span className="text-slate-500 font-semibold">Registration No.</span><p className="font-bold text-slate-900">{data.organization.registrationNo}</p></div>
          <div><span className="text-slate-500 font-semibold">Fiscal Year</span><p className="font-bold text-slate-900">{data.fiscalYear?.code || 'N/A'}</p></div>
          <div><span className="text-slate-500 font-semibold">Period</span><p className="font-bold text-slate-900">{data.fiscalYear?.startDateBs || ''} — {data.fiscalYear?.endDateBs || ''}</p></div>
        </div>
      </div>

      {/* AGM Meeting Info */}
      {data.agmMeeting && (
        <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-200 shadow-sm">
          <h2 className="font-bold text-emerald-900 text-sm mb-3 flex items-center gap-2"><CalendarDays className="w-4 h-4" />AGM Meeting Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <div><span className="text-emerald-700 font-semibold">Title</span><p className="font-bold text-emerald-900">{data.agmMeeting.title}</p></div>
            <div><span className="text-emerald-700 font-semibold">Date (BS)</span><p className="font-bold text-emerald-900">{data.agmMeeting.date}</p></div>
            <div><span className="text-emerald-700 font-semibold">Time</span><p className="font-bold text-emerald-900">{data.agmMeeting.startTime || ''}{data.agmMeeting.endTime ? ` — ${data.agmMeeting.endTime}` : ''}</p></div>
            <div><span className="text-emerald-700 font-semibold">Venue</span><p className="font-bold text-emerald-900">{data.agmMeeting.venue || 'N/A'}</p></div>
            <div><span className="text-emerald-700 font-semibold">Status</span><p><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(data.agmMeeting.status)}`}>{data.agmMeeting.status}</span></p></div>
            <div><span className="text-emerald-700 font-semibold">Chaired By</span><p className="font-bold text-emerald-900">{data.agmMeeting.chairedBy || 'N/A'}</p></div>
            <div><span className="text-emerald-700 font-semibold">Secretary</span><p className="font-bold text-emerald-900">{data.agmMeeting.secretaryName || 'N/A'}</p></div>
          </div>
        </div>
      )}

      {/* Agenda */}
      {data.agendaItems.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4" />Meeting Agenda</h2>
          <div className="space-y-2">
            {data.agendaItems.map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-white bg-emerald-600 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">{item.item}</span>
                <div className="flex-1">
                  <p className="font-bold text-slate-900 text-xs">{item.title}</p>
                  {item.titleNepali && <p className="text-slate-500 text-[11px]">{item.titleNepali}</p>}
                  {item.description && <p className="text-slate-500 text-[11px] mt-0.5">{item.description}</p>}
                </div>
                {item.type && <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full flex-shrink-0">{item.type}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendance */}
      {data.attendance && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2"><Users className="w-4 h-4" />AGM Attendance</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Invited', value: data.attendance.totalInvited, color: 'text-slate-900' },
              { label: 'Present', value: data.attendance.present, color: 'text-emerald-700' },
              { label: 'Absent', value: data.attendance.absent, color: 'text-red-600' },
            ].map((c, i) => (
              <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <p className="text-[10px] font-semibold text-slate-500 uppercase">{c.label}</p>
                <p className={`text-xl font-black ${c.color} mt-1`}>{c.value}</p>
              </div>
            ))}
          </div>
          <div className={`mt-3 p-3 rounded-xl text-xs font-bold ${data.attendance.quorumMet ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {data.attendance.quorumMet ? '✓ Quorum Achieved' : '✗ Quorum Not Achieved'} ({data.attendance.present}/{data.attendance.totalInvited} — {data.attendance.quorumPercentage}% required)
          </div>
        </div>
      )}

      {/* Overview */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="font-bold text-slate-900 text-sm mb-3">Organizational Overview (संगठनात्मक सारांश)</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total Members', value: String(o.totalMembers) },
            { label: 'Active Members', value: String(o.activeMembers) },
            { label: 'Share Capital', value: formatNPR(o.totalShareCapital) },
            { label: 'Total Savings', value: formatNPR(o.totalSavings) },
            { label: 'Loan Outstanding', value: formatNPR(o.loanOutstanding) },
          ].map((c, i) => (
            <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
              <p className="text-[10px] font-semibold text-slate-500 uppercase">{c.label}</p>
              <p className="text-lg font-black text-slate-900 mt-1">{c.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Financial Highlights */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="font-bold text-slate-900 text-sm mb-3">Financial Highlights (वित्तीय सारांश)</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'Total Assets', value: f.totalAssets, color: 'text-emerald-700' },
            { label: 'Total Liabilities', value: f.totalLiabilities, color: 'text-rose-600' },
            { label: 'Total Equity', value: f.totalEquity, color: 'text-sky-700' },
            { label: 'Total Income', value: f.totalIncome, color: 'text-emerald-600' },
            { label: 'Total Expense', value: f.totalExpense, color: 'text-rose-500' },
            { label: 'Net Surplus', value: f.netSurplus, color: f.netSurplus >= 0 ? 'text-emerald-700' : 'text-rose-700' },
          ].map((r, i) => (
            <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-600 font-semibold">{r.label}</span>
              <span className={`font-mono font-bold ${r.color}`}>{formatNPR(r.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Resolutions */}
      {data.resolutions.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2"><Gavel className="w-4 h-4" />AGM Resolutions</h2>
          <div className="space-y-2">
            {data.resolutions.map((r, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-200 rounded-full px-2 py-0.5">#{r.resolutionNo}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(r.status)}`}>{r.status}</span>
                </div>
                <p className="font-bold text-slate-900 text-xs">{r.title}</p>
                {r.titleNepali && <p className="text-slate-500 text-[11px]">{r.titleNepali}</p>}
                {r.description && <p className="text-slate-500 text-[11px] mt-0.5">{r.description}</p>}
                <div className="flex gap-3 mt-1 text-[10px] text-slate-500">
                  {r.proposedBy && <span>Proposed by: <b>{r.proposedBy}</b></span>}
                  {r.secondedBy && <span>Seconded by: <b>{r.secondedBy}</b></span>}
                  {r.decision && <span>Decision: <b>{r.decision}</b></span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loan & Savings */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="font-bold text-slate-900 text-sm mb-3">Loan & Savings Portfolio (कर्जा र बचत पोर्टफोलियो)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Active Loans', value: String(o.activeLoans) },
            { label: 'Loans Disbursed', value: formatNPR(o.totalLoanDisbursed) },
            { label: 'Loan Overdue', value: formatNPR(o.loanOverdue) },
            { label: 'Savings Accounts', value: String(o.savingsAccounts) },
          ].map((c, i) => (
            <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-600 font-semibold">{c.label}</span>
              <span className="font-mono font-bold text-slate-900">{c.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
