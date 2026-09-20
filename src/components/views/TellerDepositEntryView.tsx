import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDownLeft,
  Search,
  Wallet,
  Landmark,
  FileText,
  ListChecks,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  Scissors,
} from 'lucide-react';
import { formatNPR, getTodayBS } from '../../utils/nepaliCalendar';
import { DateConverter } from '../../utils/DateConverter';
import { ExpandableFormCard } from '../common/ExpandableFormCard';
import { NepaliDatePicker } from '../common/NepaliDatePicker';
import { invalidateChequeRegister } from '../../lib/queryClient';
import {
  lookupAccount,
  postDeposit,
  postBatchDeposits,
  validateChequeLeaf,
  AccountLookup,
  DepositPayload,
  DepositMode,
  ChequeLeafStatus,
} from '../../api/savingsDeposits';

interface BatchRow {
  account: AccountLookup;
  amount: number;
  mode: DepositMode;
  reference?: string;
  chequeNumber?: string;
  remarks?: string;
}

type TransferChannel = 'bank' | 'esewa' | 'khalti' | 'connectips';

const DENOMINATIONS = [1000, 500, 100, 50, 20, 10, 5];

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitWords(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? ' ' + ONES[o] : '');
}

function threeDigitWords(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return (h ? ONES[h] + ' Hundred' + (r ? ' ' : '') : '') + (r ? twoDigitWords(r) : '');
}

/** Indian/Nepali numbering: crore, lakh, thousand, hundred. */
function numberToWords(input: number): string {
  if (!isFinite(input)) return '';
  const n = Math.floor(Math.abs(input));
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(numberToWords(crore) + ' Crore');
  if (lakh) parts.push(numberToWords(lakh) + ' Lakh');
  if (thousand) parts.push(numberToWords(thousand) + ' Thousand');
  if (rest) parts.push(threeDigitWords(rest));
  return parts.join(' ');
}

function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  return numberToWords(rupees) + ' Rupees' + (paise ? ' and ' + numberToWords(paise) + ' Paisa' : '') + ' Only';
}

interface DepositSlipData {
  copyLabel: string;
  voucherNo: string;
  memberName: string;
  memberNo?: string;
  accountNo: string;
  depositorName: string;
  bsDate: string;
  adDate: string;
  modeLabel: string;
  amount: number;
  amountWords: string;
  denoms: { value: number; count: number }[];
}

function DepositSlip({ copyLabel, voucherNo, memberName, memberNo, accountNo, depositorName, bsDate, adDate, modeLabel, amount, amountWords, denoms }: DepositSlipData) {
  return (
    <div className="deposit-slip-copy">
      <div className="slip-head">
        <h1>SHREE DIPSHIKHA KRISHI SAHAKARI SANSTHA LTD.</h1>
        <p className="subtitle">Deposit Voucher — {copyLabel}</p>
      </div>
      <table className="slip-table">
        <tbody>
          <tr>
            <th>Voucher No.</th>
            <td>{voucherNo}</td>
            <th>Date (BS)</th>
            <td>{bsDate}</td>
          </tr>
          <tr>
            <th>Date (AD)</th>
            <td>{adDate}</td>
            <th>Mode</th>
            <td>{modeLabel}</td>
          </tr>
          <tr>
            <th>Member Name</th>
            <td colSpan={3}>{memberName}{memberNo ? ` (${memberNo})` : ''}</td>
          </tr>
          <tr>
            <th>Account No.</th>
            <td colSpan={3}>{accountNo}</td>
          </tr>
          <tr>
            <th>Depositor Name</th>
            <td colSpan={3}>{depositorName}</td>
          </tr>
          <tr>
            <th>Amount in Words</th>
            <td colSpan={3} className="amount-words">{amountWords}</td>
          </tr>
          <tr>
            <th>Total Amount</th>
            <td colSpan={3} className="amount-total">रु. {formatNPR(amount)}</td>
          </tr>
        </tbody>
      </table>
      <table className="slip-table" style={{ marginTop: 8 }}>
        <tbody>
          <tr>
            <th colSpan={denoms.length + 1} style={{ textAlign: 'center' }}>Cash Denomination</th>
          </tr>
          <tr>
            {denoms.map((d) => <td key={d.value} className="denom-cell">{d.value}</td>)}
            <td className="denom-cell denom-total">Total</td>
          </tr>
          <tr>
            {denoms.map((d) => <td key={d.value} className="denom-cell">{d.count || ''}</td>)}
            <td className="denom-cell denom-total">{formatNPR(amount)}</td>
          </tr>
        </tbody>
      </table>
      <table className="slip-table" style={{ marginTop: 10 }}>
        <tbody>
          <tr>
            <td className="sign-box"><div className="sign-line">Depositor's Signature</div></td>
            <td className="sign-box"><div className="sign-line">Teller's Signature</div></td>
            <td className="sign-box"><div className="sign-line">Officer / Seal</div></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const PRINT_SLIP_CSS = `
#printable-deposit-slip { display: none; }
@media print {
  body * { visibility: hidden; }
  #printable-deposit-slip, #printable-deposit-slip * { visibility: visible; }
  #printable-deposit-slip { display: block; position: absolute; left: 0; top: 0; width: 100%; }
  @page { size: A4 portrait; margin: 10mm; }
  .deposit-slip-copy {
    width: 100%;
    border: 1.5px solid #000;
    padding: 12px 14px;
    margin-bottom: 8px;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11.5px;
    color: #000;
    box-sizing: border-box;
    page-break-inside: avoid;
  }
  .deposit-slip-copy h1 { margin: 0 0 2px; font-size: 16px; text-align: center; letter-spacing: 0.4px; }
  .deposit-slip-copy .subtitle { margin: 0 0 6px; text-align: center; font-size: 11px; }
  .slip-head { border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
  .slip-table { width: 100%; border-collapse: collapse; }
  .slip-table th, .slip-table td { border: 1px solid #000; padding: 3px 6px; vertical-align: top; }
  .slip-table th { background: #f1f5f9; font-weight: 600; }
  .amount-words { font-weight: 600; text-transform: capitalize; }
  .amount-total { font-weight: 700; }
  .denom-cell { text-align: center; }
  .denom-total { font-weight: 700; }
  .sign-box { height: 52px; text-align: center; }
  .sign-line { margin-top: 34px; font-size: 10.5px; }
  .cut-line { display: flex; align-items: center; gap: 8px; margin: 4px 0 10px; color: #000; }
  .cut-line::before, .cut-line::after { content: ''; flex: 1; border-top: 1.5px dashed #000; }
}
`;

/**
 * Date defaults to today (BS) automatically. A "Backdate this entry" link
 * reveals the date picker only when actually needed — no empty date box shown
 * by default.
 */
function DateField({ bsDate, setBsDate }: { bsDate: string; setBsDate: (v: string) => void }) {
  const [backdating, setBackdating] = useState(false);
  return (
    <div>
      {!backdating ? (
        <div className="flex items-center justify-between text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <span className="text-slate-500 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-emerald-400" />
            Date: <span className="font-semibold text-slate-800">{bsDate} (today)</span>
          </span>
          <button type="button" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800" onClick={() => setBackdating(true)}>
            Backdate this entry
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <NepaliDatePicker value={bsDate} onChange={(bs) => setBsDate(bs)} />
          <button type="button" className="text-sm font-semibold text-slate-500 hover:text-slate-700" onClick={() => { setBackdating(false); setBsDate(getTodayBS()); }}>
            Use today ({getTodayBS()})
          </button>
        </div>
      )}
    </div>
  );
}

export const TellerDepositEntryView: React.FC = () => {
  const [batchMode, setBatchMode] = useState(false);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<AccountLookup[]>([]);
  const [account, setAccount] = useState<AccountLookup | null>(null);
  const [searching, setSearching] = useState(false);

  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<DepositMode>('cash');
  const [bsDate, setBsDate] = useState(getTodayBS());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{ voucherNo: string; newBalance: number; pendingClearing?: boolean } | null>(null);

  const [denoms, setDenoms] = useState<Record<number, string>>({});

  // Internal cheque lookup — a leaf issued from this cooperative's own chequebooks.
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeLeaf, setChequeLeaf] = useState<ChequeLeafStatus | null>(null);
  const [chequeChecking, setChequeChecking] = useState(false);
  const [chequeNotFound, setChequeNotFound] = useState(false);
  const [chequeError, setChequeError] = useState('');

  const [transfer, setTransfer] = useState<{ channel: TransferChannel; reference: string; senderName: string; sourceBank: string }>({
    channel: 'bank',
    reference: '',
    senderName: '',
    sourceBank: '',
  });
  const [transferVerified, setTransferVerified] = useState(false);

  const [batch, setBatch] = useState<BatchRow[]>([]);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Live account lookup (debounced).
  useEffect(() => {
    if (account || query.trim().length < 2) { setMatches([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const rows = await lookupAccount(query);
        setMatches(rows ?? []);
      } catch {
        setMatches([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, account]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setMatches([]);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Live internal cheque-leaf lookup — shared GET /cheque/leaves/:chequeNumber endpoint.
  // Only cheques issued from this cooperative's own chequebooks are accepted.
  useEffect(() => {
    setChequeLeaf(null); setChequeNotFound(false); setChequeError('');
    if (chequeNumber.trim().length < 3) return;
    setChequeChecking(true);
    const t = setTimeout(async () => {
      try {
        const leaf = await validateChequeLeaf(chequeNumber.trim());
        setChequeLeaf(leaf);
      } catch (err: any) {
        const msg = err?.response?.data?.error || err?.message || '';
        if (/not found/i.test(msg)) setChequeNotFound(true);
        else setChequeError(msg);
      } finally {
        setChequeChecking(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [chequeNumber]);

  const numericAmount = Number(amount) || 0;
  const newBalancePreview = account ? account.balance + numericAmount : 0;

  const denomTotal = DENOMINATIONS.reduce((sum, d) => sum + d * (Number(denoms[d]) || 0), 0);
  const denomMatches = mode !== 'cash' || denomTotal === numericAmount;

  function resetForm() {
    setAccount(null); setQuery(''); setMatches([]); setAmount(''); setMode('cash'); setDenoms({});
    setChequeNumber(''); setChequeLeaf(null); setChequeNotFound(false); setChequeError('');
    setTransfer({ channel: 'bank', reference: '', senderName: '', sourceBank: '' });
    setTransferVerified(false);
    setBsDate(getTodayBS());
  }

  function validate(): string | null {
    if (!account) return 'Search and select an account first.';
    if (account.status !== 'active') return `Account is ${account.status}. Deposits are blocked.`;
    if (!numericAmount) return 'Enter a deposit amount.';
    if (mode === 'cash' && !denomMatches) return `Denomination count (NPR ${denomTotal.toLocaleString()}) does not match the entered amount.`;
    if (mode === 'cheque') {
      if (chequeNotFound) return 'This cheque number is not recognized. Only cheques issued by this cooperative can be deposited.';
      if (chequeError) return chequeError;
      if (!chequeLeaf) return 'Enter a valid internal cheque number.';
      if (!chequeLeaf.valid) return `This cheque is ${chequeLeaf.status} and cannot be deposited.`;
    }
    if (mode === 'bank_transfer') {
      if (!transfer.reference.trim()) return 'Transaction / UTR reference is required.';
      if (!transferVerified) return 'Confirm the transfer is verified against the bank statement or gateway dashboard.';
    }
    return null;
  }

  function buildRemarks(): string | undefined {
    if (mode !== 'bank_transfer') return undefined;
    const parts = [`Via ${transfer.channel}`];
    if (transfer.senderName.trim()) parts.push(transfer.senderName.trim());
    if (transfer.sourceBank.trim()) parts.push(transfer.sourceBank.trim());
    return parts.join(' · ');
  }

  function addToBatch() {
    const err = validate();
    if (err) return setError(err);
    setError('');
    setBatch(prev => [...prev, {
      account: account!,
      amount: numericAmount,
      mode,
      reference: mode === 'bank_transfer' ? transfer.reference.trim() : undefined,
      chequeNumber: mode === 'cheque' ? chequeNumber.trim() : undefined,
      remarks: buildRemarks(),
    }]);
    resetForm();
  }

  async function submitBatch() {
    setError('');
    setSubmitting(true);
    try {
      const entries: DepositPayload[] = batch.map(r => ({
        accountId: r.account.id,
        amount: r.amount,
        mode: r.mode,
        bsDate: bsDate || undefined,
        cheque: r.mode === 'cheque' && r.chequeNumber ? { number: r.chequeNumber } : undefined,
        reference: r.mode === 'bank_transfer' ? r.reference : undefined,
        remarks: r.remarks,
      }));
      const res = await postBatchDeposits(entries);
      setBatch([]);
      setReceipt(null);
      setError(`Batch posted successfully — ${res.posted} deposit(s).`);
      // Internal-cheque deposits consume cheque leaves — refresh the register.
      if (batch.some(r => r.mode === 'cheque')) await invalidateChequeRegister();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Batch deposit failed — no entries were posted.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSingle(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) return setError(err);
    setError('');
    setSubmitting(true);
    try {
      const data = await postDeposit({
        accountId: account!.id,
        amount: numericAmount,
        mode,
        bsDate: bsDate || getTodayBS(),
        cheque: mode === 'cheque' ? { number: chequeNumber.trim() } : undefined,
        reference: mode === 'bank_transfer' ? transfer.reference.trim() : undefined,
        remarks: buildRemarks(),
      });
      setReceipt({ voucherNo: data.voucherNo, newBalance: data.newBalance, pendingClearing: data.pendingClearing });
      // Internal-cheque deposit consumes the leaf (unused → presented) — refresh
      // the cheque register so its new status shows immediately.
      if (mode === 'cheque') await invalidateChequeRegister();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Deposit failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt) {
    const depositorName =
      mode === 'bank_transfer' && transfer.senderName.trim()
        ? transfer.senderName.trim()
        : account?.memberName ?? '';
    const modeLabel = mode === 'cash' ? 'Cash' : mode === 'cheque' ? 'Internal Cheque' : 'Bank / Digital Transfer';
    const adDate = DateConverter.bsToAd(bsDate || getTodayBS()) || new Date().toISOString().slice(0, 10);
    const slipData: DepositSlipData | null = account
      ? {
          copyLabel: 'Office Copy',
          voucherNo: receipt.voucherNo,
          memberName: account.memberName,
          memberNo: account.memberNo,
          accountNo: account.accountNumber,
          depositorName,
          bsDate: bsDate || getTodayBS(),
          adDate,
          modeLabel,
          amount: numericAmount,
          amountWords: amountInWords(numericAmount),
          denoms: DENOMINATIONS.map((v) => ({ value: v, count: Number(denoms[v]) || 0 })),
        }
      : null;

    return (
      <>
        {slipData &&
          createPortal(
            <>
              <style>{PRINT_SLIP_CSS}</style>
              <div id="printable-deposit-slip">
                <DepositSlip {...slipData} />
                <div className="cut-line"><Scissors className="w-4 h-4" /></div>
                <DepositSlip {...slipData} copyLabel="Customer Copy" />
              </div>
            </>,
            document.body
          )}
        <div className="p-1 sm:p-2.5 max-w-[1800px] mx-auto text-slate-800">
        <div className="max-w-md mx-auto mt-8 bg-white border rounded-2xl p-6 text-center shadow-sm">
          {receipt.pendingClearing ? (
            <>
              <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
                <FileText className="w-6 h-6 text-amber-600" />
              </div>
              <p className="text-amber-700 font-semibold mt-3">Cheque queued for clearance</p>
              <p className="text-sm text-slate-500 mb-3 mt-1">Receipt {receipt.voucherNo} — balance updates after the cheque clears.</p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="text-emerald-700 font-semibold mt-3">Deposit recorded</p>
              <p className="text-sm text-slate-500 mb-1">Voucher {receipt.voucherNo}</p>
              <p className="text-xl font-bold text-slate-900 font-mono mb-4">New balance: {formatNPR(receipt.newBalance)}</p>
            </>
          )}
          <div className="flex gap-2 justify-center">
            <button className="border border-slate-300 rounded-lg px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => window.print()}>Print deposit slip</button>
            <button className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-4 py-2 text-xs font-semibold" onClick={() => { setReceipt(null); resetForm(); }}>New deposit</button>
          </div>
        </div>
      </div>
      </>
    );
  }

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-1">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Teller Deposit Entry</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <ArrowDownLeft className="w-3.5 h-3.5 text-slate-500" />
            <span>Cash / digital-transfer deposits and internal-cheque deposits (queued for clearance)</span>
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-sm font-semibold text-slate-900">Single deposit</p>
            <p className="text-xs text-slate-500">Post one deposit at the teller counter</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={batchMode} onChange={e => setBatchMode(e.target.checked)} className="rounded border-slate-300" />
            <ListChecks className="w-4 h-4" />
            Batch / field collection mode
          </label>
        </div>

        {batchMode && batch.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl divide-y shadow-sm">
            {batch.map((r, i) => (
              <div key={i} className="flex justify-between px-4 py-2 text-sm">
                <span className="text-slate-700">{r.account.memberName} — <span className="font-mono">#{r.account.accountNumber}</span></span>
                <span className="font-mono font-semibold">{formatNPR(r.amount)} ({r.mode})</span>
              </div>
            ))}
            <div className="px-4 py-2 flex justify-between text-sm font-bold text-slate-900 bg-slate-50">
              <span>Total ({batch.length} entries)</span>
              <span>{formatNPR(batch.reduce((s, r) => s + r.amount, 0))}</span>
            </div>
          </div>
        )}

        <form onSubmit={batchMode ? e => { e.preventDefault(); addToBatch(); } : submitSingle} className="space-y-4">
          <ExpandableFormCard
            title="Account"
            subtitle="Search by account number, member name, or ID"
            icon={<Wallet className="w-5 h-5 text-emerald-400" />}
          >
            {!account ? (
              <div className="relative" ref={searchBoxRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none shadow-xs"
                    placeholder="Search account number or member..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    autoFocus
                  />
                </div>
                {searching && <p className="text-xs text-slate-400 mt-1">Searching...</p>}
                {!searching && matches.length === 0 && query.trim().length >= 2 && (
                  <p className="text-xs text-slate-400 mt-1">No accounts match &quot;{query}&quot;.</p>
                )}
                {matches.length > 0 && (
                  <div className="absolute z-20 bg-white border border-slate-200 rounded-lg w-full mt-1 shadow-lg max-h-64 overflow-auto">
                    {matches.map(m => (
                      <div key={m.id} className="px-3 py-2 hover:bg-slate-50 cursor-pointer border-b last:border-0 text-sm"
                        onClick={() => {
                          setAccount(m); setQuery(''); setMatches([]);
                          setError(m.status !== 'active' ? `Account is ${m.status}. Deposits are blocked.` : '');
                        }}>
                        <p className="font-medium text-slate-800">{m.memberName} — <span className="font-mono">#{m.accountNumber}</span></p>
                        <p className="text-xs text-slate-400 font-mono">{formatNPR(m.balance)}{m.productName ? ` · ${m.productName}` : ''}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">{account.memberName} — <span className="font-mono">#{account.accountNumber}</span></p>
                  <p className="text-xs text-slate-500">Current balance: <span className="font-mono font-semibold">{formatNPR(account.balance)}</span> · Product: {account.productName || '—'}</p>
                </div>
                <button type="button" className="text-xs text-slate-500 hover:text-slate-700" onClick={() => { setAccount(null); setMatches([]); setError(''); }}>Change</button>
              </div>
            )}
          </ExpandableFormCard>

          {account && account.status === 'active' && (
            <ExpandableFormCard
              title="Deposit details"
              subtitle="Amount and payment mode"
              icon={<ArrowDownLeft className="w-5 h-5 text-emerald-400" />}
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-700 font-semibold text-xs">Amount (NPR) *</label>
                  <input className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-emerald-700 font-mono text-sm font-bold focus:border-emerald-500 focus:outline-none shadow-xs" type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-700 font-semibold text-xs">Mode *</label>
                  <select className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm focus:border-emerald-500 focus:outline-none shadow-xs" value={mode} onChange={e => setMode(e.target.value as DepositMode)}>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque (internal only)</option>
                    <option value="bank_transfer">Bank / digital transfer</option>
                  </select>
                </div>
              </div>

              {mode === 'cash' && numericAmount > 0 && (
                <p className="text-sm text-slate-500 mt-3">New balance will be: <span className="font-mono font-semibold text-slate-900">{formatNPR(newBalancePreview)}</span></p>
              )}

              {mode === 'cash' && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-slate-700 mb-1.5">Cash denomination count</p>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    {DENOMINATIONS.map((d, i) => {
                      const count = Number(denoms[d]) || 0;
                      return (
                        <div key={d} className={`flex items-center justify-between px-3 py-1.5 text-sm ${i !== DENOMINATIONS.length - 1 ? 'border-b border-slate-100' : ''}`}>
                          <span className="text-slate-600">NPR {d} ×</span>
                          <input type="number" min={0} className="w-16 border border-slate-300 rounded px-2 py-1 text-center font-mono text-sm focus:border-emerald-500 focus:outline-none" value={denoms[d] ?? ''} onChange={e => setDenoms(prev => ({ ...prev, [d]: e.target.value }))} />
                          <span className="w-20 text-right text-slate-400 font-mono">{(d * count).toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className={`flex justify-between text-sm px-3 py-2 mt-1.5 rounded-lg ${denomMatches ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
                    <span>Counted total</span>
                    <span className="font-semibold">{formatNPR(denomTotal)} {denomMatches ? '✓ matches' : '— does not match amount'}</span>
                  </div>
                </div>
              )}

              {mode === 'cheque' && (
                <div className="mt-3 space-y-2">
                  <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" placeholder="Cheque leaf number issued by this cooperative" value={chequeNumber} onChange={e => setChequeNumber(e.target.value)} />
                  {chequeChecking && <p className="text-xs text-slate-400">Checking...</p>}
                  {chequeNotFound && (
                    <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded px-3 py-2">Not recognized. Only cheques issued by this cooperative's own chequebooks can be deposited — external bank cheques are not accepted.</p>
                  )}
                  {chequeError && (
                    <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded px-3 py-2">This cheque cannot be deposited: {chequeError}</p>
                  )}
                  {chequeLeaf && chequeLeaf.valid && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs text-emerald-700 space-y-0.5">
                      <p>Internal cheque verified — leaf #{chequeLeaf.leafNo}{chequeLeaf.bookNumber ? ` · book ${chequeLeaf.bookNumber}` : ''}</p>
                      <p className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Queued for clearance — balance updates after the cheque clears.</p>
                    </div>
                  )}
                  {chequeLeaf && !chequeLeaf.valid && (
                    <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded px-3 py-2">This cheque is {chequeLeaf.status} and cannot be deposited.</p>
                  )}
                </div>
              )}

              {mode === 'bank_transfer' && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" value={transfer.channel} onChange={e => setTransfer({ ...transfer, channel: e.target.value as TransferChannel })}>
                      <option value="bank">Bank transfer</option>
                      <option value="esewa">eSewa</option>
                      <option value="khalti">Khalti</option>
                      <option value="connectips">ConnectIPS</option>
                    </select>
                    <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" placeholder="Transaction / UTR number" value={transfer.reference} onChange={e => setTransfer({ ...transfer, reference: e.target.value })} />
                    <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" placeholder="Sender name" value={transfer.senderName} onChange={e => setTransfer({ ...transfer, senderName: e.target.value })} />
                    <input className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" placeholder="Source bank / wallet" value={transfer.sourceBank} onChange={e => setTransfer({ ...transfer, sourceBank: e.target.value })} />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={transferVerified} onChange={e => setTransferVerified(e.target.checked)} className="rounded border-slate-300" />
                    Verified against bank statement / gateway dashboard
                  </label>
                </div>
              )}

              <div className="mt-3">
                <DateField bsDate={bsDate} setBsDate={setBsDate} />
              </div>
            </ExpandableFormCard>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </p>
          )}

          {account && account.status === 'active' && (
            batchMode
              ? <button type="submit" className="w-full border border-emerald-600 text-emerald-700 rounded-lg py-2.5 text-sm font-bold hover:bg-emerald-50">Add to batch</button>
              : <button type="submit" disabled={submitting} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg py-2.5 font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Landmark className="w-4 h-4" />}
                  {submitting ? 'Posting...' : 'Post deposit'}
                </button>
          )}
        </form>

        {batchMode && batch.length > 0 && (
          <button onClick={submitBatch} disabled={submitting} className="w-full bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg py-2.5 font-bold disabled:opacity-50">
            {submitting ? 'Posting batch...' : `Post all ${batch.length} deposits`}
          </button>
        )}
      </div>
    </div>
  );
};
