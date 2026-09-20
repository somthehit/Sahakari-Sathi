import React, { useState, useEffect } from 'react';
import { ClipboardList, Loader2, RefreshCw, Printer, FileSpreadsheet, CalendarDays, Users } from 'lucide-react';
import { exportToPdf, exportToExcel } from '../../../utils/exportUtils';
import { fetchAgmAttendance, type AgmAttendanceResponse } from '../../../api/agmGovernance';

export const AgmAttendancePage: React.FC = () => {
  const [data, setData] = useState<AgmAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try { setLoading(true); setError(null); setData(await fetchAgmAttendance()); }
    catch (e: any) { setError(e.response?.data?.error || e.message || 'Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handlePdf = () => {
    if (!data) return;
    const headers = ['S.N.', 'Member No.', 'Full Name', 'Phone', 'Status', 'Eligible'];
    const rows = data.members.map(m => [m.sno, m.memberNo || '', m.fullName || m.guestName || '', m.phone || '', m.attended ? 'Present' : 'Absent', 'Yes']);
    rows.push(['', '', '', `Quorum: ${data.quorum.quorumRequired} of ${data.quorum.activeMembers} required`, '', '']);
    exportToPdf('AGM_Attendance_Quorum', `${data.organization.name} — AGM Attendance & Quorum`, `FY: ${data.fiscalYear?.code || 'N/A'}`, headers, rows);
  };

  const handleExcel = () => {
    if (!data) return;
    const headers = ['S.N.', 'Member No.', 'Full Name', 'Phone', 'Present', 'Proxy', 'Signature', 'Remarks'];
    const rows = data.members.map(m => [m.sno, m.memberNo || '', m.fullName || m.guestName || '', m.phone || '', m.attended ? 'Yes' : 'No', m.proxyGiven ? 'Yes' : 'No', m.signatureReceived ? 'Yes' : 'No', m.remarks || '']);
    exportToExcel('AGM_Attendance', 'AGM_Attendance_Quorum', headers, rows);
  };

  if (loading) return <div className="flex items-center justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /><span className="ml-2 text-sm text-slate-500">Loading…</span></div>;
  if (error) return <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>;
  if (!data) return null;

  const q = data.quorum;

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">AGM Member Attendance & Quorum Report</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
            Member Attendance List, Quorum Calculation & Eligibility
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

      {/* Quorum Status */}
      <div className={`p-5 rounded-2xl border-2 shadow-sm ${q.quorumMet ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-300'}`}>
        <h2 className="font-bold text-slate-900 text-sm mb-3">Quorum Status (गणसंख्या स्थिति)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
            <p className="text-[10px] font-semibold text-slate-500 uppercase">Total Members</p>
            <p className="text-xl font-black text-slate-900 mt-1">{q.totalMembers}</p>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
            <p className="text-[10px] font-semibold text-slate-500 uppercase">Active Members</p>
            <p className="text-xl font-black text-emerald-700 mt-1">{q.activeMembers}</p>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
            <p className="text-[10px] font-semibold text-slate-500 uppercase">Quorum Required ({q.quorumPercentage}%)</p>
            <p className="text-xl font-black text-amber-700 mt-1">{q.quorumRequired}</p>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
            <p className="text-[10px] font-semibold text-slate-500 uppercase">Status</p>
            <p className={`text-sm font-black mt-2 ${q.quorumMet ? 'text-emerald-700' : 'text-rose-700'}`}>{q.status}</p>
          </div>
        </div>
        {/* Breakdown */}
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
            <p className="text-[10px] font-semibold text-slate-500 uppercase">Present</p>
            <p className="text-lg font-black text-emerald-700 mt-1">{q.present}</p>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
            <p className="text-[10px] font-semibold text-slate-500 uppercase">Proxy</p>
            <p className="text-lg font-black text-amber-700 mt-1">{q.proxy}</p>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
            <p className="text-[10px] font-semibold text-slate-500 uppercase">Guests</p>
            <p className="text-lg font-black text-sky-700 mt-1">{q.guests}</p>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2"><Users className="w-4 h-4" />Member Attendance List (सदस्य उपस्थिति सूची)</h2>
        <p className="text-[11px] text-slate-500 mb-3">{data.attendanceTemplate.note}</p>
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-amber-50 text-amber-800 border-b border-amber-200 text-[11px] font-semibold">
              <tr>
                <th className="p-3">S.N.</th>
                <th className="p-3">Member No.</th>
                <th className="p-3">Full Name</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Role</th>
                <th className="p-3 text-center">Present</th>
                <th className="p-3 text-center">Absent</th>
                <th className="p-3 text-center">Proxy</th>
                <th className="p-3 text-center">Signature</th>
                <th className="p-3">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.members.map((m) => (
                <tr key={m.sno} className="hover:bg-slate-50/80">
                  <td className="p-3 text-slate-400">{m.sno}</td>
                  <td className="p-3 font-mono font-bold text-slate-900">{m.memberNo || '—'}</td>
                  <td className="p-3 font-semibold text-slate-900">{m.fullName || m.guestName || '—'}</td>
                  <td className="p-3 text-slate-600">{m.phone || '—'}</td>
                  <td className="p-3 text-[10px] text-slate-500">
                    {m.isGuest ? <span className="px-2 py-0.5 bg-sky-100 text-sky-700 rounded-full font-bold">Guest{m.guestRole ? `: ${m.guestRole}` : ''}</span> :
                     m.attended ? <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-bold">Member</span> : <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full font-bold">Absent</span>}
                  </td>
                  <td className="p-3 text-center">
                    {m.attended ? <span className="text-emerald-600 text-lg">✓</span> : <div className="w-5 h-5 border-2 border-slate-300 rounded mx-auto print:border-black" />}
                  </td>
                  <td className="p-3 text-center">
                    {!m.attended ? <div className="w-5 h-5 border-2 border-slate-300 rounded mx-auto print:border-black" /> : null}
                  </td>
                  <td className="p-3 text-center">
                    {m.proxyGiven ? <span className="text-amber-600 text-xs">→ {m.proxyTo}</span> : <div className="w-5 h-5 border-2 border-slate-300 rounded mx-auto print:border-black" />}
                  </td>
                  <td className="p-3 text-center">
                    {m.signatureReceived ? <span className="text-emerald-600 text-lg">✓</span> : <div className="w-5 h-5 border-2 border-slate-300 rounded mx-auto print:border-black" />}
                  </td>
                  <td className="p-3 text-[10px] text-slate-500">{m.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
