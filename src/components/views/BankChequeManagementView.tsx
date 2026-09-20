import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Plus,
  RefreshCw,
  FileText,
  Ban,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { formatNPR, getTodayBS } from '../../utils/nepaliCalendar';
import { DateConverter } from '../../utils/DateConverter';
import { NepaliDatePicker } from '../common/NepaliDatePicker';
import {
  fetchAccountingSettings,
  type BankAccount,
  type Bank,
  clearBankChequeLeaf,
  bounceBankChequeLeaf,
} from '../../api/accountingSettings';
import {
  fetchBankChequeLeaves,
  fetchBankChequeBooks,
  issueBankChequeBook,
  markChequeLeafIssued,
  type BankChequeLeaf,
  type BankChequeBook,
  type IssueChequeBookInput,
} from '../../api/loanServicing';

type Tab = 'register' | 'books' | 'add-book';

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  unused: { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: <CheckCircle className="w-3 h-3" /> },
  issued: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: <FileText className="w-3 h-3" /> },
  cancelled: { color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200', icon: <Ban className="w-3 h-3" /> },
  cleared: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: <CheckCircle2 className="w-3 h-3" /> },
  bounced: { color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200', icon: <AlertCircle className="w-3 h-3" /> },
};

export const BankChequeManagementView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('register');
  const [bankAccounts, setBankAccounts] = useState<(BankAccount & { bankName?: string })[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const [leaves, setLeaves] = useState<(BankChequeLeaf & { status?: string; payeeName?: string; amount?: number })[]>([]);
  const [books, setBooks] = useState<BankChequeBook[]>([]);
  const [leafLoading, setLeafLoading] = useState(false);

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Register cheque book state
  const [regMode, setRegMode] = useState<'range' | 'individual'>('range');
  const [startLeafNo, setStartLeafNo] = useState<string>('1');
  const [totalLeaves, setTotalLeaves] = useState<string>('25');
  const [regDateBs, setRegDateBs] = useState(getTodayBS());
  const [regPurpose, setRegPurpose] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [regResult, setRegResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [baRes, banksRes] = await Promise.all([
        fetchAccountingSettings('bank-accounts'),
        fetchAccountingSettings('banks'),
      ]);
      setBankAccounts(baRes);
      setBanks(banksRes);
      if (baRes.length > 0 && !selectedAccountId) {
        setSelectedAccountId(baRes[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => { loadData(); }, [loadData]);

  const selectedAccount = bankAccounts.find(a => a.id === selectedAccountId);
  const selectedGlAccountId = selectedAccount?.glAccountId || '';

  const loadChequeData = useCallback(async () => {
    if (!selectedGlAccountId) return;
    setLeafLoading(true);
    try {
      const [leavesRes, booksRes] = await Promise.all([
        fetchBankChequeLeaves(selectedGlAccountId),
        fetchBankChequeBooks(selectedGlAccountId),
      ]);
      setLeaves(leavesRes);
      setBooks(booksRes);
    } finally {
      setLeafLoading(false);
    }
  }, [selectedGlAccountId]);

  useEffect(() => { loadChequeData(); }, [loadChequeData]);

  const filteredLeaves = leaves.filter(l => {
    if (filterStatus !== 'all' && l.status !== filterStatus) return false;
    if (searchQuery && !l.chequeNumber.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !(l.payeeName || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const statusCounts = leaves.reduce((acc, l) => {
    const s = l.status || 'unused';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleRegisterBook = useCallback(async () => {
    if (!selectedGlAccountId) return;
    setSubmitting(true);
    setRegResult(null);
    try {
      const adDate = DateConverter.bsToAd(regDateBs);
      const payload: IssueChequeBookInput = regMode === 'range'
        ? {
            bankAccountId: selectedGlAccountId,
            mode: 'range',
            startingLeafNo: Number(startLeafNo),
            totalLeaves: Number(totalLeaves),
            issuedDateBs: regDateBs,
            issuedDateAd: adDate,
            purpose: regPurpose || undefined,
          }
        : {
            bankAccountId: selectedGlAccountId,
            mode: 'individual',
            leafNumbers: Array.from({ length: Number(totalLeaves) }, (_, i) => Number(startLeafNo) + i),
            issuedDateBs: regDateBs,
            issuedDateAd: adDate,
            purpose: regPurpose || undefined,
          };
      const res = await issueBankChequeBook(payload);
      setRegResult({
        success: true,
        message: `Cheque book registered: ${res.chequeRange} (${res.leafCount} leaves) | Book #${res.book.bookNumber}`,
      });
      setStartLeafNo(String(Number(startLeafNo) + Number(totalLeaves)));
      setRegPurpose('');
      loadChequeData();
    } catch (err: any) {
      setRegResult({ success: false, message: err?.response?.data?.error || err?.message || 'Failed to register cheque book' });
    } finally {
      setSubmitting(false);
    }
  }, [selectedGlAccountId, regMode, startLeafNo, totalLeaves, regDateBs, regPurpose, loadChequeData]);

  const handleClear = useCallback(async (leafId: string) => {
    if (!confirm('Mark this cheque as cleared?')) return;
    try {
      await clearBankChequeLeaf(leafId);
      loadChequeData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to clear cheque');
    }
  }, [loadChequeData]);

  const handleBounce = useCallback(async (leafId: string) => {
    const reason = prompt('Enter bounce reason:');
    if (reason === null) return;
    try {
      await bounceBankChequeLeaf(leafId, reason || 'Bounced');
      loadChequeData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to bounce cheque');
    }
  }, [loadChequeData]);

  const getBankName = (bankId: string) => banks.find(b => b.id === bankId)?.name || 'Unknown Bank';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        <span className="ml-2 text-sm text-slate-500">Loading bank cheques...</span>
      </div>
    );
  }

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Bank Cheque Management</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <CreditCard className="w-3.5 h-3.5 text-slate-500" />
            <span>Manage bank cheque books received from banks, track usage, and clearance</span>
          </p>
        </div>
        <button
          onClick={loadChequeData}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Bank Account Selector */}
      <div className="flex flex-wrap gap-2">
        {bankAccounts.filter(a => a.isActive).map(ba => (
          <button
            key={ba.id}
            onClick={() => setSelectedAccountId(ba.id)}
            className={`px-3 py-2 text-xs font-semibold rounded-xl border-2 transition-all ${
              selectedAccountId === ba.id
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            <span className="font-bold">{getBankName(ba.bankId)}</span>
            <span className="ml-1.5 text-slate-400">{ba.accountNumber}</span>
            {!ba.glAccountId && (
              <span className="ml-1.5 text-[9px] text-rose-500 font-bold">NO GL</span>
            )}
          </button>
        ))}
      </div>

      {selectedAccountId && !selectedGlAccountId && (
        <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-700 font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          This bank account has no GL account linked in Accounting Settings. Please link it before managing cheques.
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
          <div key={status} className={`p-3 rounded-xl border ${config.bg} flex items-center justify-between`}>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{status}</div>
              <div className="text-lg font-black text-slate-900">{statusCounts[status] || 0}</div>
            </div>
            <div className={config.color}>{config.icon}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {(['register', 'books', 'add-book'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab === 'register' && <FileText className="w-3.5 h-3.5 inline mr-1.5" />}
            {tab === 'books' && <CreditCard className="w-3.5 h-3.5 inline mr-1.5" />}
            {tab === 'add-book' && <Plus className="w-3.5 h-3.5 inline mr-1.5" />}
            {tab === 'add-book' ? 'Add Book' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Register Result */}
      {regResult && (
        <div className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
          regResult.success
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {regResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {regResult.message}
        </div>
      )}

      {/* REGISTER TAB */}
      {activeTab === 'register' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Filters */}
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search cheque number or payee..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:border-emerald-500 outline-none"
              />
            </div>
            <div className="flex gap-1">
              {['all', 'unused', 'issued', 'cleared', 'bounced', 'cancelled'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${
                    filterStatus === s
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {leafLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">No cheques found.</div>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-slate-100">
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600 uppercase tracking-wider">Cheque #</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600 uppercase tracking-wider">Book</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600 uppercase tracking-wider">Payee</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-slate-600 uppercase tracking-wider">Amount</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredLeaves.map(leaf => {
                    const st = STATUS_CONFIG[leaf.status || 'unused'] || STATUS_CONFIG.unused;
                    return (
                      <tr key={leaf.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 font-mono font-bold text-slate-900">{leaf.chequeNumber}</td>
                        <td className="px-3 py-2 text-slate-600">{leaf.bookNumber}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.bg} ${st.color}`}>
                            {st.icon}
                            {(leaf.status || 'unused').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{leaf.payeeName || '—'}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">{leaf.amount ? formatNPR(leaf.amount) : '—'}</td>
                        <td className="px-3 py-2 text-center">
                          {leaf.status === 'unused' && (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleClear(leaf.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Clear">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleBounce(leaf.id)} className="p-1 text-rose-600 hover:bg-rose-50 rounded" title="Bounce">
                                <AlertCircle className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* BOOKS TAB */}
      {activeTab === 'books' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {leafLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
            </div>
          ) : books.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">No cheque books found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600 uppercase tracking-wider">Book #</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600 uppercase tracking-wider">Prefix</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600 uppercase tracking-wider">Leaf Range</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600 uppercase tracking-wider">Leaves</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600 uppercase tracking-wider">Issued Date</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {books.map(book => (
                    <tr key={book.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2 font-mono font-bold text-slate-900">{book.bookNumber}</td>
                      <td className="px-3 py-2 text-slate-600">{book.prefix || '—'}</td>
                      <td className="px-3 py-2 font-mono text-slate-700">{book.leafStartNumber} – {book.leafEndNumber}</td>
                      <td className="px-3 py-2 text-slate-600">{book.leafCount}</td>
                      <td className="px-3 py-2 text-slate-600">{book.issuedDateBs}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {book.status?.toUpperCase() || 'ACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ADD BOOK TAB */}
      {activeTab === 'add-book' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs max-w-xl space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-emerald-50 rounded-lg border border-emerald-100 text-emerald-700">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Register Cheque Book from Bank</h2>
              <p className="text-[11px] text-slate-500">Record a cheque book received from the bank</p>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Registration Mode</label>
            <div className="flex gap-2">
              <button
                onClick={() => setRegMode('range')}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl border-2 transition-all ${
                  regMode === 'range'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                Range
              </button>
              <button
                onClick={() => setRegMode('individual')}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl border-2 transition-all ${
                  regMode === 'individual'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                Individual
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Starting Leaf #</label>
              <input
                type="number"
                min="1"
                value={startLeafNo}
                onChange={e => setStartLeafNo(e.target.value)}
                className="w-full px-3 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Total Leaves</label>
              <input
                type="number"
                min="1"
                value={totalLeaves}
                onChange={e => setTotalLeaves(e.target.value)}
                className="w-full px-3 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Received Date (BS)</label>
            <NepaliDatePicker value={regDateBs} onChange={setRegDateBs} />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Purpose (Optional)</label>
            <input
              type="text"
              value={regPurpose}
              onChange={e => setRegPurpose(e.target.value)}
              placeholder="e.g. Monthly disbursement cheque book"
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-emerald-500 outline-none"
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
            <span className="font-semibold">Preview:</span> Cheque range {startLeafNo} to {Number(startLeafNo) + Number(totalLeaves) - 1} ({totalLeaves} leaves)
          </div>

          <button
            onClick={handleRegisterBook}
            disabled={!selectedGlAccountId || submitting}
            className="w-full py-3 bg-emerald-600 text-white font-bold text-sm rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {submitting ? 'Registering...' : 'Register Cheque Book'}
          </button>
        </div>
      )}
    </div>
  );
};
