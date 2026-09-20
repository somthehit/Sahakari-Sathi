import React, { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown, Check } from 'lucide-react';
import { useCoop } from '../../context/CoopContext';
import { exportToExcel, exportToPdf } from '../../utils/exportUtils';
import { useToast } from '../../context/ToastContext';
import { fetchStaffList } from '../../api/staff';

export const HeaderExportButton: React.FC = () => {
  const { 
    tabs, 
    activeTabId, 
    members, 
    savingsAccounts, 
    loanAccounts, 
    chartOfAccounts, 
    approvalRequests, 
    fixedAssets, 
    auditLogs,
    addNotification 
  } = useCoop();

  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const moduleKey = activeTab ? activeTab.moduleKey : 'home_dashboard';
  const tabTitle = activeTab ? activeTab.title : 'Active Module';

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getExportDataForTab = async () => {
    const key = (moduleKey || '').toLowerCase();

    if (key.includes('member')) {
      const headers = ['Member No', 'Full Name', 'Phone', 'Gender', 'Address', 'Status', 'Savings Balance (NPR)', 'Loan Balance (NPR)'];
      const rows = (members || []).map(m => [
        m.memberNo,
        m.fullName,
        m.phone,
        m.gender,
        m.address,
        m.status,
        m.totalSavingsBalance || 0,
        m.totalLoanBalance || 0
      ]);
      return { filename: `Members_Directory_${Date.now()}`, title: 'Members Directory Report', subtitle: `Total Active Members: ${rows.length}`, headers, rows };
    }

    if (key.includes('saving') || key.includes('deposit')) {
      const headers = ['Account No', 'Member Name', 'Product Name', 'Balance (NPR)', 'Interest Rate (%)', 'Status'];
      const rows = (savingsAccounts || []).map(s => [
        s.accountNo,
        s.memberName,
        s.productName,
        s.balance,
        `${s.interestRate}%`,
        s.status
      ]);
      return { filename: `Savings_Accounts_${Date.now()}`, title: 'Savings Portfolio Report', subtitle: `Total Active Accounts: ${rows.length}`, headers, rows };
    }

    if (key.includes('loan')) {
      const headers = ['Loan No', 'Member Name', 'Product Name', 'Approved Amount (NPR)', 'Outstanding Principal (NPR)', 'Interest Rate (%)', 'Status'];
      const rows = (loanAccounts || []).map(l => [
        l.loanNo,
        l.memberName,
        l.productName,
        l.approvedAmount,
        l.outstandingPrincipal,
        `${l.interestRate}%`,
        l.status
      ]);
      return { filename: `Loan_Portfolio_${Date.now()}`, title: 'Loan Portfolio Report', subtitle: `Total Active Loans: ${rows.length}`, headers, rows };
    }

    if (key.includes('account') || key.includes('voucher') || key.includes('ledger') || key.includes('coa')) {
      const headers = ['Account Code', 'Account Name', 'Type', 'Current Balance (NPR)'];
      const rows = (chartOfAccounts || []).map(c => [
        c.code,
        c.name,
        c.type,
        c.balance
      ]);
      return { filename: `Chart_Of_Accounts_${Date.now()}`, title: 'Chart of Accounts Ledger', subtitle: `Total Ledgers: ${rows.length}`, headers, rows };
    }

    if (key.includes('staff') || key.includes('hr') || key.includes('employee')) {
      const staff = await fetchStaffList();
      const headers = ['Employee Code', 'Name', 'Designation', 'Department', 'Phone', 'Status'];
      const rows = (staff || []).map(s => [
        s.employeeCode,
        s.fullName,
        s.designation,
        s.department,
        s.phone,
        s.status
      ]);
      return { filename: `Staff_Directory_${Date.now()}`, title: 'Staff & HR Directory', subtitle: `Total Employees: ${rows.length}`, headers, rows };
    }

    if (key.includes('approval') || key.includes('workflow')) {
      const headers = ['Reference No', 'Request Type', 'Requested By', 'Requested Date (BS)', 'Status'];
      const rows = (approvalRequests || []).map(r => [
        r.referenceNo,
        r.requestType,
        r.requestedBy,
        r.requestedDateBS,
        r.status
      ]);
      return { filename: `Approval_Requests_${Date.now()}`, title: 'Workflow & Approval Logs', subtitle: `Total Requests: ${rows.length}`, headers, rows };
    }

    if (key.includes('fixed_asset') || key.includes('asset')) {
      const headers = ['Asset Code', 'Asset Name', 'Category', 'Original Cost (NPR)', 'Depreciation Rate (%)', 'Status'];
      const rows = (fixedAssets || []).map(f => [
        f.assetCode,
        f.assetName,
        f.category,
        f.originalCost,
        `${f.depreciationRatePercent}%`,
        f.status
      ]);
      return { filename: `Fixed_Assets_${Date.now()}`, title: 'Fixed Assets Register', subtitle: `Total Assets: ${rows.length}`, headers, rows };
    }

    if (key.includes('inventory')) {
      const headers = ['Item Code', 'Item Name', 'Category', 'Unit', 'Cost Price (NPR)', 'Selling Price (NPR)', 'Stock Qty'];
      const rows = [
        ['INV-FERT-01', 'Urea Fertilizer 50kg Bag', 'Fertilizer', 'Bag', 950, 1050, 420],
        ['INV-SEED-02', 'Hybrid Paddy Seeds Khumal-4 (10kg)', 'Seeds', 'Kg', 450, 520, 280],
        ['INV-GOODS-03', 'Mustard Oil Pure Tokla (1 Litre)', 'Consumer Goods', 'Litre', 220, 250, 600],
        ['INV-TOOL-04', 'Stainless Steel Milk Can 20L', 'Dairy Tools', 'Pcs', 3800, 4200, 45],
      ];
      return { filename: `Inventory_Register_${Date.now()}`, title: 'Inventory Stock Register', subtitle: 'Store & Merchandise Items', headers, rows };
    }

    if (key.includes('audit') || key.includes('log')) {
      const headers = ['Timestamp (BS)', 'User Name', 'Role', 'Action', 'Details', 'IP Address'];
      const rows = (auditLogs || []).map(a => [
        a.timestampBS,
        a.userName,
        a.userRole,
        a.action,
        a.details,
        a.ipAddress
      ]);
      return { filename: `Audit_Logs_${Date.now()}`, title: 'System Security Audit Trail', subtitle: `Total Logs Recorded: ${rows.length}`, headers, rows };
    }

    // Default Fallback export (Cooperative Operational Summary)
    const headers = ['Module Category', 'Total Records', 'Primary Status', 'Summary Metric'];
    const rows = [
      ['Members Directory', members.length, 'Active', `${members.filter(m => m.status === 'Active').length} Active Members`],
      ['Savings Portfolio', savingsAccounts.length, 'Operational', `NPR ${savingsAccounts.reduce((sum, s) => sum + s.balance, 0).toLocaleString()} Total Deposits`],
      ['Loan Portfolio', loanAccounts.length, 'Monitored', `NPR ${loanAccounts.reduce((sum, l) => sum + l.outstandingPrincipal, 0).toLocaleString()} Outstanding`],
      ['Chart of Accounts', chartOfAccounts.length, 'Balanced', 'Double Entry Active'],
    ];
    return { 
      filename: `SahakariSathi_Summary_${Date.now()}`, 
      title: `${tabTitle} Summary Report`, 
      subtitle: 'System Workspace Export Summary', 
      headers, 
      rows 
    };
  };

  const handleExportFormat = async (type: 'excel' | 'pdf') => {
    const data = await getExportDataForTab();
    setIsOpen(false);

    try {
      if (type === 'excel') {
        exportToExcel(data.filename, tabTitle, data.headers, data.rows);
        if (toast?.showSuccess) {
          toast.showSuccess(`Exported "${data.title}" to Excel spreadsheet (.xlsx)`, 'Excel Export Ready');
        }
        addNotification('Excel Export Success', `Generated spreadsheet for ${tabTitle} (${data.rows.length} rows).`, 'success');
      } else {
        exportToPdf(data.filename, data.title, data.subtitle, data.headers, data.rows);
        if (toast?.showSuccess) {
          toast.showSuccess(`Exported "${data.title}" to PDF document (.pdf)`, 'PDF Export Ready');
        }
        addNotification('PDF Export Success', `Generated PDF report for ${tabTitle} (${data.rows.length} rows).`, 'success');
      }
    } catch (err: any) {
      console.error("Export Error:", err);
      if (toast?.showError) {
        toast.showError(err?.message || "Failed to generate report export.", "Export Failure");
      }
    }
  };

  return (
    <div className="relative z-[10000]" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-md transition cursor-pointer text-xs font-bold shadow-2xs border border-emerald-500/80"
        title="Export Current Tab Data (Excel / PDF)"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Export</span>
        <ChevronDown className={`w-3 h-3 text-emerald-100 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 z-[10001] animate-in fade-in slide-in-from-top-2">
          {/* Header */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-0.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Export Current View</div>
            <div className="font-bold text-xs text-slate-900 truncate" title={tabTitle}>
              {tabTitle}
            </div>
          </div>

          {/* Format Options */}
          <div className="p-1.5 space-y-1">
            <button
              type="button"
              onClick={() => handleExportFormat('excel')}
              className="w-full text-left px-3 py-2 hover:bg-emerald-50 rounded-lg text-slate-700 hover:text-emerald-900 flex items-center justify-between transition cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-md group-hover:bg-emerald-600 group-hover:text-white transition">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs">Excel Spreadsheet</div>
                  <div className="text-[10px] text-slate-500">Formatted .XLSX Workbook</div>
                </div>
              </div>
              <ChevronDown className="-rotate-90 w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-700" />
            </button>

            <button
              type="button"
              onClick={() => handleExportFormat('pdf')}
              className="w-full text-left px-3 py-2 hover:bg-rose-50 rounded-lg text-slate-700 hover:text-rose-900 flex items-center justify-between transition cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-rose-100 text-rose-800 rounded-md group-hover:bg-rose-600 group-hover:text-white transition">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs">PDF Document</div>
                  <div className="text-[10px] text-slate-500">Print-ready .PDF Report</div>
                </div>
              </div>
              <ChevronDown className="-rotate-90 w-3.5 h-3.5 text-slate-500 group-hover:text-rose-700" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
