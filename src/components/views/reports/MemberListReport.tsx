import React, { useState, useMemo } from 'react';
import { useCoop } from '../../../context/CoopContext';
import { Users, Download, FileSpreadsheet, Printer, Filter, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { formatNPR } from '../../../utils/nepaliCalendar';
import { exportToPdf, exportToExcel } from '../../../utils/exportUtils';
import { resolveMediaUrl } from '../../../api/storage';

type GroupBy = 'group' | 'ethnicity' | 'status' | 'age' | 'none';

export const MemberListReport: React.FC = () => {
  const { members } = useCoop();
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive' | 'Terminated'>('All');
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const filteredMembers = useMemo(() => {
    let result = [...members];
    if (statusFilter !== 'All') result = result.filter(m => m.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(m =>
        m.fullName.toLowerCase().includes(q) ||
        m.memberNo.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        (m.groupName || '').toLowerCase().includes(q) ||
        (m.memberCategory || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [members, statusFilter, search]);

  const groupedData = useMemo(() => {
    if (groupBy === 'none') return { 'All Members': filteredMembers };

    const groups: Record<string, typeof filteredMembers> = {};
    filteredMembers.forEach(m => {
      let key = 'Unclassified';
      if (groupBy === 'group') key = m.groupName || 'No Group';
      else if (groupBy === 'ethnicity') key = m.memberCategory || 'General';
      else if (groupBy === 'status') key = m.status;
      else if (groupBy === 'age') {
        const match = m.dobBS.match(/^(\d{4})/);
        if (match) {
          const bsYear = parseInt(match[1]);
          const approxAge = 2083 - bsYear;
          if (approxAge < 25) key = 'Below 25';
          else if (approxAge < 35) key = '25-34';
          else if (approxAge < 45) key = '35-44';
          else if (approxAge < 55) key = '45-54';
          else key = '55+';
        }
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
    return groups;
  }, [filteredMembers, groupBy]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const stats = useMemo(() => ({
    total: filteredMembers.length,
    active: filteredMembers.filter(m => m.status === 'Active').length,
    totalSavings: filteredMembers.reduce((s, m) => s + m.totalSavingsBalance, 0),
    totalLoans: filteredMembers.reduce((s, m) => s + m.totalLoanBalance, 0),
  }), [filteredMembers]);

  const handlePrint = () => window.print();

  const handleExportPdf = () => {
    const headers = ['Member No', 'Name', 'Group', 'Category', 'Phone', 'Status', 'Savings (NPR)', 'Loan (NPR)'];
    const rows = filteredMembers.map(m => [
      m.memberNo, m.fullName, m.groupName || '-', m.memberCategory || '-', m.phone, m.status,
      m.totalSavingsBalance, m.totalLoanBalance
    ]);
    exportToPdf('Member_List_Report', 'Member List Report', `Total: ${filteredMembers.length} members | Status: ${statusFilter}`, headers, rows);
  };

  const handleExportExcel = () => {
    const headers = ['Member No', 'Name', 'Group', 'Category', 'Phone', 'Status', 'Savings', 'Loan'];
    const rows = filteredMembers.map(m => [
      m.memberNo, m.fullName, m.groupName || '-', m.memberCategory || '-', m.phone, m.status,
      m.totalSavingsBalance, m.totalLoanBalance
    ]);
    exportToExcel('Member_List_Report', 'Member_List', headers, rows);
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Member List Report</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            Group-wise, Ethnicity-wise, Age-wise member listing with active status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs"><Printer className="w-3.5 h-3.5" />Print</button>
          <button onClick={handleExportPdf} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><Download className="w-3.5 h-3.5" />PDF</button>
          <button onClick={handleExportExcel} className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"><FileSpreadsheet className="w-3.5 h-3.5" />Excel</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Members', value: String(stats.total), color: 'emerald' },
          { label: 'Active Members', value: String(stats.active), color: 'sky' },
          { label: 'Total Savings', value: formatNPR(stats.totalSavings), color: 'violet' },
          { label: 'Total Loans', value: formatNPR(stats.totalLoans), color: 'amber' },
        ].map((c, i) => (
          <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{c.label}</p>
            <p className="text-lg font-black text-slate-900 mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Filter className="w-4 h-4 text-slate-500 shrink-0" />
        <div className="flex flex-wrap gap-2 flex-1">
          <input
            type="text"
            placeholder="Search name, member no, phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-w-[200px]"
          />
          <select value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
            <option value="none">No Grouping</option>
            <option value="group">Group Wise</option>
            <option value="ethnicity">Ethnicity / Category Wise</option>
            <option value="age">Age Wise</option>
            <option value="status">Status Wise</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Terminated">Terminated</option>
          </select>
        </div>
        <span className="text-[10px] text-slate-400 font-semibold">{filteredMembers.length} members</span>
      </div>

      {/* Grouped Table */}
      {Object.entries(groupedData).map(([groupKey, groupMembers]) => {
        const isExpanded = groupBy === 'none' || expandedGroups.has(groupKey);
        return (
          <div key={groupKey} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {groupBy !== 'none' && (
              <button onClick={() => toggleGroup(groupKey)}
                className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 hover:bg-slate-100 transition cursor-pointer border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">{groupKey}</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{groupMembers.length}</span>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </button>
            )}
            {isExpanded && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Member No</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Group</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Savings</th>
                      <th className="p-3 text-right">Loan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {groupMembers.map((m, idx) => (
                      <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-mono text-slate-500">{m.memberNo}</td>
                        <td className="p-3 font-bold text-slate-900">{m.fullName}</td>
                        <td className="p-3">{m.groupName || '-'}</td>
                        <td className="p-3">{m.memberCategory || '-'}</td>
                        <td className="p-3 font-mono">{m.phone}</td>
                        <td className="p-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : m.status === 'Inactive' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                            {m.status}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-semibold text-emerald-700">{formatNPR(m.totalSavingsBalance)}</td>
                        <td className="p-3 text-right font-mono font-semibold text-amber-700">{formatNPR(m.totalLoanBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
