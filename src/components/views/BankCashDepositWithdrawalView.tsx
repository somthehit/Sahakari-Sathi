import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  RefreshCw,
  Banknote,
  CreditCard,
  User,
  Upload,
  X,
  FileText,
  Image,
} from 'lucide-react';
import { formatNPR, getTodayBS } from '../../utils/nepaliCalendar';
import { DateConverter } from '../../utils/DateConverter';
import { NepaliDatePicker } from '../common/NepaliDatePicker';
import { uploadMedia } from '../../api/storage';
import {
  fetchAccountingSettings,
  fetchCoa,
  voidVoucher,
  type BankAccount,
  type Bank,
  type ChartAccount,
  createBankDeposit,
} from '../../api/accountingSettings';
import { fetchStaffList, type Staff } from '../../api/staff';
import { searchMembers, type MemberSearchResult } from '../../api/savingsDeposits';
import {
  fetchBankChequeLeaves,
  markChequeLeafIssued,
  postBankChequeVoucher,
  type BankChequeLeaf,
} from '../../api/loanServicing';

type Tab = 'deposit' | 'withdrawal' | 'transactions';
type DepositorType = 'staff' | 'member' | 'nonstaff';

export const BankCashDepositWithdrawalView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('deposit');
  const [bankAccounts, setBankAccounts] = useState<(BankAccount & { bankName?: string; glAccountName?: string; glBalance?: number })[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [narration, setNarration] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [dateBs, setDateBs] = useState(getTodayBS());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Withdrawal state — bank cheque flow
  const [chequeNumber, setChequeNumber] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [chequeDateBs, setChequeDateBs] = useState(getTodayBS());
  const [matchedLeaf, setMatchedLeaf] = useState<BankChequeLeaf | null>(null);
  const [chequeError, setChequeError] = useState('');
  const [availableLeaves, setAvailableLeaves] = useState<BankChequeLeaf[]>([]);

  // Transaction history state
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  // Void voucher state
  const [voidingVoucherId, setVoidingVoucherId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidSubmitting, setVoidSubmitting] = useState(false);
  const [voidResult, setVoidResult] = useState<{ success: boolean; message: string } | null>(null);

  // Source GL account for deposits
  const [glAccounts, setGlAccounts] = useState<ChartAccount[]>([]);
  const [sourceAccountId, setSourceAccountId] = useState('');

  // File upload state — deposit voucher proof
  const depositFileRef = useRef<HTMLInputElement>(null);
  const [depositFile, setDepositFile] = useState<File | null>(null);
  const [depositFilePreview, setDepositFilePreview] = useState<string | null>(null);
  const [depositFileError, setDepositFileError] = useState<string | null>(null);

  // Depositor info state
  const [depositorType, setDepositorType] = useState<DepositorType>('member');
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<MemberSearchResult[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberSearchResult | null>(null);
  const [memberSearching, setMemberSearching] = useState(false);
  const [nonStaffName, setNonStaffName] = useState('');
  const [nonStaffMobile, setNonStaffMobile] = useState('');

  // File upload state — cheque image proof (withdrawal)
  const chequeFileRef = useRef<HTMLInputElement>(null);
  const [chequeFile, setChequeFile] = useState<File | null>(null);
  const [chequeFilePreview, setChequeFilePreview] = useState<string | null>(null);
  const [chequeFileError, setChequeFileError] = useState<string | null>(null);

  const selectedAccount = bankAccounts.find(a => a.id === selectedAccountId);
  const selectedGlAccountId = selectedAccount?.glAccountId || '';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [baRes, banksRes, coaRes] = await Promise.all([
        fetchAccountingSettings('bank-accounts'),
        fetchAccountingSettings('banks'),
        fetchCoa(),
      ]);
      // Use server-computed glBalance (authoritative from voucher entries)
      const enriched = baRes.map((ba: any) => ({
        ...ba,
        glBalance: ba.glBalance ?? 0,
      }));
      setBankAccounts(enriched);
      setBanks(banksRes);
      if (enriched.length > 0 && !selectedAccountId) {
        setSelectedAccountId(enriched[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Load staff list for depositor dropdown
  useEffect(() => {
    fetchStaffList().then(setStaffList).catch(() => setStaffList([]));
  }, []);

  // Load GL accounts for source account selector
  useEffect(() => {
    fetchCoa().then(res => setGlAccounts(res.accounts.filter(a => a.allowPosting))).catch(() => setGlAccounts([]));
  }, []);

  // Member search
  const handleMemberSearch = useCallback(async (q: string) => {
    setMemberSearchQuery(q);
    setSelectedMember(null);
    if (q.length < 2) { setMemberSearchResults([]); return; }
    setMemberSearching(true);
    try {
      const results = await searchMembers(q);
      setMemberSearchResults(results);
    } finally {
      setMemberSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedAccountId || activeTab !== 'transactions') return;
    setTxLoading(true);
    import('../../api/accountingSettings').then(({ fetchBankTransactions }) =>
      fetchBankTransactions(selectedAccountId)
    ).then(res => {
      setTransactions(res.transactions || []);
    }).finally(() => setTxLoading(false));
  }, [selectedAccountId, activeTab]);

  // Load available cheque leaves when bank account changes or withdrawal tab opens
  useEffect(() => {
    if (!selectedGlAccountId || activeTab !== 'withdrawal') return;
    fetchBankChequeLeaves(selectedGlAccountId).then(leaves => {
      setAvailableLeaves(leaves);
    }).catch(() => setAvailableLeaves([]));
  }, [selectedGlAccountId, activeTab]);

  const validateChequeNumber = useCallback((num: string) => {
    setChequeNumber(num);
    setChequeError('');
    setMatchedLeaf(null);
    if (!num.trim()) return;
    const leaf = availableLeaves.find(
      l => l.chequeNumber === num.trim() && (!l.status || l.status === 'unused')
    );
    if (leaf) {
      setMatchedLeaf(leaf);
    } else {
      const anyLeaf = availableLeaves.find(l => l.chequeNumber === num.trim());
      if (anyLeaf) {
        setChequeError(`Cheque ${num} is ${anyLeaf.status || 'not available'}`);
      } else {
        setChequeError('Cheque number not found in this bank account');
      }
    }
  }, [availableLeaves]);

  const handleVoidVoucher = useCallback(async (voucherId: string) => {
    if (!voidReason.trim()) return;
    setVoidSubmitting(true);
    setVoidResult(null);
    try {
      const res = await voidVoucher(voucherId, voidReason.trim());
      setVoidResult({ success: true, message: res.message });
      setVoidingVoucherId(null);
      setVoidReason('');
      loadData();
    } catch (err: any) {
      setVoidResult({ success: false, message: err?.response?.data?.error || err?.message || 'Void failed' });
    } finally {
      setVoidSubmitting(false);
    }
  }, [voidReason, loadData]);

  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

  const handleDepositFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDepositFileError(null);
    if (file.size > MAX_FILE_SIZE) {
      setDepositFileError(`File too large. Max 5MB. Your file: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setDepositFileError('Invalid type. Only JPG, PNG, PDF allowed.');
      return;
    }
    setDepositFile(file);
    if (file.type.startsWith('image/')) {
      setDepositFilePreview(URL.createObjectURL(file));
    } else {
      setDepositFilePreview(null);
    }
  }, []);

  const handleDepositFileRemove = useCallback(() => {
    setDepositFile(null);
    setDepositFilePreview(null);
    setDepositFileError(null);
    if (depositFileRef.current) depositFileRef.current.value = '';
  }, []);

  const handleChequeFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setChequeFileError(null);
    if (file.size > MAX_FILE_SIZE) {
      setChequeFileError(`File too large. Max 5MB. Your file: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setChequeFileError('Invalid type. Only JPG, PNG, PDF allowed.');
      return;
    }
    setChequeFile(file);
    if (file.type.startsWith('image/')) {
      setChequeFilePreview(URL.createObjectURL(file));
    } else {
      setChequeFilePreview(null);
    }
  }, []);

  const handleChequeFileRemove = useCallback(() => {
    setChequeFile(null);
    setChequeFilePreview(null);
    setChequeFileError(null);
    if (chequeFileRef.current) chequeFileRef.current.value = '';
  }, []);

  /** Convert File → data URL then upload via storage API */
  const uploadFileAsMedia = async (file: File, targetType: string, fileName: string): Promise<string | null> => {
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const stored = await uploadMedia(targetType as any, dataUrl, { fileName });
      return stored.url || null;
    } catch {
      return null;
    }
  };

  const handleDeposit = useCallback(async () => {
    if (!selectedAccountId || !amount || Number(amount) <= 0 || !sourceAccountId || !invoiceNumber.trim()) return;
    setSubmitting(true);
    setResult(null);
    try {
      // Build depositor label for narration
      let depositorLabel = '';
      if (depositorType === 'staff' && selectedStaffId) {
        const s = staffList.find(x => x.id === selectedStaffId);
        depositorLabel = s ? `Staff: ${s.fullName}` : '';
      } else if (depositorType === 'member' && selectedMember) {
        depositorLabel = `Member: ${selectedMember.name} (${selectedMember.memberCode})`;
      } else if (depositorType === 'nonstaff' && nonStaffName.trim()) {
        depositorLabel = `Non-Staff: ${nonStaffName.trim()}${nonStaffMobile ? ` (${nonStaffMobile})` : ''}`;
      }

      const finalNarration = narration || `Cash deposit on ${dateBs}` + (depositorLabel ? ` | ${depositorLabel}` : '');

      const res = await createBankDeposit(selectedAccountId, {
        amount: Number(amount),
        sourceAccountId,
        dateBs,
        narration: finalNarration,
        invoiceNumber: invoiceNumber.trim() || undefined,
      });

      // Upload deposit voucher proof if provided
      let proofUrl: string | null = null;
      if (depositFile) {
        proofUrl = await uploadFileAsMedia(depositFile, 'deposit_voucher', `deposit-${res.voucher?.voucherNo || Date.now()}`);
      }

      setResult({
        success: true,
        message: `Deposit of ${formatNPR(Number(amount))} posted. Voucher: ${res.voucher?.voucherNo || 'N/A'}${depositorLabel ? ` | ${depositorLabel}` : ''}${proofUrl ? ' | Proof uploaded' : ''}`,
      });
      setAmount('');
      setNarration('');
      setInvoiceNumber('');
      handleDepositFileRemove();
      loadData();
    } catch (err: any) {
      setResult({ success: false, message: err?.response?.data?.error || err?.message || 'Deposit failed' });
    } finally {
      setSubmitting(false);
    }
  }, [selectedAccountId, amount, narration, invoiceNumber, dateBs, depositorType, selectedStaffId, selectedMember, nonStaffName, nonStaffMobile, staffList, sourceAccountId, depositFile, loadData, handleDepositFileRemove]);

  const handleWithdrawal = useCallback(async () => {
    if (!matchedLeaf || !selectedGlAccountId || !amount || Number(amount) <= 0 || !payeeName.trim()) return;
    setSubmitting(true);
    setResult(null);
    try {
      const chequeAdDate = DateConverter.bsToAd(chequeDateBs);
      const todayAd = DateConverter.bsToAd(dateBs);

      // 1. Mark cheque leaf as issued
      await markChequeLeafIssued({
        leafId: matchedLeaf.id,
        payeeName: payeeName.trim(),
        amount: Number(amount),
        chequeDateBs,
        chequeDateAd: chequeAdDate,
      });

      // 2. Post GL voucher (Dr Expense/Liability → Cr Bank)
      const res = await postBankChequeVoucher({
        bankAccountId: selectedGlAccountId,
        chequeLeafId: matchedLeaf.id,
        payeeName: payeeName.trim(),
        amount: Number(amount),
        voucherDateBS: dateBs,
        voucherDateAD: todayAd || dateBs,
        particulars: narration || `Bank cheque withdrawal #${matchedLeaf.chequeNumber} to ${payeeName.trim()}`,
        debitLedgerId: '',
      });

      // Upload cheque image proof if provided
      let proofUrl: string | null = null;
      if (chequeFile) {
        proofUrl = await uploadFileAsMedia(chequeFile, 'cheque_image', `cheque-${matchedLeaf.chequeNumber}`);
      }

      setResult({
        success: true,
        message: `Cheque #${matchedLeaf.chequeNumber} issued for ${formatNPR(Number(amount))} to ${payeeName.trim()}. Voucher: ${res.voucherNo}${proofUrl ? ' | Cheque image uploaded' : ''}`,
      });
      setAmount('');
      setNarration('');
      setChequeNumber('');
      setPayeeName('');
      setMatchedLeaf(null);
      handleChequeFileRemove();
      // Refresh available leaves
      const freshLeaves = await fetchBankChequeLeaves(selectedGlAccountId);
      setAvailableLeaves(freshLeaves);
      loadData();
    } catch (err: any) {
      setResult({ success: false, message: err?.response?.data?.error || err?.message || 'Cheque issuance failed' });
    } finally {
      setSubmitting(false);
    }
  }, [matchedLeaf, selectedGlAccountId, amount, payeeName, chequeDateBs, dateBs, narration, chequeFile, loadData, handleChequeFileRemove]);

  const getBankName = (bankId: string) => banks.find(b => b.id === bankId)?.name || 'Unknown Bank';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        <span className="ml-2 text-sm text-slate-500">Loading bank accounts...</span>
      </div>
    );
  }

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Bank Cash Deposit & Withdrawal</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <Landmark className="w-3.5 h-3.5 text-slate-500" />
            <span>Record bank deposits, cash withdrawals, and view transaction history</span>
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Bank Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {bankAccounts.filter(a => a.isActive).map(ba => (
          <div
            key={ba.id}
            onClick={() => setSelectedAccountId(ba.id)}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              selectedAccountId === ba.id
                ? 'border-emerald-500 bg-emerald-50/50 shadow-md'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{getBankName(ba.bankId)}</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">{ba.accountName}</div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">{ba.accountNumber}</div>
              </div>
              {ba.isPrimary && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded">PRIMARY</span>
              )}
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">GL Balance</span>
              <span className="font-mono text-sm font-black text-emerald-700">{formatNPR(ba.glBalance ?? ba.openingBalance ?? 0)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {(['deposit', 'withdrawal', 'transactions'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab === 'deposit' && <ArrowDownLeft className="w-3.5 h-3.5 inline mr-1.5" />}
            {tab === 'withdrawal' && <ArrowUpRight className="w-3.5 h-3.5 inline mr-1.5" />}
            {tab === 'transactions' && <Banknote className="w-3.5 h-3.5 inline mr-1.5" />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Result Banner */}
      {result && (
        <div className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
          result.success
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {result.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {result.message}
        </div>
      )}

      {/* DEPOSIT TAB */}
      {activeTab === 'deposit' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs max-w-xl space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-emerald-50 rounded-lg border border-emerald-100 text-emerald-700">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Bank Cash Deposit</h2>
              <p className="text-[11px] text-slate-500">Record cash deposit into the selected bank account</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">
                Invoice Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-2083-0042"
                required
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">
                Amount (NPR) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Enter deposit amount"
                className="w-full px-3 py-2.5 text-lg font-mono font-black text-emerald-700 border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none bg-emerald-50/30"
              />
              {amount && <div className="text-xs text-slate-500 mt-1 font-medium">{formatNPR(Number(amount))}</div>}
            </div>
          </div>

          {/* Source GL Account */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">
              Source GL Account <span className="text-rose-500">*</span>
            </label>
            <select
              value={sourceAccountId}
              onChange={e => setSourceAccountId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-emerald-500 outline-none"
            >
              <option value="">Select source account...</option>
              {glAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.code} – {a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Date (BS)</label>
            <NepaliDatePicker value={dateBs} onChange={setDateBs} />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Narration</label>
            <textarea
              value={narration}
              onChange={e => setNarration(e.target.value)}
              placeholder="e.g. Cash received from member savings"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none resize-none"
            />
          </div>

          {/* Depositor Information */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
              Depositor Information
            </label>

            {/* Depositor Type Selector */}
            <div className="flex gap-2">
              {([
                { value: 'member' as const, label: 'Member' },
                { value: 'staff' as DepositorType, label: 'Staff' },
                { value: 'nonstaff' as const, label: 'Non-Staff' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setDepositorType(opt.value); setSelectedStaffId(''); setSelectedMember(null); setMemberSearchQuery(''); setMemberSearchResults([]); setNonStaffName(''); setNonStaffMobile(''); }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl border-2 transition-all ${
                    depositorType === opt.value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Staff Dropdown */}
            {depositorType === 'staff' && (
              <div>
                <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Select Staff</label>
                <select
                  value={selectedStaffId}
                  onChange={e => setSelectedStaffId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-emerald-500 outline-none"
                >
                  <option value="">Choose staff...</option>
                  {staffList.filter(s => s.status === 'active').map(s => (
                    <option key={s.id} value={s.id}>{s.fullName} ({s.employeeCode})</option>
                  ))}
                </select>
                {selectedStaffId && (() => {
                  const s = staffList.find(x => x.id === selectedStaffId);
                  return s ? (
                    <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-700 font-medium">
                      {s.fullName} | {s.phone || '—'} | {s.department || '—'}
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {/* Member Search */}
            {depositorType === 'member' && (
              <div>
                <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Search Member</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={memberSearchQuery}
                    onChange={e => handleMemberSearch(e.target.value)}
                    placeholder="Search by name, member no, or phone..."
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-emerald-500 outline-none"
                  />
                  {memberSearching && <Loader2 className="absolute right-3 top-2.5 w-4 h-4 animate-spin text-slate-400" />}
                </div>
                {memberSearchResults.length > 0 && (
                  <div className="mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {memberSearchResults.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { setSelectedMember(m); setMemberSearchQuery(`${m.name} (${m.memberCode})`); setMemberSearchResults([]); }}
                        className="w-full px-3 py-2.5 text-left text-sm hover:bg-emerald-50 flex items-center justify-between border-b border-slate-50 last:border-0"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">{m.name}</div>
                          <div className="text-[11px] text-slate-500">{m.memberCode} | {m.phone}</div>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </button>
                    ))}
                  </div>
                )}
                {selectedMember && (
                  <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-700 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    {selectedMember.name} | {selectedMember.memberCode} | {selectedMember.phone}
                  </div>
                )}
              </div>
            )}

            {/* Non-Staff */}
            {depositorType === 'nonstaff' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={nonStaffName}
                    onChange={e => setNonStaffName(e.target.value)}
                    placeholder="Depositor name"
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Mobile Number</label>
                  <input
                    type="tel"
                    value={nonStaffMobile}
                    onChange={e => setNonStaffMobile(e.target.value)}
                    placeholder="98XXXXXXXX"
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Deposit Voucher Proof Upload */}
          <div>
            <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">
              Deposit Voucher Proof (Optional)
            </label>
            {depositFile ? (
              <div className="flex items-center gap-3 p-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                {depositFilePreview ? (
                  <img src={depositFilePreview} alt="Preview" className="w-14 h-14 object-cover rounded-lg border border-emerald-200" />
                ) : (
                  <div className="w-14 h-14 flex items-center justify-center bg-emerald-100 rounded-lg border border-emerald-200">
                    <FileText className="w-6 h-6 text-emerald-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-900 truncate">{depositFile.name}</div>
                  <div className="text-[11px] text-slate-500">{(depositFile.size / 1024).toFixed(1)} KB</div>
                </div>
                <button onClick={handleDepositFileRemove} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="cursor-pointer flex items-center justify-center gap-2 px-3 py-3 border border-dashed border-emerald-400 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition">
                <Upload className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-800">Upload Deposit Voucher / Receipt</span>
                <input
                  ref={depositFileRef}
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={handleDepositFile}
                  className="hidden"
                />
              </label>
            )}
            {depositFileError && <p className="text-[11px] text-red-600 font-semibold mt-1">{depositFileError}</p>}
          </div>

          <button
            onClick={handleDeposit}
            disabled={!selectedAccountId || !amount || Number(amount) <= 0 || !sourceAccountId || submitting}
            className="w-full py-3 bg-emerald-600 text-white font-bold text-sm rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownLeft className="w-4 h-4" />}
            {submitting ? 'Processing...' : 'Record Deposit'}
          </button>
        </div>
      )}

      {/* WITHDRAWAL TAB — Bank Cheque Issuance */}
      {activeTab === 'withdrawal' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs max-w-xl space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-amber-50 rounded-lg border border-amber-100 text-amber-700">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Bank Cheque Withdrawal</h2>
              <p className="text-[11px] text-slate-500">
                {selectedAccount
                  ? `Issue a bank cheque from ${getBankName(selectedAccount.bankId)} — ${selectedAccount.accountName}`
                  : 'Select a bank account above first'}
              </p>
            </div>
          </div>

          {!selectedAccountId ? (
            <div className="py-8 text-center text-sm text-slate-400">
              <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-slate-300" />
              Please select a bank account from the cards above to issue a cheque.
            </div>
          ) : (
            <>
              {/* Cheque Number */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">
                  Cheque Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={chequeNumber}
                    onChange={e => validateChequeNumber(e.target.value)}
                    placeholder="Enter cheque number..."
                    className="w-full pl-9 pr-3 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
                  />
                  {matchedLeaf && <CheckCircle2 className="absolute right-3 top-2.5 w-4 h-4 text-emerald-500" />}
                </div>
                {chequeError && (
                  <div className="mt-1.5 text-[11px] text-rose-600 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {chequeError}
                  </div>
                )}
                {matchedLeaf && (
                  <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-700 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Leaf #{matchedLeaf.leafNo} | Book: {matchedLeaf.bookNumber}
                    {matchedLeaf.prefix && ` | Prefix: ${matchedLeaf.prefix}`}
                  </div>
                )}
              </div>

              {/* Payee Name */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">
                  Payee Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={payeeName}
                    onChange={e => setPayeeName(e.target.value)}
                    placeholder="Enter payee name..."
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none"
                  />
                </div>
              </div>

              {/* Cheque Date */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">
                  Cheque Date (BS) <span className="text-rose-500">*</span>
                </label>
                <NepaliDatePicker value={chequeDateBs} onChange={setChequeDateBs} />
              </div>

              {/* Amount */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">
                  Amount (NPR) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Enter cheque amount"
                  className="w-full px-3 py-2.5 text-lg font-mono font-black text-amber-700 border border-slate-300 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none bg-amber-50/30"
                />
                {amount && <div className="text-xs text-slate-500 mt-1 font-medium">{formatNPR(Number(amount))}</div>}
              </div>

              {/* Remarks */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Remarks</label>
                <textarea
                  value={narration}
                  onChange={e => setNarration(e.target.value)}
                  placeholder="e.g. Loan disbursement via bank cheque"
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none resize-none"
                />
              </div>

              {/* Cheque Image Proof Upload */}
              <div>
                <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">
                  Cheque Image Proof (Optional)
                </label>
                {chequeFile ? (
                  <div className="flex items-center gap-3 p-2 bg-amber-50 border border-amber-200 rounded-xl">
                    {chequeFilePreview ? (
                      <img src={chequeFilePreview} alt="Cheque preview" className="w-14 h-14 object-cover rounded-lg border border-amber-200" />
                    ) : (
                      <div className="w-14 h-14 flex items-center justify-center bg-amber-100 rounded-lg border border-amber-200">
                        <FileText className="w-6 h-6 text-amber-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate">{chequeFile.name}</div>
                      <div className="text-[11px] text-slate-500">{(chequeFile.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <button onClick={handleChequeFileRemove} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex items-center justify-center gap-2 px-3 py-3 border border-dashed border-amber-400 bg-amber-50 hover:bg-amber-100 rounded-xl transition">
                    <Image className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-semibold text-amber-800">Upload Cheque Image</span>
                    <input
                      ref={chequeFileRef}
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      onChange={handleChequeFile}
                      className="hidden"
                    />
                  </label>
                )}
                {chequeFileError && <p className="text-[11px] text-red-600 font-semibold mt-1">{chequeFileError}</p>}
              </div>

              <button
                onClick={handleWithdrawal}
                disabled={!matchedLeaf || !payeeName.trim() || !amount || Number(amount) <= 0 || submitting}
                className="w-full py-3 bg-amber-600 text-white font-bold text-sm rounded-xl hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                {submitting ? 'Issuing Cheque...' : 'Issue Bank Cheque'}
              </button>
            </>
          )}
        </div>
      )}

      {/* TRANSACTIONS TAB */}
      {activeTab === 'transactions' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Banknote className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-900">Transaction History</h3>
            </div>
            <span className="text-xs text-slate-500">{transactions.length} transactions</span>
          </div>

          {voidResult && (
            <div className={`p-3 mx-4 mt-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
              voidResult.success
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {voidResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {voidResult.message}
            </div>
          )}

          {txLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              <span className="ml-2 text-sm text-slate-500">Loading transactions...</span>
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">No transactions found for this account.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600 uppercase tracking-wider">Voucher</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600 uppercase tracking-wider">Narration</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-slate-600 uppercase tracking-wider">Debit</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-slate-600 uppercase tracking-wider">Credit</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-slate-600 uppercase tracking-wider">Balance</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-slate-600 uppercase tracking-wider w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(() => {
                    // Group transactions by voucherId for void display
                    const grouped = new Map<string, any[]>();
                    for (const tx of transactions) {
                      if (!grouped.has(tx.voucherId)) grouped.set(tx.voucherId, []);
                      grouped.get(tx.voucherId)!.push(tx);
                    }
                    return transactions.map((tx: any) => {
                      const isFirstOfVoucher = grouped.get(tx.voucherId)?.[0]?.id === tx.id;
                      const voucherEntries = grouped.get(tx.voucherId) || [];
                      const isVoiding = voidingVoucherId === tx.voucherId;
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2 font-mono text-slate-700">{tx.dateBs}</td>
                          <td className="px-3 py-2 font-mono text-slate-600">{tx.voucherNo}</td>
                          <td className="px-3 py-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">{tx.voucherType}</span>
                          </td>
                          <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate">{tx.narration}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-rose-600">{tx.debit > 0 ? formatNPR(tx.debit) : '—'}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600">{tx.credit > 0 ? formatNPR(tx.credit) : '—'}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">{formatNPR(tx.runningBalance)}</td>
                          <td className="px-3 py-2 text-center">
                            {isFirstOfVoucher && voucherEntries.length > 1 && !isVoiding && (
                              <button
                                onClick={() => { setVoidingVoucherId(tx.voucherId); setVoidResult(null); }}
                                className="text-[10px] font-semibold text-rose-500 hover:text-rose-700 underline"
                                title="Void this voucher"
                              >Void</button>
                            )}
                            {isVoiding && (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={voidReason}
                                  onChange={e => setVoidReason(e.target.value)}
                                  placeholder="Reason..."
                                  className="w-24 px-1.5 py-1 border border-rose-300 rounded text-[10px]"
                                />
                                <button
                                  onClick={() => handleVoidVoucher(tx.voucherId)}
                                  disabled={!voidReason.trim() || voidSubmitting}
                                  className="text-[10px] font-bold text-rose-600 hover:text-rose-800 disabled:opacity-40"
                                >{voidSubmitting ? '...' : 'OK'}</button>
                                <button
                                  onClick={() => { setVoidingVoucherId(null); setVoidReason(''); }}
                                  className="text-[10px] text-slate-400 hover:text-slate-600"
                                >X</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
