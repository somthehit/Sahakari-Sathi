import React, { useState, useEffect } from 'react';
import { FileText, Loader2, RefreshCw, Printer, FileSpreadsheet, CalendarDays, Gavel, BookOpen } from 'lucide-react';
import { fetchAgmMinutes, type AgmMinutesResponse } from '../../../api/agmGovernance';
import { exportToPdf, exportToExcel } from '../../../utils/exportUtils';

export const AgmMinutesPage: React.FC = () => {
  const [data, setData] = useState<AgmMinutesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try { setLoading(true); setError(null); setData(await fetchAgmMinutes()); }
    catch (e: any) { setError(e.response?.data?.error || e.message || 'Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handlePdf = () => {
    if (!data) return;
    const headers = ['#', 'Agenda Item', 'Description'];
    const rows = data.agendaItems.map(a => [a.item, a.title, a.description || '']);
    if (data.resolutions?.length) {
      rows.push(['', '', ''], ['RESOLUTIONS', '', '']);
      data.resolutions.forEach(r => rows.push([r.resolutionNo, r.title, r.status]));
    }
    exportToPdf('AGM_Resolution_Minutes', `${data.organization.name} — AGM Resolution & Minutes`, `FY: ${data.fiscalYear?.code || 'N/A'}`, headers, rows);
  };

  const handleExcel = () => {
    if (!data) return;
    const headers = ['#', 'Title', 'Description'];
    const rows = data.agendaItems.map(a => [a.item, a.title, a.description || '']);
    exportToExcel('AGM_Minutes', 'AGM_Resolution_Minutes', headers, rows);
  };

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /><span className="ml-2 text-sm text-slate-500">Loading…</span></div>;
  if (error) return <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>;
  if (!data) return null;

  const statusColor = (s: string) => {
    const m: Record<string, string> = { Scheduled: 'bg-sky-100 text-sky-700', Completed: 'bg-emerald-100 text-emerald-700', In_Progress: 'bg-amber-100 text-amber-700', Approved: 'bg-emerald-100 text-emerald-700', Rejected: 'bg-red-100 text-red-700', Deferred: 'bg-amber-100 text-amber-700', Proposed: 'bg-sky-100 text-sky-700' };
    return m[s] || 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">AGM Resolution & Minutes Summary</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            Agenda Items, Resolutions & Meeting Minutes
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
          <h2 className="font-bold text-emerald-900 text-sm mb-3 flex items-center gap-2"><CalendarDays className="w-4 h-4" />Meeting Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <div><span className="text-emerald-700 font-semibold">Title</span><p className="font-bold text-emerald-900">{data.agmMeeting.title}</p></div>
            <div><span className="text-emerald-700 font-semibold">Date (BS)</span><p className="font-bold text-emerald-900">{data.agmMeeting.date}</p></div>
            <div><span className="text-emerald-700 font-semibold">Time</span><p className="font-bold text-emerald-900">{data.agmMeeting.startTime || ''}{data.agmMeeting.endTime ? ` — ${data.agmMeeting.endTime}` : ''}</p></div>
            <div><span className="text-emerald-700 font-semibold">Venue</span><p className="font-bold text-emerald-900">{data.agmMeeting.venue || 'N/A'}</p></div>
            <div><span className="text-emerald-700 font-semibold">Chaired By</span><p className="font-bold text-emerald-900">{data.agmMeeting.chairedBy || 'N/A'}</p></div>
          </div>
        </div>
      )}

      {/* Board of Directors */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="font-bold text-slate-900 text-sm mb-3">Board of Directors (सञ्चालक समिति)</h2>
        {data.boardOfDirectors.length === 0 ? (
          <p className="text-slate-500 text-center py-4">No board members found.</p>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-emerald-50 text-emerald-800 border-b border-emerald-200 text-[11px] font-semibold">
                <tr><th className="p-3">Name</th><th className="p-3">Designation</th><th className="p-3">Department</th><th className="p-3">Phone</th><th className="p-3">Email</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.boardOfDirectors.map((b, i) => (
                  <tr key={i} className="hover:bg-slate-50/80">
                    <td className="p-3 font-bold text-slate-900">{b.name}</td>
                    <td className="p-3 text-slate-700">{b.designation}</td>
                    <td className="p-3 text-slate-600">{b.department || '—'}</td>
                    <td className="p-3 text-slate-600">{b.phone || '—'}</td>
                    <td className="p-3 text-slate-600">{b.email || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Agenda Items */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4" />Agenda Items (कार्यसूची)</h2>
        <div className="space-y-3">
          {data.agendaItems.map((a) => (
            <div key={a.item} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-xs">{a.item}</span>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 text-sm">{a.title}</h3>
                  {a.titleNepali && <p className="text-slate-500 text-[11px] mt-0.5">{a.titleNepali}</p>}
                  {a.description && <p className="text-slate-500 text-[11px] mt-0.5">{a.description}</p>}
                </div>
                {a.type && <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full flex-shrink-0">{a.type}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resolutions */}
      {data.resolutions.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2"><Gavel className="w-4 h-4" />Resolutions (प्रस्तावहरू)</h2>
          <div className="space-y-3">
            {data.resolutions.map((r, idx) => (
              <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-200 rounded-full px-2 py-0.5">#{r.resolutionNo}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(r.status)}`}>{r.status}</span>
                </div>
                <p className="font-bold text-slate-900 text-xs">{r.title}</p>
                {r.titleNepali && <p className="text-slate-500 text-[11px]">{r.titleNepali}</p>}
                {r.description && <p className="text-slate-500 text-[11px] mt-0.5">{r.description}</p>}
                <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-slate-500">
                  {r.proposedBy && <span>Proposed by: <b>{r.proposedBy}</b></span>}
                  {r.secondedBy && <span>Seconded by: <b>{r.secondedBy}</b></span>}
                  {r.decision && <span>Decision: <b className="text-emerald-700">{r.decision}</b></span>}
                  {r.votesFor !== undefined && <span>For: <b className="text-emerald-600">{r.votesFor}</b></span>}
                  {r.votesAgainst !== undefined && <span>Against: <b className="text-red-600">{r.votesAgainst}</b></span>}
                  {r.abstained !== undefined && <span>Abstained: <b>{r.abstained}</b></span>}
                  {r.assignedTo && <span>Assigned to: <b>{r.assignedTo}</b></span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Minutes Summary */}
      {data.minutes.summary && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="font-bold text-slate-900 text-sm mb-3">Meeting Minutes Summary</h2>
          <p className="text-slate-700 text-xs whitespace-pre-wrap">{data.minutes.summary}</p>
          <div className="flex gap-4 mt-3 text-[10px] text-slate-500">
            <span>Total Resolutions: <b>{data.minutes.totalResolutions}</b></span>
            <span>Approved: <b className="text-emerald-600">{data.minutes.approved}</b></span>
            <span>Rejected: <b className="text-red-600">{data.minutes.rejected}</b></span>
            <span>Deferred: <b className="text-amber-600">{data.minutes.deferred}</b></span>
          </div>
        </div>
      )}

      {/* Member Summary */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="font-bold text-slate-900 text-sm mb-3">Member Summary (सदस्य सारांश)</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-600 font-semibold">Total Members</span>
            <span className="font-mono font-bold text-slate-900">{data.memberSummary.totalMembers}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-600 font-semibold">Active Members</span>
            <span className="font-mono font-bold text-emerald-700">{data.memberSummary.activeMembers}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
