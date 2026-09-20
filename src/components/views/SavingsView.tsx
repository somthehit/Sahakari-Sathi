import React, { useState, useEffect } from 'react';
import { useCoop } from '../../context/CoopContext';
import { 
  PiggyBank, 
  CreditCard, 
  BookOpen, 
  Sparkles, 
  Search, 
  ArrowDownLeft, 
  ArrowUpRight, 
  CheckCircle2, 
  Printer, 
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { formatNPR } from '../../utils/nepaliCalendar';
import { ExpandableFormCard } from '../common/ExpandableFormCard';
import { ImageHoverPreview } from '../common/ImageHoverPreview';
import { FormLabelWithHelp } from '../common/FormHelpTooltip';
import { PaymentMethodSelector, type PaymentMethod } from '../shared/PaymentMethodSelector';
import type { ChequeSelectorData } from '../shared/ChequePaymentSelector';
import { fetchAccountingSettings } from '../../api/accountingSettings';

interface Props {
  activeSubKey?: string;
}

export const SavingsView: React.FC<Props> = ({ activeSubKey }) => {
  const { 
    savingsAccounts = [], 
    members = [], 
    processDeposit, 
    processWithdrawal, 
    setSelectedAccountForPassbook, 
    runInterestPosting,
    openTab
  } = useCoop();

  const safeSavings = savingsAccounts || [];
  const safeMembers = members || [];

  const [activeSubTab, setActiveSubTab] = useState<'deposit' | 'withdraw' | 'accounts_list' | 'interest_engine'>('deposit');

  React.useEffect(() => {
    if (activeSubKey === 'savings_deposit') setActiveSubTab('deposit');
    else if (activeSubKey === 'savings_withdraw') setActiveSubTab('withdraw');
    else if (activeSubKey === 'savings_interest') setActiveSubTab('interest_engine');
    else if (activeSubKey === 'savings_products' || activeSubKey === 'savings_accounts') setActiveSubTab('accounts_list');
  }, [activeSubKey]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(safeSavings[0]?.id || '');
  const [amount, setAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Bank_Transfer' | 'Collection_Agent'>('Cash');
  const [remarks, setRemarks] = useState<string>('');
  const [withdrawPaymentMethod, setWithdrawPaymentMethod] = useState<PaymentMethod>('cash');
  const [withdrawChequeData, setWithdrawChequeData] = useState<ChequeSelectorData | null>(null);
  const [withdrawPaymentValid, setWithdrawPaymentValid] = useState(true);
  const [withdrawBankAccountId, setWithdrawBankAccountId] = useState<string>('');
  const [withdrawBankAccounts, setWithdrawBankAccounts] = useState<any[]>([]);

  // Fetch bank accounts for cheque withdrawal payout
  useEffect(() => {
    Promise.all([
      fetchAccountingSettings('bank-accounts'),
      fetchAccountingSettings('banks'),
    ])
      .then(([accounts, banks]) => {
        const activeAccounts = accounts.filter((a: any) => a.isActive !== false);
        const bankMap = new Map(banks.map((b: any) => [b.id, b]));
        const enriched = activeAccounts.map((a: any) => ({
          ...a,
          bankName: bankMap.get(a.bankId)?.name || 'Unknown Bank',
        }));
        setWithdrawBankAccounts(enriched);
      })
      .catch(() => setWithdrawBankAccounts([]));
  }, []);

  const selectedAccount = safeSavings.find(a => a.id === selectedAccountId) || safeSavings[0];
  const selectedMember = safeMembers.find(m => m.id === selectedAccount?.memberId);

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid deposit amount.');
      return;
    }

    await processDeposit(selectedAccountId, numAmount, paymentMode, remarks || 'Cash Deposit at Teller Counter');
    setAmount('');
    setRemarks('');
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid withdrawal amount.');
      return;
    }

    if (selectedAccount && selectedAccount.balance - numAmount < selectedAccount.minBalance) {
      alert(`Cannot withdraw. Minimum balance of NPR ${selectedAccount.minBalance} must remain.`);
      return;
    }

    if (withdrawPaymentMethod === 'cheque_bank' && !withdrawPaymentValid) {
      alert('Please complete all cheque payment details.');
      return;
    }

    if (withdrawPaymentMethod === 'cheque_bank' && withdrawChequeData && withdrawBankAccountId) {
      await processWithdrawal(selectedAccountId, numAmount, remarks || 'Savings Withdrawal via Bank Cheque', {
        bankAccountId: withdrawBankAccountId,
        chequeLeafId: withdrawChequeData.chequeLeafId,
        payeeName: withdrawChequeData.payeeName,
        voucherDateBS: withdrawChequeData.chequeDateBs,
        voucherDateAD: withdrawChequeData.chequeDateAd,
      });
    } else {
      await processWithdrawal(selectedAccountId, numAmount, remarks || 'Cash Withdrawal at Teller Counter');
    }
    setAmount('');
    setRemarks('');
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800">
      
      {/* Module Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Savings & Teller Operations Desk</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <PiggyBank className="w-3.5 h-3.5 text-slate-500" />
            <span>Fast teller deposits, withdrawals, thermal passbook printing, and quarterly interest posting</span>
          </p>
        </div>
      </div>

      {/* TELLER DEPOSIT FORM */}
      {activeSubTab === 'deposit' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Form Card */}
          <div className="lg:col-span-2">
            <ExpandableFormCard
              title="Process Member Deposit Entry"
              subtitle="Updates member balance and posts double-entry GL voucher instantly"
              icon={<ArrowDownLeft className="w-5 h-5 text-emerald-400" />}
              badge={
                <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-2.5 py-1 rounded font-bold">
                  Counter Desk
                </span>
              }
              onSubmit={handleDepositSubmit}
              footerActions={
                <button
                  type="submit"
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition cursor-pointer shadow-lg text-xs"
                >
                  Post Deposit & Issue Voucher
                </button>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div className="space-y-1.5 md:col-span-2">
                  <FormLabelWithHelp 
                    label="Select Savings Account" 
                    required 
                    helpTitle="Savings Account Selection"
                    helpText="Choose the member account to credit. Account balance and interest product tier will be displayed on the right for teller verification."
                    example="SA-1002 (Regular Savings)"
                  />
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 font-mono text-xs focus:border-emerald-500 focus:outline-none shadow-xs"
                  >
                    {safeSavings.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.accountNo} — {s.memberName} ({s.productName} | NPR {s.balance.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <FormLabelWithHelp 
                    label="Deposit Amount (NPR)" 
                    required 
                    helpTitle="Deposit Value"
                    helpText="Enter the cash or transfer amount in NPR. Vault limits and transaction log notifications trigger automatically upon confirmation."
                    example="25,000"
                  />
                  <input
                    type="number"
                    required
                    min="10"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 25000"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-emerald-700 font-mono text-sm focus:border-emerald-500 focus:outline-none font-bold shadow-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <FormLabelWithHelp 
                    label="Payment Mode" 
                    required 
                    helpTitle="Transaction Channel"
                    helpText="Select Vault Cash for counter cash transactions, Bank Transfer for clearing cheques, or Collection Agent for daily route collector postings."
                    example="Vault Cash"
                  />
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 text-xs focus:border-emerald-500 focus:outline-none shadow-xs"
                  >
                    <option value="Cash">Vault Cash</option>
                    <option value="Bank_Transfer">Bank Wire / Account Transfer</option>
                    <option value="Collection_Agent">Daily Collection Agent Route</option>
                  </select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <FormLabelWithHelp 
                    label="Teller Remarks / Particulars" 
                    helpTitle="Transaction Narration"
                    helpText="Provide reference notes, deposit voucher slip number, or cheque particulars. This narration prints on the passbook statement and GL ledger."
                    example="Counter Deposit Slip #89120"
                  />
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Deposit slip details, cheque no, or remarks..."
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none shadow-xs"
                  />
                </div>

              </div>
            </ExpandableFormCard>
          </div>

          {/* Real-time Account & Signature Preview Panel */}
          {selectedAccount && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs">
              <h3 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">Account Verification Card</h3>
              
              <div className="space-y-2 text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-500">Account No:</span>
                  <span className="font-mono font-bold text-emerald-600">{selectedAccount.accountNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Member Name:</span>
                  <span className="font-bold text-slate-900">{selectedAccount.memberName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Product:</span>
                  <span className="text-amber-700 font-medium">{selectedAccount.productName} ({selectedAccount.interestRate}%)</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="text-slate-500">Current Balance:</span>
                  <span className="font-mono font-bold text-lg text-emerald-700">{formatNPR(selectedAccount.balance)}</span>
                </div>
              </div>

              {/* Photo & Signature Check */}
              {selectedMember && (
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Member Verification Photo:</span>
                  <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <ImageHoverPreview
                      src={selectedMember.photoUrl}
                      name={selectedMember.fullName}
                      subtext={selectedMember.memberNo}
                      badge={selectedMember.kycStatus}
                      sizeClass="w-12 h-12"
                    />
                    <div>
                      <div className="font-bold text-slate-900">{selectedMember.fullName}</div>
                      <div className="text-[10px] text-slate-500">Citizenship: {selectedMember.citizenshipNo}</div>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => setSelectedAccountForPassbook(selectedAccount)}
                className="w-full mt-2 py-2.5 bg-slate-100 hover:bg-slate-200 text-emerald-700 font-bold rounded-xl border border-slate-200 transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Preview Thermal Passbook</span>
              </button>
            </div>
          )}

        </div>
      )}

      {/* TELLER WITHDRAWAL FORM */}
      {activeSubTab === 'withdraw' && (
        <div className="max-w-3xl mx-auto">
          <ExpandableFormCard
            title="Process Member Cash Withdrawal"
            subtitle="Validates minimum balance constraint and deducts vault cash"
            icon={<ArrowUpRight className="w-5 h-5 text-rose-400" />}
            badge={
              <span className="text-xs bg-rose-950 text-rose-400 border border-rose-800 px-2.5 py-1 rounded font-bold">
                Teller Outflow
              </span>
            }
            onSubmit={handleWithdrawSubmit}
            footerActions={
              <button
                type="submit"
                className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition cursor-pointer shadow-lg text-xs"
              >
                Process Cash Withdrawal
              </button>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-slate-700 font-semibold">Select Account *</label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 font-mono text-xs focus:border-rose-500 focus:outline-none shadow-xs"
                >
                  {safeSavings.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.accountNo} — {s.memberName} (Bal: NPR {s.balance.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-slate-700 font-semibold">Withdrawal Amount (NPR) *</label>
                <input
                  type="number"
                  required
                  min="10"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 10000"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-rose-700 font-mono text-sm focus:border-rose-500 focus:outline-none font-bold shadow-xs"
                />
              </div>

              {withdrawPaymentMethod === 'cheque_bank' && (
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-slate-700 font-semibold">Payout Bank Account *</label>
                  <select
                    value={withdrawBankAccountId}
                    onChange={(e) => setWithdrawBankAccountId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 font-mono text-xs focus:border-rose-500 focus:outline-none shadow-xs"
                  >
                    <option value="">-- Select bank account --</option>
                    {withdrawBankAccounts.map((a: any) => (
                      <option key={a.id} value={a.glAccountId || a.id}>
                        {a.bankName} — {a.accountName} ({a.accountNumber})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="md:col-span-2">
                <PaymentMethodSelector
                  bankAccountId={withdrawBankAccountId}
                  amount={parseFloat(amount) || 0}
                  suggestedPayeeName={selectedAccount?.memberName}
                  allowedMethods={['cash', 'cheque_bank']}
                  onChange={({ method, chequeData, isValid }) => {
                    setWithdrawPaymentMethod(method);
                    setWithdrawChequeData(chequeData);
                    setWithdrawPaymentValid(isValid);
                  }}
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-slate-700 font-semibold">Remarks / Slip Details</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Cheque No or Withdrawal Slip details..."
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:border-rose-500 focus:outline-none shadow-xs"
                />
              </div>

            </div>
          </ExpandableFormCard>
        </div>
      )}

      {/* ALL ACCOUNTS GRID */}
      {activeSubTab === 'accounts_list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {safeSavings.map(s => (
            <div key={s.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-[0_4px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-emerald-700 text-sm">{s.accountNo}</span>
                <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-semibold">
                  {s.productName}
                </span>
              </div>

              <div className="text-xs space-y-1 text-slate-600">
                <div>Member: <span className="font-bold text-slate-900">{s.memberName}</span> ({s.memberNo})</div>
                <div>Interest Rate: <span className="text-amber-700 font-semibold">{s.interestRate}% p.a.</span></div>
                <div className="text-base font-bold text-emerald-700 font-mono mt-2">{formatNPR(s.balance)}</div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Opened: {s.openedDateBS} BS</span>
                <button
                  onClick={() => setSelectedAccountForPassbook(s)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-emerald-700 font-semibold rounded text-xs transition cursor-pointer flex items-center gap-1 border border-slate-200"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Passbook</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* INTEREST POSTING ENGINE */}
      {activeSubTab === 'interest_engine' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 text-xs max-w-3xl mx-auto text-center">
          <div className="p-3 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 w-12 h-12 mx-auto flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-900">Quarterly Savings Interest Batch Posting Engine</h2>
            <p className="text-slate-500 mt-1 max-w-md mx-auto">
              Calculates accrued quarterly interest across all active member savings accounts and automatically posts balanced double-entry GL journal vouchers.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 max-w-md mx-auto space-y-2 text-left">
            <div className="flex justify-between text-slate-700">
              <span>Eligible Accounts:</span>
              <span className="font-bold text-slate-900">{safeSavings.length} accounts</span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span>Period:</span>
              <span className="font-mono text-emerald-700 font-semibold">Quarter 1 (2083/84)</span>
            </div>
          </div>

          <button
            onClick={runInterestPosting}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-slate-800 font-bold rounded-xl transition cursor-pointer shadow-md text-xs inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Execute Batch Interest Calculation & GL Posting</span>
          </button>
        </div>
      )}

    </div>
  );
};
