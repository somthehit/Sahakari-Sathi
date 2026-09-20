import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  X,
  Search,
  RefreshCw,
  ChevronDown,
  FileText,
  RotateCcw,
  ShieldCheck,
  Home,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Clock,
  Truck,
  Building2,
  FileSignature,
  Lock,
  Info,
  LayoutDashboard,
  Table2,
  Ban,
  AlertOctagon,
  Palette,
  Printer,
} from 'lucide-react';
import { formatNPR } from '../../utils/nepaliCalendar';
import { DateConverter } from '../../utils/DateConverter';
import { chequeQueryKeys, invalidateChequeRegister } from '../../lib/queryClient';
import {
  listChequeBooks,
  listChequeLeaves,
  listChequeDeposits,
  issueChequeBook,
  clearChequeDeposit,
  bounceChequeDeposit,
  listPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  lookupAccount,
  ChequeBook,
  ChequeDeposit,
  PendingWithdrawal,
  AccountLookup,
} from '../../api/savingsDeposits';
import { ReasonPromptModal } from '../modals/ReasonPromptModal';
import { ChequeBookPrintModal } from '../modals/ChequeBookPrintModal';
import { ChequeOverviewTab } from '../cheque/ChequeOverviewTab';
import { ChequeRegisterTab } from '../cheque/ChequeRegisterTab';
import { ChequeStopPaymentsTab } from '../cheque/ChequeStopPaymentsTab';
import { ChequeBouncesTab } from '../cheque/ChequeBouncesTab';
import { ChequeDesignsTab } from '../cheque/ChequeDesignsTab';

type Tab = 'overview' | 'register' | 'books' | 'clearance' | 'stop_payments' | 'bounces' | 'approvals' | 'design';

function leafClasses(status: string): string {
  switch (status) {
    case 'used': return 'border-violet-200 bg-violet-50 text-violet-700';
    case 'presented': return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'cleared': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'stopped':
    case 'cancelled': return 'border-red-200 bg-red-50 text-red-700';
    case 'bounced': return 'border-rose-200 bg-rose-50 text-rose-700';
    default: return 'border-slate-200 bg-white text-slate-500';
  }
}

function StatusPill({ status }: { status: string }) {
  const active = status === 'active';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
      {status}
    </span>
  );
}

function LeafGrid({ leaves }: { leaves: { id: string; chequeNumber: string; status: string }[] }) {
  if (leaves.length === 0) {
    return <div className="px-5 py-4 text-[12.5px] text-slate-400">No leaves found.</div>;
  }
  return (
    <div className="grid grid-cols-4 gap-2.5 border-t border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-6 lg:grid-cols-8">
      {leaves.map((l) => (
        <div
          key={l.id}
          className={`rounded-md border px-2 py-2 text-center text-[11.5px] font-medium ${leafClasses(l.status)}`}
        >
          <div className="font-mono text-[11px]">{l.chequeNumber}</div>
          <div className="mt-0.5 text-[10.5px] uppercase tracking-wide opacity-80">{l.status}</div>
        </div>
      ))}
    </div>
  );
}

interface IssueChequeBookModalProps {
  open: boolean;
  onClose: () => void;
  onIssued: () => void;
}

// Bank reissue policy gates.
const MIN_UTILIZATION = 80; // last active book must be this % used up before reissue
const COOLDOWN_DAYS = 30;   // minimum gap (days) since the previous issuance

type KYCLevel = 'verified' | 'pending' | 'expired';
type AccountTone = 'active' | 'dormant' | 'frozen';

interface EligibilityData {
  account: AccountLookup;
  accountStatus: AccountTone;
  kyc: KYCLevel;
  blacklisted: boolean;
  history: { id: string; issued: string; leaves: number; used: number; status: string }[];
  daysSinceLastIssue: number | null;
}

const kycStyle: Record<KYCLevel, string> = {
  verified: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  expired: 'bg-rose-50 text-rose-700 ring-rose-200',
};
const acctStyle: Record<AccountTone, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  dormant: 'bg-amber-50 text-amber-700 ring-amber-200',
  frozen: 'bg-rose-50 text-rose-700 ring-rose-200',
};

function utilizationOf(book: { used: number; leaves: number }): number {
  return book.leaves > 0 ? Math.round((book.used / book.leaves) * 100) : 0;
}

function normalizeKyc(kycStatus?: string): KYCLevel {
  if (!kycStatus) return 'pending';
  const s = kycStatus.toLowerCase();
  if (s === 'verified') return 'verified';
  if (s === 'expired' || s === 'rejected') return 'expired';
  return 'pending';
}

function normalizeAccountStatus(status: string): AccountTone {
  const s = (status || '').toLowerCase();
  if (s === 'active') return 'active';
  if (s === 'dormant') return 'dormant';
  return 'frozen'; // Closed / Matured / anything unexpected is not issuable
}

function evaluateEligibility(data: EligibilityData) {
  const reasons: string[] = [];
  if (data.accountStatus !== 'active') reasons.push(`Account is ${data.accountStatus}, not active.`);
  if (data.kyc !== 'verified') reasons.push(`KYC is ${data.kyc} — must be verified.`);
  if (data.blacklisted) reasons.push('Account flagged for cheque-return / blacklist.');
  const lastActive = data.history.find(h => h.status === 'active');
  if (lastActive) {
    const util = utilizationOf(lastActive);
    if (util < MIN_UTILIZATION) {
      reasons.push(`Previous book ${lastActive.id} is only ${util}% used — minimum ${MIN_UTILIZATION}% required before reissue.`);
    }
  }
  if (data.daysSinceLastIssue !== null && data.daysSinceLastIssue < COOLDOWN_DAYS) {
    reasons.push(`Only ${data.daysSinceLastIssue} days since last issuance — ${COOLDOWN_DAYS} day cooling period applies.`);
  }
  return { eligible: reasons.length === 0, reasons };
}

function UtilBar({ pct }: { pct: number }) {
  const tone = pct >= MIN_UTILIZATION ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function IssueChequeBookModal({ open, onClose, onIssued }: IssueChequeBookModalProps) {
  const [stage, setStage] = useState<'search' | 'review' | 'form'>('search');
  const [query, setQuery] = useState('');
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<EligibilityData | null>(null);
  const [error, setError] = useState('');

  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [confirmSignatory, setConfirmSignatory] = useState(false);
  const [delivery, setDelivery] = useState<'branch' | 'courier'>('branch');
  const [leavesPerBook, setLeavesPerBook] = useState('25');
  const [purpose, setPurpose] = useState('Regular reissue');
  const [issuing, setIssuing] = useState(false);

  const eligibility = useMemo(() => (data ? evaluateEligibility(data) : null), [data]);

  const canSubmit =
    stage === 'form' &&
    confirmSignatory &&
    (eligibility?.eligible || (overrideOpen && overrideReason.trim().length > 4));

  if (!open) return null;

  const handleFind = async () => {
    if (!query.trim()) return;
    setChecking(true);
    setError('');
    try {
      const rows = await lookupAccount(query.trim());
      if (rows.length === 0) { setError('No matching account found.'); return; }
      const account = rows[0];
      setStage('review');
      setLoading(true);
      setData(null);
      const { data: books } = await listChequeBooks({ accountId: account.id });
      const history = await Promise.all(books.map(async (b) => {
        const leaves = await listChequeLeaves({ bookId: b.id });
        return {
          id: b.bookNumber,
          issued: b.issuedDateBs,
          leaves: b.leafCount || leaves.length,
          used: leaves.filter(l => l.status !== 'unused').length,
          status: b.status,
        };
      }));
      history.sort((a, b) => a.issued.localeCompare(b.issued));
      const last = history[history.length - 1];
      let daysSinceLastIssue: number | null = null;
      if (last) {
        const lastBook = books.find(b => b.bookNumber === last.id);
        const adMs = lastBook?.issuedDateAd
          ? new Date(lastBook.issuedDateAd).getTime()
          : (() => { const ad = DateConverter.bsToAd(last.issued); return ad ? new Date(ad).getTime() : null; })();
        if (adMs) daysSinceLastIssue = Math.max(0, Math.floor((Date.now() - adMs) / 86400000));
      }
      setData({
        account,
        accountStatus: normalizeAccountStatus(account.status),
        kyc: normalizeKyc(account.kycStatus),
        blacklisted: account.memberStatus === 'Blacklisted',
        history,
        daysSinceLastIssue,
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Account lookup failed.');
      setStage('search');
    } finally {
      setChecking(false);
      setLoading(false);
    }
  };

  const handleIssue = async () => {
    if (!data) return;
    setIssuing(true);
    setError('');
    try {
      const count = Number(leavesPerBook) || 1;
      await issueChequeBook({
        accountId: data.account.id,
        leafCount: count,
        purpose: purpose.trim() || undefined,
        deliveryMethod: delivery,
        overrideReason: overrideOpen ? overrideReason.trim() || undefined : undefined,
      });
      onIssued();
      reset();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to issue cheque book.');
    } finally {
      setIssuing(false);
    }
  };

  const reset = () => {
    setStage('search');
    setQuery('');
    setData(null);
    setError('');
    setOverrideOpen(false);
    setOverrideReason('');
    setConfirmSignatory(false);
    setDelivery('branch');
    setLeavesPerBook('25');
    setPurpose('Regular reissue');
  };

  const close = () => {
    onClose();
    reset();
  };

  const steps = [
    { key: 'search', label: 'Find member' },
    { key: 'review', label: 'Eligibility check' },
    { key: 'form', label: 'Issue details' },
  ] as const;
  const stageIndex = steps.findIndex(s => s.key === stage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-[2px]" style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>
      <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Plus size={18} strokeWidth={2.5} />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">Issue new cheque book</h2>
              <p className="mt-0.5 text-[13px] leading-snug text-slate-500">
                Allocates a book and its leaves atomically with concurrency locking
              </p>
            </div>
          </div>
          <button onClick={close} className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {/* Step rail */}
        <div className="flex items-center gap-1.5 border-b border-slate-100 px-6 py-3 text-[11.5px] font-medium">
          {steps.map((s, i) => (
            <React.Fragment key={s.key}>
              <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${i === stageIndex ? 'bg-emerald-600 text-white' : i < stageIndex ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                {i + 1}. {s.label}
              </span>
              {i < steps.length - 1 && <div className="h-px flex-1 bg-slate-100" />}
            </React.Fragment>
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* STAGE 1 — search */}
          {stage === 'search' && (
            <>
              <label className="mb-1.5 block text-[12px] font-medium text-slate-600">Account number or member</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFind()}
                    placeholder="e.g. SAV-D3C-0004 or member name"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-[13px] text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <button
                  onClick={handleFind}
                  disabled={checking}
                  className="shrink-0 rounded-lg bg-slate-800 px-4 text-[13px] font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
                >
                  {checking ? 'Checking…' : 'Find'}
                </button>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[12px] text-slate-400">
                <Info size={13} />
                We'll automatically pull KYC status, account state, and prior cheque book history before allowing issuance.
              </p>
              {error && (
                <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3.5 py-2 text-[12.5px] text-red-700">{error}</p>
              )}
            </>
          )}

          {/* STAGE 2 — eligibility review */}
          {stage === 'review' && (
            loading ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <p className="mt-2 text-[12.5px]">Checking KYC, account state and cheque history…</p>
              </div>
            ) : data && (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800">{data.account.memberName}</p>
                    <p className="font-mono text-[12px] text-slate-500">{data.account.accountNumber} · {data.account.memberNo || '—'}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${acctStyle[data.accountStatus]}`}>{data.accountStatus}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${kycStyle[data.kyc]}`}>KYC {data.kyc}</span>
                  </div>
                </div>

                {/* Eligibility verdict */}
                <div className={`rounded-lg border px-4 py-3 ${eligibility!.eligible ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/70'}`}>
                  <div className="flex items-center gap-2">
                    {eligibility!.eligible
                      ? <CheckCircle2 size={16} className="text-emerald-600" />
                      : <AlertTriangle size={16} className="text-amber-600" />}
                    <p className={`text-[13px] font-semibold ${eligibility!.eligible ? 'text-emerald-800' : 'text-amber-800'}`}>
                      {eligibility!.eligible ? 'Eligible for reissue' : 'Not eligible — policy checks failed'}
                    </p>
                  </div>
                  {!eligibility!.eligible && (
                    <ul className="mt-2 space-y-1 pl-6 text-[12.5px] text-amber-800">
                      {eligibility!.reasons.map((r, i) => (
                        <li key={i} className="list-disc">{r}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Previous cheque book history */}
                <div>
                  <p className="mb-2 text-[12px] font-medium text-slate-600">Cheque book history</p>
                  <div className="overflow-hidden rounded-lg border border-slate-100">
                    {data.history.length === 0 ? (
                      <div className="px-3.5 py-3 text-[12.5px] text-slate-400">No prior cheque books on this account.</div>
                    ) : data.history.map((h, idx) => {
                      const pct = utilizationOf(h);
                      return (
                        <div key={h.id} className={`flex items-center gap-3 px-3.5 py-2.5 text-[12.5px] ${idx !== 0 ? 'border-t border-slate-100' : ''}`}>
                          <span className="w-20 shrink-0 font-mono font-semibold text-slate-700">{h.id}</span>
                          <span className="w-24 shrink-0 text-slate-400">{h.issued}</span>
                          <div className="flex-1"><UtilBar pct={pct} /></div>
                          <span className="w-24 shrink-0 text-right text-slate-500">{h.used}/{h.leaves} used</span>
                          <span className={`w-14 shrink-0 text-right text-[11px] font-medium ${h.status === 'active' ? 'text-emerald-600' : 'text-slate-400'}`}>{h.status}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Override path if not eligible */}
                {!eligibility!.eligible && (
                  <div className="rounded-lg border border-dashed border-slate-200 p-3.5">
                    {!overrideOpen ? (
                      <button onClick={() => setOverrideOpen(true)} className="flex items-center gap-1.5 text-[12.5px] font-medium text-slate-500 transition hover:text-slate-700">
                        <Lock size={13} />
                        Request supervisor override
                      </button>
                    ) : (
                      <div>
                        <label className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-slate-600">
                          <ShieldCheck size={13} className="text-slate-500" />
                          Override justification (logged in audit trail)
                        </label>
                        <textarea
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          rows={2}
                          placeholder="e.g. Member reports lost book, all leaves accounted for by branch manager"
                          className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12.5px] outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between pt-1">
                  <button onClick={() => setStage('search')} className="text-[12.5px] font-medium text-slate-400 hover:text-slate-600">← Back</button>
                  <button
                    onClick={() => setStage('form')}
                    disabled={!eligibility!.eligible && !(overrideOpen && overrideReason.trim().length > 4)}
                    className="rounded-lg bg-slate-800 px-4 py-2 text-[13px] font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    Continue to issue details
                  </button>
                </div>
              </div>
            )
          )}

          {/* STAGE 3 — issue details / form */}
          {stage === 'form' && data && (
            <div className="space-y-4">
              {!eligibility!.eligible && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-2 text-[12px] font-medium text-amber-800">
                  <ShieldCheck size={14} />
                  Issuing under supervisor override — reason recorded.
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-slate-600">Leaves per book</label>
                <input
                  type="number"
                  min={1}
                  value={leavesPerBook}
                  onChange={(e) => setLeavesPerBook(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13px] text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-slate-600">Purpose</label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13px] text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                >
                  <option>Regular reissue</option>
                  <option>Lost / stolen book</option>
                  <option>Damaged book</option>
                  <option>New account</option>
                  <option>Additional book requested</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-slate-600">Delivery method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDelivery('branch')}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[12.5px] font-medium transition ${delivery === 'branch' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                  >
                    <Building2 size={15} /> Branch pickup
                  </button>
                  <button
                    type="button"
                    onClick={() => setDelivery('courier')}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[12.5px] font-medium transition ${delivery === 'courier' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                  >
                    <Truck size={15} /> Courier to address
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-3 text-[12.5px] text-slate-600">
                <input
                  type="checkbox"
                  checked={confirmSignatory}
                  onChange={(e) => setConfirmSignatory(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400"
                />
                <span className="flex items-start gap-1.5">
                  <FileSignature size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  I've verified the requester's signature / identity matches the specimen on file.
                </span>
              </label>

              <div className="flex items-center gap-1.5 text-[11.5px] text-slate-400">
                <Clock size={13} />
                This action will be timestamped and recorded in the audit log under your teller ID.
              </div>

              {error && (
                <p className="rounded-lg border border-red-100 bg-red-50 px-3.5 py-2 text-[12.5px] text-red-700">{error}</p>
              )}

              <div className="pt-1">
                <button onClick={() => setStage('review')} className="text-[12.5px] font-medium text-slate-400 hover:text-slate-600">← Back</button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-100 bg-white px-6 py-4">
          <button onClick={close} className="rounded-lg px-4 py-2 text-[13px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
            Cancel
          </button>
          <button
            onClick={handleIssue}
            disabled={!canSubmit || issuing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-medium text-white shadow-sm shadow-emerald-600/20 transition enabled:hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            {issuing && <Loader2 size={14} className="animate-spin" />}
            {issuing ? 'Issuing…' : 'Issue cheque book'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const ChequeBookManageView: React.FC = () => {
  const [tab, setTab] = useState<Tab>('overview');

  // Books tab — backed by the canonical `cheque-book-register` query key so a
  // leaf consumed elsewhere (teller withdrawal, deposit, transfer) refreshes
  // this list automatically via invalidation.
  const [bookQuery, setBookQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [printBook, setPrintBook] = useState<ChequeBook | null>(null);
  const [notice, setNotice] = useState('');

  const booksQuery = useQuery({
    queryKey: [...chequeQueryKeys.books(), bookQuery],
    queryFn: () => listChequeBooks({ search: bookQuery || undefined }).then(r => r.data),
  });
  const books = booksQuery.data ?? [];

  const leavesQuery = useQuery({
    queryKey: [...chequeQueryKeys.leaves(), expanded ?? 'none'],
    enabled: !!expanded,
    queryFn: () => listChequeLeaves({ bookId: expanded! }),
  });
  const leaves = leavesQuery.data ?? [];

  // Clearance tab
  const [chequeDeposits, setChequeDeposits] = useState<ChequeDeposit[]>([]);
  const [clearanceStatus, setClearanceStatus] = useState('Pending');
  const [clearanceLoading, setClearanceLoading] = useState(false);

  // Approvals tab
  const [withdrawals, setWithdrawals] = useState<PendingWithdrawal[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  // Reason-capture modals (replace the old blocking window.prompt calls).
  const [bounceTarget, setBounceTarget] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const loadClearance = useCallback(async () => {
    setClearanceLoading(true);
    try {
      const { data } = await listChequeDeposits({ status: clearanceStatus });
      setChequeDeposits(data);
    } catch {
      setChequeDeposits([]);
    } finally {
      setClearanceLoading(false);
    }
  }, [clearanceStatus]);

  const loadApprovals = useCallback(async () => {
    setApprovalsLoading(true);
    try {
      const { data } = await listPendingWithdrawals();
      setWithdrawals(data);
    } catch {
      setWithdrawals([]);
    } finally {
      setApprovalsLoading(false);
    }
  }, []);

  useEffect(() => { if (tab === 'clearance') loadClearance(); }, [tab, loadClearance]);
  useEffect(() => { if (tab === 'approvals') loadApprovals(); }, [tab, loadApprovals]);

  const handleIssued = async () => {
    await invalidateChequeRegister();
    setNotice('Cheque book issued successfully.');
    window.setTimeout(() => setNotice(''), 4000);
  };

  async function handleClear(id: string) {
    setActionMsg('');
    try {
      await clearChequeDeposit(id);
      await invalidateChequeRegister();
      loadClearance();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.error || err?.message || 'Clear failed.');
    }
  }

  async function confirmBounce(reason: string) {
    if (!bounceTarget) return;
    setActionMsg('');
    setActionBusy(true);
    try {
      await bounceChequeDeposit(bounceTarget, reason || undefined);
      await invalidateChequeRegister();
      setBounceTarget(null);
      loadClearance();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.error || err?.message || 'Bounce failed.');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleApprove(id: string) {
    setActionMsg('');
    try {
      await approveWithdrawal(id);
      await invalidateChequeRegister();
      loadApprovals();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.error || err?.message || 'Approval failed.');
    }
  }

  async function confirmReject(remarks: string) {
    if (!rejectTarget) return;
    setActionMsg('');
    setActionBusy(true);
    try {
      await rejectWithdrawal(rejectTarget, remarks || undefined);
      await invalidateChequeRegister();
      setRejectTarget(null);
      loadApprovals();
    } catch (err: any) {
      setActionMsg(err?.response?.data?.error || err?.message || 'Rejection failed.');
    } finally {
      setActionBusy(false);
    }
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <LayoutDashboard size={15} /> },
    { key: 'register', label: 'Register', icon: <Table2 size={15} /> },
    { key: 'books', label: 'Cheque Books', icon: <FileText size={15} /> },
    { key: 'clearance', label: 'Clearance', icon: <RotateCcw size={15} /> },
    { key: 'stop_payments', label: 'Stop Payments', icon: <Ban size={15} /> },
    { key: 'bounces', label: 'Bounces', icon: <AlertOctagon size={15} /> },
    { key: 'approvals', label: 'Approvals', icon: <ShieldCheck size={15} /> },
    { key: 'design', label: 'Design', icon: <Palette size={15} /> },
  ];

  return (
    <div className="w-full bg-slate-50 font-sans text-slate-800" style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>
      <style>{`@keyframes modalIn { from { opacity:0; transform: translateY(6px) scale(.98);} to {opacity:1; transform:none;} }`}</style>

      {/* Top bar */}
      <div className="border-b border-slate-200 bg-white px-6 py-3.5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-1.5 text-[13px] text-slate-500">
            <Home size={14} />
            <span>Dashboard</span>
            <ChevronRight size={13} className="text-slate-300" />
            <span className="font-medium text-slate-800">Cheque Book Management</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Sahakari Sathi
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Cheque Management</h1>
            <p className="mt-1 text-[13.5px] text-slate-500">
              One workspace for cheque books, the unified register, clearance, stop payments, bounces, approvals, and leaf design
            </p>
          </div>
        </div>

        {notice && (
          <div className="mb-4 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-[12.5px] font-medium text-emerald-700">
            {notice}
          </div>
        )}

        {/* Segmented tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] transition cursor-pointer ${tab === t.key
                ? 'bg-emerald-600 font-semibold text-white shadow-sm shadow-emerald-600/20'
                : 'border border-slate-200 bg-white font-medium text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && (
          <ChequeOverviewTab onOpenRegister={() => setTab('register')} />
        )}

        {/* ── REGISTER TAB ── */}
        {tab === 'register' && <ChequeRegisterTab />}

        {/* ── BOOKS TAB ── */}
        {tab === 'books' && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-[15px] font-semibold text-slate-900">Issued cheque books</h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    placeholder="Search book / account / member"
                    value={bookQuery}
                    onChange={e => setBookQuery(e.target.value)}
                    className="w-64 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-[12.5px] outline-none transition focus:border-emerald-400 focus:bg-white"
                  />
                </div>
                <button
                  onClick={() => booksQuery.refetch()}
                  className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
                  title="Refresh"
                >
                  <RefreshCw size={14} className={booksQuery.isFetching ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={() => setModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700"
                >
                  <Plus size={15} strokeWidth={2.5} />
                  Issue New Cheque Book
                </button>
              </div>
            </div>

            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[11.5px] uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2.5 font-medium">Book No</th>
                  <th className="px-5 py-2.5 font-medium">Account</th>
                  <th className="px-5 py-2.5 font-medium">Member</th>
                  <th className="px-5 py-2.5 font-medium">Leaves</th>
                  <th className="px-5 py-2.5 font-medium">Range</th>
                  <th className="px-5 py-2.5 font-medium">Issued</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {books.map(b => (
                  <React.Fragment key={b.id}>
                    <tr className="border-t border-slate-100 transition hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-mono text-[12.5px] font-semibold text-emerald-700">{b.bookNumber}</td>
                      <td className="px-5 py-3 font-mono text-slate-600">{b.accountNo}</td>
                      <td className="px-5 py-3 text-slate-700">{b.memberName || '—'}</td>
                      <td className="px-5 py-3 text-slate-600">{b.leafCount}</td>
                      <td className="px-5 py-3 font-mono text-slate-500">{b.leafStartNumber}–{b.leafEndNumber}</td>
                      <td className="px-5 py-3 text-slate-500">{b.issuedDateBs}</td>
                      <td className="px-5 py-3"><StatusPill status={b.status} /></td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => setPrintBook(b)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                            title="Print cheque book for member"
                          >
                            <Printer size={13} />
                            Print
                          </button>
                          <button
                            onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-slate-500 transition hover:text-emerald-700"
                          >
                            Leaves
                            <ChevronDown size={14} className={`transition-transform ${expanded === b.id ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded === b.id && (
                      <tr>
                        <td colSpan={8} className="p-0">
                          <div className="flex items-center justify-between px-5 pt-3 text-[12.5px] font-semibold text-slate-500">
                            {b.bookNumber} — leaves
                          </div>
                          <LeafGrid leaves={leaves} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {books.length === 0 && !booksQuery.isFetching && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-slate-400">No cheque books issued yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── CLEARANCE TAB ── */}
        {tab === 'clearance' && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-[15px] font-semibold text-slate-900">Cheque deposits awaiting clearance</h2>
              <select className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12.5px] text-slate-700 outline-none focus:border-emerald-400" value={clearanceStatus} onChange={e => setClearanceStatus(e.target.value)}>
                <option value="Pending">Pending</option>
                <option value="Cleared">Cleared</option>
                <option value="Bounced">Bounced</option>
              </select>
            </div>
            {actionMsg && (
              <div className="border-b border-slate-100 px-5 py-2.5 text-[12.5px] text-slate-600">{actionMsg}</div>
            )}
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[11.5px] uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2.5 font-medium">Account</th>
                  <th className="px-5 py-2.5 font-medium">Member</th>
                  <th className="px-5 py-2.5 font-medium">Cheque No</th>
                  <th className="px-5 py-2.5 font-medium">Bank</th>
                  <th className="px-5 py-2.5 font-medium">Amount</th>
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {chequeDeposits.map(c => (
                  <tr key={c.id} className="border-t border-slate-100 transition hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono text-slate-600">{c.accountNo}</td>
                    <td className="px-5 py-3 text-slate-700">{c.memberName}</td>
                    <td className="px-5 py-3 font-mono text-[12.5px] font-semibold text-emerald-700">{c.chequeNumber}</td>
                    <td className="px-5 py-3 text-slate-600">{c.chequeBank || '—'}</td>
                    <td className="px-5 py-3 font-mono font-semibold text-slate-800">{formatNPR(c.amount)}</td>
                    <td className="px-5 py-3 text-slate-500">{c.dateBs}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${c.status === 'Pending' ? 'bg-amber-50 text-amber-700 ring-amber-200' : c.status === 'Cleared' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}`}>{c.status}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {c.status === 'Pending' && (
                        <div className="inline-flex gap-1.5">
                          <button onClick={() => handleClear(c.id)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[12px] font-medium text-white transition hover:bg-emerald-700">
                            <CheckCircle2 size={13} /> Clear
                          </button>
                          <button onClick={() => setBounceTarget(c.id)} className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-[12px] font-medium text-white transition hover:bg-rose-700">
                            <XCircle size={13} /> Bounce
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {chequeDeposits.length === 0 && !clearanceLoading && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-slate-400">No cheque deposits in this status.</td>
                  </tr>
                )}
              </tbody>
            </table>
            {clearanceLoading && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>}
          </div>
        )}

        {/* ── APPROVALS TAB ── */}
        {tab === 'approvals' && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-[15px] font-semibold text-slate-900">Queued withdrawals (dual approval)</h2>
              <button onClick={loadApprovals} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] text-slate-500 transition hover:bg-slate-50">
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
            {actionMsg && (
              <div className="border-b border-slate-100 px-5 py-2.5 text-[12.5px] text-slate-600">{actionMsg}</div>
            )}
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[11.5px] uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2.5 font-medium">Voucher</th>
                  <th className="px-5 py-2.5 font-medium">Account</th>
                  <th className="px-5 py-2.5 font-medium">Member</th>
                  <th className="px-5 py-2.5 font-medium">Amount</th>
                  <th className="px-5 py-2.5 font-medium">Instrument</th>
                  <th className="px-5 py-2.5 font-medium">Payout</th>
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map(w => (
                  <tr key={w.id} className="border-t border-slate-100 transition hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono text-[12.5px] text-slate-600">{w.voucherNo}</td>
                    <td className="px-5 py-3 font-mono text-slate-600">{w.accountNo}</td>
                    <td className="px-5 py-3 text-slate-700">{w.memberName}</td>
                    <td className="px-5 py-3 font-mono font-semibold text-rose-700">{formatNPR(w.amount)}</td>
                    <td className="px-5 py-3 text-slate-600">{w.instrumentType}</td>
                    <td className="px-5 py-3 text-slate-600">{w.payoutMode}</td>
                    <td className="px-5 py-3 text-slate-500">{w.dateBs}</td>
                    <td className="px-5 py-3 text-right">
                      {w.status === 'Pending' ? (
                        <div className="inline-flex gap-1.5">
                          <button onClick={() => handleApprove(w.id)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[12px] font-medium text-white transition hover:bg-emerald-700">
                            <CheckCircle2 size={13} /> Approve
                          </button>
                          <button onClick={() => setRejectTarget(w.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-600 transition hover:bg-slate-50">
                            <XCircle size={13} /> Reject
                          </button>
                        </div>
                      ) : (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${w.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}`}>{w.status}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {withdrawals.length === 0 && !approvalsLoading && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-slate-400">
                      <span className="inline-flex items-center gap-2"><AlertTriangle size={15} /> No queued withdrawals.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {approvalsLoading && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>}
          </div>
        )}

        {/* ── STOP PAYMENTS TAB ── */}
        {tab === 'stop_payments' && <ChequeStopPaymentsTab />}

        {/* ── BOUNCES TAB ── */}
        {tab === 'bounces' && <ChequeBouncesTab />}

        {/* ── DESIGN TAB ── */}
        {tab === 'design' && <ChequeDesignsTab />}

        {/* Floating action button */}
        {tab === 'books' && (
          <button
            onClick={() => setModalOpen(true)}
            className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 transition hover:scale-105 hover:bg-emerald-700"
            aria-label="Issue new cheque book"
          >
            <Plus size={24} />
          </button>
        )}
      </div>

      <IssueChequeBookModal open={modalOpen} onClose={() => setModalOpen(false)} onIssued={handleIssued} />

      <ChequeBookPrintModal open={!!printBook} book={printBook} onClose={() => setPrintBook(null)} />

      {/* Bounce a pending cheque deposit — reason capture */}
      <ReasonPromptModal
        open={!!bounceTarget}
        title="Bounce cheque"
        description="Mark this cheque deposit as dishonoured. A bounce charge may be posted per your cheque settings."
        label="Bounce reason"
        placeholder="e.g. Insufficient funds / signature mismatch"
        confirmLabel="Bounce cheque"
        tone="danger"
        busy={actionBusy}
        onCancel={() => setBounceTarget(null)}
        onConfirm={confirmBounce}
      />

      {/* Reject a queued withdrawal — remarks capture */}
      <ReasonPromptModal
        open={!!rejectTarget}
        title="Reject withdrawal"
        description="This withdrawal will be returned to the teller queue as rejected."
        label="Rejection remarks"
        placeholder="e.g. Signature does not match specimen on file"
        required
        confirmLabel="Reject withdrawal"
        tone="danger"
        busy={actionBusy}
        onCancel={() => setRejectTarget(null)}
        onConfirm={confirmReject}
      />
    </div>
  );
};
