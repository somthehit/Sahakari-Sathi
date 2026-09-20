/**
 * BulkCoaModal — drag-and-drop Chart of Accounts import.
 * Accepts `.csv` (parsed client-side with papaparse) and `.xlsx` (SheetJS).
 * Every row is validated locally (required fields, account type, duplicate GL
 * codes, parent resolution against the file ∪ existing accounts) and shown in a
 * preview table before the atomic commit to `POST /coa/bulk-import`.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  UploadCloud, FileSpreadsheet, X, AlertTriangle, CheckCircle2, Download, Loader2, FileDown,
} from 'lucide-react';
import { bulkImportCoa, type CoaBulkRow, type CoaAccountType, type CoaImportResult } from '../../api/accountingSettings';

type RowStatus = 'ok' | 'error' | 'warning';

interface PreviewRow {
  rowIndex: number;
  glCode: string;
  accountName: string;
  accountType: string;
  parentGlCode: string;
  posting: boolean;
  openingBalance: number;
  status: RowStatus;
  messages: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after a successful commit so the parent can refetch the COA. */
  onImported: () => void;
  /** GL codes already present in this organization (warn + skip). */
  existingCodes?: string[];
}

const TYPE_ALIAS: Record<string, CoaAccountType> = {
  asset: 'Asset', assets: 'Asset', liability: 'Liability', liabilities: 'Liability',
  equity: 'Equity', income: 'Income', gain: 'Income', expense: 'Expense', expenses: 'Expense',
};

const normType = (raw: unknown): CoaAccountType | null => {
  if (raw === undefined || raw === null) return null;
  const key = String(raw).toLowerCase().replace(/[^a-z]/g, '');
  return TYPE_ALIAS[key] ?? null;
};

const parseBool = (raw: unknown): boolean => {
  if (raw === undefined || raw === null || raw === '') return true;
  const s = String(raw).trim().toLowerCase();
  if (['false', '0', 'no', 'n', 'non', 'none', 'blocked'].includes(s)) return false;
  return true;
};

const parseNum = (raw: unknown): number => {
  if (raw === undefined || raw === null || raw === '') return 0;
  const n = Number(String(raw).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
};

const normKey = (k: string): string => k.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Canonical field → accepted header aliases (normalized). */
const HEADER_ALIASES: Record<keyof CoaBulkRow, string[]> = {
  glCode: ['glcode', 'code', 'gl code', 'gl-code'],
  accountName: ['accountname', 'name', 'account name', 'ledger name'],
  accountType: ['accounttype', 'type', 'account type', 'category'],
  parentGlCode: ['parentglcode', 'parentcode', 'parent', 'parentcode2', 'parent code'],
  isPostingAllowed: ['ispostingallowed', 'allowposting', 'posting', 'isposting'],
  openingBalance: ['openingbalance', 'balance', 'opening balance', 'opening'],
  normalBalance: ['normalbalance', 'normal balance', 'nbalance'],
  isControlAccount: ['iscontrolaccount', 'controlaccount', 'control account', 'control'],
};

function pickField(row: Record<string, unknown>, canonical: keyof CoaBulkRow): unknown {
  const wanted = HEADER_ALIASES[canonical].map(normKey);
  for (const [k, v] of Object.entries(row)) {
    if (wanted.includes(normKey(k))) return v;
  }
  return undefined;
}

/** Map a raw header row into a canonical CoaBulkRow. */
function canonicalize(row: Record<string, unknown>): { value: CoaBulkRow; missing: string[] } {
  const glCode = String(pickField(row, 'glCode') ?? '').trim();
  const accountName = String(pickField(row, 'accountName') ?? '').trim();
  const rawType = pickField(row, 'accountType');
  const parentGlCode = String(pickField(row, 'parentGlCode') ?? '').trim();
  const postingRaw = pickField(row, 'isPostingAllowed');
  const balanceRaw = pickField(row, 'openingBalance');
  const normalBalanceRaw = pickField(row, 'normalBalance');
  const controlRaw = pickField(row, 'isControlAccount');

  const missing: string[] = [];
  if (!glCode) missing.push('gl_code');
  if (!accountName) missing.push('account_name');
  if (rawType === undefined || rawType === null || String(rawType).trim() === '') missing.push('account_type');

  return {
    value: {
      glCode,
      accountName,
      accountType: normType(rawType) ?? 'Asset',
      parentGlCode: parentGlCode || null,
      isPostingAllowed: postingRaw === undefined ? true : parseBool(postingRaw),
      openingBalance: balanceRaw === undefined ? 0 : parseNum(balanceRaw),
      normalBalance: normalBalanceRaw === undefined ? undefined : parseBool(normalBalanceRaw) ? 'credit' : 'debit',
      isControlAccount: controlRaw === undefined ? false : parseBool(controlRaw),
    },
    missing,
  };
}

async function readRows(file: File): Promise<{ rows: Record<string, unknown>[]; header: string[] }> {
  const isCsv = /\.csv$/i.test(file.name);
  if (isCsv) {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
    });
    return { rows: parsed.data, header: (parsed.meta.fields ?? []).map((h) => String(h)) };
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  return { rows: json, header: json.length ? Object.keys(json[0]) : [] };
}

export const BulkCoaModal: React.FC<Props> = ({ open, onClose, onImported, existingCodes = [] }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [header, setHeader] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<CoaImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setFileName(null);
    setHeader([]);
    setRows([]);
    setResult(null);
    setParseError(null);
    setImporting(false);
  }, []);

  const handleFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(csv|xlsx)$/i.test(file.name)) {
      setParseError('Unsupported file type. Please upload a .csv or .xlsx file.');
      return;
    }
    setParseError(null);
    setResult(null);
    try {
      const { rows: parsed, header: h } = await readRows(file);
      if (parsed.length === 0) {
        setParseError('The file is empty or has no data rows.');
        setRows([]);
        setHeader([]);
        setFileName(null);
        return;
      }
      setFileName(file.name);
      setHeader(h);
      setRows(parsed);
    } catch (err: any) {
      setParseError(err?.message || 'Failed to parse the file. Check the format and try again.');
      setRows([]);
      setFileName(null);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }, [handleFile]);

  const preview: PreviewRow[] = useMemo(() => {
    if (rows.length === 0) return [];
    const existing = new Set(existingCodes.map((c) => c.trim().toUpperCase()));
    const fileCodes = new Set<string>();
    rows.forEach((r) => {
      const c = String(pickField(r, 'glCode') ?? '').trim().toUpperCase();
      if (c) fileCodes.add(c);
    });
    const known = new Set([...existing, ...fileCodes]);
    const seen = new Set<string>();

    return rows.map((raw, i) => {
      const { value, missing } = canonicalize(raw);
      const messages: string[] = [];
      let status: RowStatus = 'ok';

      if (missing.includes('gl_code')) { status = 'error'; messages.push('GL code is required'); }
      if (missing.includes('account_name')) { status = 'error'; messages.push('Account name is required'); }

      const type = normType(raw.accountType ?? raw.type);
      if (!type && !missing.includes('account_type')) {
        status = 'error';
        messages.push(`Invalid account type "${raw.accountType ?? raw.type}"`);
      }

      const upper = value.glCode.toUpperCase();
      if (value.glCode) {
        if (seen.has(upper)) { status = 'error'; messages.push('Duplicate GL code within the file'); }
        seen.add(upper);
        if (existing.has(upper)) { status = status === 'error' ? status : 'warning'; messages.push('Already exists — will be skipped'); }
      }

      if (value.parentGlCode) {
        const parent = value.parentGlCode.toUpperCase();
        if (!known.has(parent)) { status = 'error'; messages.push(`Parent GL code "${value.parentGlCode}" not found`); }
      }

      return {
        rowIndex: i + 2,
        glCode: value.glCode,
        accountName: value.accountName,
        accountType: type ? value.accountType : String(raw.accountType ?? raw.type ?? ''),
        parentGlCode: value.parentGlCode ?? '',
        posting: value.isPostingAllowed ?? true,
        openingBalance: value.openingBalance ?? 0,
        status,
        messages,
      };
    });
  }, [rows, existingCodes]);

  const errorCount = preview.filter((r) => r.status === 'error').length;
  const okCount = preview.filter((r) => r.status === 'ok').length;
  const warningCount = preview.filter((r) => r.status === 'warning').length;

  const commit = useCallback(async () => {
    if (errorCount > 0 || okCount === 0 || importing) return;
    setImporting(true);
    setResult(null);
    try {
      const payload: CoaBulkRow[] = preview
        .filter((r) => r.status === 'ok')
        .map((r) => ({
          glCode: r.glCode,
          accountName: r.accountName,
          accountType: normType(r.accountType) ?? 'Asset',
          parentGlCode: r.parentGlCode || null,
          isPostingAllowed: r.posting,
          openingBalance: r.openingBalance,
        }));
      const res = await bulkImportCoa(payload);
      setResult(res);
      if (res.success) onImported();
    } catch (err: any) {
      setResult({
        success: false,
        importedCount: 0,
        failedCount: 1,
        message: err?.response?.data?.error || err?.message || 'Import failed. No changes were saved.',
      });
    } finally {
      setImporting(false);
    }
  }, [preview, errorCount, okCount, importing, onImported]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-2xl text-slate-800 flex flex-col max-h-[92vh] animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">Import Chart of Accounts (CSV / Excel)</h3>
              <p className="text-[11px] text-slate-500">Preview validates every row before the atomic commit.</p>
            </div>
          </div>
          <button onClick={() => { reset(); onClose(); }} className="text-slate-500 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          {/* Drag & drop */}
          {!fileName ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center transition cursor-pointer ${dragging ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-300 hover:border-emerald-400 bg-slate-50/50'}`}
            >
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
              <UploadCloud className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <p className="font-bold text-slate-800 text-sm">Drag & drop your spreadsheet here</p>
              <p className="text-[11px] text-slate-500 mt-1">or click to browse — accepts <span className="font-mono font-bold">.csv</span> / <span className="font-mono font-bold">.xlsx</span></p>
              <a href="/templates/coa-sample.csv" download onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 text-[11px] text-emerald-600 font-bold mt-4 hover:underline cursor-pointer">
                <Download className="w-3.5 h-3.5" /> Download sample CSV template
              </a>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileSpreadsheet className="w-6 h-6 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{fileName}</p>
                  <p className="text-[10px] text-slate-500">{preview.length} data row(s) · {header.length} column(s)</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg hover:bg-slate-100 transition cursor-pointer">Replace</button>
                <button onClick={reset} className="px-3 py-1.5 bg-rose-50 text-rose-600 text-[11px] font-semibold rounded-lg border border-rose-200 hover:bg-rose-100 transition cursor-pointer">Clear</button>
                <input ref={fileInputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
              </div>
            </div>
          )}

          {parseError && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-rose-700 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {parseError}
            </div>
          )}

          {/* Validation summary */}
          {fileName && !parseError && (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border font-bold ${okCount ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <CheckCircle2 className="w-3.5 h-3.5" /> {okCount} ready to import
              </span>
              {warningCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-700 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" /> {warningCount} already exist (skipped)
                </span>
              )}
              {errorCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-rose-200 bg-rose-50 text-rose-700 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" /> {errorCount} with errors — fix and re-upload
                </span>
              )}
            </div>
          )}

          {/* Preview table */}
          {fileName && preview.length > 0 && (
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white text-xs max-h-[340px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[10px] uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="p-2.5">#</th>
                    <th className="p-2.5">GL Code</th>
                    <th className="p-2.5">Account Name</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5">Parent Code</th>
                    <th className="p-2.5 text-center">Posting</th>
                    <th className="p-2.5 text-right">Opening</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {preview.map((r) => {
                    const isError = r.status === 'error';
                    const isWarn = r.status === 'warning';
                    return (
                      <tr key={r.rowIndex} className={isError ? 'bg-rose-50/60' : isWarn ? 'bg-amber-50/50' : 'hover:bg-slate-50'}>
                        <td className="p-2.5 text-slate-400 font-mono">{r.rowIndex}</td>
                        <td className="p-2.5 font-mono font-bold text-emerald-700">{r.glCode || <span className="text-rose-500">—</span>}</td>
                        <td className="p-2.5 font-semibold">{r.accountName || <span className="text-rose-500">—</span>}</td>
                        <td className="p-2.5">{r.accountType}</td>
                        <td className="p-2.5 font-mono text-slate-500">{r.parentGlCode || '—'}</td>
                        <td className="p-2.5 text-center">{r.posting ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" /> : <span className="text-slate-400">—</span>}</td>
                        <td className="p-2.5 text-right font-mono">{r.openingBalance.toLocaleString()}</td>
                        <td className="p-2.5">
                          {isError ? (
                            <span className="text-rose-600 font-bold text-[10px]">{r.messages.join('; ')}</span>
                          ) : isWarn ? (
                            <span className="text-amber-600 font-bold text-[10px]">{r.messages.join('; ')}</span>
                          ) : (
                            <span className="text-emerald-600 font-bold text-[10px]">Ready</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!fileName && (
            <div className="text-[11px] text-slate-500 leading-relaxed">
              <p className="font-bold text-slate-600 mb-1">Template columns</p>
              <p className="font-mono text-[10px]">gl_code, account_name, account_type, parent_gl_code, is_posting_allowed, opening_balance</p>
              <p className="mt-1">Account types: <span className="font-mono">Asset, Liability, Equity, Income, Expense</span>. Leave <span className="font-mono">parent_gl_code</span> blank for root accounts. Parent accounts must be listed before their children (or already exist).</p>
            </div>
          )}

          {/* Result banner */}
          {result && (
            <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-xs border ${result.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
              {result.success ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
              <div className="space-y-0.5">
                <p className="font-bold">{result.message}</p>
                {Array.isArray(result.errors) && result.errors.length > 0 && (
                  <ul className="list-disc pl-4 space-y-0.5">{result.errors.slice(0, 20).map((e, i) => <li key={i} className="text-[11px]">{e}</li>)}</ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 shrink-0">
          <span className="text-[11px] text-slate-400">Imports run in a single transaction — if a row fails on the server, nothing is saved.</span>
          <div className="flex items-center gap-3">
            <button onClick={() => { reset(); onClose(); }} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer">Cancel</button>
            <button
              onClick={commit}
              disabled={errorCount > 0 || okCount === 0 || importing}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              {importing ? 'Importing…' : result?.success ? 'Done' : `Import ${okCount} account${okCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};