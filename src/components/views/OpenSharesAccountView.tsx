import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PieChart,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  UserCheck,
  ChevronRight,
  RefreshCw,
  Printer,
  Users,
  PlusCircle,
  Coins,
  X,
  ArrowLeft,
  UserPlus,
  Trash2,
  ShieldCheck,
  Upload,
  Sparkles,
  Check,
  Building2,
  CreditCard,
  Calendar,
  FileText,
} from 'lucide-react';
import { formatNPR, getTodayBS } from '../../utils/nepaliCalendar';
import { useAuthStore } from '../../stores/authStore';
import { useCoop } from '../../context/CoopContext';
import {
  fetchUnprovisionedMembers,
  fetchShareTypes,
  fetchOrgShareSettings,
  openShareAccount,
  type UnprovisionedMember,
  type ShareTransactionResult,
  type OrganizationShareSettings,
} from '../../api/shares';
import { fetchCoa } from '../../api/accountingSettings';
import { uploadMedia, resolveMediaUrl } from '../../api/storage';
import type { ShareType } from '../../types/coop';

// --- Receipt Interfaces & Component ---

interface ReceiptNominee {
  fullName: string;
  relation: string;
  sharePercentage: number;
  isPrimary: boolean;
}

interface ShareOpenReceipt {
  memberNo: string;
  memberName: string;
  shareTypeName: string;
  faceValue: number;
  numberOfShares: number;
  totalAmount: number;
  voucherNo: string;
  certificateNo: string | null | undefined;
  accountNo: string | null | undefined;
  kittaStart: number | null | undefined;
  kittaEnd: number | null | undefined;
  dateBs: string;
  nominees: ReceiptNominee[];
}

const ReceiptRow: React.FC<{ label: string; value: React.ReactNode; mono?: boolean; strong?: boolean }> = ({
  label,
  value,
  mono,
  strong,
}) => (
  <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-dashed border-slate-100 last:border-0">
    <span className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold shrink-0">{label}</span>
    <span
      className={`text-xs text-right ${mono ? 'font-mono' : ''} ${
        strong ? 'font-black text-emerald-700' : 'font-semibold text-slate-800'
      }`}
    >
      {value}
    </span>
  </div>
);

const ShareOpeningReceipt: React.FC<{ data: ShareOpenReceipt; label: string }> = ({ data, label }) => {
  const { user } = useAuthStore();
  const { activeBranch } = useCoop();
  const orgName = user?.organizationName || user?.organizationCode || 'Sahakari';
  const branchLine = [activeBranch?.name, activeBranch?.address, activeBranch?.phone].filter(Boolean).join(' • ');

  return (
    <div className="relative border border-slate-300 rounded-lg p-5 print:break-inside-avoid bg-white">
      <div className="absolute top-3 right-4 text-[10px] font-bold tracking-[0.18em] text-slate-500 border border-slate-300 px-2 py-0.5 bg-white">
        {label}
      </div>
      <div className="text-center border-b-2 border-slate-200 pb-3">
        <p className="text-[15px] font-black uppercase tracking-wide text-slate-900">{orgName}</p>
        <p className="text-[11px] text-slate-600 mt-0.5">{branchLine}</p>
        <p className="mt-2 inline-block px-6 py-1.5 border-2 border-slate-300 text-[11px] font-black uppercase tracking-[0.25em]">
          Share Account Opening Receipt
        </p>
      </div>
      <div className="mt-4 space-y-0.5">
        <ReceiptRow label="Date (BS)" value={data.dateBs} mono />
        <ReceiptRow label="Member No." value={data.memberNo} mono />
        <ReceiptRow label="Member Name" value={data.memberName} />
        <ReceiptRow label="Share Type" value={data.shareTypeName} />
        <ReceiptRow label="Kitta (Shares)" value={data.numberOfShares} />
        <ReceiptRow label="Face Value / Share" value={`NPR ${formatNPR(data.faceValue)}`} />
        {data.kittaStart != null && data.kittaEnd != null && (
          <ReceiptRow label="Kitta Range" value={`${data.kittaStart} - ${data.kittaEnd}`} mono />
        )}
        {data.accountNo && <ReceiptRow label="Share Account No." value={data.accountNo} mono />}
        {data.certificateNo && <ReceiptRow label="Certificate No." value={data.certificateNo} mono />}
        <ReceiptRow label="Voucher No." value={data.voucherNo} mono />
        <ReceiptRow label="Total Amount" value={`NPR ${formatNPR(data.totalAmount)}`} strong />
      </div>
      {data.nominees.length > 0 && (
        <div className="mt-4 pt-2 border-t border-dashed border-slate-300">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Nominees (हकवाला)</p>
          <div className="space-y-1">
            {data.nominees.map((n, i) => (
              <div key={i} className="flex items-center justify-between text-[11px] text-slate-700">
                <span className="font-semibold">
                  {n.fullName} <span className="text-slate-400">· {n.relation}</span>
                </span>
                <span className="font-mono">
                  {n.sharePercentage}%{n.isPrimary ? ' ★' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4 pt-3 border-t border-dashed border-slate-300 text-[11px] text-slate-600">
        Share account provisioned - GL journal posted - certificate issued. System-generated receipt.
      </div>
      <div className="grid grid-cols-2 gap-8 mt-10 text-[10px] text-slate-600">
        <div className="text-center">
          <div className="border-t border-slate-400 pt-1">Prepared by (Teller)</div>
        </div>
        <div className="text-center">
          <div className="border-t border-slate-400 pt-1">Member Signature</div>
        </div>
      </div>
    </div>
  );
};

// --- Draft Nominee State ---

interface NomineeDraft {
  fullName: string;
  relation: string;
  citizenshipNo: string;
  contactNo: string;
  photoUrl: string;
  sharePercentage: number;
  isPrimary: boolean;
}

const emptyNominee = (primary = false): NomineeDraft => ({
  fullName: '',
  relation: '',
  citizenshipNo: '',
  contactNo: '',
  photoUrl: '',
  sharePercentage: primary ? 100 : 0,
  isPrimary: primary,
});

// --- Main View Component ---

export const OpenSharesAccountView: React.FC = () => {
  const [members, setMembers] = useState<UnprovisionedMember[]>([]);
  const [shareTypes, setShareTypes] = useState<ShareType[]>([]);
  const [orgSettings, setOrgSettings] = useState<OrganizationShareSettings | null>(null);
  const [paymentAccounts, setPaymentAccounts] = useState<{ id: string; code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<UnprovisionedMember | null>(null);
  const [shareTypeId, setShareTypeId] = useState('');
  const [numberOfShares, setNumberOfShares] = useState<number>(10);
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [dateBs, setDateBs] = useState(getTodayBS());
  const [nominees, setNominees] = useState<NomineeDraft[]>([emptyNominee(true)]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ShareOpenReceipt | null>(null);

  const orgMinKitta = orgSettings?.minRequiredKitta ?? 10;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersData, typesData, settingsData, coaData] = await Promise.all([
        fetchUnprovisionedMembers(),
        fetchShareTypes(),
        fetchOrgShareSettings().catch(() => null),
        fetchCoa().catch(() => null),
      ]);
      setMembers(membersData ?? []);
      const active = (typesData ?? []).filter((t: ShareType) => t.status === 'Active');
      setShareTypes(active);
      setOrgSettings(settingsData);
      const accounts = (coaData?.accounts ?? [])
        .filter((a: any) => a.type === 'Asset' && a.allowPosting && a.isActive !== false)
        .sort((a: any, b: any) => (!!a.cashBankAccount === !!b.cashBankAccount ? a.code.localeCompare(b.code) : a.cashBankAccount ? -1 : 1))
        .map((a: any) => ({ id: a.id, code: a.code, name: a.name }));
      setPaymentAccounts(accounts);
      if (active.length === 1) setShareTypeId(active[0].id);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = shareTypes.find((t) => t.id === shareTypeId);
    if (t) {
      const min = Math.max(t.minShares ?? 1, orgMinKitta);
      setNumberOfShares((prev) => (prev < min ? min : prev));
    }
  }, [shareTypeId, shareTypes, orgMinKitta]);

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.memberNo.toLowerCase().includes(q) ||
        (m.membershipType || '').toLowerCase().includes(q)
    );
  }, [members, search]);

  const selectedType = shareTypes.find((t) => t.id === shareTypeId);
  const estimatedTotal = selectedType ? selectedType.faceValue * numberOfShares : 0;

  // Nominee live validation
  const totalPct = useMemo(
    () => nominees.reduce((sum, n) => sum + (Number.isFinite(n.sharePercentage) ? n.sharePercentage : 0), 0),
    [nominees]
  );
  const primaryCount = nominees.filter((n) => n.isPrimary).length;
  const nomineesValid = useMemo(() => {
    if (nominees.length === 0) return false;
    if (primaryCount !== 1) return false;
    if (Math.abs(totalPct - 100) > 0.01) return false;
    return nominees.every((n) => n.fullName.trim() && n.relation.trim() && n.sharePercentage > 0 && n.sharePercentage <= 100);
  }, [nominees, primaryCount, totalPct]);

  const pickMember = (m: UnprovisionedMember) => {
    setSelectedMember(m);
    setFormError(null);
    const dn = m.defaultNominee;
    if (dn?.fullName) {
      setNominees([
        {
          fullName: dn.fullName,
          relation: dn.relation ?? '',
          citizenshipNo: dn.citizenshipNo ?? '',
          contactNo: dn.phone ?? '',
          photoUrl: '',
          sharePercentage: 100,
          isPrimary: true,
        },
      ]);
    } else {
      setNominees([emptyNominee(true)]);
    }
    const min = Math.max(orgMinKitta, 1);
    setNumberOfShares(min);
  };

  const resetForm = () => {
    setSelectedMember(null);
    setShareTypeId(shareTypes.length === 1 ? shareTypes[0].id : '');
    setNumberOfShares(orgMinKitta);
    setPaymentAccountId('');
    setRemarks('');
    setDateBs(getTodayBS());
    setNominees([emptyNominee(true)]);
    setFormError(null);
  };

  const updateNominee = (index: number, patch: Partial<NomineeDraft>) => {
    setNominees((prev) => prev.map((n, i) => (i === index ? { ...n, ...patch } : n)));
  };

  const addNominee = () => {
    setNominees((prev) => {
      const next = [...prev, emptyNominee(false)];
      // Evenly distribute if possible or leave new as 0
      return next;
    });
  };

  const setNominee100 = (index: number) => {
    setNominees((prev) =>
      prev.map((n, i) => ({
        ...n,
        sharePercentage: i === index ? 100 : 0,
      }))
    );
  };

  const uploadNomineePhoto = async (index: number, file: File) => {
    if (!file || !selectedMember) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      try {
        const stored = await uploadMedia('photo', dataUrl, { memberId: selectedMember.id });
        updateNominee(index, { photoUrl: stored.url });
      } catch {
        updateNominee(index, { photoUrl: dataUrl });
      }
    };
    reader.readAsDataURL(file);
  };

  const removeNominee = (index: number) => {
    setNominees((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) return [emptyNominee(true)];
      if (prev[index].isPrimary && next.length > 0) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return setFormError('Please select a member.');
    if (!shareTypeId) return setFormError('Please select a share type.');
    if (!numberOfShares || numberOfShares < 1) return setFormError('Number of shares must be at least 1.');
    if (selectedType?.minShares && numberOfShares < selectedType.minShares)
      return setFormError(`Minimum ${selectedType.minShares} shares required for this share type.`);
    if (selectedType?.maxShares && numberOfShares > selectedType.maxShares)
      return setFormError(`Maximum ${selectedType.maxShares} shares allowed for this share type.`);
    if (numberOfShares < orgMinKitta) return setFormError(`Initial kitta must be at least ${orgMinKitta} (organization minimum).`);
    if (!nomineesValid) {
      if (nominees.length === 0) return setFormError('Add at least one nominee (हकवाला).');
      if (Math.abs(totalPct - 100) > 0.01)
        return setFormError(`Nominee percentages must total exactly 100% — current total is ${totalPct.toFixed(2)}%.`);
      if (primaryCount !== 1) return setFormError('Exactly one nominee must be marked as the primary (पहिलो हकवाला).');
      return setFormError('Every nominee needs a name, a relation, and a percentage above 0%.');
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const result: ShareTransactionResult = await openShareAccount({
        memberId: selectedMember.id,
        shareTypeId,
        numberOfShares,
        remarks: remarks.trim() || undefined,
        paymentAccountId: paymentAccountId || undefined,
        minRequiredKitta: orgMinKitta,
        nominees: nominees.map((n) => ({
          fullName: n.fullName.trim(),
          relation: n.relation.trim(),
          citizenshipNo: n.citizenshipNo.trim() || null,
          contactNo: n.contactNo.trim() || null,
          photoUrl: n.photoUrl.trim() || null,
          sharePercentage: n.sharePercentage,
          isPrimary: n.isPrimary,
        })),
      });
      setSuccess({
        memberNo: selectedMember.memberNo,
        memberName: selectedMember.fullName,
        shareTypeName: result.shareType,
        faceValue: result.faceValuePerShare ?? selectedType?.faceValue ?? 0,
        numberOfShares: result.numberOfShares,
        totalAmount: result.totalAmount,
        voucherNo: result.voucherNo,
        certificateNo: result.certificateNo,
        accountNo: result.accountNo,
        kittaStart: result.kittaStart,
        kittaEnd: result.kittaEnd,
        dateBs: result.dateBs ?? dateBs,
        nominees: nominees.map((n) => ({
          fullName: n.fullName.trim(),
          relation: n.relation.trim(),
          sharePercentage: n.sharePercentage,
          isPrimary: n.isPrimary,
        })),
      });
      await load();
    } catch (err: any) {
      setFormError(err?.response?.data?.error ?? err?.message ?? 'Failed to open share account.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="p-4 max-w-5xl mx-auto text-slate-800">
        <div id="printable-voucher-document" className="hidden print:block">
          <div className="space-y-6">
            <ShareOpeningReceipt data={success} label="CUSTOMER COPY" />
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black tracking-[0.3em] my-6">
              <span className="flex-1 border-t border-dashed border-slate-400" />
              CUT HERE
              <span className="flex-1 border-t border-dashed border-slate-400" />
            </div>
            <ShareOpeningReceipt data={success} label="OFFICIAL COPY" />
          </div>
        </div>

        <div className="max-w-lg mx-auto mt-6 bg-white border border-emerald-200 rounded-3xl p-8 text-center shadow-xl relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-40 h-40 bg-emerald-50 rounded-full blur-2xl pointer-events-none" />
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20 mb-4">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Share Account Created!</h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {success.memberName} • <span className="font-mono text-emerald-700 font-semibold">{success.memberNo}</span>
          </p>

          <div className="mt-6 bg-slate-50/80 rounded-2xl p-5 text-left space-y-1 border border-slate-200/80">
            <ReceiptRow label="Voucher No." value={success.voucherNo} mono />
            {success.accountNo && <ReceiptRow label="Account No." value={success.accountNo} mono />}
            {success.certificateNo && <ReceiptRow label="Certificate No." value={success.certificateNo} mono />}
            <ReceiptRow label="Kitta Issued" value={`${success.numberOfShares} Shares`} />
            {success.kittaStart != null && success.kittaEnd != null && (
              <ReceiptRow label="Kitta Range" value={`${success.kittaStart} - ${success.kittaEnd}`} mono />
            )}
            <ReceiptRow label="Total Amount" value={`NPR ${formatNPR(success.totalAmount)}`} strong />

            {success.nominees.length > 0 && (
              <div className="pt-3 mt-2 border-t border-dashed border-slate-200">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">Nominees (हकवाला)</p>
                {success.nominees.map((n, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-0.5">
                    <span className="font-semibold text-slate-700">
                      {n.fullName} <span className="text-slate-400 font-normal">({n.relation})</span>
                    </span>
                    <span className="font-mono font-bold text-emerald-700">
                      {n.sharePercentage}%{n.isPrimary ? ' ★' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-center mt-6">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 border border-slate-300 rounded-xl px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
            >
              <Printer className="w-4 h-4 text-slate-500" /> Print Receipt
            </button>
            <button
              onClick={() => {
                setSuccess(null);
                resetForm();
              }}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl px-5 py-2.5 text-xs font-bold transition shadow-md shadow-emerald-600/20"
            >
              <PlusCircle className="w-4 h-4" /> Open Another Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-5 max-w-[1700px] mx-auto text-slate-800 space-y-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-4 sm:p-5 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
            <PieChart className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-white">Open Shares Account (हकवाला)</h1>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                Share Studio
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Issue member share capital, assign nominees (हकवाला), post GL journals & generate certificates.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <div className="bg-white/10 backdrop-blur-md rounded-xl px-3 py-1.5 border border-white/10 text-right">
            <span className="text-[10px] text-slate-300 uppercase tracking-wider block font-semibold">Eligible Members</span>
            <span className="text-sm font-black text-emerald-400 font-mono">{members.length}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl px-3 py-1.5 border border-white/10 text-right">
            <span className="text-[10px] text-slate-300 uppercase tracking-wider block font-semibold">Org Min Kitta</span>
            <span className="text-sm font-black text-amber-300 font-mono">{orgMinKitta}</span>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white transition disabled:opacity-50"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-center gap-3 text-xs text-red-700 shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span className="font-medium">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column — Eligible Members (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col max-h-[820px]">
          <div className="p-3.5 border-b border-slate-100 bg-slate-50/70 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-600" /> Select Member
              </span>
              <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                {filteredMembers.length} available
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or member no..."
                className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white text-slate-800 shadow-xs"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-slate-100 overflow-y-auto custom-scrollbar flex-1 max-h-[720px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                <span className="text-xs font-medium">Loading eligible members...</span>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-xs font-semibold text-slate-600">No Eligible Members Found</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {search ? 'Try adjusting your search criteria.' : 'All active members already have open share accounts.'}
                </p>
              </div>
            ) : (
              filteredMembers.map((m) => {
                const isSelected = selectedMember?.id === m.id;
                const hasNominee = !!m.defaultNominee?.fullName;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => pickMember(m)}
                    className={`w-full text-left p-3.5 flex items-center justify-between gap-3 transition cursor-pointer border-l-4 ${
                      isSelected
                        ? 'bg-gradient-to-r from-emerald-50 to-teal-50/40 border-emerald-600 shadow-inner'
                        : 'border-transparent hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 font-bold text-xs shadow-xs ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {m.fullName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-xs font-bold truncate ${isSelected ? 'text-emerald-900' : 'text-slate-800'}`}
                          >
                            {m.fullName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {m.memberNo}
                          </span>
                          {hasNominee ? (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                              Nominee on file
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                              No Nominee
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-emerald-600 text-white' : 'text-slate-300'
                      }`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column — Share Account Creation Studio (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {!selectedMember ? (
            <div className="flex flex-col items-center justify-center p-16 text-center text-slate-400 space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-50 to-teal-50 border border-emerald-100 flex items-center justify-center text-emerald-500 shadow-inner">
                <UserCheck className="w-10 h-10" />
              </div>
              <div className="max-w-md space-y-1">
                <h3 className="text-base font-bold text-slate-800">Select a Member to Open Share Account</h3>
                <p className="text-xs text-slate-500">
                  Choose an eligible member from the list on the left to configure their initial share parameters and nominee (हकवाला) records.
                </p>
              </div>
              <div className="pt-4 flex items-center gap-6 text-xs text-slate-500 border-t border-slate-100">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> GL Auto-Journal
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Kitta Pointer Sync
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Printable Receipt
                </span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col">
              {/* Selected Member Top Bar */}
              <div className="bg-gradient-to-r from-emerald-900 to-slate-900 p-4 text-white flex items-center justify-between gap-4 border-b border-emerald-800">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-md">
                    {selectedMember.fullName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-white">{selectedMember.fullName}</h2>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        No Shares Yet
                      </span>
                    </div>
                    <p className="text-xs text-emerald-200/80 font-mono mt-0.5">
                      Member No: {selectedMember.memberNo} • Type: {selectedMember.membershipType || 'General'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition border border-white/10"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Switch Member
                </button>
              </div>

              {/* Form Content Body */}
              <div className="p-5 space-y-6 max-h-[640px] overflow-y-auto custom-scrollbar">
                {/* SECTION 1: SHARE PARAMETERS */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <Coins className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">1. Share Issue Details</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Share Type */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Share Type <span className="text-red-500">*</span>
                      </label>
                      {shareTypes.length === 0 ? (
                        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                          No active share types found. Please configure share types in Admin Setups first.
                        </div>
                      ) : (
                        <select
                          value={shareTypeId}
                          onChange={(e) => setShareTypeId(e.target.value)}
                          required
                          className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white text-slate-800 shadow-xs"
                        >
                          <option value="">-- Select Share Type --</option>
                          {shareTypes.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.code}) — NPR {formatNPR(t.faceValue)} / share
                            </option>
                          ))}
                        </select>
                      )}

                      {selectedType && (
                        <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-center">
                            <span className="text-slate-500 block">Face Value</span>
                            <span className="font-bold text-slate-800">NPR {formatNPR(selectedType.faceValue)}</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-center">
                            <span className="text-slate-500 block">Min Shares</span>
                            <span className="font-bold text-slate-800">
                              {Math.max(selectedType.minShares ?? 1, orgMinKitta)}
                            </span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-center">
                            <span className="text-slate-500 block">Dividend Rate</span>
                            <span className="font-bold text-emerald-700">{selectedType.dividendRate ?? 0}%</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quantity Kitta */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Number of Shares (Kitta) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={Math.max(selectedType?.minShares ?? 1, orgMinKitta)}
                          max={selectedType?.maxShares ?? undefined}
                          value={numberOfShares}
                          onChange={(e) => setNumberOfShares(Number(e.target.value))}
                          required
                          className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-slate-900 shadow-xs"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                          Kitta
                        </span>
                      </div>

                      {/* Quick presets */}
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="text-[10px] text-slate-400 font-medium">Quick:</span>
                        {[orgMinKitta, 10, 50, 100].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setNumberOfShares(preset)}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition ${
                              numberOfShares === preset
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>

                      {numberOfShares < orgMinKitta && (
                        <p className="text-[11px] text-red-600 font-semibold mt-1">
                          Minimum {orgMinKitta} kitta required by organization policy.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Payment Account</label>
                      <select
                        value={paymentAccountId}
                        onChange={(e) => setPaymentAccountId(e.target.value)}
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white text-slate-800"
                      >
                        <option value="">-- Cash / Server Default --</option>
                        {paymentAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} • {a.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Date (BS)</label>
                      <input
                        type="text"
                        value={dateBs}
                        onChange={(e) => setDateBs(e.target.value)}
                        placeholder="YYYY-MM-DD"
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Remarks</label>
                      <input
                        type="text"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="e.g. Initial share opening"
                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 2: NOMINEES (हकवाला) */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">2. Nominee (हकवाला) Details</h3>
                    </div>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                        Math.abs(totalPct - 100) <= 0.01
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                    >
                      Total: {totalPct.toFixed(2)}% {Math.abs(totalPct - 100) <= 0.01 ? '✓' : '(Must be 100%)'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {nominees.map((n, idx) => (
                      <div
                        key={idx}
                        className={`bg-slate-50/70 border rounded-2xl p-4 space-y-3 relative transition ${
                          n.isPrimary ? 'border-emerald-300 ring-2 ring-emerald-500/20 bg-emerald-50/30' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                            <input
                              type="radio"
                              name="primary-nominee"
                              checked={n.isPrimary}
                              onChange={() => setNominees((prev) => prev.map((x, i) => ({ ...x, isPrimary: i === idx })))}
                              className="accent-emerald-600 w-4 h-4"
                            />
                            <span>Primary Nominee (पहिलो हकवाला)</span>
                            {n.isPrimary && (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-600 text-white">
                                PRIMARY
                              </span>
                            )}
                          </label>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setNominee100(idx)}
                              className="text-[10px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-md transition"
                            >
                              Set 100%
                            </button>
                            {nominees.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeNominee(idx)}
                                className="p-1 text-slate-400 hover:text-red-600 transition"
                                title="Remove Nominee"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Full Name <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={n.fullName}
                              onChange={(e) => updateNominee(idx, { fullName: e.target.value })}
                              placeholder="Nominee full name"
                              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Relation <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={n.relation}
                              onChange={(e) => updateNominee(idx, { relation: e.target.value })}
                              placeholder="Spouse / Son / Daughter / Father..."
                              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Citizenship No.</label>
                            <input
                              type="text"
                              value={n.citizenshipNo}
                              onChange={(e) => updateNominee(idx, { citizenshipNo: e.target.value })}
                              placeholder="Optional"
                              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Contact No.</label>
                            <input
                              type="text"
                              value={n.contactNo}
                              onChange={(e) => updateNominee(idx, { contactNo: e.target.value })}
                              placeholder="Optional"
                              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">Share Percentage (%)</label>
                            <div className="relative">
                              <input
                                type="number"
                                min="1"
                                max="100"
                                step="0.01"
                                value={n.sharePercentage}
                                onChange={(e) => updateNominee(idx, { sharePercentage: Number(e.target.value) })}
                                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                %
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Nominee photo upload */}
                        <div className="flex items-center gap-3 pt-1 border-t border-slate-200/60">
                          {n.photoUrl ? (
                            <img
                              src={resolveMediaUrl(n.photoUrl)}
                              alt="Nominee"
                              className="w-10 h-10 rounded-xl object-cover border border-slate-300 shadow-xs shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-200/70 text-slate-400 flex items-center justify-center shrink-0">
                              <UserPlus className="w-5 h-5" />
                            </div>
                          )}
                          <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl px-3 py-1.5 cursor-pointer shadow-xs transition">
                            <Upload className="w-3.5 h-3.5 text-slate-500" />
                            <span>{n.photoUrl ? 'Change Photo' : 'Upload Nominee Photo'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) uploadNomineePhoto(idx, f);
                              }}
                            />
                          </label>
                          {n.photoUrl && (
                            <button
                              type="button"
                              onClick={() => updateNominee(idx, { photoUrl: '' })}
                              className="text-xs text-red-600 font-semibold hover:underline"
                            >
                              Remove Photo
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addNominee}
                    className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-emerald-400 text-emerald-700 rounded-2xl p-3 text-xs font-bold hover:bg-emerald-50 transition cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" /> Add Another Nominee (हकवाला)
                  </button>

                  {Math.abs(totalPct - 100) > 0.01 && (
                    <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>Nominee percentages must sum to exactly 100% (currently {totalPct.toFixed(2)}%).</span>
                    </p>
                  )}
                </div>

                {formError && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-red-700 shadow-sm">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <span className="font-semibold leading-relaxed">{formError}</span>
                  </div>
                )}
              </div>

              {/* PERSISTENT ALWAYS-VISIBLE STICKY FOOTER WITH SUBMIT BUTTON */}
              <div className="p-4 border-t-2 border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                    <PieChart className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Total Share Capital Required</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg sm:text-xl font-black text-emerald-700 font-mono">
                        NPR {formatNPR(estimatedTotal)}
                      </span>
                      {selectedType && (
                        <span className="text-xs font-bold text-slate-500">
                          ({numberOfShares} kitta @ NPR {formatNPR(selectedType.faceValue)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* THE PRIMARY CREATE SHARE ACCOUNT BUTTON */}
                <button
                  type="submit"
                  disabled={submitting || shareTypes.length === 0 || !nomineesValid}
                  className="w-full sm:w-auto min-w-[260px] bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed text-white rounded-2xl px-6 py-3.5 text-sm font-black tracking-wide transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2.5 border border-emerald-400/30 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Creating Share Account...</span>
                    </>
                  ) : (
                    <>
                      <PieChart className="w-5 h-5" />
                      <span>OPEN SHARE ACCOUNT</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};