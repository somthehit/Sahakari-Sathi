/**
 * CashReconciliationView — Proper Bank Reconciliation
 *
 * Formula:
 *   Bank Statement Balance
 *     + Deposits in Transit
 *     - Outstanding Cheques
 *     ± Adjustments (bank charges, interest, etc.)
 *     = Adjusted Bank Balance
 *
 *   Adjusted Bank Balance == System Book Balance → Reconciled ✓
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft, Search, CheckCircle2, AlertTriangle, RefreshCw, Scale,
  Banknote, Building2, Plus, Minus, X, Loader2, Calendar, Eye, Clock,
  CreditCard, TrendingDown, TrendingUp, FileText, Ban, ChevronDown,
  ChevronRight, Printer, Download, BookOpen,
} from 'lucide-react';
import { useCoop } from '../../context/CoopContext';
import {
  createReconciliationSession,
  fetchReconciliationSessions,
  fetchReconciliationById,
  updateReconciliationSession,
  fetchOutstandingCheques,
  addOutstandingItems,
  updateOutstandingItem,
  addStatementEntries,
  addAdjustment,
  deleteAdjustment,
  autoMatchEntries,
  fetchReconciliationSummary,
  fetchBankAccountsForRecon,
  fetchBookEntries,
  fetchDepositsInTransit,
  finalizeReconciliation,
  type ReconciliationSession,
  type ReconciliationEntry,
  type StatementEntry,
  type ReconciliationAdjustment,
  type OutstandingItem,
  type BankAccountForRecon,
  type BookEntry,
  type OutstandingChequeFromRegister,
  type ReconciliationSummary,
} from '../../api/reconciliation';
import { formatNPR, getTodayBS } from '../../utils/nepaliCalendar';
import { DateConverter } from '../../utils/DateConverter';

interface Props {
  activeSubKey?: string;
  onNavigate?: (key: string) => void;
}

type ReconType = 'bank' | 'vault';
type ViewMode = 'list' | 'session';
type TabKey = 'outstanding' | 'deposits' | 'adjustments' | 'statement' | 'book';

export function CashReconciliationView({ activeSubKey, onNavigate }: Props) {
  const { activeBranch, addNotification } = useCoop();

  // Core
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [loading, setLoading] = useState(false);
  const [reconType, setReconType] = useState<ReconType>('bank');
  const [tab, setTab] = useState<TabKey>('outstanding');

  // List
  const [sessions, setSessions] = useState<ReconciliationSession[]>([]);
  const [listFilter, setListFilter] = useState<string>('all');

  // Session
  const [session, setSession] = useState<ReconciliationSession | null>(null);
  const [entries, setEntries] = useState<ReconciliationEntry[]>([]);
  const [stmtEntries, setStmtEntries] = useState<StatementEntry[]>([]);
  const [adjustments, setAdjustments] = useState<ReconciliationAdjustment[]>([]);
  const [outstandingItems, setOutstandingItems] = useState<OutstandingItem[]>([]);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);

  // Form
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [dateFrom, setDateFrom] = useState(getTodayBS());
  const [dateTo, setDateTo] = useState(getTodayBS());
  const [statementBalance, setStatementBalance] = useState('');
  const [statementOpeningBalance, setStatementOpeningBalance] = useState('');
  const [remarks, setRemarks] = useState('');

  // Account data
  const [bankAccounts, setBankAccounts] = useState<BankAccountForRecon[]>([]);
  const [bookEntries, setBookEntries] = useState<BookEntry[]>([]);
  const [depositsInTransit, setDepositsInTransit] = useState<BookEntry[]>([]);
  const [outstandingCheques, setOutstandingCheques] = useState<OutstandingChequeFromRegister[]>([]);

  // Modals
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [showAddOutstandingModal, setShowAddOutstandingModal] = useState(false);

  // Adjustment form
  const [adjForm, setAdjForm] = useState({
    adjustmentType: 'bank_charge' as string,
    description: '',
    amount: '',
    dateBs: getTodayBS(),
  });

  // Statement entry form
  const [stmtForm, setStmtForm] = useState({
    entryDateBs: getTodayBS(),
    description: '',
    reference: '',
    chequeNo: '',
    debit: '',
    credit: '',
  });

  // =============================================
  // Load data
  // =============================================
  const loadAccounts = useCallback(async () => {
    try {
      const accounts = await fetchBankAccountsForRecon();
      setBankAccounts(accounts);
    } catch (err: any) {
      addNotification('Error', err.message || 'Failed to load accounts', 'error');
    }
  }, [addNotification]);

  const loadSessions = useCallback(async () => {
    if (!activeBranch) return;
    setLoading(true);
    try {
      const data = await fetchReconciliationSessions({
        branchId: activeBranch.id,
        type: reconType,
        status: listFilter === 'all' ? undefined : listFilter,
      });
      setSessions(data);
    } catch (err: any) {
      addNotification('Error', err.message || 'Failed to load sessions', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeBranch, reconType, listFilter, addNotification]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { if (viewMode === 'list') loadSessions(); }, [loadSessions, viewMode]);

  // Load book entries when account selected
  useEffect(() => {
    if (!selectedAccountId) return;
    setLoading(true);
    Promise.all([
      fetchBookEntries(selectedAccountId, dateFrom, dateTo),
      fetchDepositsInTransit(selectedAccountId, dateFrom, dateTo),
    ]).then(([books, deposits]) => {
      setBookEntries(books);
      setDepositsInTransit(deposits);
    }).catch(err => addNotification('Error', err.message, 'error'))
      .finally(() => setLoading(false));
  }, [selectedAccountId, dateFrom, dateTo, addNotification]);

  // Load outstanding cheques when account selected
  useEffect(() => {
    if (!selectedAccountId) return;
    fetchOutstandingCheques(selectedAccountId)
      .then(setOutstandingCheques)
      .catch(() => setOutstandingCheques([]));
  }, [selectedAccountId]);

  // =============================================
  // Session operations
  // =============================================
  const handleStartSession = async () => {
    if (!selectedAccountId || !activeBranch) {
      addNotification('Validation', 'Please select a bank account and ensure you are in a branch', 'warning');
      return;
    }
    if (!selectedAccount) {
      addNotification('Validation', 'Selected account not found in the bank list', 'warning');
      return;
    }
    const stmtBal = parseFloat(statementBalance) || 0;
    if (stmtBal <= 0) {
      addNotification('Validation', 'Enter the Bank Statement Closing Balance from your bank statement', 'warning');
      return;
    }
    setLoading(true);
    try {
      const todayAd = DateConverter.bsToAd(getTodayBS());
      const sess = await createReconciliationSession({
        branchId: activeBranch.id,
        reconciliationType: reconType,
        bankAccountId: selectedAccount.id,
        glAccountId: selectedAccountId,
        reconcileDateBs: dateTo,
        reconcileDateAd: todayAd,
        statementPeriodFrom: dateFrom,
        statementPeriodTo: dateTo,
      });
      // Save statement balance immediately
      const updated = await updateReconciliationSession(sess.id, {
        statementBalance: stmtBal,
        statementOpeningBalance: 0,
        statementPeriodFrom: dateFrom,
        statementPeriodTo: dateTo,
        remarks,
      });
      setSession(updated);
      setViewMode('session');
      addNotification('Created', 'Reconciliation session started', 'success');
    } catch (err: any) {
      console.error('Reconciliation: Failed to start session', err);
      addNotification('Error', err.response?.data?.error || err.message || 'Failed to start reconciliation', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSession = async (id: string) => {
    setLoading(true);
    try {
      const result = await fetchReconciliationById(id);
      setSession(result.session);
      setEntries(result.entries);
      setStmtEntries(result.statementEntries);
      setAdjustments(result.adjustments);
      setOutstandingItems(result.outstandingItems);
      setStatementBalance(result.session.statementBalance);
      setStatementOpeningBalance(result.session.statementOpeningBalance);
      setRemarks(result.session.remarks || '');
      setViewMode('session');

      // Load summary
      const s = await fetchReconciliationSummary(id);
      setSummary(s);
    } catch (err: any) {
      addNotification('Error', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRecalcSession = async (sessionId: string) => {
    try {
      const result = await fetchReconciliationById(sessionId);
      setSession(result.session);
      setEntries(result.entries);
      setStmtEntries(result.statementEntries);
      setAdjustments(result.adjustments);
      setOutstandingItems(result.outstandingItems);
      const s = await fetchReconciliationSummary(sessionId);
      setSummary(s);
    } catch {}
  };

  // =============================================
  // Outstanding cheques
  // =============================================
  const handleAddOutstandingCheques = async (cheques: OutstandingChequeFromRegister[]) => {
    if (!session) return;
    setLoading(true);
    try {
      await addOutstandingItems(session.id, cheques.map(c => ({
        itemType: 'outstanding_cheque' as const,
        sourceId: c.id,
        sourceType: 'bank_cheque_leaf' as const,
        chequeNo: c.chequeNo,
        payeeName: c.payeeName || undefined,
        amount: c.amount,
        entryDateBs: c.dateBs,
      })));
      await handleRecalcSession(session.id);
      setShowAddOutstandingModal(false);
      addNotification('Added', `${cheques.length} outstanding cheques added`, 'success');
    } catch (err: any) {
      addNotification('Error', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClearOutstanding = async (itemId: string) => {
    if (!session) return;
    try {
      await updateOutstandingItem(itemId, { status: 'cleared', clearedDateBs: getTodayBS() });
      await handleRecalcSession(session.id);
    } catch (err: any) {
      addNotification('Error', err.message, 'error');
    }
  };

  // =============================================
  // Adjustments
  // =============================================
  const handleAddAdjustment = async () => {
    if (!session) return;
    if (!adjForm.description || !adjForm.amount) {
      addNotification('Validation', 'Description and amount required', 'warning');
      return;
    }
    setLoading(true);
    try {
      await addAdjustment(session.id, {
        ...adjForm,
        amount: Number(adjForm.amount),
      });
      await handleRecalcSession(session.id);
      setShowAdjustmentModal(false);
      setAdjForm({ adjustmentType: 'bank_charge', description: '', amount: '', dateBs: getTodayBS() });
      addNotification('Added', 'Adjustment recorded', 'success');
    } catch (err: any) {
      addNotification('Error', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdjustment = async (adjId: string) => {
    if (!session) return;
    try {
      await deleteAdjustment(adjId);
      await handleRecalcSession(session.id);
    } catch (err: any) {
      addNotification('Error', err.message, 'error');
    }
  };

  // =============================================
  // Statement entries
  // =============================================
  const handleAddStatementEntry = async () => {
    if (!session) return;
    if (!stmtForm.entryDateBs || (!stmtForm.debit && !stmtForm.credit)) {
      addNotification('Validation', 'Date and amount required', 'warning');
      return;
    }
    setLoading(true);
    try {
      await addStatementEntries(session.id, [{
        entryDateBs: stmtForm.entryDateBs,
        description: stmtForm.description || undefined,
        reference: stmtForm.reference || undefined,
        chequeNo: stmtForm.chequeNo || undefined,
        debit: Number(stmtForm.debit) || 0,
        credit: Number(stmtForm.credit) || 0,
      }]);
      await handleRecalcSession(session.id);
      setStmtForm({ entryDateBs: getTodayBS(), description: '', reference: '', chequeNo: '', debit: '', credit: '' });
      setShowStatementModal(false);
      addNotification('Added', 'Statement entry recorded', 'success');
    } catch (err: any) {
      addNotification('Error', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // =============================================
  // Auto-match
  // =============================================
  const handleAutoMatch = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const result = await autoMatchEntries(session.id);
      await handleRecalcSession(session.id);
      addNotification('Auto-Matched', `${result.matchCount} transactions matched automatically`, 'success');
    } catch (err: any) {
      addNotification('Error', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // =============================================
  // Finalize
  // =============================================
  const handleFinalize = async () => {
    if (!session) return;
    setLoading(true);
    try {
      await finalizeReconciliation(session.id);
      await handleRecalcSession(session.id);
      addNotification('Reconciled', 'Bank reconciliation completed successfully!', 'success');
    } catch (err: any) {
      addNotification('Error', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // =============================================
  // Computed
  // =============================================
  const bookBalance = useMemo(() => {
    return bookEntries.reduce((sum, e) => sum + e.debit - e.credit, 0);
  }, [bookEntries]);

  const statementBalanceNum = parseFloat(statementBalance) || 0;
  const outstandingChequesTotal = outstandingItems
    .filter(i => i.itemType === 'outstanding_cheque' && i.status === 'pending')
    .reduce((s, i) => s + Number(i.amount), 0);
  const depositsInTransitTotal = outstandingItems
    .filter(i => i.itemType === 'deposit_in_transit' && i.status === 'pending')
    .reduce((s, i) => s + Number(i.amount), 0);
  const adjustmentsTotal = adjustments.reduce((s, a) => {
    const amt = Number(a.amount);
    if (['bank_charge', 'interest_charged', 'direct_debit', 'error_correction'].includes(a.adjustmentType)) return s - amt;
    return s + amt;
  }, 0);
  const adjustedBalance = statementBalanceNum + depositsInTransitTotal - outstandingChequesTotal + adjustmentsTotal;
  const difference = adjustedBalance - bookBalance;
  const isReconciled = Math.abs(difference) < 1 && statementBalanceNum > 0;

  const selectedAccount = bankAccounts.find(a => a.glAccountId === selectedAccountId);

  // =============================================
  // RENDER
  // =============================================
  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Bank Reconciliation
          </h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <Scale className="w-3.5 h-3.5 text-slate-500" />
            <span>Statement Balance + Deposits in Transit - Outstanding Cheques ± Adjustments = Book Balance</span>
          </p>
        </div>
        {viewMode === 'session' && (
          <button
            onClick={() => { setViewMode('list'); setSession(null); setEntries([]); setStmtEntries([]); setAdjustments([]); setOutstandingItems([]); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Sessions
          </button>
        )}
      </div>

      {viewMode === 'list' ? (
        /* ============================================
           SESSION LIST
           ============================================ */
        <div className="space-y-4">
          {/* Type selector + filters */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-2">
                {(['bank', 'vault'] as ReconType[]).map(t => (
                  <button key={t} onClick={() => { setReconType(t); setSelectedAccountId(''); }}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                      reconType === t ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}>
                    {t === 'bank' ? <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Bank</span> :
                      <span className="flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5" /> Vault</span>}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {(['all', 'draft', 'in_progress', 'reconciled', 'exception']).map(f => (
                  <button key={f} onClick={() => setListFilter(f)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                      listFilter === f ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'
                    }`}>
                    {f === 'all' ? 'All' : f.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <button onClick={loadSessions} className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Start new session */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-3">Start New Reconciliation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-3">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Bank Account</label>
                <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="">Select bank account...</option>
                  {bankAccounts.map(a => (
                    <option key={a.id} value={a.glAccountId}>
                      {a.bankName} - {a.accountName} ({a.accountNumber}) — {a.glAccountCode}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Statement Period From</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Statement Period To</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Bank Statement Closing Balance (NPR)</label>
                <input type="number" value={statementBalance} onChange={e => setStatementBalance(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm font-mono font-bold border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. 598000" />
                <p className="text-[10px] text-slate-400 mt-1">
                  {selectedAccount ? `System Book Balance: ${formatNPR(selectedAccount.currentBalance)}` : 'Enter the closing balance from your bank statement'}
                </p>
              </div>
              <div className="lg:col-span-3 flex justify-end">
                <button onClick={handleStartSession} disabled={loading || !selectedAccountId}
                  className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 shadow-lg">
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Start Reconciliation
                </button>
              </div>
            </div>
          </div>

          {/* Sessions list */}
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : sessions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Scale className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500">No reconciliation sessions</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Date</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Period</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Book Balance</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Statement Balance</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Adjusted</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Variance</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-slate-600">Status</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-slate-600"></th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-medium">{s.reconcileDateBs}</td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {s.statementPeriodFrom && s.statementPeriodTo
                          ? `${s.statementPeriodFrom} → ${s.statementPeriodTo}`
                          : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{formatNPR(Number(s.bookBalance))}</td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {Number(s.statementBalance) > 0 ? formatNPR(Number(s.statementBalance)) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {Number(s.statementBalance) > 0 ? formatNPR(Number(s.adjustedBalance)) : '—'}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono font-semibold ${
                        Number(s.variance) === 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {Number(s.statementBalance) > 0 ? formatNPR(Math.abs(Number(s.variance))) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          s.status === 'reconciled' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          s.status === 'exception' ? 'bg-red-50 text-red-700 border-red-200' :
                          s.status === 'in_progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                          {s.status === 'reconciled' && <CheckCircle2 className="w-3 h-3 inline mr-0.5" />}
                          {s.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button onClick={() => handleLoadSession(s.id)} className="text-blue-600 hover:text-blue-800">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ============================================
           SESSION DETAIL — PROPER BANK RECONCILIATION
           ============================================ */
        <div className="space-y-4">
          {/* ── RECONCILIATION FORMULA ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: inputs */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-500" /> Reconciliation Setup
                </h3>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Bank Statement Closing Balance (NPR)</label>
                  <input type="number" value={statementBalance} onChange={e => setStatementBalance(e.target.value)}
                    className="w-full mt-1 px-3 py-2.5 text-lg font-mono font-bold border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. 598000"
                    disabled={session?.status === 'reconciled'} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Statement Opening Balance (NPR)</label>
                  <input type="number" value={statementOpeningBalance} onChange={e => setStatementOpeningBalance(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    disabled={session?.status === 'reconciled'} />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Remarks</label>
                  <input type="text" value={remarks} onChange={e => setRemarks(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Reconciliation notes..."
                    disabled={session?.status === 'reconciled'} />
                </div>
                {session?.status !== 'reconciled' && (
                  <button onClick={() => {
                    if (!session) return;
                    updateReconciliationSession(session.id, {
                      statementBalance: Number(statementBalance),
                      statementOpeningBalance: Number(statementOpeningBalance),
                      remarks,
                      statementPeriodFrom: session.statementPeriodFrom || dateFrom,
                      statementPeriodTo: session.statementPeriodTo || dateTo,
                    }).then(s => { setSession(s); addNotification('Saved', 'Session updated', 'success'); })
                      .catch(err => addNotification('Error', err.message, 'error'));
                  }} className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
                    Save Balances
                  </button>
                )}
              </div>

              {/* Right: balance summary */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-blue-500" /> Balance Summary
                </h3>
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  {/* Book Balance */}
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600 font-medium">A. System Book Balance (GL)</span>
                    <span className="text-sm font-mono font-bold text-slate-900">{formatNPR(bookBalance)}</span>
                  </div>
                  <div className="h-px bg-slate-200" />

                  {/* Statement Balance */}
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-600 font-medium">B. Bank Statement Balance</span>
                    <span className="text-sm font-mono font-bold text-blue-700">{formatNPR(statementBalanceNum)}</span>
                  </div>
                  <div className="h-px bg-slate-200" />

                  {/* Reconciling Items */}
                  <div className="pl-4 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-emerald-600 font-medium">+ Deposits in Transit</span>
                      <span className="text-xs font-mono text-emerald-700">{formatNPR(depositsInTransitTotal)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-red-600 font-medium">- Outstanding Cheques</span>
                      <span className="text-xs font-mono text-red-600">{formatNPR(outstandingChequesTotal)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-amber-600 font-medium">± Adjustments</span>
                      <span className={`text-xs font-mono ${adjustmentsTotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {adjustmentsTotal >= 0 ? '+' : ''}{formatNPR(adjustmentsTotal)}
                      </span>
                    </div>
                  </div>
                  <div className="h-px bg-slate-200" />

                  {/* Adjusted Balance */}
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-800 font-bold">C. Adjusted Bank Balance</span>
                    <span className="text-sm font-mono font-black text-slate-900">{formatNPR(adjustedBalance)}</span>
                  </div>
                  <div className="h-px bg-slate-300" />

                  {/* Difference */}
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-xs font-bold text-slate-800">Difference (C - A)</span>
                    <span className={`text-lg font-mono font-black ${isReconciled ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatNPR(Math.abs(difference))}
                    </span>
                  </div>
                </div>

                {/* Reconciled status */}
                {isReconciled ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="text-xs font-bold text-emerald-700">✓ RECONCILED</p>
                      <p className="text-[10px] text-emerald-600">Book Balance = Adjusted Bank Balance</p>
                    </div>
                  </div>
                ) : statementBalanceNum > 0 ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="text-xs font-bold text-red-700">Not Reconciled — Difference: {formatNPR(Math.abs(difference))}</p>
                      <p className="text-[10px] text-red-600">Add outstanding items or adjustments to reconcile</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* ── TABS: Outstanding / Deposits / Adjustments / Statement / Book ── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="flex border-b border-slate-100">
              {([
                { key: 'outstanding' as TabKey, label: `Outstanding Cheques (${outstandingItems.filter(i => i.itemType === 'outstanding_cheque' && i.status === 'pending').length})`, icon: CreditCard },
                { key: 'deposits' as TabKey, label: `Deposits in Transit (${outstandingItems.filter(i => i.itemType === 'deposit_in_transit' && i.status === 'pending').length})`, icon: TrendingUp },
                { key: 'adjustments' as TabKey, label: `Adjustments (${adjustments.length})`, icon: FileText },
                { key: 'statement' as TabKey, label: `Bank Statement Entries (${stmtEntries.length})`, icon: Building2 },
                { key: 'book' as TabKey, label: `System Book Entries (${bookEntries.length})`, icon: BookOpen },
              ]).map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition-all border-b-2 ${
                    tab === t.key ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}>
                  <t.icon className="w-3.5 h-3.5" /> {t.label}
                </button>
              ))}
            </div>

            <div className="p-4">
              {/* ── OUTSTANDING CHEQUES TAB ── */}
              {tab === 'outstanding' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700">Outstanding Cheques (Issued but not yet cleared by bank)</h4>
                    {session?.status !== 'reconciled' && (
                      <button onClick={() => setShowAddOutstandingModal(true)}
                        className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                        <Plus className="w-3 h-3" /> Add from Cheque Register
                      </button>
                    )}
                  </div>
                  {outstandingItems.filter(i => i.itemType === 'outstanding_cheque').length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">
                      <CreditCard className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      No outstanding cheques. Click "Add from Cheque Register" to add cheques issued but not yet cleared.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Cheque No</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Payee</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Date</th>
                            <th className="text-right px-3 py-2 font-semibold text-slate-600">Amount</th>
                            <th className="text-center px-3 py-2 font-semibold text-slate-600">Status</th>
                            {session?.status !== 'reconciled' && (
                              <th className="text-center px-3 py-2 font-semibold text-slate-600">Action</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {outstandingItems.filter(i => i.itemType === 'outstanding_cheque').map(item => (
                            <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                              <td className="px-3 py-2 font-mono font-medium">{item.chequeNo || '—'}</td>
                              <td className="px-3 py-2 text-slate-600">{item.payeeName || '—'}</td>
                              <td className="px-3 py-2">{item.entryDateBs}</td>
                              <td className="px-3 py-2 text-right font-mono text-red-600 font-semibold">{formatNPR(Number(item.amount))}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  item.status === 'cleared' ? 'bg-emerald-50 text-emerald-700' :
                                  item.status === 'voided' ? 'bg-slate-100 text-slate-500' :
                                  'bg-amber-50 text-amber-700'
                                }`}>{item.status}</span>
                              </td>
                              {session?.status !== 'reconciled' && (
                                <td className="px-3 py-2 text-center">
                                  {item.status === 'pending' && (
                                    <button onClick={() => handleClearOutstanding(item.id)}
                                      className="text-emerald-600 hover:text-emerald-800 text-[10px] font-semibold">
                                      Mark Cleared
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-red-50 font-semibold">
                            <td colSpan={3} className="px-3 py-2 text-right text-red-700">Total Outstanding Cheques:</td>
                            <td className="px-3 py-2 text-right font-mono text-red-700">{formatNPR(outstandingChequesTotal)}</td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── DEPOSITS IN TRANSIT TAB ── */}
              {tab === 'deposits' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">Deposits in Transit (Recorded in system but not yet in bank statement)</h4>
                  {depositsInTransit.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">
                      <TrendingUp className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      No deposits in transit for the selected period.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Date</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Voucher</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Description</th>
                            <th className="text-right px-3 py-2 font-semibold text-slate-600">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {depositsInTransit.map(e => (
                            <tr key={e.voucherEntryId} className="border-b border-slate-50 hover:bg-slate-50/50">
                              <td className="px-3 py-2 font-medium">{e.dateBs}</td>
                              <td className="px-3 py-2 font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded inline-block">{e.voucherNo}</td>
                              <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate">{e.description}</td>
                              <td className="px-3 py-2 text-right font-mono text-emerald-700 font-semibold">{formatNPR(e.debit)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-emerald-50 font-semibold">
                            <td colSpan={3} className="px-3 py-2 text-right text-emerald-700">Total Deposits in Transit:</td>
                            <td className="px-3 py-2 text-right font-mono text-emerald-700">{formatNPR(depositsInTransitTotal || depositsInTransit.reduce((s, e) => s + e.debit, 0))}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── ADJUSTMENTS TAB ── */}
              {tab === 'adjustments' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700">Adjustments (Bank charges, Interest, Direct Debits/Credits)</h4>
                    {session?.status !== 'reconciled' && (
                      <button onClick={() => setShowAdjustmentModal(true)}
                        className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                        <Plus className="w-3 h-3" /> Add Adjustment
                      </button>
                    )}
                  </div>
                  {adjustments.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      No adjustments recorded. Common adjustments: bank charges, interest earned, direct debits.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Type</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Description</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Date</th>
                            <th className="text-right px-3 py-2 font-semibold text-slate-600">Amount</th>
                            <th className="text-right px-3 py-2 font-semibold text-slate-600">Effect on Balance</th>
                            {session?.status !== 'reconciled' && (
                              <th className="text-center px-3 py-2 font-semibold text-slate-600"></th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {adjustments.map(a => {
                            const isDebit = ['bank_charge', 'interest_charged', 'direct_debit', 'error_correction'].includes(a.adjustmentType);
                            const labels: Record<string, string> = {
                              bank_charge: 'Bank Charge', interest_earned: 'Interest Earned',
                              interest_charged: 'Interest Charged', direct_debit: 'Direct Debit',
                              direct_credit: 'Direct Credit', error_correction: 'Error Correction', other: 'Other',
                            };
                            return (
                              <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                <td className="px-3 py-2">
                                  <span className={`flex items-center gap-1 font-medium ${isDebit ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {isDebit ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                    {labels[a.adjustmentType] || a.adjustmentType}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-slate-600">{a.description}</td>
                                <td className="px-3 py-2">{a.dateBs}</td>
                                <td className={`px-3 py-2 text-right font-mono font-semibold ${isDebit ? 'text-red-600' : 'text-emerald-600'}`}>
                                  {isDebit ? '-' : '+'}{formatNPR(Number(a.amount))}
                                </td>
                                <td className={`px-3 py-2 text-right font-mono text-[10px] ${isDebit ? 'text-red-500' : 'text-emerald-500'}`}>
                                  {isDebit ? 'Reduces adjusted balance' : 'Increases adjusted balance'}
                                </td>
                                {session?.status !== 'reconciled' && (
                                  <td className="px-3 py-2 text-center">
                                    <button onClick={() => handleDeleteAdjustment(a.id)} className="text-red-400 hover:text-red-600">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── STATEMENT ENTRIES TAB ── */}
              {tab === 'statement' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700">Bank Statement Entries</h4>
                    {session?.status !== 'reconciled' && (
                      <button onClick={() => setShowStatementModal(true)}
                        className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                        <Plus className="w-3 h-3" /> Add Statement Entry
                      </button>
                    )}
                  </div>
                  {stmtEntries.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">
                      <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      No statement entries. Add entries from your bank statement to enable matching.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Date</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Description</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Reference</th>
                            <th className="text-right px-3 py-2 font-semibold text-slate-600">Debit</th>
                            <th className="text-right px-3 py-2 font-semibold text-slate-600">Credit</th>
                            <th className="text-center px-3 py-2 font-semibold text-slate-600">Match</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stmtEntries.map(e => (
                            <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                              <td className="px-3 py-2 font-medium">{e.entryDateBs}</td>
                              <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate">{e.description || '—'}</td>
                              <td className="px-3 py-2 text-slate-500 font-mono text-[10px]">{e.reference || e.chequeNo || '—'}</td>
                              <td className="px-3 py-2 text-right font-mono text-red-600">
                                {Number(e.debit) > 0 ? formatNPR(Number(e.debit)) : '—'}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-emerald-700">
                                {Number(e.credit) > 0 ? formatNPR(Number(e.credit)) : '—'}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className={`text-[10px] font-semibold ${
                                  e.matchStatus === 'matched' ? 'text-emerald-600' :
                                  e.matchStatus === 'partial' ? 'text-amber-600' : 'text-slate-400'
                                }`}>{e.matchStatus}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── BOOK ENTRIES TAB ── */}
              {tab === 'book' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700">System Book Entries (GL Ledger)</h4>
                  {bookEntries.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">
                      <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      No book entries for the selected period.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Date</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Voucher</th>
                            <th className="text-left px-3 py-2 font-semibold text-slate-600">Description</th>
                            <th className="text-right px-3 py-2 font-semibold text-slate-600">Debit</th>
                            <th className="text-right px-3 py-2 font-semibold text-slate-600">Credit</th>
                            <th className="text-center px-3 py-2 font-semibold text-slate-600">Match</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bookEntries.map((e, i) => {
                            const matched = entries.find(en => en.voucherEntryId === e.voucherEntryId);
                            return (
                              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                                <td className="px-3 py-2 font-medium">{e.dateBs}</td>
                                <td className="px-3 py-2 font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded inline-block">{e.voucherNo}</td>
                                <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate">{e.description}</td>
                                <td className="px-3 py-2 text-right font-mono text-emerald-700">
                                  {e.debit > 0 ? formatNPR(e.debit) : '—'}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-red-600">
                                  {e.credit > 0 ? formatNPR(e.credit) : '—'}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {matched ? (
                                    <span className={`text-[10px] font-semibold ${
                                      matched.matchStatus === 'matched' ? 'text-emerald-600' :
                                      matched.matchStatus === 'partial' ? 'text-amber-600' : 'text-slate-400'
                                    }`}>{matched.matchStatus}</span>
                                  ) : (
                                    <span className="text-[10px] text-slate-300">unmatched</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 font-semibold">
                            <td colSpan={3} className="px-3 py-2 text-right text-slate-600">Net Book Balance:</td>
                            <td className="px-3 py-2 text-right font-mono text-emerald-700">{formatNPR(bookEntries.reduce((s, e) => s + e.debit, 0))}</td>
                            <td className="px-3 py-2 text-right font-mono text-red-600">{formatNPR(bookEntries.reduce((s, e) => s + e.credit, 0))}</td>
                            <td className="px-3 py-2 text-center font-mono text-slate-900 font-bold">{formatNPR(bookBalance)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── ACTION BUTTONS ── */}
          {session?.status !== 'reconciled' && (
            <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 shadow-xs p-4">
              <div className="flex gap-2">
                <button onClick={handleAutoMatch} disabled={loading}
                  className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5">
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Auto-Match Entries
                </button>
              </div>
              <div className="flex gap-2">
                {isReconciled && (
                  <button onClick={handleFinalize} disabled={loading}
                    className="px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 shadow-lg">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    ✓ Finalize Reconciliation
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Reconciled report */}
          {session?.status === 'reconciled' && (
            <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-6">
              <h3 className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" /> Bank Reconciliation Statement
              </h3>
              <div className="bg-white rounded-xl p-4 max-w-md text-xs space-y-1.5">
                <p className="font-bold text-slate-800 text-sm mb-2">As of: {session.reconciledDateBs || session.reconcileDateBs}</p>
                <div className="flex justify-between"><span>Balance as per Bank Statement</span><span className="font-mono">{formatNPR(statementBalanceNum)}</span></div>
                <div className="flex justify-between text-emerald-700"><span className="pl-4">Add: Deposits in Transit</span><span className="font-mono">+{formatNPR(depositsInTransitTotal)}</span></div>
                <div className="flex justify-between text-red-600"><span className="pl-4">Less: Outstanding Cheques</span><span className="font-mono">-{formatNPR(outstandingChequesTotal)}</span></div>
                {adjustmentsTotal !== 0 && (
                  <div className={`flex justify-between ${adjustmentsTotal >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    <span className="pl-4">± Adjustments</span>
                    <span className="font-mono">{adjustmentsTotal >= 0 ? '+' : ''}{formatNPR(adjustmentsTotal)}</span>
                  </div>
                )}
                <div className="h-px bg-slate-200 my-1" />
                <div className="flex justify-between font-bold"><span>Adjusted Bank Balance</span><span className="font-mono">{formatNPR(adjustedBalance)}</span></div>
                <div className="flex justify-between font-bold"><span>Balance as per Books</span><span className="font-mono">{formatNPR(bookBalance)}</span></div>
                <div className="h-px bg-slate-200 my-1" />
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Difference</span><span className="font-mono">{formatNPR(0)}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 space-y-0.5">
                  <p>Prepared By: {session.preparedBy || '—'}</p>
                  <p>Approved By: {session.approvedBy || '—'}</p>
                  <p>Reconciled Date: {session.reconciledDateBs || '—'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================
          ADD OUTSTANDING CHEQUES MODAL
          ============================================ */}
      {showAddOutstandingModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Add Outstanding Cheques from Register</h3>
              <button onClick={() => setShowAddOutstandingModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              <p className="text-xs text-slate-500 mb-3">
                Select cheques that have been issued (status: issued) but not yet cleared by the bank.
                These are your outstanding cheques.
              </p>
              {outstandingCheques.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No outstanding cheques found for this bank account.
                </div>
              ) : (
                <div className="space-y-2">
                  {outstandingCheques.map(c => {
                    const alreadyAdded = outstandingItems.some(
                      i => i.sourceId === c.id && i.itemType === 'outstanding_cheque'
                    );
                    return (
                      <label key={c.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                        alreadyAdded ? 'bg-slate-50 border-slate-200 opacity-50' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer'
                      }`}>
                        <input type="checkbox" className="rounded border-slate-300"
                          disabled={alreadyAdded}
                          onChange={e => {
                            if (e.target.checked) {
                              handleAddOutstandingCheques([c]);
                            }
                          }} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold">{c.chequeNo}</span>
                            <span className="text-[10px] text-slate-500">→</span>
                            <span className="text-xs text-slate-600">{c.payeeName || 'N/A'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Date: {c.dateBs} {c.voucherNo && `| Voucher: ${c.voucherNo}`}</div>
                        </div>
                        <span className="font-mono text-sm font-bold text-red-600">{formatNPR(c.amount)}</span>
                        {alreadyAdded && <span className="text-[10px] text-slate-400 font-medium">Added</span>}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
              <button onClick={() => setShowAddOutstandingModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================
          ADD ADJUSTMENT MODAL
          ============================================ */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Add Reconciliation Adjustment</h3>
              <button onClick={() => setShowAdjustmentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Adjustment Type</label>
                <select value={adjForm.adjustmentType} onChange={e => setAdjForm(p => ({ ...p, adjustmentType: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="bank_charge">Bank Charge (reduces balance)</option>
                  <option value="interest_earned">Interest Earned (increases balance)</option>
                  <option value="interest_charged">Interest Charged (reduces balance)</option>
                  <option value="direct_debit">Direct Debit (reduces balance)</option>
                  <option value="direct_credit">Direct Credit (increases balance)</option>
                  <option value="error_correction">Error Correction</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Description</label>
                <input type="text" value={adjForm.description} onChange={e => setAdjForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Monthly bank service charge" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Amount (NPR)</label>
                <input type="number" value={adjForm.amount} onChange={e => setAdjForm(p => ({ ...p, amount: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Date</label>
                <input type="date" value={adjForm.dateBs} onChange={e => setAdjForm(p => ({ ...p, dateBs: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setShowAdjustmentModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
              <button onClick={handleAddAdjustment} disabled={loading || !adjForm.description || !adjForm.amount}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : 'Add Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================
          ADD STATEMENT ENTRY MODAL
          ============================================ */}
      {showStatementModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Add Bank Statement Entry</h3>
              <button onClick={() => setShowStatementModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Date</label>
                <input type="date" value={stmtForm.entryDateBs} onChange={e => setStmtForm(p => ({ ...p, entryDateBs: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Description</label>
                <input type="text" value={stmtForm.description} onChange={e => setStmtForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Transaction description from bank statement" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Reference / Cheque No</label>
                  <input type="text" value={stmtForm.chequeNo} onChange={e => setStmtForm(p => ({ ...p, chequeNo: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Narration Ref</label>
                  <input type="text" value={stmtForm.reference} onChange={e => setStmtForm(p => ({ ...p, reference: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Debit (Withdrawal)</label>
                  <input type="number" value={stmtForm.debit} onChange={e => setStmtForm(p => ({ ...p, debit: e.target.value, credit: '' }))}
                    className="w-full mt-1 px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase">Credit (Deposit)</label>
                  <input type="number" value={stmtForm.credit} onChange={e => setStmtForm(p => ({ ...p, credit: e.target.value, debit: '' }))}
                    className="w-full mt-1 px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00" />
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setShowStatementModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
              <button onClick={handleAddStatementEntry} disabled={loading || (!stmtForm.debit && !stmtForm.credit)}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : 'Add Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
