import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Wallet,
  Landmark,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Plus,
  RefreshCw,
  CreditCard,
  Edit2,
  Trash2,
} from 'lucide-react';
import { formatNPR } from '../../utils/nepaliCalendar';
import {
  fetchAccountingSettings,
  createAccountingSetting,
  updateAccountingSetting,
  deleteAccountingSetting,
  fetchBankBalanceSummaries,
  type BankAccount,
  type Bank,
  type CashCounter,
  type ChartAccount,
  type BankBalanceSummary,
} from '../../api/accountingSettings';
import { fetchCoa } from '../../api/accountingSettings';

export const CashCountersBankAccountsView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'bank_accounts' | 'cash_counters'>('bank_accounts');
  const [bankAccounts, setBankAccounts] = useState<(BankAccount & { bankName?: string; glAccountName?: string; glBalance?: number })[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [cashCounters, setCashCounters] = useState<CashCounter[]>([]);
  const [coaAccounts, setCoaAccounts] = useState<ChartAccount[]>([]);
  const [balanceSummaries, setBalanceSummaries] = useState<BankBalanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formType, setFormType] = useState<'bank_account' | 'cash_counter'>('bank_account');
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formBankId, setFormBankId] = useState('');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formGlAccountId, setFormGlAccountId] = useState('');
  const [formOpeningBalance, setFormOpeningBalance] = useState('0');
  const [formMaxCashLimit, setFormMaxCashLimit] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [baRes, banksRes, ccRes, coaRes, balSummaries] = await Promise.all([
        fetchAccountingSettings('bank-accounts'),
        fetchAccountingSettings('banks'),
        fetchAccountingSettings('cash-counters'),
        fetchCoa(),
        fetchBankBalanceSummaries(),
      ]);
      setBanks(banksRes);
      setCashCounters(ccRes);
      setBalanceSummaries(balSummaries);
      // Use server-computed glBalance (authoritative from voucher entries)
      const enrichedBanks = baRes.map((ba: any) => ({
        ...ba,
        glBalance: ba.glBalance ?? 0,
      }));
      setBankAccounts(enrichedBanks);
      setCoaAccounts(coaRes.accounts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getBankName = (bankId: string) => banks.find(b => b.id === bankId)?.name || 'Unknown Bank';
  const getGlAccountName = (glId: string | null) => {
    if (!glId) return '—';
    return coaAccounts.find(a => a.id === glId)?.name || coaAccounts.find(a => a.id === glId)?.code || '—';
  };
  const getBalanceSummary = (baId: string) => balanceSummaries.find(s => s.id === baId);

  const bankAccountsByBank = bankAccounts.reduce((acc, ba) => {
    const bankName = getBankName(ba.bankId);
    if (!acc[bankName]) acc[bankName] = [];
    acc[bankName].push(ba);
    return acc;
  }, {} as Record<string, typeof bankAccounts>);

  const totalBankBalance = balanceSummaries.reduce((sum, s) => sum + s.currentBalance, 0);
  const totalCounterBalance = cashCounters.reduce((sum, cc) => sum + (cc.openingBalance || 0), 0);

  const resetForm = () => {
    setFormName(''); setFormCode(''); setFormBankId(''); setFormAccountNumber('');
    setFormGlAccountId(''); setFormOpeningBalance('0'); setFormMaxCashLimit('');
    setShowForm(false); setEditingId(null); setFormType('bank_account');
  };

  const handleSubmit = useCallback(async () => {
    setFormSubmitting(true);
    try {
      const entityType = formType === 'bank_account' ? 'bank-accounts' : 'cash-counters';
      const body: Record<string, any> = {
        name: formName,
        code: formCode,
        nameNepali: null,
        description: null,
        isActive: true,
        isSystem: false,
      };

      if (formType === 'bank_account') {
        body.bankId = formBankId;
        body.accountNumber = formAccountNumber;
        body.glAccountId = formGlAccountId || null;
        body.openingBalance = Number(formOpeningBalance) || 0;
        body.currency = 'NPR';
        body.accountType = 'savings';
        body.isPrimary = false;
        body.reconciliationEnabled = true;
      } else {
        body.branchId = ''; // Will be set by backend
        body.glCashAccountId = formGlAccountId || null;
        body.openingBalance = Number(formOpeningBalance) || 0;
        body.maxCashLimit = Number(formMaxCashLimit) || null;
        body.assignedUserId = null;
      }

      if (editingId) {
        await updateAccountingSetting(entityType, editingId, body);
      } else {
        await createAccountingSetting(entityType, body);
      }
      resetForm();
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || 'Failed to save');
    } finally {
      setFormSubmitting(false);
    }
  }, [formType, formName, formCode, formBankId, formAccountNumber, formGlAccountId, formOpeningBalance, formMaxCashLimit, editingId, loadData]);

  const handleDelete = useCallback(async (type: 'bank-accounts' | 'cash-counters', id: string) => {
    if (!confirm('Delete this record? This cannot be undone.')) return;
    try {
      await deleteAccountingSetting(type, id);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to delete');
    }
  }, [loadData]);

  const startEdit = (type: 'bank_account' | 'cash_counter', item: any) => {
    setFormType(type);
    setEditingId(item.id);
    setFormName(item.name || item.accountName || '');
    setFormCode(item.code || '');
    if (type === 'bank_account') {
      setFormBankId(item.bankId || '');
      setFormAccountNumber(item.accountNumber || '');
      setFormGlAccountId(item.glAccountId || '');
      setFormOpeningBalance(String(item.openingBalance || 0));
    } else {
      setFormGlAccountId(item.glCashAccountId || '');
      setFormOpeningBalance(String(item.openingBalance || 0));
      setFormMaxCashLimit(String(item.maxCashLimit || ''));
    }
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        <span className="ml-2 text-sm text-slate-500">Loading bank accounts & counters...</span>
      </div>
    );
  }

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Cash Counters & Bank Accounts</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <Building2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Manage bank accounts, cash counters, and GL account linkages</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(true); setFormType(activeSection === 'cash_counters' ? 'cash_counter' : 'bank_account'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add {activeSection === 'cash_counters' ? 'Cash Counter' : 'Bank Account'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-emerald-50 rounded-lg border border-emerald-100 text-emerald-700">
              <Landmark className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bank Accounts</span>
          </div>
          <div className="text-2xl font-black text-slate-900">{bankAccounts.filter(a => a.isActive).length}</div>
          <div className="text-xs text-slate-500 mt-1">Total GL Balance: <span className="font-bold text-emerald-700">{formatNPR(totalBankBalance)}</span></div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-amber-50 rounded-lg border border-amber-100 text-amber-700">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cash Counters</span>
          </div>
          <div className="text-2xl font-black text-slate-900">{cashCounters.filter(c => c.isActive).length}</div>
          <div className="text-xs text-slate-500 mt-1">Total Opening: <span className="font-bold text-amber-700">{formatNPR(totalCounterBalance)}</span></div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-blue-50 rounded-lg border border-blue-100 text-blue-700">
              <CreditCard className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Banks</span>
          </div>
          <div className="text-2xl font-black text-slate-900">{banks.filter(b => b.isActive).length}</div>
          <div className="text-xs text-slate-500 mt-1">Active banking partners</div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setActiveSection('bank_accounts')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeSection === 'bank_accounts'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Landmark className="w-3.5 h-3.5 inline mr-1.5" />
          Bank Accounts
        </button>
        <button
          onClick={() => setActiveSection('cash_counters')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeSection === 'cash_counters'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Wallet className="w-3.5 h-3.5 inline mr-1.5" />
          Cash Counters
        </button>
      </div>

      {/* BANK ACCOUNTS SECTION */}
      {activeSection === 'bank_accounts' && (
        <div className="space-y-4">
          {Object.entries(bankAccountsByBank).map(([bankName, accounts]) => (
            <div key={bankName} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-bold text-slate-900">{bankName}</span>
                  <span className="text-xs text-slate-400">({accounts.length} accounts)</span>
                </div>
                <span className="text-xs font-bold text-emerald-700 font-mono">
                  {formatNPR(accounts.reduce((s, a) => s + (a.glBalance ?? a.openingBalance ?? 0), 0))}
                </span>
              </div>
              <div className="divide-y divide-slate-50">
                {accounts.map(ba => {
                  const summary = getBalanceSummary(ba.id);
                  return (
                    <div key={ba.id} className="px-4 py-3 hover:bg-slate-50/50">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">{ba.accountName}</span>
                            {ba.isPrimary && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded">PRIMARY</span>
                            )}
                            {!ba.isActive && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-500 rounded">INACTIVE</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            <span className="font-mono">{ba.accountNumber}</span>
                            {ba.glAccountId && (
                              <span className="ml-2 text-slate-400">| GL: {getGlAccountName(ba.glAccountId)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => startEdit('bank_account', ba)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete('bank-accounts', ba.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {/* Balance Summary Card */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                        <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Opening</div>
                          <div className="text-xs font-bold text-slate-700 font-mono">{formatNPR(summary?.openingBalance ?? ba.openingBalance ?? 0)}</div>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Deposits</div>
                          <div className="text-xs font-bold text-emerald-700 font-mono">{formatNPR(summary?.totalDeposits ?? 0)}</div>
                        </div>
                        <div className="bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Withdrawals</div>
                          <div className="text-xs font-bold text-rose-700 font-mono">{formatNPR(summary?.totalWithdrawals ?? 0)}</div>
                        </div>
                        <div className={`rounded-lg px-3 py-2 border ${(summary?.currentBalance ?? 0) >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-amber-50 border-amber-100'}`}>
                          <div className={`text-[10px] font-bold uppercase tracking-wider ${(summary?.currentBalance ?? 0) >= 0 ? 'text-blue-500' : 'text-amber-500'}`}>Current</div>
                          <div className={`text-xs font-black font-mono ${(summary?.currentBalance ?? 0) >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>{formatNPR(summary?.currentBalance ?? ba.glBalance ?? 0)}</div>
                        </div>
                      </div>
                      {summary && summary.transactionCount > 0 && (
                        <div className="text-[10px] text-slate-400 mt-1.5">{summary.transactionCount} transactions</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {bankAccounts.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-400">
              No bank accounts configured. Click "Add Bank Account" to create one.
            </div>
          )}
        </div>
      )}

      {/* CASH COUNTERS SECTION */}
      {activeSection === 'cash_counters' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {cashCounters.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              No cash counters configured. Click "Add Cash Counter" to create one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600 uppercase tracking-wider">Name</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600 uppercase tracking-wider">Code</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-600 uppercase tracking-wider">GL Account</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-slate-600 uppercase tracking-wider">Opening Balance</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-slate-600 uppercase tracking-wider">Max Cash Limit</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {cashCounters.map(cc => (
                    <tr key={cc.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-amber-50 rounded border border-amber-100 text-amber-700">
                            <Wallet className="w-3 h-3" />
                          </div>
                          <span className="font-bold text-slate-900">{cc.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600">{cc.code}</td>
                      <td className="px-3 py-2.5 text-slate-600">{getGlAccountName(cc.glCashAccountId)}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">{formatNPR(cc.openingBalance || 0)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-600">{cc.maxCashLimit ? formatNPR(cc.maxCashLimit) : '—'}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          cc.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-50 text-slate-500 border border-slate-200'
                        }`}>
                          {cc.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => startEdit('cash_counter', cc)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete('cash-counters', cc.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* FORM MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId ? 'Edit' : 'Add'} {formType === 'bank_account' ? 'Bank Account' : 'Cash Counter'}
                </h2>
              </div>
              <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 text-lg">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              {formType === 'bank_account' && (
                <>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Bank</label>
                    <select
                      value={formBankId}
                      onChange={e => setFormBankId(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-emerald-500 outline-none"
                    >
                      <option value="">Select bank...</option>
                      {banks.filter(b => b.isActive).map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Account Name</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      placeholder="e.g. Primary Current Account"
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Code</label>
                      <input
                        type="text"
                        value={formCode}
                        onChange={e => setFormCode(e.target.value)}
                        placeholder="e.g. BO001"
                        className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Account Number</label>
                      <input
                        type="text"
                        value={formAccountNumber}
                        onChange={e => setFormAccountNumber(e.target.value)}
                        placeholder="e.g. 0123456789"
                        className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">GL Account (Optional)</label>
                    <select
                      value={formGlAccountId}
                      onChange={e => setFormGlAccountId(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-emerald-500 outline-none"
                    >
                      <option value="">None</option>
                      {coaAccounts.filter(a => a.allowPosting && (a.type === 'Asset' || a.type === 'Liability')).map(a => (
                        <option key={a.id} value={a.id}>{a.code} – {a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Opening Balance (NPR)</label>
                    <input
                      type="number"
                      value={formOpeningBalance}
                      onChange={e => setFormOpeningBalance(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:border-emerald-500 outline-none"
                    />
                  </div>
                </>
              )}

              {formType === 'cash_counter' && (
                <>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Counter Name</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      placeholder="e.g. Main Teller Counter"
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Code</label>
                    <input
                      type="text"
                      value={formCode}
                      onChange={e => setFormCode(e.target.value)}
                      placeholder="e.g. CTR-01"
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">GL Cash Account (Optional)</label>
                    <select
                      value={formGlAccountId}
                      onChange={e => setFormGlAccountId(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:border-emerald-500 outline-none"
                    >
                      <option value="">None</option>
                      {coaAccounts.filter(a => a.allowPosting && a.type === 'Asset').map(a => (
                        <option key={a.id} value={a.id}>{a.code} – {a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Opening Balance (NPR)</label>
                      <input
                        type="number"
                        value={formOpeningBalance}
                        onChange={e => setFormOpeningBalance(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Max Cash Limit (NPR)</label>
                      <input
                        type="number"
                        value={formMaxCashLimit}
                        onChange={e => setFormMaxCashLimit(e.target.value)}
                        placeholder="Optional"
                        className="w-full px-3 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="p-5 border-t border-slate-100 flex gap-3">
              <button
                onClick={resetForm}
                className="flex-1 py-2.5 text-sm font-semibold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formName || !formCode || formSubmitting}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
              >
                {formSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
