import React, { useState, useEffect } from 'react';
import { Users, Loader2, RefreshCw, Printer, FileSpreadsheet, CalendarDays, BookOpen, Gavel, Clock } from 'lucide-react';
import { formatNPR } from '../../../utils/nepaliCalendar';
import { exportToPdf, exportToExcel } from '../../../utils/exportUtils';
import { fetchBoardMeeting, type BoardMeetingResponse } from '../../../api/agmGovernance';

export const BoardMeetingPage: React.FC = () => {
  const [data, setData] = useState<BoardMeetingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try { setLoading(true); setError(null); setData(await fetchBoardMeeting()); }
    catch (e: any) { setError(e.response?.data?.error || e.message || 'Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handlePdf = () => {
    if (!data) return;
    const f = data.financialHighlights; const o = data.operationalHighlights;
    const headers = ['Category', 'Parameter', 'Value'];
    const rows = [
      ['Board', 'Board Members', data.boardMembers.length],
      ['Financial', 'Total Assets', formatNPR(f.totalAssets)], ['Financial', 'Net Surplus', formatNPR(f.netSurplus)],
      ['Operations', 'Total Members', o.totalMembers], ['Operations', 'Active Loans', o.activeLoans],
      ['Operations', 'Loan Outstanding', formatNPR(o.loanOutstanding)],
    ];
    if (data.resolutions?.length) data.resolutions.forEach(r => rows.push(['Resolution', r.title, r.status]));
    exportToPdf('Board_Meeting_Report', `${data.organization.name} — Board Meeting Report`, `FY: ${data.fiscalYear?.code || 'N/A'}`, headers, rows);
  };

  const handleExcel = () => {
    if (!data) return;
    const headers = ['Name', 'Designation', 'Department', 'Phone'];
    const rows = data.boardMembers.map(b => [b.name, b.designation, b.department || '', b.phone || '']);
    exportToExcel('Board_Meeting', 'Board_Meeting_Report', headers, rows);
  };

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /><span className="ml-2 text-sm text-slate-500">Loading…</span></div>;
  if (error) return <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>;
  if (!data) return null;

  const f = data.financialHighlights; const o = data.operationalHighlights;
  const statusColor = (s: string) => {
    const m: Record<string, string> = { Scheduled: 'bg-sky-100 text-sky-700', Completed: 'bg-emerald-100 text-emerald-700', In_Progress: 'bg-amber-100 text-amber-700', Approved: 'bg-emerald-100 text-emerald-700', Rejected: 'bg-red-100 text-red-700', Deferred: 'bg-amber-100 text-amber-700', Proposed: 'bg-sky-100 text-sky-700' };
    return m[s] || 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Board/Committee Meeting Reports (सञ्चालक समिति बैठक)</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            Board Members, Committees, Agenda & Financial Highlights
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

      {/* Current Meeting Info */}
      {data.currentMeeting && (
        <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-200 shadow-sm">
          <h2 className="font-bold text-emerald-900 text-sm mb-3 flex items-center gap-2"><CalendarDays className="w-4 h-4" />Current Meeting Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <div><span className="text-emerald-700 font-semibold">Title</span><p className="font-bold text-emerald-900">{data.currentMeeting.title}</p></div>
            <div><span className="text-emerald-700 font-semibold">Date (BS)</span><p className="font-bold text-emerald-900">{data.currentMeeting.date}</p></div>
            <div><span className="text-emerald-700 font-semibold">Time</span><p className="font-bold text-emerald-900">{data.currentMeeting.startTime || ''}{data.currentMeeting.endTime ? ` — ${data.currentMeeting.endTime}` : ''}</p></div>
            <div><span className="text-emerald-700 font-semibold">Venue</span><p className="font-bold text-emerald-900">{data.currentMeeting.venue || 'N/A'}</p></div>
            <div><span className="text-emerald-700 font-semibold">Status</span><p><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(data.currentMeeting.status)}`}>{data.currentMeeting.status}</span></p></div>
            <div><span className="text-emerald-700 font-semibold">Chaired By</span><p className="font-bold text-emerald-900">{data.currentMeeting.chairedBy || 'N/A'}</p></div>
            <div><span className="text-emerald-700 font-semibold">Secretary</span><p className="font-bold text-emerald-900">{data.currentMeeting.secretaryName || 'N/A'}</p></div>
          </div>
        </div>
      )}

      {/* Agenda Items */}
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
          <h2 className="font-bold text-slate-900 text-sm mb-3">Meeting Attendance</h2>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Invited', value: data.attendance.totalInvited, color: 'text-slate-900' },
              { label: 'Present', value: data.attendance.present, color: 'text-emerald-700' },
              { label: 'Absent', value: data.attendance.absent, color: 'text-red-600' },
              { label: 'Guests', value: data.attendance.guests, color: 'text-sky-700' },
            ].map((c, i) => (
              <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <p className="text-[10px] font-semibold text-slate-500 uppercase">{c.label}</p>
                <p className={`text-xl font-black ${c.color} mt-1`}>{c.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Board Members */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="font-bold text-slate-900 text-sm mb-3">Board of Directors (सञ्चालक समिति)</h2>
        {data.boardMembers.length === 0 ? (
          <p className="text-slate-500 text-center py-4">No board members identified.</p>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-emerald-50 text-emerald-800 border-b border-emerald-200 text-[11px] font-semibold">
                <tr><th className="p-3">Name</th><th className="p-3">Designation</th><th className="p-3">Department</th><th className="p-3">Phone</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.boardMembers.map((b, i) => (
                  <tr key={i} className="hover:bg-slate-50/80">
                    <td className="p-3 font-bold text-slate-900">{b.name}</td>
                    <td className="p-3 text-slate-700">{b.designation}</td>
                    <td className="p-3 text-slate-600">{b.department || '—'}</td>
                    <td className="p-3 text-slate-600">{b.phone || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Committees */}
      {data.committees.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="font-bold text-slate-900 text-sm mb-3">Committee Members (समिति सदस्य)</h2>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-amber-50 text-amber-800 border-b border-amber-200 text-[11px] font-semibold">
                <tr><th className="p-3">Name</th><th className="p-3">Designation</th><th className="p-3">Department</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.committees.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50/80">
                    <td className="p-3 font-bold text-slate-900">{c.name}</td>
                    <td className="p-3 text-slate-700">{c.designation}</td>
                    <td className="p-3 text-slate-600">{c.department || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resolutions */}
      {data.resolutions.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2"><Gavel className="w-4 h-4" />Resolutions from Recent Meetings</h2>
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
                <div className="flex flex-wrap gap-3 mt-1 text-[10px] text-slate-500">
                  {r.proposedBy && <span>Proposed by: <b>{r.proposedBy}</b></span>}
                  {r.secondedBy && <span>Seconded by: <b>{r.secondedBy}</b></span>}
                  {r.decision && <span>Decision: <b className="text-emerald-700">{r.decision}</b></span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Meetings */}
      {data.recentMeetings.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2"><Clock className="w-4 h-4" />Recent Meetings History</h2>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-800 border-b border-slate-200 text-[11px] font-semibold">
                <tr><th className="p-3">Meeting</th><th className="p-3">Type</th><th className="p-3">Date</th><th className="p-3">Venue</th><th className="p-3">Status</th><th className="p-3">Resolutions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recentMeetings.map((m, i) => (
                  <tr key={i} className="hover:bg-slate-50/80">
                    <td className="p-3 font-bold text-slate-900 text-xs">{m.title}</td>
                    <td className="p-3 text-slate-700 text-xs">{m.type}</td>
                    <td className="p-3 text-slate-600 text-xs">{m.date}</td>
                    <td className="p-3 text-slate-600 text-xs">{m.venue || '—'}</td>
                    <td className="p-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(m.status)}`}>{m.status}</span></td>
                    <td className="p-3 text-center font-mono font-bold text-slate-900 text-xs">{m.resolutionsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      {/* Operational Highlights */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="font-bold text-slate-900 text-sm mb-3">Operational Highlights (संचालन सारांश)</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'Total Members', value: String(o.totalMembers) },
            { label: 'Active Loans', value: String(o.activeLoans) },
            { label: 'Loan Outstanding', value: formatNPR(o.loanOutstanding) },
            { label: 'Loan Overdue', value: formatNPR(o.loanOverdue) },
            { label: 'Total Savings', value: formatNPR(o.totalSavings) },
            { label: 'Share Capital', value: formatNPR(o.totalShareCapital) },
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
