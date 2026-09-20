import React, { useState } from 'react';
import { Download, FileSpreadsheet, Upload, Loader2 } from 'lucide-react';
import { useCoop } from '../../context/CoopContext';
import { useToast } from '../../context/ToastContext';
import { exportToExcel, exportToPdf } from '../../utils/exportUtils';
import { NotConfiguredPanel } from '../common/NotConfiguredPanel';

interface Props {
  activeSubKey?: string;
}

type ModuleKey = 'members' | 'savings' | 'loans' | 'coa';
type FormatKey = 'xlsx' | 'csv' | 'pdf';

const MODULES: { key: ModuleKey; label: string }[] = [
  { key: 'members', label: 'Member register' },
  { key: 'savings', label: 'Savings accounts' },
  { key: 'loans', label: 'Loan accounts' },
  { key: 'coa', label: 'Chart of accounts' },
];

const FORMATS: { key: FormatKey; label: string }[] = [
  { key: 'xlsx', label: 'Excel (.xlsx)' },
  { key: 'csv', label: 'Comma separated values (.csv)' },
  { key: 'pdf', label: 'PDF (.pdf)' },
];

/** Turn rows into a CSV blob and hand it to the browser. */
const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\r\n');
  // BOM so Excel opens Devanagari member names in UTF-8 rather than mojibake.
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Bulk import / export.
 *
 * The import side used to accept no file at all: clicking "Select Excel File &
 * Import" started a 1.2 second timer and then reported "Successfully imported
 * 150 legacy records… COA double-entry integrity verified." Nothing was read,
 * validated or written. There is no import endpoint, so that tab now says so.
 *
 * The export side is real: it writes the records currently loaded for the
 * signed-in user's branch scope using the shared export utilities. It is not a
 * database dump, and the copy no longer claims to be one.
 */
export const AdminImportExportView: React.FC<Props> = ({ activeSubKey = 'admin_import_members' }) => {
  const subTab = activeSubKey;
  const { members, savingsAccounts, loanAccounts, chartOfAccounts, addNotification } = useCoop();
  const { showSuccess, showWarning, showError } = useToast();

  const [module, setModule] = useState<ModuleKey>('members');
  const [format, setFormat] = useState<FormatKey>('xlsx');
  const [exporting, setExporting] = useState(false);

  const buildDataset = (): { title: string; headers: string[]; rows: (string | number)[][] } => {
    switch (module) {
      case 'savings':
        return {
          title: 'Savings Accounts',
          headers: ['Account No', 'Member Name', 'Product', 'Balance (NPR)', 'Interest Rate (%)', 'Status'],
          rows: (savingsAccounts || []).map(a => [
            a.accountNo, a.memberName, a.productName ?? '', a.balance ?? 0, a.interestRate ?? 0, a.status ?? '',
          ]),
        };
      case 'loans':
        return {
          title: 'Loan Accounts',
          headers: ['Loan No', 'Member Name', 'Product', 'Approved (NPR)', 'Outstanding Principal (NPR)', 'Status'],
          rows: (loanAccounts || []).map(l => [
            l.loanNo, l.memberName, l.productType ?? '', l.approvedAmount ?? 0, l.outstandingPrincipal ?? 0, l.status ?? '',
          ]),
        };
      case 'coa':
        return {
          title: 'Chart of Accounts',
          headers: ['Code', 'Account Name', 'Type', 'Parent Code', 'Balance (NPR)'],
          rows: (chartOfAccounts || []).map(a => [
            a.code, a.name, a.type, a.parentCode ?? '', a.balance ?? 0,
          ]),
        };
      case 'members':
      default:
        return {
          title: 'Member Register',
          headers: ['Member No', 'Full Name', 'Phone', 'Gender', 'Address', 'Status'],
          rows: (members || []).map(m => [
            m.memberNo, m.fullName, m.phone ?? '', m.gender ?? '', m.address ?? '', m.status ?? '',
          ]),
        };
    }
  };

  const handleExport = () => {
    const { title, headers, rows } = buildDataset();

    // Refuse rather than hand over an empty file that looks like a clean result.
    if (rows.length === 0) {
      showWarning(`There are no ${title.toLowerCase()} records loaded to export.`, 'Nothing to Export');
      return;
    }

    setExporting(true);
    try {
      const filename = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;
      if (format === 'csv') {
        downloadCsv(filename, headers, rows);
      } else if (format === 'pdf') {
        exportToPdf(filename, title, `${rows.length} records`, headers, rows);
      } else {
        exportToExcel(filename, title, headers, rows);
      }
      addNotification('Export Ready', `${rows.length} ${title.toLowerCase()} records exported.`, 'success');
      showSuccess(`${rows.length} records written to ${filename}.`, 'Export Ready');
    } catch (error: any) {
      const message = error?.message || 'The file could not be generated.';
      addNotification('Export Failed', message, 'alert');
      showError(message, 'Export Failed');
    } finally {
      setExporting(false);
    }
  };

  const isImportTab = subTab === 'admin_import_members'
    || subTab === 'admin_import_accounts'
    || subTab === 'admin_import_ob';

  return (
    <div className="space-y-6">

      {/* IMPORT — no endpoint exists */}
      {isImportTab && (
        <NotConfiguredPanel title="Bulk import is not available yet" icon={Upload}>
          <p>
            The application has no endpoint for loading spreadsheets of members, accounts or opening
            balances, so no file uploaded here could be read or written to the database.
          </p>
          <p>
            Opening balances in particular must not be imported casually: they have to be posted as
            a balanced opening journal so the trial balance still ties. Until that is built, create
            records through their own screens.
          </p>
        </NotConfiguredPanel>
      )}

      {/* EXPORT — real, from the records currently loaded */}
      {subTab === 'admin_export_data' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 max-w-xl shadow-xs">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="font-bold text-slate-900 text-sm">Export Loaded Records</h3>
            <p className="text-slate-500 text-xs">
              Writes the records currently loaded for your branch scope. This is a working export
              for review and filing, not a full database backup.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            <div>
              <label className="block text-slate-600 text-xs mb-1" htmlFor="export-module">Module</label>
              <select
                id="export-module"
                value={module}
                onChange={(e) => setModule(e.target.value as ModuleKey)}
                className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
              >
                {MODULES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 text-xs mb-1" htmlFor="export-format">File format</label>
              <select
                id="export-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as FormatKey)}
                className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-xs text-slate-900"
              >
                {FORMATS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </div>

            <div className="text-[11px] text-slate-500">
              {buildDataset().rows.length} record(s) ready to export.
            </div>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs flex items-center justify-center gap-2"
            >
              {exporting
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : format === 'xlsx' ? <FileSpreadsheet className="w-4 h-4" /> : <Download className="w-4 h-4" />}
              <span>{exporting ? 'Generating file…' : 'Download Export'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
