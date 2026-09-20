import React, { useEffect, useMemo, useState } from 'react';
import {
  UserPlus,
  Search,
  RefreshCw,
  Eye,
  Pencil,
  BookOpen,
  Printer,
  BookMarked,
  PiggyBank,
  Wallet,
  Users,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  Building2,
  Trash2,
} from 'lucide-react';
import { useCoop } from '../../context/CoopContext';
import { getSavingsAccounts } from '../../api/savings';
import { updateSavingsAccount } from '../../api/savingsDeposits';
import { hardDeleteSavingsAccount } from '../../api/hardDelete';
import { HardDeleteModal } from '../modals/HardDeleteModal';
import { formatNPR } from '../../utils/nepaliCalendar';
import { ImageHoverPreview } from '../common/ImageHoverPreview';
import type { SavingsAccount } from '../../types/coop';

const STATUS_STYLES: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Dormant: 'bg-amber-100 text-amber-800 border-amber-200',
  Closed: 'bg-rose-100 text-rose-700 border-rose-200',
};

export const SavingsAccountRegisterView: React.FC = () => {
  const {
    savingsAccounts = [],
    members = [],
    branches = [],
    activeBranchId,
    activeRole,
    openTab,
    setSelectedAccountForPassbook,
    addNotification,
  } = useCoop();

  const [accounts, setAccounts] = useState<SavingsAccount[]>(savingsAccounts);
  const [search, setSearch] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState(activeBranchId || '');
  const [loading, setLoading] = useState(false);
  const [viewing, setViewing] = useState<SavingsAccount | null>(null);
  const [editing, setEditing] = useState<SavingsAccount | null>(null);
  // Admin-only secure hard delete (archives immutable snapshot before removal)
  const [hardDeleteTarget, setHardDeleteTarget] = useState<SavingsAccount | null>(null);

  const canHardDelete =
    (activeRole as string) === 'org_admin' || (activeRole as string) === 'admin' || (activeRole as string) === 'super_admin';

  const load = async () => {
    setLoading(true);
    try {
      const result = await getSavingsAccounts({ page: 1, limit: 500 });
      if (Array.isArray(result.data)) setAccounts(result.data);
    } catch {
      setAccounts(savingsAccounts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const productTypes = useMemo(
    () => [...new Set(accounts.map((a) => a.productType))].sort(),
    [accounts]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts
      .filter((a) => {
        if (
          q &&
          !a.accountNo.toLowerCase().includes(q) &&
          !a.memberName.toLowerCase().includes(q) &&
          !a.memberNo.toLowerCase().includes(q)
        ) {
          return false;
        }
        if (productFilter && a.productType !== productFilter) return false;
        if (statusFilter && a.status !== statusFilter) return false;
        if (branchFilter && a.branchId !== branchFilter) return false;
        return true;
      })
      .sort((a, b) => a.accountNo.localeCompare(b.accountNo));
  }, [accounts, search, productFilter, statusFilter, branchFilter]);

  const totalAccounts = accounts.length;
  const totalDeposits = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const activeCount = accounts.filter((a) => a.status === 'Active').length;
  const inactiveCount = totalAccounts - activeCount;

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name || '—';

  const openNewAccount = () => openTab('savings_open_account', 'Open New Account', 'UserPlus');

  const handleEditSaved = (updated: SavingsAccount) => {
    setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setEditing(null);
    addNotification('Account updated', `${updated.accountNo} — ${updated.memberName} updated successfully.`, 'success');
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-1">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Savings Account Register</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <PiggyBank className="w-3.5 h-3.5 text-slate-500" />
            <span>Search, view and manage every savings account in the cooperative</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition cursor-pointer shadow-xs text-xs"
            title="Refresh account register"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={openNewAccount}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition cursor-pointer shadow-lg text-xs"
          >
            <UserPlus className="w-4 h-4" />
            + Open New Account
          </button>
        </div>
      </div>

      {/* Account Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Accounts</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900">{totalAccounts.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Deposits</span>
            <PiggyBank className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-1.5 text-xl font-bold text-emerald-700 font-mono">{formatNPR(totalDeposits)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Active</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900">{activeCount.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Dormant / Closed</span>
            <Users className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900">{inactiveCount.toLocaleString()}</div>
        </div>
      </div>

      {/* Search / Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2.5">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by account no, member name or member no…"
              className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs focus:border-emerald-500 focus:outline-none shadow-xs"
            />
          </div>
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none shadow-xs"
          >
            <option value="">All Product Types</option>
            {productTypes.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none shadow-xs"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Dormant">Dormant</option>
            <option value="Closed">Closed</option>
          </select>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none shadow-xs"
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider">
                <th className="px-4 py-2.5 text-left font-bold">Account No</th>
                <th className="px-4 py-2.5 text-left font-bold">Member</th>
                <th className="px-4 py-2.5 text-left font-bold">Product</th>
                <th className="px-4 py-2.5 text-right font-bold">Interest</th>
                <th className="px-4 py-2.5 text-right font-bold">Balance</th>
                <th className="px-4 py-2.5 text-left font-bold">Status</th>
                <th className="px-4 py-2.5 text-left font-bold">Branch</th>
                <th className="px-4 py-2.5 text-left font-bold">Opened (BS)</th>
                <th className="px-4 py-2.5 text-center font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Building2 className="w-8 h-8" />
                      <p className="text-sm font-semibold">No accounts found</p>
                      <p className="text-xs">Try adjusting your search / filters, or open a new account.</p>
                      <button
                        type="button"
                        onClick={openNewAccount}
                        className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition cursor-pointer shadow text-xs"
                      >
                        <UserPlus className="w-4 h-4" />
                        + Open New Account
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 hover:bg-emerald-50/40 transition">
                  <td className="px-4 py-2.5 font-mono font-bold text-emerald-700">{a.accountNo}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-bold text-slate-900">{a.memberName}</div>
                    <div className="text-[10px] text-slate-500">{a.memberNo}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="text-slate-700">{a.productName || a.productType}</div>
                    <div className="text-[10px] text-slate-400 uppercase">{a.productType}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-amber-700 font-semibold">{a.interestRate}%</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">{formatNPR(a.balance)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full border font-bold ${STATUS_STYLES[a.status] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{branchName(a.branchId)}</td>
                  <td className="px-4 py-2.5 text-slate-600 font-mono">{a.openedDateBS}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" title="View Account" onClick={() => setViewing(a)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-100 hover:text-emerald-700 text-slate-600 border border-slate-200 transition cursor-pointer">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" title="Edit / Manage Account" onClick={() => setEditing(a)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-600 border border-slate-200 transition cursor-pointer">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" title="Account Ledger" onClick={() => openTab('savings_ledger', 'Account Ledger', 'BookOpen')}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 text-slate-600 border border-slate-200 transition cursor-pointer">
                        <BookOpen className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" title="Print Passbook" onClick={() => setSelectedAccountForPassbook(a)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-amber-100 hover:text-amber-700 text-slate-600 border border-slate-200 transition cursor-pointer">
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" title="Cheque Book" onClick={() => openTab('savings_cheque_management', 'Cheque Book Management', 'BookMarked')}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-teal-100 hover:text-teal-700 text-slate-600 border border-slate-200 transition cursor-pointer">
                        <BookMarked className="w-3.5 h-3.5" />
                      </button>
                      {canHardDelete && (
                        <button type="button" title="Hard Delete (Admin Only)" onClick={() => setHardDeleteTarget(a)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-600 border border-slate-200 transition cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
          <span>
            Showing <span className="font-bold text-slate-800">{filtered.length}</span> of{' '}
            <span className="font-bold text-slate-800">{totalAccounts}</span> accounts
          </span>
          {loading && (
            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Syncing…
            </span>
          )}
        </div>
      </div>

      {/* Modals */}
      {viewing && (
        <AccountDetailModal
          account={viewing}
          member={members.find((m) => m.id === viewing.memberId) || null}
          branchName={branchName(viewing.branchId)}
          onClose={() => setViewing(null)}
          onManage={() => {
            setViewing(null);
            setEditing(viewing);
          }}
        />
      )}
      {editing && (
        <AccountEditModal
          account={editing}
          onClose={() => setEditing(null)}
          onSaved={handleEditSaved}
        />
      )}

      {/* SECURE HARD DELETE (admin only) — archives immutable snapshot first */}
      {hardDeleteTarget && (
        <HardDeleteModal
          title="Hard Delete Savings Account"
          entityLabel={hardDeleteTarget.memberName}
          entityCode={hardDeleteTarget.accountNo}
          subtext="This will also permanently delete the account's full transaction ledger, interest postings and cheque instruments."
          onClose={() => setHardDeleteTarget(null)}
          onConfirm={async (reason) => {
            await hardDeleteSavingsAccount(hardDeleteTarget.id, reason);
            setHardDeleteTarget(null);
            addNotification('Account Hard Deleted', `Savings account ${hardDeleteTarget.accountNo} was permanently deleted. An immutable audit record was archived.`, 'success');
            await load();
          }}
        />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// View Account Modal
// ─────────────────────────────────────────────────────────────

function AccountDetailModal({
  account,
  member,
  branchName,
  onClose,
  onManage,
}: {
  account: SavingsAccount;
  member: any;
  branchName: string;
  onClose: () => void;
  onManage: () => void;
}) {
  const rows: [string, React.ReactNode][] = [
    ['Account No', <span key="acc" className="font-mono font-bold text-emerald-700">{account.accountNo}</span>],
    ['Status', <span key="st" className={`px-2 py-0.5 rounded-full border font-bold ${STATUS_STYLES[account.status] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>{account.status}</span>],
    ['Product', `${account.productName || account.productType} (${account.productType})`],
    ['Interest Rate', `${account.interestRate}% p.a.`],
    ['Balance', <span key="bal" className="font-mono font-bold text-emerald-700">{formatNPR(account.balance)}</span>],
    ['Minimum Balance', formatNPR(account.minBalance)],
    ['Opened (BS)', account.openedDateBS],
    ['Last Transaction (BS)', account.lastTransactionDateBS || '—'],
    ['Branch', branchName],
    ['Member No', account.memberNo],
    ...(account.maturityDateBS ? ([['Maturity (BS)', account.maturityDateBS]] as [string, React.ReactNode][]) : []),
    ...(account.monthlyInstallment ? ([['Monthly Installment', formatNPR(account.monthlyInstallment)]] as [string, React.ReactNode][]) : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Account Details</h3>
            <p className="text-[11px] text-slate-500">{account.memberName} — {account.accountNo}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {member && (
            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <ImageHoverPreview
                src={member.photoUrl}
                name={member.fullName}
                subtext={member.memberNo}
                badge={member.kycStatus}
                sizeClass="w-12 h-12"
              />
              <div>
                <div className="font-bold text-slate-900">{member.fullName}</div>
                <div className="text-[10px] text-slate-500">Citizenship: {member.citizenshipNo || '—'}</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
            {rows.map(([label, value]) => (
              <div key={String(label)}>
                <div className="text-[10px] text-slate-500 uppercase font-semibold">{label}</div>
                <div className="text-slate-800 font-medium mt-0.5">{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onManage}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow"
          >
            Edit / Manage
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Edit / Manage Account Modal
// ─────────────────────────────────────────────────────────────

function AccountEditModal({
  account,
  onClose,
  onSaved,
}: {
  account: SavingsAccount;
  onClose: () => void;
  onSaved: (updated: SavingsAccount) => void;
}) {
  const [status, setStatus] = useState(account.status);
  const [minBalance, setMinBalance] = useState(String(account.minBalance ?? ''));
  const [interestRate, setInterestRate] = useState(String(account.interestRate ?? ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload: { status?: 'Active' | 'Dormant' | 'Closed'; minBalance?: number; interestRate?: number } = {};
      if (status !== account.status) payload.status = status;
      const minBal = minBalance === '' ? undefined : Number(minBalance);
      const rate = interestRate === '' ? undefined : Number(interestRate);
      if (minBal !== undefined && !Number.isFinite(minBal)) return setError('Minimum balance must be a valid number.');
      if (rate !== undefined && !Number.isFinite(rate)) return setError('Interest rate must be a valid number.');
      if (minBal !== undefined && minBal !== account.minBalance) payload.minBalance = minBal;
      if (rate !== undefined && rate !== account.interestRate) payload.interestRate = rate;

      if (Object.keys(payload).length === 0) {
        onClose();
        return;
      }

      const updated = await updateSavingsAccount(account.id, payload);
      onSaved({ ...account, ...updated });
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to update account.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Edit / Manage Account</h3>
            <p className="text-[11px] text-slate-500">{account.accountNo} — {account.memberName}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Current Balance</span>
              <span className="font-mono font-bold text-emerald-700">{formatNPR(account.balance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Product</span>
              <span className="text-slate-800 font-semibold">{account.productName || account.productType}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Account Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none shadow-xs"
            >
              <option value="Active">Active</option>
              <option value="Dormant">Dormant</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Minimum Balance (NPR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={minBalance}
                onChange={(e) => setMinBalance(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:border-emerald-500 focus:outline-none shadow-xs"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Interest Rate (% p.a.)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono focus:border-emerald-500 focus:outline-none shadow-xs"
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            Balance and member identity cannot be changed here. Status changes block or restore teller transactions.
          </div>

          {error && (
            <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
