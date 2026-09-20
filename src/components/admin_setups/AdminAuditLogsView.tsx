import React, { useState } from 'react';
import { useCoop } from '../../context/CoopContext';
import { ShieldAlert, Activity, DollarSign, AlertTriangle, Lock } from 'lucide-react';
import { AdminSetupSearchFilterBar } from '../common/AdminSetupSearchFilterBar';

interface Props {
  activeSubKey?: string;
}

export const AdminAuditLogsView: React.FC<Props> = ({ activeSubKey = 'admin_audit_trail' }) => {
  const { auditLogs } = useCoop();
  const [subTab, setSubTab] = useState<string>(activeSubKey);
  const [filterModule, setFilterModule] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredLogs = auditLogs.filter(log => {
    const matchesModule = filterModule === 'All' || (log.module || '').toLowerCase() === (filterModule || '').toLowerCase();
    const matchesSearch = (log.details || '').toLowerCase().includes((searchQuery || '').toLowerCase()) || 
                          (log.userName || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
                          (log.action || '').toLowerCase().includes((searchQuery || '').toLowerCase());
    return matchesModule && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Persistent Search & Filter Bar */}
      <AdminSetupSearchFilterBar
        searchTerm={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search audit log details, user name, or action performed..."
        filterGroups={[
          {
            id: 'moduleFilter',
            label: 'Module',
            value: filterModule,
            options: [
              { label: 'All Modules', value: 'All' },
              { label: 'Savings', value: 'Savings' },
              { label: 'Loans', value: 'Loans' },
              { label: 'Accounts', value: 'Accounts' },
              { label: 'Members', value: 'Members' },
              { label: 'Workflow', value: 'Workflow' },
            ],
            onChange: setFilterModule,
          }
        ]}
        quickStats={[
          { label: 'Matching Logs', value: filteredLogs.length, color: 'text-emerald-400' }
        ]}
      />

      {/* AUDIT LOG TABLE */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xl text-xs">
        <table className="w-full text-left border-collapse">
          <thead className="bg-white text-slate-500 font-semibold text-[11px] uppercase border-b border-slate-200">
            <tr>
              <th className="p-3">Timestamp (BS)</th>
              <th className="p-3">User & Role</th>
              <th className="p-3">Module</th>
              <th className="p-3">Action Performed</th>
              <th className="p-3">Audit Log Details</th>
              <th className="p-3 text-right">IP Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 text-slate-700">
            {filteredLogs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-mono text-[10px] text-slate-500">{log.timestampBS}</td>
                <td className="p-3">
                  <div className="font-bold text-slate-800 text-xs">{log.userName}</div>
                  <div className="text-[10px] text-emerald-400">{log.userRole}</div>
                </td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded bg-slate-50 text-slate-600 font-mono text-[10px] font-bold">
                    {log.module}
                  </span>
                </td>
                <td className="p-3 font-bold text-slate-700">{log.action}</td>
                <td className="p-3 text-slate-600">{log.details}</td>
                <td className="p-3 text-right font-mono text-[10px] text-slate-500">{log.ipAddress}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
