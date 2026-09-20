import React, { useState } from 'react';
import { useCoop } from '../../context/CoopContext';
import { FileSpreadsheet, ShieldAlert, FileText, Printer, CheckCircle2, Download } from 'lucide-react';
import { formatNPR } from '../../utils/nepaliCalendar';
import { exportToPdf, exportToExcel } from '../../utils/exportUtils';

export const ReportsAuditView: React.FC = () => {
  const { auditLogs } = useCoop();
  const [activeTab, setActiveTab] = useState<'regulatory' | 'audit_logs'>('regulatory');

  const pearlsData = [
    ['P1', 'Protection', 'Loan Loss Allowance / 100% Delinquent Loans', '100%', '102.5%', 'Compliant'],
    ['E1', 'Effective Financial Structure', 'Net Loans / Total Assets', '70% - 80%', '74.2%', 'Compliant'],
    ['E5', 'Savings Deposits', 'Savings Deposits / Total Assets', '70% - 80%', '72.8%', 'Compliant'],
    ['E9', 'Institutional Capital', 'Institutional Capital / Total Assets', 'Min 10%', '11.4%', 'Compliant'],
    ['A1', 'Asset Quality', 'Total Non-Performing Loans / Total Loans', 'Max 5%', '2.1%', 'Compliant'],
    ['R9', 'Operating Expenses', 'Total Operating Expenses / Average Total Assets', 'Max 5%', '3.8%', 'Compliant'],
    ['L1', 'Liquidity', 'Liquid Assets / Total Savings Deposits', 'Min 15%', '18.6%', 'Compliant'],
    ['S11', 'Signs of Growth', 'Total Assets Growth Rate (Annual)', 'Inflation + 5%', '14.2%', 'Compliant'],
  ];

  const pearlsHeaders = ['Code', 'PEARLS Area', 'Key Ratio Indicator', 'Target Standard', 'Actual Current', 'Status'];

  const handleExportPearlsPdf = () => {
    exportToPdf(
      'PEARLS_Statutory_Return_2083',
      'PEARLS Financial Ratio Matrix Return (P1 - S11)',
      'Statutory Compliance Return - Department of Cooperatives, Nepal',
      pearlsHeaders,
      pearlsData
    );
  };

  const handleExportPearlsExcel = () => {
    exportToExcel(
      'PEARLS_Statutory_Return_2083',
      'PEARLS_Ratios',
      pearlsHeaders,
      pearlsData
    );
  };

  const agmData = [
    ['Share Capital', 'NPR 12,500,000', 'NPR 15,800,000', '+26.4%'],
    ['Member Savings', 'NPR 85,200,000', 'NPR 112,400,000', '+31.9%'],
    ['Loan Investment', 'NPR 72,000,000', 'NPR 95,100,000', '+32.1%'],
    ['Reserve Fund', 'NPR 8,500,000', 'NPR 11,200,000', '+31.7%'],
    ['Gross Profit', 'NPR 9,100,000', 'NPR 12,300,000', '+35.1%'],
    ['Proposed Dividend', '12% Share Dividend', '14% Share Dividend', '+2.0%'],
  ];

  const agmHeaders = ['Financial Parameter', 'Previous FY (2081/82)', 'Current FY (2082/83)', 'Growth %'];

  const handleExportAgmPdf = () => {
    exportToPdf(
      'AGM_Financial_Booklet_2083',
      'Annual General Meeting (AGM) Statutory Financial Booklet',
      'Audited Financial Performance & Dividend Distribution Proposal',
      agmHeaders,
      agmData
    );
  };

  const handleExportAgmExcel = () => {
    exportToExcel(
      'AGM_Financial_Booklet_2083',
      'AGM_Financials',
      agmHeaders,
      agmData
    );
  };

  const handleExportAuditPdf = () => {
    const auditHeaders = ['Timestamp (BS)', 'User', 'Role', 'Action Module', 'Log Details', 'IP Address'];
    const auditRows = auditLogs.map(log => [
      `${log.timestampBS} BS`,
      log.userName,
      log.userRole,
      log.action,
      log.details,
      log.ipAddress
    ]);

    exportToPdf(
      'Audit_Trail_Log_2083',
      'Immutable Security & Financial Audit Trail Log',
      `Total Logged Actions: ${auditLogs.length} | System Security Audit Record`,
      auditHeaders,
      auditRows
    );
  };

  const handleExportAuditExcel = () => {
    const auditHeaders = ['Timestamp (BS)', 'User', 'Role', 'Action Module', 'Log Details', 'IP Address'];
    const auditRows = auditLogs.map(log => [
      `${log.timestampBS} BS`,
      log.userName,
      log.userRole,
      log.action,
      log.details,
      log.ipAddress
    ]);

    exportToExcel(
      'Audit_Trail_Log_2083',
      'Audit_Logs',
      auditHeaders,
      auditRows
    );
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Regulatory Reports & Immutable Audit Trail Log</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span>Department of Cooperatives statutory PEARLS return, AGM package, and forensic logs</span>
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
          <button
            onClick={() => setActiveTab('regulatory')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${ activeTab === 'regulatory' ? 'bg-purple-600 text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60' }`}
          >
            Statutory Reports
          </button>
          <button
            onClick={() => setActiveTab('audit_logs')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${ activeTab === 'audit_logs' ? 'bg-purple-600 text-slate-800 shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60' }`}
          >
            Audit Logs ({auditLogs.length})
          </button>
        </div>
      </div>

      {activeTab === 'regulatory' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-900 text-base">Department of Cooperatives Mandatory PEARLS Return Pack</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="font-bold text-slate-900 text-sm">PEARLS Financial Ratio Matrix (P1 to S11)</div>
              <p className="text-slate-600">Evaluates Protection, Effective Financial Structure, Asset Quality, Rates of Return, Liquidity, and Signs of Growth.</p>
              <div className="flex items-center gap-2 pt-2">
                <button 
                  onClick={handleExportPearlsPdf}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-slate-800 font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>Export PDF</span>
                </button>
                <button 
                  onClick={handleExportPearlsExcel}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export Excel</span>
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="font-bold text-slate-900 text-sm">Annual General Meeting (AGM) Financial Booklet</div>
              <p className="text-slate-600">Includes Audited Balance Sheet, Income Statement, Board Report, and Dividend Distribution proposal.</p>
              <div className="flex items-center gap-2 pt-2">
                <button 
                  onClick={handleExportAgmPdf}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-slate-800 font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>Export PDF</span>
                </button>
                <button 
                  onClick={handleExportAgmExcel}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export Excel</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'audit_logs' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h2 className="font-bold text-slate-900 text-base">Immutable Security & Financial Transaction Audit Log</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportAuditPdf}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-slate-800 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Audit PDF</span>
              </button>
              <button
                onClick={handleExportAuditExcel}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Download Audit Excel</span>
              </button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
                <tr>
                  <th className="p-3">Timestamp (BS)</th>
                  <th className="p-3">User & Role</th>
                  <th className="p-3">Action Module</th>
                  <th className="p-3">Log Details</th>
                  <th className="p-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono text-slate-500">{log.timestampBS} BS</td>
                    <td className="p-3 font-bold text-slate-900">{log.userName} ({log.userRole})</td>
                    <td className="p-3">
                      <span className="bg-purple-50 text-purple-700 border border-purple-200 font-mono px-2 py-0.5 rounded">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600">{log.details}</td>
                    <td className="p-3 font-mono text-slate-500">{log.ipAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

