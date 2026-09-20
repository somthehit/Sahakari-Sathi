import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Landmark, CheckCircle2, AlertCircle, Upload, X, ArrowRight, Repeat2, Search, Loader2 } from 'lucide-react';
import { formatNPR, getTodayBS } from '../../utils/nepaliCalendar';
import { searchChequeLeafByNumber, type ChequeLeafSearchResult } from '../../api/chequeSettings';

export interface InternalChequeData {
  chequeLeafId: string;
  chequeNumber: string;
  payeeName: string;
  chequeDateBs: string;
  chequeDateAd: string;
  chequeImageFile?: File;
  chequeImagePreviewUrl?: string;
  payerSavingsAccountId: string;
  payerMemberId: string;
  payerMemberName: string;
  isThirdParty: boolean;
  chequeAmount: number;
  shortfall: number;
}

interface InternalChequeSelectorProps {
  borrowerMemberId?: string;
  borrowerMemberName?: string;
  amount: number;
  onValidChange: (data: InternalChequeData | null) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

const InternalChequeSelector: React.FC<InternalChequeSelectorProps> = ({
  borrowerMemberId = '',
  borrowerMemberName = '',
  amount,
  onValidChange,
}) => {
  const [chequeNumberInput, setChequeNumberInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [leafResult, setLeafResult] = useState<ChequeLeafSearchResult | null>(null);

  const [payeeName, setPayeeName] = useState('');
  const [chequeDateBs, setChequeDateBs] = useState('');
  const [chequeAmountStr, setChequeAmountStr] = useState('');
  const [chequeImageFile, setChequeImageFile] = useState<File | null>(null);
  const [chequeImagePreviewUrl, setChequeImagePreviewUrl] = useState('');
  const [imageError, setImageError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!chequeDateBs) setChequeDateBs(getTodayBS());
    searchInputRef.current?.focus();
  }, []);

  const handleSearch = useCallback(async () => {
    const num = chequeNumberInput.trim();
    if (!num) return;
    setSearching(true);
    setSearchError('');
    setLeafResult(null);
    try {
      const result = await searchChequeLeafByNumber(num);
      setLeafResult(result);
      if (result.status !== 'unused') {
        setSearchError(`Cheque ${num} is ${result.status} — only unused cheques can be used.`);
        setLeafResult(null);
      } else {
        if (result.memberName) setPayeeName((prev) => prev || `${result.memberName} (Loan Repayment)`);
        const avail = Math.max(0, Number(result.balance) - Number(result.minBalance || 0));
        const defaultAmt = Math.min(avail, amount);
        setChequeAmountStr(defaultAmt > 0 ? String(defaultAmt) : '');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Cheque not found.';
      setSearchError(msg);
      setLeafResult(null);
    } finally {
      setSearching(false);
    }
  }, [chequeNumberInput]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  }, [handleSearch]);

  const handleClear = useCallback(() => {
    setChequeNumberInput('');
    setLeafResult(null);
    setSearchError('');
    setPayeeName('');
    setChequeAmountStr('');
    setChequeImageFile(null);
    setChequeImagePreviewUrl('');
    searchInputRef.current?.focus();
  }, []);

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setImageError(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 5MB.`);
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setImageError('Only JPG, PNG, or PDF files are allowed.');
      return;
    }
    setChequeImageFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setChequeImagePreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setChequeImagePreviewUrl('');
    }
  }, []);

  const removeImage = useCallback(() => {
    setChequeImageFile(null);
    setChequeImagePreviewUrl('');
    setImageError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const payerBalance = leafResult
    ? Math.max(0, Number(leafResult.balance) - Number(leafResult.minBalance || 0))
    : 0;
  const chequeAmount = Math.max(0, Number(chequeAmountStr) || 0);
  const chequeExceedsBalance = chequeAmount > payerBalance;
  const hasSufficientBalance = chequeAmount >= amount;
  const isSelfPayment = leafResult?.memberId === borrowerMemberId;

  useEffect(() => {
    if (!leafResult || !payeeName.trim() || !chequeDateBs.trim() || chequeAmount <= 0) {
      onValidChange(null);
      return;
    }
    if (chequeExceedsBalance) {
      onValidChange(null);
      return;
    }
    const shortfall = Math.max(0, amount - chequeAmount);
    onValidChange({
      chequeLeafId: leafResult.id,
      chequeNumber: leafResult.chequeNumber,
      payeeName: payeeName.trim(),
      chequeDateBs,
      chequeDateAd: '',
      chequeImageFile: chequeImageFile || undefined,
      chequeImagePreviewUrl: chequeImagePreviewUrl || undefined,
      payerSavingsAccountId: leafResult.accountId,
      payerMemberId: leafResult.memberId || borrowerMemberId,
      payerMemberName: leafResult.memberName || '',
      isThirdParty: !isSelfPayment,
      chequeAmount,
      shortfall,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafResult, payeeName, chequeDateBs, chequeAmountStr, chequeImageFile, chequeImagePreviewUrl, borrowerMemberId, payerBalance, amount, isSelfPayment, chequeAmount, chequeExceedsBalance]);

  return (
    <div className="p-4 bg-emerald-50/40 border border-emerald-200 rounded-lg space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-emerald-200 pb-2">
        <h4 className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
          <Landmark className="w-4 h-4 text-emerald-600" />
          Internal Co-operative Cheque Transfer
        </h4>
        {leafResult && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-slate-500 hover:text-red-600 transition"
          >
            Clear & Search Again
          </button>
        )}
      </div>

      {/* Step 1: Cheque Number Input */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Cheque Leaf Number <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={searchInputRef}
              type="text"
              value={chequeNumberInput}
              onChange={(e) => setChequeNumberInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter cheque leaf number..."
              disabled={!!leafResult}
              className={`w-full text-sm p-2 pr-8 border rounded bg-white ${
                leafResult ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold' : 'border-slate-300'
              } ${searchError ? 'border-red-300' : ''}`}
            />
            {chequeNumberInput && !leafResult && (
              <button
                type="button"
                onClick={() => setChequeNumberInput('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {!leafResult && (
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching || !chequeNumberInput.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {searching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              Lookup
            </button>
          )}
        </div>
        {searchError && (
          <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {searchError}
          </p>
        )}
      </div>

      {/* Step 2: Auto-fetched Cheque Details (read-only) */}
      {leafResult && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cheque Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Cheque Number</label>
            <input
              type="text"
              readOnly
              value={leafResult.chequeNumber}
              className="w-full text-sm p-2 border border-emerald-200 rounded bg-emerald-50 text-emerald-800 font-semibold"
            />
          </div>

          {/* Cheque Book */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Cheque Book</label>
            <input
              type="text"
              readOnly
              value={leafResult.bookNumber}
              className="w-full text-sm p-2 border border-slate-200 rounded bg-slate-100 text-slate-600"
            />
          </div>

          {/* Payer Member */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Payer Member</label>
            <input
              type="text"
              readOnly
              value={leafResult.memberName || 'N/A'}
              className="w-full text-sm p-2 border border-slate-200 rounded bg-slate-100 text-slate-600"
            />
          </div>

          {/* Savings Account */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Savings Account</label>
            <input
              type="text"
              readOnly
              value={leafResult.accountNo}
              className="w-full text-sm p-2 border border-slate-200 rounded bg-slate-100 text-slate-600"
            />
          </div>

          {/* Cheque Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Amount on Cheque <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">NPR</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={chequeAmountStr}
                onChange={(e) => setChequeAmountStr(e.target.value)}
                placeholder="0.00"
                className={`w-full text-sm p-2 pl-10 border rounded bg-white ${
                  chequeExceedsBalance ? 'border-red-300 bg-red-50' : 'border-slate-300'
                }`}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Available: {formatNPR(payerBalance)} &middot; EMI: {formatNPR(amount)}
            </p>
            {chequeExceedsBalance && (
              <p className="text-[10px] text-red-600 mt-0.5 flex items-center gap-0.5">
                <AlertCircle className="w-3 h-3" /> Cannot exceed available balance
              </p>
            )}
          </div>

          {/* Payee Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payee Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={payeeName}
              onChange={(e) => setPayeeName(e.target.value)}
              placeholder={`e.g. ${leafResult.memberName || borrowerMemberName || 'Borrower Name'} (Loan Repayment)`}
              className="w-full text-sm p-2 border border-slate-300 rounded bg-white"
            />
          </div>

          {/* Cheque Date (BS) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cheque Date (BS) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={chequeDateBs}
              onChange={(e) => setChequeDateBs(e.target.value)}
              placeholder="YYYY/MM/DD"
              className="w-full text-sm p-2 border border-slate-300 rounded bg-white"
            />
          </div>

          {/* File Upload */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cheque Image (optional, max 5MB)
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleImageChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 text-xs bg-white border border-slate-300 rounded hover:bg-slate-50 transition"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                {chequeImageFile ? 'Change File' : 'Upload Image'}
              </button>
              {chequeImageFile && (
                <span className="text-[10px] text-slate-600 truncate max-w-[200px]">
                  {chequeImageFile.name} ({(chequeImageFile.size / 1024).toFixed(0)}KB)
                  <button type="button" onClick={removeImage} className="ml-1 text-red-500 hover:text-red-700">
                    <X className="w-3 h-3 inline" />
                  </button>
                </span>
              )}
            </div>
            {imageError && <span className="text-[10px] text-red-600 mt-1 block">{imageError}</span>}
            {chequeImagePreviewUrl && (
              <img src={chequeImagePreviewUrl} alt="Cheque preview" className="mt-2 h-20 rounded border border-slate-200 object-cover" />
            )}
          </div>
        </div>
      )}

      {/* Balance Check */}
      {leafResult && (
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded border ${
          chequeExceedsBalance
            ? 'bg-rose-50 border-rose-300 text-rose-900'
            : hasSufficientBalance
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          {chequeExceedsBalance ? (
            <span>
              <AlertCircle className="w-3 h-3 inline mr-0.5" />
              Cheque amount {formatNPR(chequeAmount)} exceeds available balance {formatNPR(payerBalance)}
            </span>
          ) : (
            <>
              <span>Cheque: <strong>{formatNPR(chequeAmount)}</strong></span>
              <span className="text-slate-400">|</span>
              <span>Balance: {formatNPR(payerBalance)}</span>
              {!hasSufficientBalance && (
                <span className="text-amber-700 font-semibold ml-2">
                  Shortfall: {formatNPR(amount - chequeAmount)}
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* Accounting Flow Preview */}
      {leafResult && (
        <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900 flex flex-col sm:flex-row justify-between gap-1">
          <span>
            Accounting Flow: <strong>Cr: {leafResult.memberName || 'Payer'} Savings</strong>
            {' '}<ArrowRight className="w-3 h-3 inline mx-0.5" />
            {' '}<strong>Dr: {borrowerMemberName || 'Borrower'} Loan EMI</strong>
          </span>
          <span className="font-semibold text-blue-800 flex items-center gap-1">
            <Repeat2 className="w-3 h-3" />
            {isSelfPayment ? 'Self-Payment' : `Linked: ${leafResult.memberName} → ${borrowerMemberName || 'Borrower'}`}
          </span>
        </div>
      )}
    </div>
  );
};

export default InternalChequeSelector;
