import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BookOpen, AlertTriangle, CheckCircle2, Upload, X, Search } from 'lucide-react';
import { fetchBankChequeLeaves, type BankChequeLeaf } from '../../api/loanServicing';
import { fetchBankAccountDetail } from '../../api/accountingSettings';
import { getTodayBS, formatNPR, convertBSToAD } from '../../utils/nepaliCalendar';

export interface ChequeSelectorData {
  chequeLeafId: string;
  chequeNumber: string;
  payeeName: string;
  chequeDateBs: string;
  chequeDateAd: string;
  chequeImageFile?: File;
  chequeImagePreviewUrl?: string;
}

interface ChequePaymentSelectorProps {
  bankAccountId: string;
  amount: number;
  suggestedPayeeName?: string;
  onValidChange: (data: ChequeSelectorData | null) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

function compareBsDates(a: string, b: string): number {
  return a.localeCompare(b);
}

export function ChequePaymentSelector({
  bankAccountId,
  amount,
  suggestedPayeeName = '',
  onValidChange,
}: ChequePaymentSelectorProps) {
  // ── State ──
  const [leaves, setLeaves] = useState<BankChequeLeaf[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [leavesError, setLeavesError] = useState<string | null>(null);

  const [selectedLeafId, setSelectedLeafId] = useState('');
  const [manualChequeNumber, setManualChequeNumber] = useState('');
  const [inputMode, setInputMode] = useState<'dropdown' | 'search'>('dropdown');

  const [payeeName, setPayeeName] = useState(suggestedPayeeName);
  const [chequeDateBs, setChequeDateBs] = useState(getTodayBS());

  const [bankBalance, setBankBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Fetch leaves ──
  useEffect(() => {
    if (!bankAccountId) return;
    setLeavesLoading(true);
    setLeavesError(null);
    setSelectedLeafId('');
    setManualChequeNumber('');
    fetchBankChequeLeaves(bankAccountId)
      .then((data) => {
        setLeaves(data);
        if (data.length === 0) setLeavesError('No unused cheque leaves. Issue a cheque book first.');
      })
      .catch(() => setLeavesError('Failed to load cheque leaves.'))
      .finally(() => setLeavesLoading(false));
  }, [bankAccountId]);

  // ── Fetch bank balance ──
  useEffect(() => {
    if (!bankAccountId) return;
    setBalanceLoading(true);
    fetchBankAccountDetail(bankAccountId)
      .then((data) => setBankBalance(data.glBalance))
      .catch(() => setBankBalance(null))
      .finally(() => setBalanceLoading(false));
  }, [bankAccountId]);

  // ── Sync payee name ──
  useEffect(() => {
    if (suggestedPayeeName) setPayeeName(suggestedPayeeName);
  }, [suggestedPayeeName]);

  // ── Close dropdown on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Resolved cheque number (from dropdown or manual input) ──
  const resolvedChequeNumber = useMemo(() => {
    if (inputMode === 'dropdown' && selectedLeafId) {
      return leaves.find((l) => l.id === selectedLeafId)?.chequeNumber || '';
    }
    return manualChequeNumber.trim();
  }, [inputMode, selectedLeafId, manualChequeNumber, leaves]);

  // ── Matched leaf (for validation) ──
  const matchedLeaf = useMemo(() => {
    if (!resolvedChequeNumber) return null;
    return leaves.find(
      (l) => l.chequeNumber.trim().toLowerCase() === resolvedChequeNumber.toLowerCase()
    ) || null;
  }, [resolvedChequeNumber, leaves]);

  // ── Filtered leaves for search ──
  const filteredLeaves = useMemo(() => {
    if (!searchQuery.trim()) return leaves;
    const q = searchQuery.toLowerCase();
    return leaves.filter(
      (l) =>
        l.chequeNumber.toLowerCase().includes(q) ||
        String(l.leafNo).includes(q)
    );
  }, [leaves, searchQuery]);

  // ── File validation ──
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    if (file.size > MAX_FILE_SIZE) {
      setFileError(`File too large. Maximum size is 5MB. Your file: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setFileError('Invalid file type. Only JPG, PNG, and PDF are allowed.');
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      setFilePreviewUrl(URL.createObjectURL(file));
    } else {
      setFilePreviewUrl(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Validation ──
  const errors = useMemo(() => {
    const e: string[] = [];
    if (!resolvedChequeNumber) e.push('Enter or select a cheque number');
    else if (!matchedLeaf) e.push(`Cheque "${resolvedChequeNumber}" is not registered as unused`);
    if (!payeeName.trim()) e.push('Payee name is required');
    if (compareBsDates(chequeDateBs, getTodayBS()) > 0) e.push('Future dated cheques are not permitted');
    if (bankBalance !== null && amount > bankBalance) {
      e.push(`Insufficient balance. Available: ${formatNPR(bankBalance)}, Required: ${formatNPR(amount)}`);
    }
    if (fileError) e.push(fileError);
    return e;
  }, [resolvedChequeNumber, matchedLeaf, payeeName, chequeDateBs, amount, bankBalance, fileError]);

  // ── Emit data ──
  useEffect(() => {
    if (errors.length === 0 && matchedLeaf) {
      onValidChange({
        chequeLeafId: matchedLeaf.id,
        chequeNumber: matchedLeaf.chequeNumber,
        payeeName: payeeName.trim(),
        chequeDateBs,
        chequeDateAd: convertBSToAD(chequeDateBs),
        chequeImageFile: selectedFile || undefined,
        chequeImagePreviewUrl: filePreviewUrl || undefined,
      });
    } else {
      onValidChange(null);
    }
  }, [errors, matchedLeaf, payeeName, chequeDateBs, selectedFile, filePreviewUrl]);

  return (
    <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
        <h4 className="text-xs font-bold text-emerald-800 flex items-center gap-2">
          <BookOpen className="w-4 h-4" /> Registered Cheque Details
        </h4>
        <span className="text-[10px] text-emerald-700 font-medium">Co-operative Bank Cheque</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ── Cheque Selector / Search ── */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Registered Cheque Number <span className="text-red-500">*</span>
          </label>

          {/* Mode Toggle */}
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => { setInputMode('dropdown'); setSelectedLeafId(''); setSearchQuery(''); }}
              className={`text-[10px] px-2.5 py-1 rounded-lg border font-semibold transition ${
                inputMode === 'dropdown'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Dropdown
            </button>
            <button
              type="button"
              onClick={() => { setInputMode('search'); setSelectedLeafId(''); setManualChequeNumber(''); }}
              className={`text-[10px] px-2.5 py-1 rounded-lg border font-semibold transition ${
                inputMode === 'search'
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Search className="w-3 h-3 inline mr-1" />
              Search
            </button>
          </div>

          {leavesLoading ? (
            <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              Loading cheque leaves...
            </div>
          ) : leavesError ? (
            <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> {leavesError}
            </div>
          ) : inputMode === 'dropdown' ? (
            <select
              value={selectedLeafId}
              onChange={(e) => setSelectedLeafId(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 font-semibold focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
            >
              <option value="">-- Select cheque leaf --</option>
              {leaves.map((leaf) => (
                <option key={leaf.id} value={leaf.id}>
                  {leaf.chequeNumber} (Leaf #{leaf.leafNo})
                </option>
              ))}
            </select>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <input
                type="text"
                value={searchQuery || resolvedChequeNumber}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setManualChequeNumber(e.target.value);
                  setSelectedLeafId('');
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Type cheque number to search..."
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 font-mono font-semibold focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
              />
              {showDropdown && filteredLeaves.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {filteredLeaves.map((leaf) => (
                    <button
                      key={leaf.id}
                      type="button"
                      onClick={() => {
                        setSelectedLeafId(leaf.id);
                        setManualChequeNumber(leaf.chequeNumber);
                        setSearchQuery('');
                        setShowDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 flex items-center justify-between border-b border-slate-100 last:border-0"
                    >
                      <span className="font-mono font-semibold text-slate-900">{leaf.chequeNumber}</span>
                      <span className="text-[10px] text-slate-500">Leaf #{leaf.leafNo}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Validation Badge */}
          {resolvedChequeNumber && !leavesLoading && (
            matchedLeaf ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Valid — Leaf #{matchedLeaf.leafNo}, Book: {matchedLeaf.bookNumber}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-red-600 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" />
                Cheque not found or already used
              </div>
            )
          )}
        </div>

        {/* ── Payee Name ── */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Payee Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={payeeName}
            onChange={(e) => setPayeeName(e.target.value)}
            placeholder="e.g. Madhavi Dahit"
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 font-semibold focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
          />
        </div>

        {/* ── Cheque Date (BS) ── */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 flex justify-between">
            <span>Cheque Date (BS) <span className="text-red-500">*</span></span>
            <span className="text-[10px] text-slate-500 font-normal">Today: {getTodayBS()}</span>
          </label>
          <input
            type="date"
            value={chequeDateBs}
            onChange={(e) => setChequeDateBs(e.target.value)}
            max={getTodayBS()}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-900 font-mono focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
          />
          {compareBsDates(chequeDateBs, getTodayBS()) > 0 && (
            <p className="text-[11px] text-red-600 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Future dated cheques are not permitted.
            </p>
          )}
        </div>

        {/* ── Cheque Image Upload ── */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700">
            Upload Cheque Copy
            <span className="text-[10px] font-normal text-slate-500 ml-1">(Max 5MB — JPG, PNG, PDF)</span>
          </label>

          {selectedFile ? (
            <div className="flex items-center gap-3 p-2 bg-white border border-slate-200 rounded-xl">
              {filePreviewUrl ? (
                <img
                  src={filePreviewUrl}
                  alt="Cheque preview"
                  className="w-12 h-12 object-cover rounded-lg border border-slate-200"
                />
              ) : (
                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                  <span className="text-[10px] text-slate-500 font-bold">PDF</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">{selectedFile.name}</p>
                <p className="text-[10px] text-slate-500">{(selectedFile.size / 1024).toFixed(0)} KB</p>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="cursor-pointer flex items-center justify-center gap-2 px-3 py-3 border border-dashed border-emerald-400 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition">
              <Upload className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-800">Choose Cheque File</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          )}
          {fileError && (
            <p className="text-[11px] text-red-600 font-semibold">{fileError}</p>
          )}
        </div>
      </div>

      {/* ── Balance Hint ── */}
      {bankBalance !== null && (
        <div className={`text-xs font-semibold px-3 py-2 rounded-xl ${
          amount > bankBalance
            ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
        }`}>
          Available Balance: {formatNPR(bankBalance)}
          {amount > bankBalance && (
            <span className="ml-2 text-red-600">(Shortfall: {formatNPR(amount - bankBalance)})</span>
          )}
        </div>
      )}
      {balanceLoading && (
        <div className="text-[10px] text-slate-400">Loading balance...</div>
      )}

      {/* ── Validation Errors ── */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700 space-y-0.5">
          {errors.map((err, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {err}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
