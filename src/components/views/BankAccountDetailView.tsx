import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Building2, Wallet, CreditCard, BookOpen, FileText,
  Plus, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  ChevronDown, Eye, Printer, Ban, Clock, Landmark, Hash,
  CalendarRange, Banknote, Loader2, ArrowUpRight, ArrowDownLeft,
  History, Scale, ChevronRight,
} from 'lucide-react';
import { useCoop } from '../../context/CoopContext';
import {
  fetchBankAccountDetail,
  fetchBankTransactions,
  createBankDeposit,
  type BankAccountDetail,
  type BankAccountDetailBook,
  type BankAccountDetailLeaf,
  type BankTransaction,
} from '../../api/accountingSettings';
import { issueBankChequeBook } from '../../api/loanServicing';
import { formatNPR, getTodayBS, getCurrentFiscalYearCode } from '../../utils/nepaliCalendar';
import { DateConverter } from '../../utils/DateConverter';
import { apiClient } from '../../lib/apiClient';

interface Props {
  bankAccountId: string;
  onBack: () => void;
}

type TabKey = 'overview' | 'cheque_books' | 'transactions' | 'reconciliation';

export function BankAccountDetailView({ bankAccountId, onBack }: Props) {
  const { addNotification, openTab } = useCoop();
  const [tab, setTab] = useState<TabKey>('overview');
  const [detail, setDetail] = useState<BankAccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cheque book registration modal
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookMode, setBookMode] = useState<'range' | 'individual'>('range');
  const [bookForm, setBookForm] = useState({
    startingLeafNo: '',
    totalLeaves: 25,
    issuedDateBs: getTodayBS(),
    purpose: '',
  });
  const [individualLeaves, setIndividualLeaves] = useState<number[]>([]);
  const [leafInput, setLeafInput] = useState('');
  const [bookError, setBookError] = useState<string | null>(null);
  const [bookSubmitting, setBookSubmitting] = useState(false);

  const addIndividualLeaf = () => {
    const leaf = parseInt(leafInput, 10);
    if (isNaN(leaf) || leaf < 1) return;
    if (individualLeaves.includes(leaf)) {
      setBookError(`Leaf ${leaf} already added to this book`);
      return;
    }
    setBookError(null);
    setIndividualLeaves((prev) => [...prev, leaf].sort((a, b) => a - b));
    setLeafInput('');
  };

  const removeLeaf = (leaf: number) => {
    setIndividualLeaves((prev) => prev.filter((l) => l !== leaf));
  };

  // Void/cancel modal
  const [voidLeaf, setVoidLeaf] = useState<BankAccountDetailLeaf | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchBankAccountDetail(bankAccountId);
      setDetail(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load bank account details.');
    } finally {
      setLoading(false);
    }
  }, [bankAccountId]);

  useEffect(() => { load(); }, [load]);

  const bankAcc = detail?.bankAccount;
  const books = detail?.chequeBooks ?? [];
  const leaves = detail?.chequeLeaves ?? [];
  const statusCounts = detail?.leafStatusCounts ?? { unused: 0, issued: 0, cancelled: 0, cleared: 0 };

  // ─── Book Registration ──────────────────────────────────────────────────────

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookError(null);

    if (!bankAcc?.glAccountId) {
      addNotification('Validation Error', 'This bank account has no linked GL account.', 'alert');
      return;
    }

    try {
      setBookSubmitting(true);
      const adDate = DateConverter.bsToAd(bookForm.issuedDateBs);

      if (bookMode === 'individual') {
        if (individualLeaves.length === 0) {
          setBookError('Add at least one leaf number.');
          setBookSubmitting(false);
          return;
        }
        const result = await issueBankChequeBook({
          bankAccountId: bankAcc.glAccountId,
          mode: 'individual',
          leafNumbers: individualLeaves,
          issuedDateBs: bookForm.issuedDateBs,
          issuedDateAd: adDate || bookForm.issuedDateBs,
          purpose: bookForm.purpose.trim() || undefined,
        });
        addNotification('Cheque Book Registered', `${result.leafCount} leaves registered: ${result.chequeRange}`, 'success');
        setShowBookModal(false);
        setIndividualLeaves([]);
        setLeafInput('');
      } else {
        const startLeaf = Number(bookForm.startingLeafNo);
        if (isNaN(startLeaf) || startLeaf < 1) {
          setBookError('Starting leaf number must be a positive integer.');
          setBookSubmitting(false);
          return;
        }
        if (bookForm.totalLeaves < 1 || bookForm.totalLeaves > 500) {
          setBookError('Total leaves must be between 1 and 500.');
          setBookSubmitting(false);
          return;
        }
        const result = await issueBankChequeBook({
          bankAccountId: bankAcc.glAccountId,
          mode: 'range',
          startingLeafNo: startLeaf,
          totalLeaves: bookForm.totalLeaves,
          issuedDateBs: bookForm.issuedDateBs,
          issuedDateAd: adDate || bookForm.issuedDateBs,
          purpose: bookForm.purpose.trim() || undefined,
        });
        addNotification('Cheque Book Registered', `${result.leafCount} leaves created: ${result.chequeRange}`, 'success');
        setShowBookModal(false);
      }

      setBookForm({ startingLeafNo: '', totalLeaves: 25, issuedDateBs: getTodayBS(), purpose: '' });
      await load();
    } catch (e: any) {
      const msg = e.response?.data?.error || e.message || 'Failed to register cheque book.';
      setBookError(msg);
      addNotification('Registration Failed', msg, 'alert');
    } finally {
      setBookSubmitting(false);
    }
  };

  // ─── Void / Cancel Leaf ─────────────────────────────────────────────────────

  const handleVoidLeaf = async () => {
    if (!voidLeaf || !voidReason.trim()) {
      addNotification('Validation Error', 'Reason is required to void a cheque.', 'alert');
      return;
    }
    try {
      const { apiClient } = await import('../../lib/apiClient');
      await apiClient.post('/bank-cheques/void', { leafId: voidLeaf.id, reason: voidReason.trim() });
      addNotification('Cheque Voided', `Cheque ${voidLeaf.chequeNumber} has been voided.`, 'success');
      setVoidLeaf(null);
      setVoidReason('');
      await load();
    } catch (e: any) {
      addNotification('Void Failed', e.response?.data?.error || e.message || 'Failed to void cheque.', 'alert');
    }
  };

  // ─── Clear / Bounce Leaf ───────────────────────────────────────────────────

  // ─── Transactions Tab State ────────────────────────────────────────────────

  const [txnLoading, setTxnLoading] = useState(false);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [txnFilter, setTxnFilter] = useState<'all' | 'cheque'>('all');
  const [openingBalance, setOpeningBalance] = useState(0);

  // ─── Deposit Form State ────────────────────────────────────────────────────

  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositForm, setDepositForm] = useState({
    amount: '',
    sourceAccountId: '',
    dateBs: getTodayBS(),
    narration: '',
    invoiceNumber: '',
  });
  const [depositSubmitting, setDepositSubmitting] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [glAccounts, setGlAccounts] = useState<{ id: string; code: string; name: string; type: string }[]>([]);

  // ─── Reconciliation Tab State ──────────────────────────────────────────────

  const [reconLoading, setReconLoading] = useState(false);
  const [reconSessions, setReconSessions] = useState<any[]>([]);
  const [showReconForm, setShowReconForm] = useState(false);
  const [reconForm, setReconForm] = useState({ statementBalance: '', dateFrom: getTodayBS(), dateTo: getTodayBS(), remarks: '' });
  const [reconSubmitting, setReconSubmitting] = useState(false);
  const [reconError, setReconError] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    if (!bankAccountId) return;
    try {
      setTxnLoading(true);
      const data = await fetchBankTransactions(bankAccountId, { chequeOnly: txnFilter === 'cheque' });
      setTransactions(data.transactions);
      setOpeningBalance(data.openingBalance ?? 0);
    } catch {
      setTransactions([]);
      setOpeningBalance(0);
    } finally {
      setTxnLoading(false);
    }
  }, [bankAccountId, txnFilter]);

  useEffect(() => {
    if (tab === 'transactions') loadTransactions();
  }, [tab, loadTransactions]);

  // ─── Load GL accounts for deposit source ──────────────────────────────────

  const loadGlAccounts = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/accounting/settings/coa');
      const accts = data.accounts || data;
      setGlAccounts(accts.filter((a: any) => a.allowPosting !== false).map((a: any) => ({
        id: a.id, code: a.code, name: a.name, type: a.type,
      })));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (tab === 'transactions' || showDepositModal) loadGlAccounts();
  }, [tab, showDepositModal, loadGlAccounts]);

  // ─── Load reconciliation sessions for this bank account ───────────────────

  const loadReconSessions = useCallback(async () => {
    if (!bankAcc?.glAccountId) return;
    try {
      setReconLoading(true);
      const { data } = await apiClient.get('/reconciliation/sessions', { params: { type: 'bank' } });
      setReconSessions(data.filter((s: any) => s.glAccountId === bankAcc.glAccountId));
    } catch { setReconSessions([]); }
    finally { setReconLoading(false); }
  }, [bankAcc?.glAccountId]);

  useEffect(() => {
    if (tab === 'reconciliation') loadReconSessions();
  }, [tab, loadReconSessions]);

  // ─── Handle Deposit ──────────────────────────────────────────────────────

  const handleDeposit = async () => {
    if (!bankAcc?.id) return;
    setDepositError(null);

    const amt = parseFloat(depositForm.amount);
    if (!amt || amt <= 0) { setDepositError('Enter a positive deposit amount.'); return; }
    if (!depositForm.sourceAccountId) { setDepositError('Select a source account.'); return; }

    try {
      setDepositSubmitting(true);
      await createBankDeposit(bankAcc.id, {
        amount: amt,
        sourceAccountId: depositForm.sourceAccountId,
        dateBs: depositForm.dateBs,
        narration: depositForm.narration.trim() || undefined,
        branchId: bankAcc.branchId || undefined,
        invoiceNumber: depositForm.invoiceNumber.trim() || undefined,
      });
      addNotification('Deposit Recorded', `${formatNPR(amt)} deposited successfully.`, 'success');
      setShowDepositModal(false);
      setDepositForm({ amount: '', sourceAccountId: '', dateBs: getTodayBS(), narration: '', invoiceNumber: '' });
      await load();
      await loadTransactions();
    } catch (e: any) {
      const msg = e.response?.data?.error || e.message || 'Deposit failed.';
      setDepositError(msg);
      addNotification('Deposit Failed', msg, 'alert');
    } finally {
      setDepositSubmitting(false);
    }
  };

  // ─── Handle Reconciliation Session Start ──────────────────────────────────

  const handleStartRecon = async () => {
    if (!bankAcc?.glAccountId || !bankAcc?.id) return;
    setReconError(null);

    const stmtBal = parseFloat(reconForm.statementBalance);
    if (!stmtBal || stmtBal <= 0) { setReconError('Enter a positive statement balance.'); return; }

    try {
      setReconSubmitting(true);
      const todayAd = DateConverter.bsToAd(reconForm.dateTo);
      const { data: sess } = await apiClient.post('/reconciliation/sessions', {
        branchId: bankAcc.branchId || '',
        reconciliationType: 'bank',
        bankAccountId: bankAcc.id,
        glAccountId: bankAcc.glAccountId,
        reconcileDateBs: reconForm.dateTo,
        reconcileDateAd: todayAd,
        statementPeriodFrom: reconForm.dateFrom,
        statementPeriodTo: reconForm.dateTo,
      });

      await apiClient.put(`/reconciliation/sessions/${sess.id}`, {
        statementBalance: stmtBal,
        statementOpeningBalance: 0,
        statementPeriodFrom: reconForm.dateFrom,
        statementPeriodTo: reconForm.dateTo,
        remarks: reconForm.remarks,
      });

      addNotification('Reconciliation Started', 'Session created. Navigate to Bank Reconciliation to complete.', 'success');
      setShowReconForm(false);
      setReconForm({ statementBalance: '', dateFrom: getTodayBS(), dateTo: getTodayBS(), remarks: '' });
      await loadReconSessions();
    } catch (e: any) {
      const msg = e.response?.data?.error || e.message || 'Failed to start reconciliation.';
      setReconError(msg);
      addNotification('Reconciliation Failed', msg, 'alert');
    } finally {
      setReconSubmitting(false);
    }
  };

  // ─── Loading / Error States ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <span className="text-sm text-slate-500">Loading bank account details…</span>
      </div>
    );
  }

  if (error || !bankAcc) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <AlertTriangle className="w-8 h-8 text-rose-500" />
        <span className="text-sm text-rose-600 font-semibold">{error || 'Bank account not found.'}</span>
        <button onClick={onBack} className="mt-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold cursor-pointer">Go Back</button>
      </div>
    );
  }

  // ─── Overview Tab ───────────────────────────────────────────────────────────

  const renderOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* GL Balance */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center"><Wallet className="w-5 h-5 text-emerald-600" /></div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">GL Balance</span>
        </div>
        <p className="text-2xl font-mono font-bold text-slate-900">{formatNPR(detail?.glBalance ?? 0)}</p>
        <p className="text-[11px] text-slate-400 mt-1">Ledger: {bankAcc.glAccountCode ?? '—'} {bankAcc.glAccountName ?? ''}</p>
      </div>

      {/* Active Cheque Books */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center"><BookOpen className="w-5 h-5 text-blue-600" /></div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Cheque Books</span>
        </div>
        <p className="text-2xl font-mono font-bold text-slate-900">{books.filter((b) => b.status === 'active').length}</p>
        <p className="text-[11px] text-slate-400 mt-1">{books.length} total registered</p>
      </div>

      {/* Available Cheques */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-violet-600" /></div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Available Cheques</span>
        </div>
        <p className="text-2xl font-mono font-bold text-emerald-600">{statusCounts.unused}</p>
        <p className="text-[11px] text-slate-400 mt-1">Ready for use</p>
      </div>

      {/* Issued Cheques */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center"><Clock className="w-5 h-5 text-amber-600" /></div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Issued / Outstanding</span>
        </div>
        <p className="text-2xl font-mono font-bold text-amber-600">{statusCounts.issued}</p>
        <p className="text-[11px] text-slate-400 mt-1">{statusCounts.cancelled} cancelled</p>
      </div>

      {/* Account Info Card */}
      <div className="md:col-span-2 xl:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Account Information</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div><span className="text-slate-400">Account Name</span><p className="font-bold text-slate-900">{bankAcc.accountName}</p></div>
          <div><span className="text-slate-400">Account Number</span><p className="font-mono font-bold text-emerald-700">{bankAcc.accountNumber}</p></div>
          <div><span className="text-slate-400">Bank</span><p className="font-bold text-slate-900">{bankAcc.bankName ?? '—'}</p></div>
          <div><span className="text-slate-400">Type</span><p className="font-bold text-slate-900">{bankAcc.accountType}</p></div>
          <div><span className="text-slate-400">Currency</span><p className="font-bold text-slate-900">{bankAcc.currency}</p></div>
          <div><span className="text-slate-400">Opening Balance</span><p className="font-mono font-bold text-slate-900">{formatNPR(Number(bankAcc.openingBalance))}</p></div>
          <div><span className="text-slate-400">Status</span><p className={`font-bold ${bankAcc.isActive ? 'text-emerald-600' : 'text-rose-500'}`}>{bankAcc.isActive ? 'Active' : 'Inactive'}</p></div>
          <div><span className="text-slate-400">Primary</span><p className="font-bold text-slate-900">{bankAcc.isPrimary ? 'Yes' : 'No'}</p></div>
        </div>
      </div>
    </div>
  );

  // ─── Cheque Books Tab ───────────────────────────────────────────────────────

  const renderChequeBooks = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700">Registered Cheque Books</h3>
        <button
          onClick={() => setShowBookModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-md"
        >
          <Plus className="w-4 h-4" /> Register Cheque Book
        </button>
      </div>
      {books.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-semibold">No cheque books registered yet.</p>
          <p className="text-[11px] text-slate-400 mt-1">Click "Register Cheque Book" to add one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {books.map((book) => {
            const bookLeaves = leaves.filter((l) => l.chequeBookId === book.id);
            const bookUnused = bookLeaves.filter((l) => l.status === 'unused').length;
            const bookIssued = bookLeaves.filter((l) => l.status === 'issued').length;
            const bookCancelled = bookLeaves.filter((l) => l.status === 'cancelled').length;
            return (
              <div key={book.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-slate-900 text-sm">{book.bookNumber}</span>
                    {book.prefix && <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">Prefix: {book.prefix}</span>}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${book.status === 'active' ? 'bg-emerald-50 text-emerald-600' : book.status === 'exhausted' ? 'bg-slate-100 text-slate-500' : 'bg-rose-50 text-rose-600'}`}>
                      {book.status.toUpperCase()}
                    </span>
                    {book.leafNumbersJson && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">NON-SEQUENTIAL</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">{book.issuedDateBs}</span>
                    <button
                      onClick={() => openTab('bank_cheque_book_detail', `Cheque Book - ${book.bookNumber}`, 'BookOpen', book.id, { bankAccountId })}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] rounded-lg flex items-center gap-1.5 transition cursor-pointer border border-emerald-200"
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  <div><span className="text-slate-400">Range</span><p className="font-mono font-bold text-slate-900">{book.leafStartNumber} – {book.leafEndNumber}</p></div>
                  <div><span className="text-slate-400">Total Leaves</span><p className="font-mono font-bold text-slate-900">{book.leafCount}</p></div>
                  <div><span className="text-slate-400">Available</span><p className="font-mono font-bold text-emerald-600">{bookUnused}</p></div>
                  <div><span className="text-slate-400">Issued</span><p className="font-mono font-bold text-amber-600">{bookIssued}</p></div>
                  <div><span className="text-slate-400">Cancelled</span><p className="font-mono font-bold text-rose-500">{bookCancelled}</p></div>
                </div>
                {book.purpose && <p className="text-[11px] text-slate-400 mt-2">Purpose: {book.purpose}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ─── Transactions History Tab ──────────────────────────────────────────────

  const renderTransactions = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-bold text-slate-700">GL Ledger: {bankAcc.glAccountCode ?? '—'} {bankAcc.glAccountName ?? ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTxnFilter('all')}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${txnFilter === 'all' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'}`}
          >All Entries</button>
          <button
            onClick={() => setTxnFilter('cheque')}
            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${txnFilter === 'cheque' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'}`}
          >Cheque Only</button>
          <button onClick={() => {
            const cashAcct = glAccounts.find(a => a.code === '04-80');
            setDepositForm(prev => ({ ...prev, sourceAccountId: cashAcct?.id || prev.sourceAccountId }));
            setShowDepositModal(true);
          }}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-md">
            <ArrowDownLeft className="w-3.5 h-3.5" /> Deposit
          </button>
          <button onClick={loadTransactions} className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      </div>

      {txnLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-emerald-600 animate-spin" /></div>
      ) : transactions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <History className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-semibold">No transactions found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-bold text-slate-600">Date</th>
                  <th className="px-4 py-2.5 text-left font-bold text-slate-600">Voucher No.</th>
                  <th className="px-4 py-2.5 text-left font-bold text-slate-600">Particulars</th>
                  <th className="px-4 py-2.5 text-left font-bold text-slate-600">Cheque Ref</th>
                  <th className="px-4 py-2.5 text-right font-bold text-slate-600">Debit</th>
                  <th className="px-4 py-2.5 text-right font-bold text-slate-600">Credit</th>
                  <th className="px-4 py-2.5 text-right font-bold text-slate-600">Balance</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening Balance Row */}
                <tr className="bg-slate-100 border-b-2 border-slate-300">
                  <td className="px-4 py-2 text-slate-500 font-mono whitespace-nowrap" colSpan={4}>
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Opening Balance</span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-bold text-slate-500" colSpan={2}></td>
                  <td className={`px-4 py-2 text-right font-mono font-bold text-sm ${openingBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>{formatNPR(openingBalance)}</td>
                </tr>
                {transactions.map((txn) => (
                  <tr key={txn.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                    <td className="px-4 py-2 text-slate-500 font-mono whitespace-nowrap">{txn.dateBs}</td>
                    <td className="px-4 py-2">
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">{txn.voucherNo}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-700 max-w-[250px] truncate">{txn.narration}</td>
                    <td className="px-4 py-2">
                      {txn.chequeNumber ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                          <Hash className="w-2.5 h-2.5" />{txn.chequeNumber}
                          <span className={`ml-1 text-[8px] px-1 rounded ${txn.chequeStatus === 'cleared' ? 'bg-blue-100 text-blue-600' : txn.chequeStatus === 'cancelled' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                            {txn.chequeStatus?.toUpperCase()}
                          </span>
                        </span>
                      ) : txn.moduleReference ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          {txn.moduleReference}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-emerald-700">{txn.debit > 0 ? formatNPR(txn.debit) : '—'}</td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-rose-600">{txn.credit > 0 ? formatNPR(txn.credit) : '—'}</td>
                    <td className={`px-4 py-2 text-right font-mono font-bold ${txn.runningBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>{formatNPR(txn.runningBalance)}</td>
                  </tr>
                ))}
                {/* Closing Balance Row */}
                {transactions.length > 0 && (
                  <tr className="bg-slate-100 border-t-2 border-slate-300">
                    <td className="px-4 py-2 text-slate-500 font-mono whitespace-nowrap" colSpan={4}>
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Closing Balance</span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-slate-500" colSpan={2}></td>
                    <td className={`px-4 py-2 text-right font-mono font-bold text-sm ${transactions[transactions.length - 1].runningBalance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>{formatNPR(transactions[transactions.length - 1].runningBalance)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  // ─── Bank Reconciliation (BRS) Tab ────────────────────────────────────────

  const renderReconciliation = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center"><Scale className="w-5 h-5 text-indigo-600" /></div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Bank Reconciliation Statement (BRS)</h3>
              <p className="text-[11px] text-slate-500">Match your book balance with the bank statement balance.</p>
            </div>
          </div>
          <button onClick={() => setShowReconForm(!showReconForm)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-md">
            <Plus className="w-4 h-4" /> Start New Reconciliation
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
            <p className="text-[11px] text-emerald-600 font-bold uppercase tracking-wider mb-1">Book Balance (GL)</p>
            <p className="text-xl font-mono font-bold text-emerald-800">{formatNPR(detail?.glBalance ?? 0)}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <p className="text-[11px] text-blue-600 font-bold uppercase tracking-wider mb-1">Last Reconciled</p>
            <p className="text-xl font-mono font-bold text-blue-800">{bankAcc.lastReconciledDateBs || 'Never'}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <p className="text-[11px] text-amber-600 font-bold uppercase tracking-wider mb-1">Status</p>
            <p className="text-xl font-mono font-bold text-amber-800">
              {reconSessions.length > 0 ? `${reconSessions.length} Session(s)` : 'Not Reconciled'}
            </p>
          </div>
        </div>

        {/* Start New Reconciliation Form */}
        {showReconForm && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
            <h4 className="text-xs font-bold text-slate-700 mb-3">New Reconciliation Session</h4>
            {reconError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[11px] text-red-700 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {reconError}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Statement Closing Balance (NPR)</label>
                <input type="number" value={reconForm.statementBalance}
                  onChange={e => setReconForm({ ...reconForm, statementBalance: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 500000" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Period From (BS)</label>
                <input type="date" value={reconForm.dateFrom}
                  onChange={e => setReconForm({ ...reconForm, dateFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Period To (BS)</label>
                <input type="date" value={reconForm.dateTo}
                  onChange={e => setReconForm({ ...reconForm, dateTo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Remarks</label>
              <input type="text" value={reconForm.remarks}
                onChange={e => setReconForm({ ...reconForm, remarks: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                placeholder="Optional notes..." />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowReconForm(false)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer">Cancel</button>
              <button onClick={handleStartRecon} disabled={reconSubmitting}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-md disabled:opacity-60">
                {reconSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scale className="w-3.5 h-3.5" />}
                Start Reconciliation
              </button>
            </div>
          </div>
        )}

        {/* Previous reconciliation sessions */}
        {reconLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-indigo-600 animate-spin" /></div>
        ) : reconSessions.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center">
            <Scale className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-semibold">No reconciliation sessions yet.</p>
            <p className="text-[11px] text-slate-400 mt-1">Click "Start New Reconciliation" to begin.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-bold text-slate-600">Date</th>
                  <th className="px-4 py-2.5 text-left font-bold text-slate-600">Period</th>
                  <th className="px-4 py-2.5 text-right font-bold text-slate-600">Book Balance</th>
                  <th className="px-4 py-2.5 text-right font-bold text-slate-600">Statement Balance</th>
                  <th className="px-4 py-2.5 text-right font-bold text-slate-600">Variance</th>
                  <th className="px-4 py-2.5 text-center font-bold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {reconSessions.map((s: any) => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-2 font-mono">{s.reconcileDateBs}</td>
                    <td className="px-4 py-2 text-slate-500">{s.statementPeriodFrom && s.statementPeriodTo ? `${s.statementPeriodFrom} → ${s.statementPeriodTo}` : '—'}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatNPR(Number(s.bookBalance))}</td>
                    <td className="px-4 py-2 text-right font-mono">{Number(s.statementBalance) > 0 ? formatNPR(Number(s.statementBalance)) : '—'}</td>
                    <td className={`px-4 py-2 text-right font-mono font-bold ${Number(s.variance) === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {Number(s.statementBalance) > 0 ? formatNPR(Math.abs(Number(s.variance))) : '—'}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        s.status === 'reconciled' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        s.status === 'exception' ? 'bg-red-50 text-red-700 border-red-200' :
                        s.status === 'in_progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {s.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  // ─── Main Render ────────────────────────────────────────────────────────────

  const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Eye className="w-3.5 h-3.5" /> },
    { key: 'cheque_books', label: 'Cheque Books', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { key: 'transactions', label: 'Transactions', icon: <History className="w-3.5 h-3.5" /> },
    { key: 'reconciliation', label: 'Reconciliation', icon: <Scale className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer" title="Back to bank accounts">
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </button>
        <div className="flex items-center gap-2.5">
          <Building2 className="w-5 h-5 text-emerald-600" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">{bankAcc.accountName}</h2>
            <p className="text-[11px] text-slate-500">{bankAcc.bankCode ?? ''} · {bankAcc.accountNumber} · {bankAcc.accountType}</p>
          </div>
        </div>
        <button onClick={load} className="ml-auto p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer" title="Refresh">
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${tab === t.key ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && renderOverview()}
      {tab === 'cheque_books' && renderChequeBooks()}
      {tab === 'transactions' && renderTransactions()}
      {tab === 'reconciliation' && renderReconciliation()}

      {/* ─── Register Cheque Book Modal ─────────────────────────────────── */}
      {showBookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-slate-900">Register New Cheque Book</h3>
              </div>
              <button onClick={() => setShowBookModal(false)} className="text-slate-500 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleBookSubmit} className="space-y-4 text-xs">
              {/* ── Mode Toggle ── */}
              <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-bold">
                <button
                  type="button"
                  onClick={() => { setBookMode('range'); setBookError(null); }}
                  className={`flex-1 py-2 transition cursor-pointer ${bookMode === 'range' ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                >
                  Range Mode
                </button>
                <button
                  type="button"
                  onClick={() => { setBookMode('individual'); setBookError(null); }}
                  className={`flex-1 py-2 transition cursor-pointer ${bookMode === 'individual' ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                >
                  Individual Mode
                </button>
              </div>

              {/* ── Error Banner ── */}
              {bookError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-[11px] text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {bookError}
                </div>
              )}

              {/* ── Common Fields ── */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Issue Date (BS) <span className="text-emerald-600">*</span></label>
                  <input
                    value={bookForm.issuedDateBs}
                    onChange={(e) => setBookForm({ ...bookForm, issuedDateBs: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:border-emerald-500 focus:outline-none"
                    placeholder="2083-06-15"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Purpose</label>
                  <input
                    value={bookForm.purpose}
                    onChange={(e) => setBookForm({ ...bookForm, purpose: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none"
                    placeholder="Loan disbursements, general payments…"
                  />
                </div>
              </div>

              {/* ── Range Mode Fields ── */}
              {bookMode === 'range' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Starting Leaf No. <span className="text-emerald-600">*</span></label>
                      <input
                        type="number"
                        value={bookForm.startingLeafNo}
                        onChange={(e) => setBookForm({ ...bookForm, startingLeafNo: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:border-emerald-500 focus:outline-none"
                        placeholder="e.g. 1001"
                        min="1"
                        required
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Starting leaf number from your physical cheque book.</p>
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Total Leaves <span className="text-emerald-600">*</span></label>
                      <input
                        type="number"
                        value={bookForm.totalLeaves}
                        onChange={(e) => setBookForm({ ...bookForm, totalLeaves: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:border-emerald-500 focus:outline-none"
                        min="1"
                        max="500"
                        required
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Number of leaves in this book (1–500).</p>
                    </div>
                  </div>
                  {bookForm.startingLeafNo && bookForm.totalLeaves > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-[11px] flex items-center justify-between">
                      <span className="text-emerald-700 font-semibold">Cheque Range:</span>
                      <span className="font-mono font-bold text-emerald-800">
                        {String(Number(bookForm.startingLeafNo)).padStart(6, '0')}-{getCurrentFiscalYearCode()}-001
                        {' → '}
                        {String(Number(bookForm.startingLeafNo) + bookForm.totalLeaves - 1).padStart(6, '0')}-{getCurrentFiscalYearCode()}-001
                      </span>
                    </div>
                  )}
                  <div className="bg-slate-50 rounded-xl p-3 text-[11px] text-slate-500">
                    <p>Sequential range. System generates all leaves from start to start+count-1.</p>
                  </div>
                </div>
              )}

              {/* ── Individual Mode Fields ── */}
              {bookMode === 'individual' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-slate-700 font-bold mb-1">Leaf No.</label>
                      <input
                        type="number"
                        value={leafInput}
                        onChange={(e) => setLeafInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIndividualLeaf(); } }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:border-emerald-500 focus:outline-none"
                        placeholder="e.g. 1001"
                        min="1"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addIndividualLeaf}
                      className="self-end px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                  {individualLeaves.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-3 py-1.5 text-[10px] font-bold text-slate-500 flex items-center justify-between">
                        <span>Added Leaves ({individualLeaves.length})</span>
                        <span className="text-slate-400">Click × to remove</span>
                      </div>
                      <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                        {individualLeaves.map((leaf) => (
                          <div key={leaf} className="flex items-center justify-between px-3 py-1.5 text-[11px] hover:bg-slate-50">
                            <span className="font-mono text-slate-700">{leaf}</span>
                            <span className="font-mono text-emerald-700 font-semibold">
                              {String(leaf).padStart(6, '0')}-{getCurrentFiscalYearCode()}-001
                            </span>
                            <button type="button" onClick={() => removeLeaf(leaf)} className="text-red-400 hover:text-red-600 cursor-pointer p-0.5">
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-xl p-3 text-[11px] text-slate-500 text-center">
                      No leaves added yet. Enter leaf numbers one by one — gaps are fine.
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button type="button" onClick={() => { setShowBookModal(false); setBookError(null); setIndividualLeaves([]); }} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer">Cancel</button>
                <button type="submit" disabled={bookSubmitting} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-2 transition cursor-pointer shadow-md disabled:opacity-60">
                  {bookSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Register Book
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Void Cheque Modal ──────────────────────────────────────────── */}
      {voidLeaf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-rose-600" />
              <h3 className="text-lg font-bold text-slate-900">Void Cheque {voidLeaf.chequeNumber}</h3>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-[11px] text-rose-700">
              This action is <strong>irreversible</strong>. The cheque leaf will be marked as CANCELLED and cannot be used for any payment.
            </div>
            <div>
              <label className="block text-slate-700 font-bold text-xs mb-1">Reason for voiding <span className="text-rose-500">*</span></label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-rose-500 focus:outline-none resize-none"
                rows={3}
                placeholder="e.g. Cheque damaged, incorrect details…"
                required
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button onClick={() => { setVoidLeaf(null); setVoidReason(''); }} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer">Cancel</button>
              <button onClick={handleVoidLeaf} disabled={!voidReason.trim()} className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl flex items-center gap-2 transition cursor-pointer shadow-md disabled:opacity-60">
                <Ban className="w-4 h-4" /> Void Cheque
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Deposit Modal ─────────────────────────────────────────────────── */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-slate-900">Deposit to {bankAcc.accountName}</h3>
              </div>
              <button onClick={() => { setShowDepositModal(false); setDepositError(null); }}
                className="text-slate-500 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-700">
              This creates a <strong>Receipt voucher</strong>: Dr Bank GL Account / Cr Source Account. Both GL balances update immediately and entries appear in all 4 ledger books.
            </div>

            {depositError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-[11px] text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {depositError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold text-xs mb-1">Deposit Amount (NPR) <span className="text-emerald-600">*</span></label>
                <input type="number" value={depositForm.amount}
                  onChange={e => setDepositForm({ ...depositForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-emerald-200 rounded-xl text-sm font-mono font-bold focus:border-emerald-500 focus:outline-none"
                  placeholder="e.g. 50000"
                  min="0.01" step="0.01" required />
              </div>
              <div>
                <label className="block text-slate-700 font-bold text-xs mb-1">Deposit Date (BS) <span className="text-emerald-600">*</span></label>
                <input type="date" value={depositForm.dateBs}
                  onChange={e => setDepositForm({ ...depositForm, dateBs: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:border-emerald-500 focus:outline-none" required />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold text-xs mb-1">Source GL Account <span className="text-emerald-600">*</span></label>
              <select value={depositForm.sourceAccountId}
                onChange={e => setDepositForm({ ...depositForm, sourceAccountId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none" required>
                <option value="">Select source account…</option>
                {glAccounts.filter(a => a.id !== bankAcc.glAccountId).map(a => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name} ({a.type})</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">The source account will be credited. E.g. Cash, Member Savings, Share Capital, etc.</p>
            </div>

            <div>
              <label className="block text-slate-700 font-bold text-xs mb-1">Narration</label>
              <input type="text" value={depositForm.narration}
                onChange={e => setDepositForm({ ...depositForm, narration: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none"
                placeholder="e.g. Member cash deposit, Transfer from savings…" />
            </div>

            <div>
              <label className="block text-slate-700 font-bold text-xs mb-1">Invoice / Reference Number</label>
              <input type="text" value={depositForm.invoiceNumber}
                onChange={e => setDepositForm({ ...depositForm, invoiceNumber: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-emerald-500 focus:outline-none"
                placeholder="e.g. INV-12345, memo no…" />
              <p className="text-[10px] text-slate-400 mt-1">Optional reference number displayed in the transaction details.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button onClick={() => { setShowDepositModal(false); setDepositError(null); }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer">
                Cancel
              </button>
              <button onClick={handleDeposit} disabled={depositSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-2 transition cursor-pointer shadow-md disabled:opacity-60">
                {depositSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownLeft className="w-4 h-4" />}
                Record Deposit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
