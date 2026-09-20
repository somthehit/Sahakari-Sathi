import React, { useEffect, useState } from 'react';
import {
  UserPlus,
  Search,
  ChevronDown,
  Building2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BadgeCheck,
  Printer,
  Fingerprint,
} from 'lucide-react';
import { formatNPR, getTodayBS } from '../../utils/nepaliCalendar';
import { useAuthStore } from '../../stores/authStore';
import { useCoop } from '../../context/CoopContext';
import { ExpandableFormCard } from '../common/ExpandableFormCard';
import { SignaturePad } from '../common/SignaturePad';
import { uploadMedia } from '../../api/storage';
import {
  searchMembers,
  getMemberNominees,
  getSavingSchemes,
  openAccount,
  MemberSearchResult,
  SavingScheme,
  Nominee,
} from '../../api/savingsDeposits';
import { getSavingsAccounts } from '../../api/savings';

type DepositSource = 'cash' | 'bank_transfer' | 'internal_transfer';

const DEPOSIT_SOURCE_LABEL: Record<DepositSource, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  internal_transfer: 'Internal Transfer',
};

/** Snapshot of the opened-account details captured at submit time. */
interface OpenSuccessReceipt {
  accountNumber: string;
  memberName: string;
  memberCode: string;
  phone: string;
  schemeName: string;
  interestRate: number;
  openingDeposit: number;
  depositSource: DepositSource;
  bsDate: string;
  adDate: string;
  nomineeName?: string;
  isJoint: boolean;
}

const ReceiptRow: React.FC<{ label: string; value: React.ReactNode; mono?: boolean; strong?: boolean }> = ({ label, value, mono, strong }) => (
  <div className="flex items-baseline justify-between gap-3">
    <span className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold shrink-0">{label}</span>
    <span className={`text-xs text-slate-900 text-right ${mono ? 'font-mono' : ''} ${strong ? 'font-black text-emerald-700' : 'font-semibold'}`}>{value}</span>
  </div>
);

/**
 * One printable receipt copy. Rendered inside #printable-voucher-document so
 * the global print stylesheet reveals it while hiding the rest of the app.
 */
const AccountOpeningReceipt: React.FC<{ data: OpenSuccessReceipt; label: string }> = ({ data, label }) => {
  const { user } = useAuthStore();
  const { activeBranch } = useCoop();
  const orgName = user?.organizationName || user?.organizationCode || '';
  const branchName = activeBranch?.name || '';
  const branchLine = [branchName, activeBranch?.address, activeBranch?.phone].filter(Boolean).join(' • ');

  return (
    <div className="relative border border-slate-300 rounded-lg p-5 print:break-inside-avoid">
      <div className="absolute top-3 right-4 text-[10px] font-bold tracking-[0.2em] text-slate-500 border border-slate-300 px-2 py-0.5 bg-white">
        {label}
      </div>

      {/* Letterhead */}
      <div className="text-center border-b-2 border-slate-200 pb-3">
        <p className="text-[15px] font-black uppercase tracking-wide text-slate-900">{orgName || 'सहकारी संस्था'}</p>
        <p className="text-[11px] text-slate-600 mt-0.5">{branchLine}</p>
        <p className="mt-2 inline-block px-6 py-1.5 border-2 border-slate-300 text-[11px] font-black uppercase tracking-[0.25em]">
          Account Opening Receipt
        </p>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 mt-4">
        <ReceiptRow label="Account No." value={data.accountNumber} mono />
        <ReceiptRow label="Date (BS)" value={data.bsDate} mono />
        <ReceiptRow label="Member Name" value={data.memberName} />
        <ReceiptRow label="Member No." value={data.memberCode} mono />
        <ReceiptRow label="Phone" value={data.phone} />
        <ReceiptRow label="Scheme" value={data.schemeName} />
        <ReceiptRow label="Interest Rate" value={`${data.interestRate}% p.a.`} />
        <ReceiptRow label="Deposit Source" value={DEPOSIT_SOURCE_LABEL[data.depositSource]} />
        <ReceiptRow label="Nominee" value={data.nomineeName || '—'} />
        <ReceiptRow label="Joint Account" value={data.isJoint ? 'Yes' : 'No'} />
        <ReceiptRow label="Date (AD)" value={data.adDate} mono />
        <ReceiptRow label="Opening Deposit" value={`NPR ${formatNPR(data.openingDeposit)}`} strong />
      </div>

      {/* Service note */}
      <div className="mt-3 pt-3 border-t border-dashed border-slate-300 text-[11px] text-slate-600">
        Opening deposit booked · GL voucher posted · passbook serial assigned. This is a system-generated receipt.
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-8 mt-10 text-[10px] text-slate-600">
        <div className="text-center">
          <div className="border-t border-slate-400 pt-1">Prepared by (Teller)</div>
        </div>
        <div className="text-center">
          <div className="border-t border-slate-400 pt-1">Member's signature</div>
        </div>
      </div>
    </div>
  );
};

export const OpenAccountView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MemberSearchResult[]>([]);
  const [member, setMember] = useState<MemberSearchResult | null>(null);
  const [schemes, setSchemes] = useState<SavingScheme[]>([]);
  const [schemeId, setSchemeId] = useState('');
  /** Product ids the selected member already holds an ACTIVE account for. */
  const [ownedProductIds, setOwnedProductIds] = useState<Set<string>>(new Set());
  const [nominees, setNominees] = useState<Nominee[]>([]);
  const [nomineeId, setNomineeId] = useState('');
  const [openingDeposit, setOpeningDeposit] = useState('');
  const [depositSource, setDepositSource] = useState<'cash' | 'bank_transfer' | 'internal_transfer'>('cash');
  const [isJoint, setIsJoint] = useState(false);
  const [bsDate, setBsDate] = useState('');
  const [specimenImage, setSpecimenImage] = useState<string | null>(null);
  const [signatoryName, setSignatoryName] = useState('');
  const [signingRule, setSigningRule] = useState<'any' | 'all' | 'specific'>('any');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<OpenSuccessReceipt | null>(null);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const rows = await searchMembers(query);
        setResults(rows);
      } catch { setResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!member) {
      setOwnedProductIds(new Set());
      setSchemeId('');
      return;
    }
    getSavingSchemes(member.memberTypeId).then(setSchemes).catch(() => setSchemes([]));
    getMemberNominees(member.id).then(setNominees).catch(() => setNominees([]));
    // Business rule: only ONE ACTIVE account per member per product — reactively
    // disable products the member already owns.
    getSavingsAccounts({ memberId: member.id, status: 'Active', limit: 500 })
      .then((res) => {
        const owned = new Set<string>();
        for (const a of res.data ?? []) {
          if (a.savingsProductId) owned.add(a.savingsProductId);
        }
        setOwnedProductIds(owned);
        setSchemeId((prev) => (owned.has(prev) ? '' : prev));
      })
      .catch(() => setOwnedProductIds(new Set()));
  }, [member]);

  const selectedScheme = schemes.find(s => s.id === schemeId);
  const kycOk = member?.kycStatus === 'Verified' || member?.kycStatus === 'verified';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!member) return setError('Select a member first.');
    if (!kycOk) {
      return setError('Member KYC is not verified. An authorized user must override this before opening an account.');
    }
    if (!schemeId) return setError('Select a saving scheme.');
    if (ownedProductIds.has(schemeId)) {
      return setError('Member already possesses an active account for this savings product.');
    }
    const amount = Number(openingDeposit);
    if (!amount || amount < (selectedScheme?.minOpeningDeposit ?? 0)) {
      return setError(`Opening deposit must be at least NPR ${formatNPR(selectedScheme?.minOpeningDeposit ?? 0)}.`);
    }

    setSubmitting(true);
    try {
      let specimenImageUrl: string | undefined;
      if (specimenImage) {
        // Store the captured signature in the member-documents bucket up front —
        // the opened account seeds its specimen row from this storage path.
        const stored = await uploadMedia('signature', specimenImage, {
          memberId: member.id,
          fileName: `signature-${member.memberCode}.png`,
        });
        specimenImageUrl = stored.storagePath;
      }
      const data = await openAccount({
        memberId: member.id,
        schemeId,
        openingDeposit: amount,
        depositSource,
        nomineeId: nomineeId || null,
        isJoint,
        bsDate: bsDate || undefined,
        specimenImageUrl,
        signatoryName: signatoryName.trim() || member.name,
        signingRule,
      });
      setSuccess({
        accountNumber: data.accountNumber,
        memberName: member.name,
        memberCode: member.memberCode,
        phone: member.phone,
        schemeName: selectedScheme?.name ?? '',
        interestRate: selectedScheme?.interestRate ?? 0,
        openingDeposit: amount,
        depositSource,
        bsDate: bsDate || getTodayBS(),
        adDate: new Date().toISOString().slice(0, 10),
        nomineeName: nominees.find(n => n.id === nomineeId)?.name,
        isJoint,
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Something went wrong. Account not opened — no ledger entry was posted.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="p-1 sm:p-2.5 max-w-[1800px] mx-auto text-slate-800">
        {/* Printable receipt — hidden on screen, shown only when printing via
            the global #printable-voucher-document print stylesheet. Prints
            two copies: one for the customer, one for official records. */}
        <div id="printable-voucher-document" className="hidden print:block">
          <div className="space-y-6">
            <AccountOpeningReceipt data={success} label="CUSTOMER COPY" />
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black tracking-[0.3em] my-6 print:break-after-auto">
              <span className="flex-1 border-t border-dashed border-slate-400" />
              CUT HERE
              <span className="flex-1 border-t border-dashed border-slate-400" />
            </div>
            <AccountOpeningReceipt data={success} label="OFFICIAL COPY" />
          </div>
        </div>

        <div className="max-w-lg mx-auto mt-8 bg-white border border-emerald-200 rounded-2xl p-6 text-center shadow-sm">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <p className="text-emerald-700 font-semibold mt-3">Account opened</p>
          <p className="text-2xl font-mono font-bold text-slate-900 mt-1">{success.accountNumber}</p>
          <p className="text-xs text-slate-500 mt-1">Opening deposit booked · GL voucher posted · passbook serial assigned</p>
          <div className="flex gap-2 justify-center mt-4">
            <button className="border border-slate-300 rounded-lg px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2" onClick={() => window.print()}><Printer className="w-3.5 h-3.5" /> Print account opening receipt</button>
            <button className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-4 py-2 text-xs font-semibold" onClick={() => { setSuccess(null); setMember(null); setSchemeId(''); setNomineeId(''); setOpeningDeposit(''); setIsJoint(false); setSpecimenImage(null); setSignatoryName(''); setSigningRule('any'); }}>Open another</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-1">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Open Savings Account</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <UserPlus className="w-3.5 h-3.5 text-slate-500" />
            <span>KYC-gated account opening with product-rule validation, nominee capture and instant GL posting</span>
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
        <ExpandableFormCard
          title="Account Opening Form"
          subtitle="Select a KYC-verified member and a savings scheme to issue a new account"
          icon={<UserPlus className="w-5 h-5 text-emerald-400" />}
          badge={
            <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-2.5 py-1 rounded font-bold">
              New Account
            </span>
          }
          footerActions={
            member ? (
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition cursor-pointer shadow-lg text-xs disabled:opacity-50 inline-flex items-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}
                <span>{submitting ? 'Opening account...' : 'Open Account & Post Opening Deposit'}</span>
              </button>
            ) : undefined
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Member search */}
            <div className="relative space-y-1.5 md:col-span-2">
              <label className="text-slate-700 font-semibold text-xs">Member *</label>
              {member ? (
                <div className="flex items-center justify-between border border-slate-300 rounded-lg px-3 py-2 bg-slate-50">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className={`w-4 h-4 ${kycOk ? 'text-emerald-600' : 'text-amber-500'}`} />
                    <div>
                      <p className="font-semibold text-sm text-slate-900">{member.name} <span className="text-slate-400 text-xs font-mono">#{member.memberCode}</span></p>
                      <p className="text-[11px] text-slate-500">{member.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-1 rounded font-bold ${kycOk ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      KYC {member.kycStatus}
                    </span>
                    <button type="button" className="text-xs text-slate-500 hover:text-slate-700" onClick={() => setMember(null)}>Change</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none shadow-xs"
                      placeholder="Search member by name, ID or phone"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                    />
                  </div>
                  {results.length > 0 && (
                    <ul className="absolute z-20 bg-white border border-slate-200 rounded-lg w-full mt-1 max-h-56 overflow-auto shadow-lg">
                      {results.map(m => (
                        <li key={m.id} className="px-3 py-2 hover:bg-slate-50 cursor-pointer flex items-center gap-2 text-sm" onClick={() => { setMember(m); setQuery(''); setResults([]); }}>
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{m.name}</span>
                          <span className="text-slate-400 font-mono text-xs">#{m.memberCode}</span>
                          <span className="ml-auto text-[10px] text-slate-400">{m.phone}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            {member && (
              <>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-slate-700 font-semibold text-xs">Saving scheme *</label>
                  <select className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm focus:border-emerald-500 focus:outline-none shadow-xs" value={schemeId} onChange={e => setSchemeId(e.target.value)}>
                    <option value="">Select scheme</option>
                    {schemes.map(s => {
                      const owned = ownedProductIds.has(s.id);
                      return (
                        <option key={s.id} value={s.id} disabled={owned}>
                          {s.name} — {s.interestRate}% p.a. ({s.accountNoPrefix}){owned ? ' (account already active)' : ''}
                        </option>
                      );
                    })}
                  </select>
                  {ownedProductIds.size > 0 && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2.5 py-1.5">
                      The selected member already holds an Active account for{' '}
                      {schemes.filter(s => ownedProductIds.has(s.id)).map(s => s.name).join(', ') || 'one of the listed products'} —
                      that product is disabled.
                    </p>
                  )}
                  {selectedScheme && (
                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      <ChevronDown className="w-3 h-3" />
                      Min opening NPR {formatNPR(selectedScheme.minOpeningDeposit)} · Min balance NPR {formatNPR(selectedScheme.minBalance)} · {selectedScheme.chequeEnabled ? 'Cheque facility' : 'No cheque facility'}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 font-semibold text-xs">Opening deposit (NPR) *</label>
                  <input className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-emerald-700 font-mono text-sm font-bold focus:border-emerald-500 focus:outline-none shadow-xs" type="number" min="0" value={openingDeposit} onChange={e => setOpeningDeposit(e.target.value)} placeholder={`Min ${selectedScheme?.minOpeningDeposit ?? 0}`} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 font-semibold text-xs">Deposit source</label>
                  <select className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm focus:border-emerald-500 focus:outline-none shadow-xs" value={depositSource} onChange={e => setDepositSource(e.target.value as any)}>
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="internal_transfer">Internal transfer</option>
                  </select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-slate-700 font-semibold text-xs">Nominee</label>
                  <select className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm focus:border-emerald-500 focus:outline-none shadow-xs" value={nomineeId} onChange={e => setNomineeId(e.target.value)}>
                    <option value="">No nominee selected</option>
                    {nominees.map(n => <option key={n.id} value={n.id}>{n.name} ({n.relationship})</option>)}
                  </select>
                  {nominees.length === 0 && <p className="text-[11px] text-slate-500">Member has no nominee on file. Some schemes require one.</p>}
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
                  <input type="checkbox" checked={isJoint} onChange={e => setIsJoint(e.target.checked)} className="rounded border-slate-300" />
                  Joint account
                </label>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-slate-700 font-semibold text-xs">Opening date (BS)</label>
                  <input className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm focus:border-emerald-500 focus:outline-none shadow-xs" placeholder="2083/04/28 (defaults to today)" value={bsDate} onChange={e => setBsDate(e.target.value)} />
                </div>

                {/* Signature specimen — seeds the withdrawal signature-verification pipeline */}
                <div className="md:col-span-2 border border-slate-200 rounded-xl p-3 space-y-3 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-emerald-600" />
                    <p className="text-xs font-bold text-slate-700">Signature specimen <span className="font-normal text-slate-400">(recommended)</span></p>
                  </div>
                  <p className="text-[11px] text-slate-500 -mt-2">
                    Teller withdrawals compare the presented signature against this specimen (match-score &gt; 90 auto-approves, 70–89 needs teller review, below 70 blocks). Leave blank to capture later in the account screen.
                  </p>
                  <SignaturePad value={specimenImage} onChange={setSpecimenImage} />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Signatory name</label>
                      <input className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm" placeholder={member.name} value={signatoryName} onChange={e => setSignatoryName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600">Signing rule</label>
                      <select className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm" value={signingRule} onChange={e => setSigningRule(e.target.value as any)}>
                        <option value="any">Any signatory</option>
                        <option value="all">All signatories</option>
                        <option value="specific">Specific signatory</option>
                      </select>
                    </div>
                  </div>
                </div>
              </>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-center gap-2 md:col-span-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </p>
            )}
          </div>
        </ExpandableFormCard>
      </form>
    </div>
  );
};
