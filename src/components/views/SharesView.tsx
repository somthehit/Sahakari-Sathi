import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PieChart, Printer, ArrowRightLeft, BookOpen, Coins, Plus, RefreshCw,
  X, Search, Award, Users, FileText, ArrowLeftRight,
} from 'lucide-react';
import { formatNPR } from '../../utils/nepaliCalendar';
import { useCoop } from '../../context/CoopContext';
import {
  fetchShareSummary, fetchShareHoldings, fetchShareTypes, fetchShareTransactions,
  fetchShareCertificates, fetchShareTransfers, processShareTransaction, transferShares, surrenderShares, createShareType,
  fetchShareMembers, fetchShareRegister, fetchShareAccountDetail,
  ShareMemberOption, ShareTransactionResult, ShareRegisterRow, ShareAccountDetail,
} from '../../api/shares';
import { fetchCoa } from '../../api/accountingSettings';
import { ShareTransferPrintModal } from '../modals/ShareTransferPrintModal';
import { ShareIssueReturnVoucherModal } from '../modals/ShareIssueReturnVoucherModal';
import { ShareCertificateModal } from '../modals/ShareCertificateModal';
import type {
  ShareHolding, ShareType, ShareTransaction, ShareCertificate, ShareDashboardSummary,
  ShareTransfer, ShareTransferResult, Member,
} from '../../types/coop';
import { ShareIssueReturnForm } from '../shares/ShareIssueReturnForm';
import { ShareTransferForm } from '../shares/ShareTransferForm';
import { OpenSharesAccountView } from './OpenSharesAccountView';
import { useAuthStore } from '../../stores/authStore';

interface Props {
  activeSubKey?: string;
}

type TabKey = 'overview' | 'register' | 'issue' | 'transfers' | 'certificates' | 'ledger' | 'types' | 'open';
type IssueMode = 'issue' | 'return' | 'transfer';
const EMPTY_SUMMARY: ShareDashboardSummary = {
  totalShareCapital: 0,
  totalSharesCount: 0,
  totalMembersWithShares: 0,
  totalCertificatesIssued: 0,
  shareTypesCount: 0,
  dividendRate: 0,
  proposedDividend: 0,
};

function resolveTab(activeSubKey?: string): TabKey {
  switch (activeSubKey) {
    case 'shares_accounts': return 'open';
    case 'shares_issue': return 'issue';
    case 'shares_ledger': return 'ledger';
    case 'shares_dividend': return 'register';
    case 'shares_transfers': return 'transfers';
    case 'shares_certs': return 'certificates';
    default: return 'overview';
  }
}

export const SharesView: React.FC<Props> = ({ activeSubKey }) => {
  const { members } = useCoop();
  const authUser = useAuthStore((s) => s.user);
  const org = { organizationName: authUser?.organizationName ?? '' };
  const [tab, setTab] = useState<TabKey>(resolveTab(activeSubKey));
  const [summary, setSummary] = useState<ShareDashboardSummary>(EMPTY_SUMMARY);
  const [holdings, setHoldings] = useState<ShareHolding[]>([]);
  const [types, setTypes] = useState<ShareType[]>([]);
  const [transactions, setTransactions] = useState<ShareTransaction[]>([]);
  const [certificates, setCertificates] = useState<ShareCertificate[]>([]);
  const [transfers, setTransfers] = useState<ShareTransfer[]>([]);
  const [shareMembers, setShareMembers] = useState<ShareMemberOption[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Share register (server-side, auto-provisioned master accounts)
  const [register, setRegister] = useState<ShareRegisterRow[]>([]);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [accountDetail, setAccountDetail] = useState<ShareAccountDetail | null>(null);
  const [ledgerTab, setLedgerTab] = useState<'issuances' | 'returns' | 'register'>('issuances');

  // Payment source options (active Asset COA accounts — cash/bank first)
  const [paymentAccounts, setPaymentAccounts] = useState<{ id: string; code: string; name: string }[]>([]);

  // Certificate preview modal state
  const [previewMember, setPreviewMember] = useState<Member | null>(null);
  const [previewCertificate, setPreviewCertificate] = useState<ShareCertificate | null>(null);

  const openCertificate = useCallback((memberId: string, certificate?: ShareCertificate | null, fallback?: Partial<Member>) => {
    const member = members.find(m => m.id === memberId) ?? (fallback ? (fallback as Member) : null);
    setPreviewMember(member);
    setPreviewCertificate(certificate ?? null);
  }, [members]);

  // Issue modal state
  const [showIssue, setShowIssue] = useState(false);
  const [issueForm, setIssueForm] = useState({ memberId: '', shareTypeId: '', numberOfShares: 10, remarks: '', paymentAccountId: '' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Transfer modal state
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({ fromHoldingId: '', toMemberId: '', numberOfShares: 1, remarks: '' });

  // Issue / Return / Transfer mode for the transaction dropdown
  const [issueMode, setIssueMode] = useState<IssueMode>('issue');

  // Inline transaction-type switcher rendered inside the form card header
  const modeSwitcher = (
    <select
      value={issueMode}
      onChange={e => setIssueMode(e.target.value as IssueMode)}
      className="text-xs font-semibold bg-white border border-slate-300 rounded-md px-3 py-1.5 text-slate-700 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-none cursor-pointer"
    >
      <option value="issue">Issue New Shares (प्राप्ति)</option>
      <option value="return">Return Shares (भुक्तानी)</option>
      <option value="transfer">Transfer Between Members (हस्तान्तरण)</option>
    </select>
  );

  // Transfer print dialog
  const [transferForPrint, setTransferForPrint] = useState<ShareTransferResult | null>(null);

  // Issue / Return voucher print dialog
  const [issueReturnForPrint, setIssueReturnForPrint] = useState<ShareTransactionResult | null>(null);

  // Type creation modal
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [typeForm, setTypeForm] = useState({
    code: '', name: '', faceValue: 100, minShares: 1, maxShares: '', isTransferable: true, dividendRate: 0, description: '',
  });

  useEffect(() => {
    setTab(resolveTab(activeSubKey));
  }, [activeSubKey]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, holdingsData, typesData, txnData, certData, memberData, transferData, registerData] = await Promise.all([
        fetchShareSummary(),
        fetchShareHoldings({ limit: 500 }),
        fetchShareTypes(),
        fetchShareTransactions({ limit: 200 }),
        fetchShareCertificates({ limit: 200 }),
        fetchShareMembers(),
        fetchShareTransfers({ limit: 200 }),
        fetchShareRegister(),
      ]);
      setSummary(summaryData ?? EMPTY_SUMMARY);
      setHoldings(holdingsData.data ?? []);
      setTypes(typesData ?? []);
      setTransactions(txnData ?? []);
      setCertificates(certData ?? []);
      setShareMembers(memberData ?? []);
      setTransfers(transferData ?? []);
      setRegister(registerData ?? []);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load share data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const loadRegister = useCallback(async () => {
    setRegisterLoading(true);
    try {
      setRegister(await fetchShareRegister({ search: search || undefined }));
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load share register');
    } finally {
      setRegisterLoading(false);
    }
  }, [search]);

  // Debounced server-side register search while the tab is active.
  useEffect(() => {
    if (tab !== 'register') return;
    const t = setTimeout(() => { loadRegister(); }, 250);
    return () => clearTimeout(t);
  }, [tab, search, loadRegister]);

  // Payment source options for the issue modal.
  useEffect(() => {
    fetchCoa().then(coa => {
      const list = (coa?.accounts ?? [])
        .filter(a => a.type === 'Asset' && a.allowPosting && a.isActive !== false)
        .sort((a, b) => {
          if (!!a.cashBankAccount !== !!b.cashBankAccount) return a.cashBankAccount ? -1 : 1;
          return a.code.localeCompare(b.code);
        })
        .map(a => ({ id: a.id, code: a.code, name: a.name }));
      setPaymentAccounts(list);
    }).catch(() => { /* COA unavailable — fall back to server default cash/bank */ });
  }, []);

  const loadAccountDetail = async (memberId: string) => {
    try {
      setLedgerTab('issuances');
      setAccountDetail(await fetchShareAccountDetail(memberId));
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load share account');
    }
  };

  const printCertificateRegister = (detail: ShareAccountDetail) => {
    const orgName = org?.organizationName ?? 'Sahakari';
    const rows = detail.panels.certificateRegister
      .map(
        (e, i) => `<tr>
            <td>${i + 1}</td>
            <td>${e.shareTypeCode ?? 'Legacy'}</td>
            <td>${e.shareTypeName ?? '—'}</td>
            <td>${e.formattedRange}</td>
            <td class="r">${e.quantity}</td>
          </tr>`
      )
      .join('');
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html><head><title>Share Certificate Register — ${detail.account.memberName}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #0f172a; padding: 24px; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .sub { color: #475569; font-size: 12px; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
  th { background: #f1f5f9; font-size: 12px; }
  .r { text-align: right; }
  .head { display: flex; justify-content: space-between; margin-bottom: 18px; }
</style></head><body>
  <div class="head">
    <div><h1>${orgName}</h1><div class="sub">Share Certificate Register — Kitta Held</div></div>
    <div style="text-align:right" class="sub">
      <div><b>${detail.account.memberName}</b></div>
      <div>${detail.account.accountNo} · ${detail.account.memberNo}</div>
      <div>Total: ${detail.account.totalShares} kittas</div>
    </div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Class</th><th>Share Type</th><th>Kitta Range</th><th class="r">Qty</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5">No kitta held.</td></tr>'}</tbody>
  </table>
</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const activeTypes = types.filter(t => t.status === 'Active');

  const submitIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueForm.memberId || !issueForm.shareTypeId) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await processShareTransaction({
        transactionType: 'ISSUE',
        memberId: issueForm.memberId,
        shareTypeId: issueForm.shareTypeId,
        numberOfShares: Number(issueForm.numberOfShares),
        remarks: issueForm.remarks || undefined,
        paymentAccountId: issueForm.paymentAccountId || undefined,
      });
      const autoProvisioned = result.wasAutoProvisioned
        ? ` Share account ${result.accountNo} auto-opened on first issue.`
        : '';
      const kitta = (typeof result.kittaStart === 'number' && typeof result.kittaEnd === 'number')
        ? ` Kitta ${result.kittaStart}–${result.kittaEnd}.`
        : '';
      setSuccess(`Issued ${result.numberOfShares} shares to ${result.memberName} — Voucher ${result.voucherNo}, Certificate ${result.certificateNo}.${autoProvisioned}${kitta}`);
      setShowIssue(false);
      setIssueForm({ memberId: '', shareTypeId: '', numberOfShares: 10, remarks: '', paymentAccountId: '' });
      await loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Failed to issue shares');
    } finally {
      setSubmitting(false);
    }
  };

  const submitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.fromHoldingId || !transferForm.toMemberId) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await transferShares({
        fromHoldingId: transferForm.fromHoldingId,
        toMemberId: transferForm.toMemberId,
        numberOfShares: Number(transferForm.numberOfShares),
        remarks: transferForm.remarks || undefined,
      });
      setSuccess(`Transferred ${result.numberOfShares} shares — Voucher ${result.voucherNo}, Certificate ${result.certificateNo}`);
      setShowTransfer(false);
      setTransferForm({ fromHoldingId: '', toMemberId: '', numberOfShares: 1, remarks: '' });
      setTransferForPrint(result);
      await loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Failed to transfer shares');
    } finally {
      setSubmitting(false);
    }
  };

  const submitSurrender = async (holding: ShareHolding) => {
    if (!window.confirm(`Surrender all ${holding.numberOfShares} shares for ${holding.memberName}?`)) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await surrenderShares(holding.id, holding.numberOfShares);
      setSuccess(`Surrendered ${holding.numberOfShares} shares for ${holding.memberName}`);
      await loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Failed to surrender shares');
    } finally {
      setSubmitting(false);
    }
  };

  const submitTypeForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await createShareType({
        code: typeForm.code.trim().toUpperCase(),
        name: typeForm.name.trim(),
        faceValue: Number(typeForm.faceValue),
        minShares: Number(typeForm.minShares || 1),
        maxShares: typeForm.maxShares ? Number(typeForm.maxShares) : null,
        isTransferable: typeForm.isTransferable,
        dividendRate: Number(typeForm.dividendRate || 0),
        description: typeForm.description || undefined,
      });
      setSuccess(`Share type "${typeForm.name}" created`);
      setShowTypeForm(false);
      setTypeForm({ code: '', name: '', faceValue: 100, minShares: 1, maxShares: '', isTransferable: true, dividendRate: 0, description: '' });
      await loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Failed to create share type');
    } finally {
      setSubmitting(false);
    }
  };

  const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: 'overview', label: 'Overview', icon: PieChart },
    { key: 'register', label: 'Share Register', icon: Users },
    { key: 'issue', label: 'Issue / Transfer', icon: ArrowRightLeft },
    { key: 'open', label: 'Open Account', icon: Plus },
    { key: 'transfers', label: 'Transfer Registry', icon: ArrowLeftRight },
    { key: 'certificates', label: 'Certificates', icon: Award },
    { key: 'ledger', label: 'Transactions', icon: BookOpen },
    { key: 'types', label: 'Share Types', icon: Coins },
  ];

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Share Capital & AGM Dividend Management</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <PieChart className="w-3.5 h-3.5 text-slate-500" />
            <span>Member share certificates, transfers, bonus share issues, and annual dividend payouts</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadAll}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => setShowIssue(true)}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-slate-800 rounded-lg text-xs font-semibold transition cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Issue Shares
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2">
        {tabs.map(t => {
          const Icon = t.icon;
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer inline-flex items-center gap-1.5 ${ isActive ? 'bg-purple-100 /40 text-purple-700 ' : 'text-slate-500 hover:bg-slate-100 ' }`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-50 /40 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 /40 border border-emerald-200 text-emerald-700 text-xs rounded-xl px-3 py-2">
          {success}
        </div>
      )}

      {/* ============================================================
          OPEN ACCOUNT (हकवाला)
      ============================================================ */}
      {tab === 'open' && <OpenSharesAccountView />}

      {/* ============================================================
          OVERVIEW
      ============================================================ */}
      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-slate-500 text-xs font-medium">Total Paid-up Share Capital</span>
              <div className="text-2xl font-black text-purple-600 font-mono mt-1">{formatNPR(summary.totalShareCapital)}</div>
              <div className="text-[11px] text-slate-500 mt-1">{summary.totalSharesCount.toLocaleString()} shares held by {summary.totalMembersWithShares} members</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-slate-500 text-xs font-medium">Total Share Certificates Issued</span>
              <div className="text-2xl font-black text-slate-900 font-mono mt-1">{summary.totalCertificatesIssued.toLocaleString()}</div>
              <div className="text-[11px] text-slate-500 mt-1">Across {summary.shareTypesCount} active share classes</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-slate-500 text-xs font-medium">Proposed AGM Dividend</span>
              <div className="text-2xl font-black text-emerald-600 font-mono mt-1">{formatNPR(summary.proposedDividend)}</div>
              <div className="text-[11px] text-slate-500 mt-1">At {summary.dividendRate}% proposed payout rate</div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900 text-base">Recent Share Transactions</h2>
              <button onClick={() => setTab('ledger')} className="text-[11px] font-semibold text-purple-600 hover:underline cursor-pointer">View all →</button>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Member</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Shares</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3">Voucher</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {transactions.slice(0, 8).map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50 /50">
                      <td className="p-3 font-mono text-[11px]">{tx.dateBs}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{tx.memberName}</div>
                        <div className="text-[10px] text-emerald-700 font-mono">{tx.memberNo}</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ tx.transactionType === 'Issue' ? 'bg-emerald-50 text-emerald-700 /30 ' : tx.transactionType.includes('Transfer') ? 'bg-blue-50 text-blue-700 /30 ' : 'bg-amber-50 text-amber-700 /30 ' }`}>
                          {tx.transactionType.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-purple-600">{tx.numberOfShares}</td>
                      <td className="p-3 text-right font-mono">{formatNPR(tx.totalAmount)}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-500">{tx.voucherNo}</td>
                    </tr>
                  ))}
                  {transactions.length === 0 && !loading && (
                    <tr><td colSpan={6} className="p-6 text-center text-slate-500">No share transactions yet. Use "Issue Shares" to begin.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ============================================================
          REGISTER (shareholding)
      ============================================================ */}
      {tab === 'register' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-bold text-slate-900 text-base">Member Shareholding Register</h2>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search member / no..."
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              />
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
                <tr>
                  <th className="p-3">Member</th>
                  <th className="p-3">Account</th>
                  <th className="p-3 text-right">No. of Shares</th>
                  <th className="p-3 text-right">Total Capital</th>
                  <th className="p-3 text-right">Dividend</th>
                  <th className="p-3 text-right">Estimated Dividend</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {register.map(r => {
                  const holding = holdings.find(h => h.memberId === r.memberId && h.status === 'Active');
                  return (
                    <tr key={r.accountId} className="hover:bg-slate-50 /50">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{r.memberName}</div>
                        <div className="text-[10px] text-emerald-700 font-mono">{r.memberNo}</div>
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => loadAccountDetail(r.memberId)}
                          title="View account & kitta history"
                          className="font-mono text-purple-700 hover:underline cursor-pointer"
                        >
                          {r.accountNo}
                        </button>
                        <div className="text-[10px] text-slate-500">{r.membershipType}</div>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-purple-600">{r.totalShares}</td>
                      <td className="p-3 text-right font-mono text-slate-800">{formatNPR(r.totalCapital)}</td>
                      <td className="p-3 text-right font-mono text-slate-500">{r.dividendRate}%</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">{formatNPR(r.estimatedDividend)}</td>
                      <td className="p-3 text-center">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => loadAccountDetail(r.memberId)}
                            title="Account & Kitta History"
                            className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs transition cursor-pointer"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                          </button>
                          {holding && (
                            <>
                              <button
                                onClick={() => { setTransferForm({ fromHoldingId: holding.id, toMemberId: '', numberOfShares: 1, remarks: '' }); setShowTransfer(true); }}
                                title="Transfer"
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs transition cursor-pointer"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openCertificate(r.memberId, null, {
                                  id: r.memberId,
                                  memberNo: r.memberNo,
                                  fullName: r.memberName,
                                  totalShares: r.totalShares,
                                  shareAmount: r.totalCapital,
                                  membershipDateBS: '',
                                })}
                                title="View Certificate"
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs transition cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => submitSurrender(holding)}
                                title="Surrender"
                                className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs transition cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {register.length === 0 && !registerLoading && (
                  <tr><td colSpan={7} className="p-6 text-center text-slate-500">No share accounts found. Issue shares to auto-provision member accounts.</td></tr>
                )}
                {registerLoading && (
                  <tr><td colSpan={7} className="p-6 text-center text-slate-400">Loading register…</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================
          ISSUE / RETURN / TRANSFER
      ============================================================ */}
      {tab === 'issue' && (
        <>
          {issueMode === 'issue' && (
            <ShareIssueReturnForm
              members={shareMembers}
              shareTypes={activeTypes}
              lockedType="ISSUE"
              headerActions={modeSwitcher}
              onSuccess={msg => setSuccess(msg)}
              onError={msg => setError(msg)}
              onSubmitted={loadAll}
              onCompleted={setIssueReturnForPrint}
            />
          )}

          {issueMode === 'return' && (
            <ShareIssueReturnForm
              members={shareMembers}
              shareTypes={activeTypes}
              lockedType="RETURN"
              headerActions={modeSwitcher}
              onSuccess={msg => setSuccess(msg)}
              onError={msg => setError(msg)}
              onSubmitted={loadAll}
              onCompleted={setIssueReturnForPrint}
            />
          )}

          {issueMode === 'transfer' && (
            <ShareTransferForm
              holdings={holdings}
              members={shareMembers}
              headerActions={modeSwitcher}
              onSuccess={msg => setSuccess(msg)}
              onError={msg => setError(msg)}
              onSubmitted={loadAll}
              onTransferred={setTransferForPrint}
            />
          )}
        </>
      )}

      {/* ============================================================
          TRANSFER REGISTRY (audit trail + printable documents)
      ============================================================ */}
      {tab === 'transfers' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-indigo-500" /> Share Transfer Registry ({transfers.length})
          </h2>
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
                <tr>
                  <th className="p-3">Transfer No</th>
                  <th className="p-3">Date (BS)</th>
                  <th className="p-3">From</th>
                  <th className="p-3">To</th>
                  <th className="p-3 text-right">Shares</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3">Voucher</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {transfers.map(tr => (
                  <tr key={tr.id} className="hover:bg-slate-50 /50">
                    <td className="p-3 font-mono font-bold text-indigo-600">{tr.transferNo}</td>
                    <td className="p-3 font-mono text-[11px]">{tr.dateBs}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{tr.fromMemberName}</div>
                      <div className="text-[10px] text-emerald-700 font-mono">{tr.fromMemberNo}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{tr.toMemberName}</div>
                      <div className="text-[10px] text-emerald-700 font-mono">{tr.toMemberNo}</div>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-purple-600">{tr.numberOfShares}</td>
                    <td className="p-3 text-right font-mono">{formatNPR(tr.totalAmount)}</td>
                    <td className="p-3 font-mono text-[11px] text-slate-500">{tr.voucherNo}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ tr.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 /30 ' : 'bg-slate-100 text-slate-600 ' }`}>{tr.status}</span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => {
                          setTransferForPrint({ ...tr, transferId: tr.id } as ShareTransferResult);
                        }}
                        title="Print Voucher & Certificate"
                        className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs transition cursor-pointer inline-flex items-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5" /> Print
                      </button>
                    </td>
                  </tr>
                ))}
                {transfers.length === 0 && !loading && (
                  <tr><td colSpan={9} className="p-6 text-center text-slate-500">No share transfers yet. Use "Transfer Shares" to begin.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================
          CERTIFICATES
      ============================================================ */}
      {tab === 'certificates' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-500" /> Share Certificates ({certificates.length})
            </h2>
          </div>
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
                <tr>
                  <th className="p-3">Certificate No</th>
                  <th className="p-3">Member</th>
                  <th className="p-3">Share Class</th>
                  <th className="p-3 text-right">Shares</th>
                  <th className="p-3">Issued (BS)</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {certificates.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 /50">
                    <td className="p-3 font-mono font-bold text-emerald-700">{c.certificateNo}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{c.memberName}</div>
                      <div className="text-[10px] text-emerald-700 font-mono">{c.memberNo}</div>
                    </td>
                    <td className="p-3">{c.shareTypeName}</td>
                    <td className="p-3 text-right font-mono font-bold text-purple-600">{c.numberOfShares}</td>
                    <td className="p-3 font-mono">{c.issuedDateBS}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ c.status === 'Active' ? 'bg-emerald-50 text-emerald-700 /30 ' : 'bg-slate-100 text-slate-600 ' }`}>{c.status}</span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => openCertificate(c.memberId, c, {
                          id: c.memberId,
                          memberNo: c.memberNo ?? '',
                          fullName: c.memberName ?? '',
                          totalShares: c.numberOfShares,
                          shareAmount: c.numberOfShares * 100,
                          membershipDateBS: c.issuedDateBS,
                        })}
                        title="View Certificate"
                        className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs transition cursor-pointer inline-flex items-center gap-1"
                      >
                        <Printer className="w-3.5 h-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))}
                {certificates.length === 0 && !loading && (
                  <tr><td colSpan={7} className="p-6 text-center text-slate-500">No certificates issued yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================
          LEDGER (transactions)
      ============================================================ */}
      {tab === 'ledger' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-500" /> Share Capital Ledger ({transactions.length})
          </h2>
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
                <tr>
                  <th className="p-3">Date (BS)</th>
                  <th className="p-3">Voucher</th>
                  <th className="p-3">Member</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-right">Shares</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3">Processed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50 /50">
                    <td className="p-3 font-mono text-[11px]">{tx.dateBs}</td>
                    <td className="p-3 font-mono text-[11px] text-slate-500">{tx.voucherNo}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{tx.memberName}</div>
                      <div className="text-[10px] text-emerald-700 font-mono">{tx.memberNo}</div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ tx.transactionType === 'Issue' ? 'bg-emerald-50 text-emerald-700 /30 ' : tx.transactionType.includes('Transfer') ? 'bg-blue-50 text-blue-700 /30 ' : 'bg-amber-50 text-amber-700 /30 ' }`}>
                        {tx.transactionType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-purple-600">{tx.numberOfShares}</td>
                    <td className="p-3 text-right font-mono">{formatNPR(tx.totalAmount)}</td>
                    <td className="p-3 text-slate-500">{tx.processedBy}</td>
                  </tr>
                ))}
                {transactions.length === 0 && !loading && (
                  <tr><td colSpan={7} className="p-6 text-center text-slate-500">No transactions yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================
          SHARE TYPES
      ============================================================ */}
      {tab === 'types' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-500" /> Share Classes ({types.length})
            </h2>
            <button
              onClick={() => setShowTypeForm(true)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> New Share Class
            </button>
          </div>
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
                <tr>
                  <th className="p-3">Code</th>
                  <th className="p-3">Name</th>
                  <th className="p-3 text-right">Face Value</th>
                  <th className="p-3 text-right">Min/Max</th>
                  <th className="p-3 text-right">Dividend Rate</th>
                  <th className="p-3 text-center">Transferable</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {types.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 /50">
                    <td className="p-3 font-mono font-bold text-amber-700">{t.code}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{t.name}</div>
                      {t.description && <div className="text-[10px] text-slate-500">{t.description}</div>}
                    </td>
                    <td className="p-3 text-right font-mono">{formatNPR(t.faceValue)}</td>
                    <td className="p-3 text-right font-mono text-slate-500">{t.minShares} / {t.maxShares ?? '∞'}</td>
                    <td className="p-3 text-right font-mono text-emerald-600">{t.dividendRate}%</td>
                    <td className="p-3 text-center">{t.isTransferable ? '✓' : '—'}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ t.status === 'Active' ? 'bg-emerald-50 text-emerald-700 /30 ' : 'bg-slate-100 text-slate-600 ' }`}>{t.status}</span>
                    </td>
                  </tr>
                ))}
                {types.length === 0 && !loading && (
                  <tr><td colSpan={7} className="p-6 text-center text-slate-500">No share classes defined. Create one to get started.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================
          ISSUE MODAL
      ============================================================ */}
      {showIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowIssue(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 text-xs space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Issue Shares</h3>
              <button onClick={() => setShowIssue(false)} className="text-slate-500 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={submitIssue} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Member</label>
                <select
                  value={issueForm.memberId}
                  onChange={e => setIssueForm({ ...issueForm, memberId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                >
                  <option value="">Select member...</option>
                  {shareMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.fullName} ({m.memberNo})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Share Class</label>
                <select
                  value={issueForm.shareTypeId}
                  onChange={e => setIssueForm({ ...issueForm, shareTypeId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                >
                  <option value="">Select share class...</option>
                  {activeTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name} — रु.{t.faceValue}/share</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Number of Shares</label>
                <input
                  type="number" min={1} value={issueForm.numberOfShares}
                  onChange={e => setIssueForm({ ...issueForm, numberOfShares: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Payment Source</label>
                <select
                  value={issueForm.paymentAccountId}
                  onChange={e => setIssueForm({ ...issueForm, paymentAccountId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                >
                  <option value="">Default (Cash / Bank)</option>
                  {paymentAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Remarks (optional)</label>
                <input
                  value={issueForm.remarks}
                  onChange={e => setIssueForm({ ...issueForm, remarks: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                />
              </div>
              <button
                type="submit" disabled={submitting}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {submitting ? 'Issuing...' : 'Issue Shares'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          TRANSFER MODAL
      ============================================================ */}
      {showTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowTransfer(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 text-xs space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Transfer Shares</h3>
              <button onClick={() => setShowTransfer(false)} className="text-slate-500 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={submitTransfer} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">From Holding</label>
                <select
                  value={transferForm.fromHoldingId}
                  onChange={e => setTransferForm({ ...transferForm, fromHoldingId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <option value="">Select source holding...</option>
                  {holdings.filter(h => h.status === 'Active').map(h => (
                    <option key={h.id} value={h.id}>{h.memberName} — {h.numberOfShares} shares ({h.shareTypeName})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">To Member</label>
                <select
                  value={transferForm.toMemberId}
                  onChange={e => setTransferForm({ ...transferForm, toMemberId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <option value="">Select receiving member...</option>
                  {shareMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.fullName} ({m.memberNo})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Number of Shares</label>
                <input
                  type="number" min={1} value={transferForm.numberOfShares}
                  onChange={e => setTransferForm({ ...transferForm, numberOfShares: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <button
                type="submit" disabled={submitting}
                className="w-full py-2.5 bg-blue-600 hover:bg-slate-200 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {submitting ? 'Transferring...' : 'Transfer Shares'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          SHARE TYPE MODAL
      ============================================================ */}
      {showTypeForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowTypeForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 text-xs space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">New Share Class</h3>
              <button onClick={() => setShowTypeForm(false)} className="text-slate-500 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={submitTypeForm} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Code</label>
                  <input
                    value={typeForm.code} onChange={e => setTypeForm({ ...typeForm, code: e.target.value })}
                    placeholder="e.g. ORD"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Name</label>
                  <input
                    value={typeForm.name} onChange={e => setTypeForm({ ...typeForm, name: e.target.value })}
                    placeholder="Ordinary Shares"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Face Value</label>
                  <input
                    type="number" value={typeForm.faceValue}
                    onChange={e => setTypeForm({ ...typeForm, faceValue: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Min Shares</label>
                  <input
                    type="number" min={1} value={typeForm.minShares}
                    onChange={e => setTypeForm({ ...typeForm, minShares: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 block mb-1">Max Shares</label>
                  <input
                    type="number" value={typeForm.maxShares} placeholder="∞"
                    onChange={e => setTypeForm({ ...typeForm, maxShares: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Dividend Rate (%)</label>
                <input
                  type="number" step="0.01" value={typeForm.dividendRate}
                  onChange={e => setTypeForm({ ...typeForm, dividendRate: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 block mb-1">Description (optional)</label>
                <input
                  value={typeForm.description} onChange={e => setTypeForm({ ...typeForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>
              <label className="flex items-center gap-2 text-slate-600">
                <input
                  type="checkbox" checked={typeForm.isTransferable}
                  onChange={e => setTypeForm({ ...typeForm, isTransferable: e.target.checked })}
                  className="rounded border-slate-300"
                />
                Transferable between members
              </label>
              <button
                type="submit" disabled={submitting}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {submitting ? 'Creating...' : 'Create Share Class'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          SHARE ACCOUNT DETAIL MODAL (three-panel subsidiary ledger)
      ============================================================ */}
      {accountDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAccountDetail(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-5 text-xs space-y-4 max-h-[87vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Share Account — {accountDetail.account.memberName}</h3>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                  {accountDetail.account.accountNo} · {accountDetail.account.memberNo} · {accountDetail.account.membershipType}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {ledgerTab === 'register' && (
                  <button
                    onClick={() => printCertificateRegister(accountDetail)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[11px] font-semibold transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print Register
                  </button>
                )}
                <button onClick={() => setAccountDetail(null)} className="text-slate-500 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <span className="text-[10px] font-semibold text-slate-500 block">Total Shares</span>
                <div className="text-lg font-black text-purple-600 font-mono">{accountDetail.account.totalShares}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <span className="text-[10px] font-semibold text-slate-500 block">Total Capital</span>
                <div className="text-lg font-black text-slate-900 font-mono">{formatNPR(accountDetail.account.totalCapital)}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <span className="text-[10px] font-semibold text-slate-500 block">Est. Dividend</span>
                <div className="text-lg font-black text-emerald-600 font-mono">{formatNPR(accountDetail.account.totalCapital * accountDetail.account.dividendRate / 100)}</div>
              </div>
            </div>

            {/* Three-panel tabs */}
            <div className="flex gap-2 border-b border-slate-200 pb-1">
              {([
                { key: 'issuances', label: `Issuance (${accountDetail.panels.issuances.length})` },
                { key: 'returns', label: `Returns & Transfers (${accountDetail.panels.returnsAndTransfers.length})` },
                { key: 'register', label: `Certificate Register (${accountDetail.panels.certificateRegister.length})` },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setLedgerTab(tab.key)}
                  className={`px-3 py-1.5 rounded-t-lg text-[11px] font-bold transition cursor-pointer ${
                    ledgerTab === tab.key
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-500 hover:text-purple-700 hover:bg-purple-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* PANEL 1 — Issuance ledger */}
            {ledgerTab === 'issuances' && (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
                    <tr>
                      <th className="p-3">Date (BS)</th>
                      <th className="p-3">Voucher</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Kitta Range</th>
                      <th className="p-3 text-right">Qty</th>
                      <th className="p-3 text-right">Amount (रु.)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {accountDetail.panels.issuances.map(h => (
                      <tr key={h.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono">{h.transactionDateBs}</td>
                        <td className="p-3 font-mono text-purple-700">{h.voucherNo}</td>
                        <td className="p-3">{h.transactionType}{h.shareTypeName ? <div className="text-[10px] text-slate-400 font-normal">{h.shareTypeName}</div> : null}</td>
                        <td className="p-3 font-mono">
                          {h.startKittaNo != null && h.endKittaNo != null
                            ? (h.startKittaNo === h.endKittaNo ? `${h.kittaPrefix}${h.startKittaNo}` : `${h.kittaPrefix}${h.startKittaNo}–${h.kittaPrefix}${h.endKittaNo}`)
                            : '—'}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-purple-600">+{h.shareQuantity}</td>
                        <td className="p-3 text-right font-mono text-slate-800">{formatNPR(h.creditAmount || h.debitAmount)}</td>
                      </tr>
                    ))}
                    {accountDetail.panels.issuances.length === 0 && (
                      <tr><td colSpan={6} className="p-6 text-center text-slate-500">No issues recorded.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* PANEL 2 — Returns & Transfers */}
            {ledgerTab === 'returns' && (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
                    <tr>
                      <th className="p-3">Date (BS)</th>
                      <th className="p-3">Voucher</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Kitta Range</th>
                      <th className="p-3 text-right">Qty</th>
                      <th className="p-3 text-right">Amount (रु.)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {accountDetail.panels.returnsAndTransfers.map(h => (
                      <tr key={h.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono">{h.transactionDateBs}</td>
                        <td className="p-3 font-mono text-purple-700">{h.voucherNo}</td>
                        <td className="p-3">{h.transactionType}{h.shareTypeName ? <div className="text-[10px] text-slate-400 font-normal">{h.shareTypeName}</div> : null}</td>
                        <td className="p-3 font-mono">
                          {h.startKittaNo != null && h.endKittaNo != null
                            ? (h.startKittaNo === h.endKittaNo ? `${h.kittaPrefix}${h.startKittaNo}` : `${h.kittaPrefix}${h.startKittaNo}–${h.kittaPrefix}${h.endKittaNo}`)
                            : '—'}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-rose-600">{h.shareQuantity > 0 ? `+${h.shareQuantity}` : h.shareQuantity}</td>
                        <td className="p-3 text-right font-mono text-slate-800">{formatNPR(h.creditAmount || h.debitAmount)}</td>
                      </tr>
                    ))}
                    {accountDetail.panels.returnsAndTransfers.length === 0 && (
                      <tr><td colSpan={6} className="p-6 text-center text-slate-500">No returns or transfers recorded.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* PANEL 3 — Certificate register (contiguous kitta ranges held) */}
            {ledgerTab === 'register' && (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Class</th>
                      <th className="p-3">Share Type</th>
                      <th className="p-3">Kitta Range Held</th>
                      <th className="p-3 text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {accountDetail.panels.certificateRegister.map((e, i) => (
                      <tr key={`${e.shareTypeId}-${i}`} className="hover:bg-slate-50">
                        <td className="p-3 text-slate-400">{i + 1}</td>
                        <td className="p-3 font-mono text-purple-700">{e.shareTypeCode ?? 'Legacy'}</td>
                        <td className="p-3">{e.shareTypeName ?? '—'}</td>
                        <td className="p-3 font-mono font-semibold text-emerald-700">{e.formattedRange}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">{e.quantity}</td>
                      </tr>
                    ))}
                    {accountDetail.panels.certificateRegister.length === 0 && (
                      <tr><td colSpan={5} className="p-6 text-center text-slate-500">No kitta currently held.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-white/60 /60 backdrop-blur-sm pointer-events-none">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading share data...
          </div>
        </div>
      )}

      {/* Transfer print dialog (voucher + certificate) */}
      <ShareTransferPrintModal transfer={transferForPrint} onClose={() => setTransferForPrint(null)} />

      {/* Issue / Return voucher print dialog */}
      <ShareIssueReturnVoucherModal result={issueReturnForPrint} onClose={() => setIssueReturnForPrint(null)} />

      {/* Share certificate preview modal */}
      <ShareCertificateModal
        member={previewMember}
        certificate={previewCertificate}
        onClose={() => { setPreviewMember(null); setPreviewCertificate(null); }}
      />
    </div>
  );
};
