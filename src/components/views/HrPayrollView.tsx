import React, { useEffect, useState } from 'react';
import { UserCheck2 } from 'lucide-react';
import { formatNPR } from '../../utils/nepaliCalendar';
import { fetchStaffList, Staff } from '../../api/staff';

export const HrPayrollView: React.FC = () => {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rows = await fetchStaffList();
        if (active) setStaff(rows);
      } catch {
        // keep empty state; UI surfaces empty-record states
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const totalGrossPayroll = staff.reduce((s, st) => s + Number(st.basicSalary) + Number(st.allowances), 0);

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">HR & Staff Monthly Payroll Processing</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <UserCheck2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Staff master records, 10% Provident Fund deduction, and payslip generation</span>
          </p>
        </div>
      </div>

      {/* Staff Grid */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-base">Co-operative Staff Roster ({staff.length} employees)</h2>
          <span className="font-mono font-bold text-emerald-700 text-sm">Monthly Gross Payroll: {formatNPR(totalGrossPayroll)}</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 font-medium">Loading staff records…</div>
        ) : staff.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-medium">
            No staff records found. Add employees under the Staff directory to process payroll.
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
                <tr>
                  <th className="p-3">Staff Code & Name</th>
                  <th className="p-3">Designation</th>
                  <th className="p-3">Department</th>
                  <th className="p-3 text-right">Basic Salary</th>
                  <th className="p-3 text-right">Allowances</th>
                  <th className="p-3 text-right">PF Deduction (10%)</th>
                  <th className="p-3 text-right">Net Payable (रु.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {staff.map(st => {
                  const basic = Number(st.basicSalary) || 0;
                  const allowances = Number(st.allowances) || 0;
                  const pfPercent = Number(st.pfContributionPercent) || 10;
                  const pf = Math.round(basic * (pfPercent / 100));
                  const net = (basic + allowances) - pf;

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/80">
                      <td className="p-3 font-bold text-slate-900">
                        <span className="font-mono text-cyan-700 mr-2">{st.employeeCode}</span>
                        <span>{st.fullName}</span>
                      </td>
                      <td className="p-3 text-slate-700">{st.designation || '—'}</td>
                      <td className="p-3 text-slate-500">{st.department || '—'}</td>
                      <td className="p-3 text-right font-mono text-slate-900">{formatNPR(basic)}</td>
                      <td className="p-3 text-right font-mono text-slate-600">{formatNPR(allowances)}</td>
                      <td className="p-3 text-right font-mono text-rose-700">{formatNPR(pf)}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-800">{formatNPR(net)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
