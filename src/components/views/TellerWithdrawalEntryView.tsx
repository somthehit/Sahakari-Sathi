import React, { useState } from 'react';
import {
  ArrowUpRight,
  Search,
  Wallet,
  FileText,
  PenLine,
  BookOpen,
  Banknote,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  Fingerprint,
  ScanLine,
} from 'lucide-react';
import { formatNPR } from '../../utils/nepaliCalendar';
import { ExpandableFormCard } from '../common/ExpandableFormCard';
import { SignaturePad } from '../common/SignaturePad';
import { invalidateChequeRegister } from '../../lib/queryClient';
import { resolveMediaUrl } from '../../api/storage';
import {
  lookupAccount,
  postWithdrawal,
  validateChequeLeaf,
  verifySignature,
  listSignatureSpecimens,
  reconcilePassbook,
  getPassbookSummary,
  type AccountLookup,
  type ChequeLeafStatus,
  type SignatureVerifyResult,
  type SignatureSpecimen,
  type PayoutMode,
  type WithdrawalInstrument,
  type PassbookReconcileResult,
  type PassbookSummary,
} from '../../api/savingsDeposits';

const MODE_LABEL: Record<WithdrawalInstrument, string> = {
  cheque: 'Cheque',
  slip: 'Withdrawal slip',
  passbook: 'Passbook',
};

/** Final signature disposition for submission. */
interface SignatureDisposition {
  logId: string;
  outcome: 'auto_approved' | 'teller_override' | 'supervisor_override';
  overrideReason?: string;
}

export const TellerWithdrawalEntryView: React.FC = () => {
  // Step 1 — mode first.
  const [mode, setMode] = useState<WithdrawalInstrument | null>(null);

  // Step 2 — account resolution (slip/passbook = manual search, cheque = leaf).
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<AccountLookup[]>([]);
  const [account, setAccount] = useState<AccountLookup | null>(null);
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeLeaf, setChequeLeaf] = useState<ChequeLeafStatus | null>(null);
  const [chequeChecking, setChequeChecking] = useState(false);

  // Specimens (per-account signatory signatures).
  const [specimens, setSpecimens] = useState<SignatureSpecimen[]>([]);
  const [fallbackSignature, setFallbackSignature] = useState<string | null>(null);
  const [selectedSpecimenId, setSelectedSpecimenId] = useState<string | null>(null);

  // Step 3 — shared verification panel.
  const [amount, setAmount] = useState('');
  const [payoutMode, setPayoutMode] = useState<PayoutMode>('cash');
  const [bsDate, setBsDate] = useState('');

  // Signature verification.
  const [presentedSignature, setPresentedSignature] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<SignatureVerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [manualVerified, setManualVerified] = useState(false);

  // Slip.
  const [slipNumber, setSlipNumber] = useState('');

  // Passbook.
  const [passbookSummary, setPassbookSummary] = useState<PassbookSummary | null>(null);
  const [bookSerial, setBookSerial] = useState('');
  const [bookLastLine, setBookLastLine] = useState('');
  const [reconcile, setReconcile] = useState<PassbookReconcileResult | null>(null);
  const [passbookPresented, setPassbookPresented] = useState(false);
  const [tamperAcknowledged, setTamperAcknowledged] = useState(false);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{ voucherNo: string; newBalance: number; needsApproval: boolean; signatureOutcome?: string | null; signatureScore?: number | null } | null>(null);

  const numericAmount = Number(amount) || 0;
  const withdrawable = account ? account.balance - account.minBalance : 0;
  const exceedsAvailable = account ? numericAmount > withdrawable : false;
  const activeOk = account && account.status === 'active';

  // ─────────────────────────────────────────────
  // Account resolution
  // ─────────────────────────────────────────────

  async function loadSpecimens(acc: AccountLookup) {
    if (!acc?.id) return;
    try {
      const data = await listSignatureSpecimens(acc.id);
      setSpecimens(data.specimens);
      setFallbackSignature(data.fallbackSignature);
      setSelectedSpecimenId(data.specimens[0]?.id ?? null);
    } catch {
      setSpecimens([]);
      setFallbackSignature(null);
    }
  }

  function selectAccount(acc: AccountLookup) {
    if (!acc?.id) return;
    setAccount(acc);
    setMatches([]);
    setError('');
    if (acc.status !== 'active') setError(`Account is ${acc.status}. Withdrawals are blocked.`);
    void loadSpecimens(acc);
    resetSignature();
    resetPassbook();
  }

  async function findAccount() {
    setError('');
    if (!query.trim()) return setError('Enter an account number or member name to search.');
    try {
      const rows = await lookupAccount(query);
      setMatches(rows);
      if (rows.length === 1) selectAccount(rows[0]);
      else if (rows.length === 0) setError('Account not found.');
    } catch {
      setError('Account not found.');
    }
  }

  async function checkCheque(num: string) {
    setChequeNumber(num);
    setChequeLeaf(null);
    setAccount(null);
    setSpecimens([]);
    setFallbackSignature(null);
    resetSignature();
    if (num.trim().length < 4) return;
    setChequeChecking(true);
    setError('');
    try {
      const leaf = await validateChequeLeaf(num.trim());
      setChequeLeaf(leaf);
      if (leaf.valid && leaf.drawer && leaf.status === 'unused') {
        // Cheque mode auto-resolves the member + account from the leaf.
        const drawer = leaf.drawer;
        selectAccount({
          id: drawer.accountId,
          accountNumber: drawer.accountNo,
          memberId: drawer.memberId,
          memberName: drawer.memberName,
          balance: drawer.balance,
          minBalance: drawer.minBalance,
          status: String(drawer.status).toLowerCase(),
        });
        if (!leaf.dateValidity?.ok) setError(leaf.dateValidity?.message || 'Cheque date invalid.');
        if (leaf.duplicatePresentment) setError(`Duplicate presentment detected — this cheque was used on ${leaf.duplicatePresentment.dateBs}.`);
      }
    } catch (err: any) {
      setChequeLeaf({ chequeNumber: num.trim(), leafNo: 0, status: 'invalid', bookNumber: null, bookStatus: null, accountId: '', valid: false } as ChequeLeafStatus);
      setError(err?.response?.data?.error || err?.message || 'Cheque leaf not found or already used.');
    } finally {
      setChequeChecking(false);
    }
  }

  // ─────────────────────────────────────────────
  // Signature verification
  // ─────────────────────────────────────────────

  function resetSignature() {
    setPresentedSignature(null);
    setVerifyResult(null);
    setOverrideReason('');
    setManualVerified(false);
  }

  function specimenForCompare(): string | null {
    const picked = specimens.find((s) => s.id === selectedSpecimenId);
    return picked?.imageUrl ?? specimens[0]?.imageUrl ?? fallbackSignature ?? null;
  }

  async function runSignatureVerify() {
    setError('');
    if (!account) return setError('Select an account first.');
    if (!account.memberId) return setError('Account has no member reference — cannot verify signature.');
    if (!presentedSignature) return setError('Capture the presented signature first.');
    const specimenImage = specimenForCompare();
    if (!specimenImage) return setError('No signature specimen on file. Capture one at account opening or in the account screen first.');
    setVerifying(true);
    try {
      const result = await verifySignature({
        accountId: account.id,
        memberId: account.memberId,
        presentedImageUrl: presentedSignature,
        specimenId: selectedSpecimenId,
      });
      setVerifyResult(result);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Signature verification failed.');
    } finally {
      setVerifying(false);
    }
  }

  const signatureDisposition = (): SignatureDisposition | null => {
    if (!verifyResult) return null;
    const band = verifyResult.band;
    if (band === 'auto_approved') {
      return { logId: verifyResult.logId, outcome: 'auto_approved' };
    }
    if (band === 'teller_review') {
      if (!overrideReason.trim()) return null;
      return { logId: verifyResult.logId, outcome: 'teller_override', overrideReason: overrideReason.trim() };
    }
    // blocked
    if (!overrideReason.trim()) return null;
    return { logId: verifyResult.logId, outcome: 'supervisor_override', overrideReason: overrideReason.trim() };
  };

  const signatureReady = Boolean(signatureDisposition());

  // ─────────────────────────────────────────────
  // Passbook reconciliation
  // ─────────────────────────────────────────────

  async function loadPassbook() {
    if (!account) return;
    try {
      const summary = await getPassbookSummary(account.id);
      setPassbookSummary(summary);
      setBookSerial(summary.passbookSerial || '');
      setBookLastLine(String(summary.lastPrintedLine));
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not load passbook summary.');
    }
  }

  async function runReconcile() {
    if (!account) return;
    try {
      const result = await reconcilePassbook(account.id, {
        bookSerial: bookSerial || undefined,
        bookLastLine: Number(bookLastLine) || undefined,
      });
      setReconcile(result);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Reconciliation check failed.');
    }
  }

  function resetPassbook() {
    setPassbookSummary(null);
    setBookSerial('');
    setBookLastLine('');
    setReconcile(null);
    setPassbookPresented(false);
    setTamperAcknowledged(false);
  }

  // ─────────────────────────────────────────────
  // Instrument readiness
  // ─────────────────────────────────────────────

  function instrumentReady(): boolean {
    if (!account) return false;
    if (mode === 'cheque') return chequeLeaf?.valid === true && chequeLeaf.status === 'unused' && (signatureReady || manualVerified);
    if (mode === 'slip') return slipNumber.trim().length > 0 && (signatureReady || manualVerified);
    if (mode === 'passbook') return passbookPresented;
    return false;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!account) return setError('Resolve the account first.');
    if (!numericAmount) return setError('Enter a withdrawal amount.');
    if (exceedsAvailable) return setError(`Amount exceeds available balance. Available: ${formatNPR(withdrawable)} (after minimum balance).`);
    if (!instrumentReady()) return setError('Complete the withdrawal instrument verification before continuing.');

    const disposition = signatureDisposition();

    setSubmitting(true);
    try {
      const data = await postWithdrawal({
        accountId: account.id,
        amount: numericAmount,
        payoutMode,
        bsDate: bsDate || undefined,
        instrument: {
          type: mode as WithdrawalInstrument,
          chequeNumber: mode === 'cheque' ? chequeNumber.trim() : undefined,
          slipNumber: mode === 'slip' ? slipNumber.trim() : undefined,
          signatureVerified: manualVerified || undefined,
          verificationLogId: disposition?.logId,
          signatureOutcome: disposition?.outcome,
          overrideReason: disposition?.overrideReason,
          passbookLastLine: mode === 'passbook' ? bookLastLine : undefined,
          passbookReconciled: mode === 'passbook' ? reconcile?.ok === true : undefined,
          passbookTampered: mode === 'passbook' ? reconcile?.ok !== true : undefined,
        },
      });
      setReceipt({ voucherNo: data.voucherNo, newBalance: data.newBalance, needsApproval: data.needsApproval, signatureOutcome: data.signatureOutcome, signatureScore: data.signatureScore });
      if (mode === 'cheque') await invalidateChequeRegister();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Withdrawal failed. No funds were released.');
    } finally {
      setSubmitting(false);
    }
  }

  function resetAll() {
    setReceipt(null);
    setMode(null);
    setAccount(null);
    setMatches([]);
    setAmount('');
    setSlipNumber('');
    setChequeNumber('');
    setChequeLeaf(null);
    setPassbookPresented(false);
    resetSignature();
    resetPassbook();
  }

  // ─────────────────────────────────────────────
  // Receipt
  // ─────────────────────────────────────────────

  if (receipt) {
    return (
      <div className="p-1 sm:p-2.5 max-w-[1800px] mx-auto text-slate-800">
        <div className="max-w-md mx-auto mt-8 bg-white border rounded-2xl p-6 text-center shadow-sm">
          {receipt.needsApproval ? (
            <>
              <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-amber-600" />
              </div>
              <p className="text-amber-700 font-semibold mt-3">Sent for approval</p>
              <p className="text-sm text-slate-500 mb-3 mt-1">Voucher {receipt.voucherNo} — queued for the dual-approval loop (threshold exceeded or passbook flagged). Funds will not release until a supervisor approves.</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="text-emerald-700 font-semibold mt-3">Withdrawal completed</p>
              <p className="text-sm text-slate-500 mb-1">Voucher {receipt.voucherNo}</p>
              <p className="text-xl font-bold text-slate-900 font-mono mb-4">New balance: {formatNPR(receipt.newBalance)}</p>
            </>
          )}
          {receipt.signatureOutcome && (
            <p className="text-[11px] text-slate-400 mb-2">
              Signature: <span className="font-semibold capitalize">{receipt.signatureOutcome.replace('_', ' ')}</span>
              {receipt.signatureScore != null ? ` · score ${receipt.signatureScore.toFixed(1)}` : ''}
            </p>
          )}
          <div className="flex gap-2 justify-center">
            <button className="border border-slate-300 rounded-lg px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => window.print()}>Print withdrawal slip</button>
            <button className="bg-rose-600 hover:bg-rose-500 text-white rounded-lg px-4 py-2 text-xs font-semibold" onClick={resetAll}>New withdrawal</button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // Step 1 — mode selection
  // ─────────────────────────────────────────────

  if (!mode) {
    return (
      <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-1">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Teller Withdrawal Entry</h1>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
              <span>Instrument-verified withdrawals with signature match scoring, cheque/duplicate guards and dual-approval queueing</span>
            </p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          <h2 className="text-sm font-bold text-slate-700">Step 1 — Select the withdrawal instrument</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              { key: 'slip' as WithdrawalInstrument, title: 'Withdrawal slip', desc: 'Pre-numbered slip + signature pad', icon: <FileText className="w-6 h-6" /> },
              { key: 'passbook' as WithdrawalInstrument, title: 'Passbook', desc: 'Passbook presented + line reconciliation', icon: <BookOpen className="w-6 h-6" /> },
              { key: 'cheque' as WithdrawalInstrument, title: 'Cheque', desc: 'Auto member/account from leaf + signature check', icon: <Banknote className="w-6 h-6" /> },
            ]).map((c) => (
              <button
                key={c.key}
                onClick={() => { setMode(c.key); setError(''); }}
                className="bg-white border border-slate-200 rounded-2xl p-5 text-left hover:border-rose-300 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-3 group-hover:bg-rose-100">{c.icon}</div>
                <p className="font-bold text-slate-900">{c.title}</p>
                <p className="text-xs text-slate-500 mt-1">{c.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // Steps 2 + 3
  // ─────────────────────────────────────────────

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-1">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Teller Withdrawal Entry</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
            <span>{MODE_LABEL[mode]} mode — instrument-verified withdrawal</span>
          </p>
        </div>
        <button type="button" onClick={() => { setMode(null); setAccount(null); setError(''); }} className="text-xs font-semibold text-slate-500 hover:text-rose-600">← Change instrument</button>
      </div>

      <form onSubmit={submit} className="max-w-2xl mx-auto space-y-4">
        {/* Account resolution — mode specific */}
        <ExpandableFormCard
          title={mode === 'cheque' ? 'Cheque verification' : 'Account'}
          subtitle={mode === 'cheque' ? 'Member + account auto-resolve from the cheque leaf' : 'Search by account number or member name'}
          icon={mode === 'cheque' ? <ScanLine className="w-5 h-5 text-rose-400" /> : <Wallet className="w-5 h-5 text-rose-400" />}
          badge={<span className="text-xs bg-rose-950 text-rose-400 border border-rose-800 px-2.5 py-1 rounded font-bold">Teller Outflow</span>}
        >
          {mode === 'cheque' && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2.5 text-sm font-mono focus:border-rose-500 focus:outline-none shadow-xs"
                  placeholder="Cheque number (e.g. 0450012)"
                  value={chequeNumber}
                  onChange={e => checkCheque(e.target.value)}
                />
              </div>
              {chequeChecking && <p className="text-xs text-slate-400 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Resolving leaf, drawer member & specimen…</p>}
              {chequeLeaf && chequeLeaf.valid === false && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2 flex items-center gap-1"><AlertTriangle className="w-4 h-4 shrink-0" /> {chequeLeaf.status === 'used' ? 'Cheque already used.' : chequeLeaf.status === 'stopped' ? 'Cheque stopped.' : 'Leaf not found, used, or reported stopped.'}</p>
              )}
              {chequeLeaf?.dateValidity && !chequeLeaf.dateValidity.ok && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2 flex items-center gap-1"><AlertTriangle className="w-4 h-4 shrink-0" /> {chequeLeaf.dateValidity.message}</p>
              )}
              {chequeLeaf?.duplicatePresentment && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2 flex items-center gap-1"><AlertCircle className="w-4 h-4 shrink-0" /> Duplicate presentment — this cheque was presented on {chequeLeaf.duplicatePresentment.dateBs} (NPR {formatNPR(chequeLeaf.duplicatePresentment.amount)}).</p>
              )}
            </div>
          )}

          {mode !== 'cheque' && !account && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:border-rose-500 focus:outline-none shadow-xs"
                    placeholder="Search account number or member"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), findAccount())}
                  />
                </div>
                <button type="button" className="border border-slate-300 rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={findAccount}>Find</button>
              </div>
              {matches.length > 1 && (
                <ul className="bg-white border border-slate-200 rounded-lg max-h-48 overflow-auto shadow-sm">
                  {matches.map(m => (
                    <li key={m.id} className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm flex justify-between" onClick={() => selectAccount(m)}>
                      <span>{m.memberName} — <span className="font-mono">#{m.accountNumber}</span></span>
                      <span className="text-slate-400 font-mono text-xs">{formatNPR(m.balance)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {account && (
            <div className="border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 flex justify-between items-center">
              <div>
                <p className="font-medium text-sm">{account.memberName} — <span className="font-mono">#{account.accountNumber}</span></p>
                <p className="text-xs text-slate-500">Balance: <span className="font-mono font-semibold">{formatNPR(account.balance)}</span> · Min balance: {formatNPR(account.minBalance)} · Available: <span className="font-mono font-semibold text-emerald-700">{formatNPR(withdrawable)}</span></p>
                {account.kycStatus && <p className="text-[11px] text-slate-400 mt-0.5">KYC: <span className="font-semibold">{account.kycStatus}</span> {account.memberStatus ? `· Member: ${account.memberStatus}` : ''}</p>}
              </div>
              {mode !== 'cheque' && (
                <button type="button" className="text-xs text-slate-500 hover:text-slate-700" onClick={() => { setAccount(null); setMatches([]); setError(''); resetSignature(); resetPassbook(); }}>Change</button>
              )}
            </div>
          )}
        </ExpandableFormCard>

        {activeOk && (
          <>
            <ExpandableFormCard
              title="Withdrawal instrument"
              subtitle={`${MODE_LABEL[mode]} verification — signature match scoring + duplicate guards`}
              icon={<PenLine className="w-5 h-5 text-rose-400" />}
            >
              {mode === 'slip' && (
                <div className="space-y-3 bg-slate-50 rounded-lg p-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">Withdrawal slip number</label>
                    <input className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono" placeholder="Pre-numbered slip serial" value={slipNumber} onChange={e => setSlipNumber(e.target.value)} />
                  </div>
                </div>
              )}

              {mode === 'cheque' && (
                <div className="space-y-3 bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Leaf #{chequeLeaf?.leafNo ?? '—'} · book {chequeLeaf?.bookNumber ?? '—'} · status <span className="font-semibold text-emerald-700 capitalize">{chequeLeaf?.status ?? '—'}</span></span>
                    {chequeLeaf?.dateValidity?.ok === false && <span className="font-semibold text-amber-700">{chequeLeaf.dateValidity.status === 'post_dated' ? 'Post-dated (hold)' : 'Stale'}</span>}
                  </div>
                </div>
              )}

              {mode === 'passbook' && (
                <div className="space-y-3 bg-slate-50 rounded-lg p-3">
                  {!passbookSummary && (
                    <button type="button" onClick={loadPassbook} className="text-xs font-semibold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1">
                      <BookOpen className="w-4 h-4" /> Load passbook state
                    </button>
                  )}
                  {passbookSummary && (
                    <div className="space-y-2">
                      <div className="text-xs text-slate-600 space-y-0.5">
                        <p>Serial <span className="font-mono font-semibold">{passbookSummary.passbookSerial}</span> · lines/page {passbookSummary.linesPerPage} · last printed line <span className="font-mono font-semibold">{passbookSummary.lastPrintedLine}</span></p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Book serial" value={bookSerial} onChange={e => setBookSerial(e.target.value)} />
                        <input className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Last printed line in book" value={bookLastLine} onChange={e => setBookLastLine(e.target.value)} />
                      </div>
                      <button type="button" onClick={runReconcile} className="text-xs font-semibold text-rose-600 hover:text-rose-700">Reconcile passbook</button>
                      {reconcile && (
                        <p className={`text-xs rounded px-3 py-2 flex items-center gap-1 ${reconcile.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-800 border border-amber-100'}`}>
                          {reconcile.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />} {reconcile.message}
                        </p>
                      )}
                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input type="checkbox" checked={passbookPresented} onChange={e => setPassbookPresented(e.target.checked)} className="rounded border-slate-300" />
                        Physical passbook presented and checked at counter
                      </label>
                      {(reconcile?.ok === false) && (
                        <label className="flex items-center gap-2 text-sm text-amber-700 cursor-pointer bg-amber-50 border border-amber-100 rounded px-3 py-2">
                          <input type="checkbox" checked={tamperAcknowledged} onChange={e => setTamperAcknowledged(e.target.checked)} className="rounded border-amber-300" />
                          Acknowledge mismatch — route this withdrawal to supervisor review
                        </label>
                      )}
                    </div>
                  )}
                </div>
              )}
            </ExpandableFormCard>

            <ExpandableFormCard
              title="Withdrawal amount & payout"
              subtitle="Minimum balance is preserved after the transaction"
              icon={<ArrowUpRight className="w-5 h-5 text-rose-400" />}
            >
              <div className="space-y-2">
                <input className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-rose-700 font-mono text-sm font-bold focus:border-rose-500 focus:outline-none shadow-xs" type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 10000" />
                <p className="text-xs text-slate-500">Available to withdraw: <span className="font-mono font-semibold">{formatNPR(withdrawable)}</span></p>
                {exceedsAvailable && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" /> Amount exceeds available balance.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <select className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-rose-500 focus:outline-none shadow-xs" value={payoutMode} onChange={e => setPayoutMode(e.target.value as PayoutMode)}>
                    <option value="cash">Cash</option>
                    <option value="cheque_issue">Issue cheque</option>
                    <option value="bank_transfer">Bank transfer</option>
                  </select>
                  <input className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Date (BS) — defaults to today" value={bsDate} onChange={e => setBsDate(e.target.value)} />
                </div>
              </div>
            </ExpandableFormCard>
          </>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </p>
        )}

        {activeOk && (
          <button type="submit" disabled={submitting || !instrumentReady()} className="w-full bg-rose-600 hover:bg-rose-500 text-white rounded-lg py-2.5 font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
            {submitting ? 'Processing...' : 'Post withdrawal'}
          </button>
        )}
      </form>

      {/* Signature verification panel — shared by slip + cheque */}
      {(mode === 'slip' || mode === 'cheque') && (
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2"><Fingerprint className="w-4 h-4 text-rose-500" /> Signature verification</h3>
            {specimenForCompare() && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Specimen:</span>
                {specimens.length > 1 ? (
                  <select className="border border-slate-300 rounded-lg px-2 py-1 bg-white text-xs" value={selectedSpecimenId ?? ''} onChange={e => { setSelectedSpecimenId(e.target.value || null); setVerifyResult(null); }}>
                    {specimens.map(s => <option key={s.id} value={s.id}>{s.signatoryName || 'Signatory'}</option>)}
                  </select>
                ) : (
                  <span className="font-semibold">{specimens[0]?.signatoryName || 'On-file signature'}</span>
                )}
              </div>
            )}
          </div>

          {!specimenForCompare() ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2">
              No signature specimen on file for this account yet. You may proceed by confirming the signature manually below, or capture a specimen at account opening / in the account screen first.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-bold text-slate-500 mb-1.5">Presented signature (member signs here)</p>
                <SignaturePad value={presentedSignature} onChange={setPresentedSignature} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 mb-1.5">Specimen on file</p>
                {(() => {
                  const url = resolveMediaUrl(specimenForCompare());
                  return url ? (
                    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden flex items-center justify-center" style={{ height: 150 }}>
                      <img src={url} alt="Specimen" className="max-w-full max-h-full object-contain" />
                    </div>
                  ) : (
                    <div className="border border-dashed border-slate-200 rounded-lg h-[150px] flex items-center justify-center text-xs text-slate-400">Image unavailable</div>
                  );
                })()}
              </div>
            </div>
          )}

          {presentedSignature && specimenForCompare() && (
            <button type="button" onClick={runSignatureVerify} disabled={verifying} className="inline-flex items-center gap-2 bg-slate-900 text-white rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50">
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
              {verifying ? 'Comparing against specimen…' : 'Verify signature'}
            </button>
          )}

          {verifyResult && (
            <div className={`rounded-lg border px-3 py-2.5 text-xs space-y-2 ${
              verifyResult.band === 'auto_approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              verifyResult.band === 'teller_review' ? 'bg-amber-50 border-amber-200 text-amber-900' :
              'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5">
                  {verifyResult.band === 'auto_approved' ? <CheckCircle2 className="w-4 h-4" /> : verifyResult.band === 'teller_review' ? <AlertTriangle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  Match score <span className="font-mono text-base font-black">{verifyResult.score.toFixed(1)}</span> / 100
                </span>
                <span className="capitalize font-semibold">{verifyResult.band === 'auto_approved' ? 'Auto-approved' : verifyResult.band === 'teller_review' ? 'Review needed' : 'Blocked'}</span>
              </div>
              {verifyResult.notes && <p className="opacity-80">{verifyResult.notes}</p>}
              {verifyResult.lowConfidence && <p className="opacity-70">Heuristic comparison (image format not fully decodable) — confirm manually.</p>}

              {(verifyResult.band === 'teller_review' || verifyResult.band === 'blocked') && (
                <div className="space-y-1.5 pt-1">
                  <input
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    placeholder={verifyResult.band === 'blocked' ? 'Supervisor override reason (mandatory)' : 'Teller override reason (mandatory)'}
                    value={overrideReason}
                    onChange={e => setOverrideReason(e.target.value)}
                  />
                  {verifyResult.band === 'blocked' && <p className="opacity-80">Below-threshold override requires an org_admin/manager account.</p>}
                </div>
              )}
            </div>
          )}

          {(mode === 'slip' || mode === 'cheque') && (
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" checked={manualVerified} onChange={e => { setManualVerified(e.target.checked); if (e.target.checked) setVerifyResult(null); }} className="rounded border-slate-300" />
              No specimen available — confirm signature manually against the on-file specimen
            </label>
          )}
        </div>
      )}
    </div>
  );
};