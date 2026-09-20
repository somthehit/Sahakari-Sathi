import React, { useState, useEffect } from 'react';
import { ChequePaymentSelector, type ChequeSelectorData } from './ChequePaymentSelector';

export type PaymentMethod = 'cash' | 'cheque_bank' | 'bank_transfer' | 'mobile_wallet' | 'savings_transfer';

interface PaymentMethodSelectorProps {
  bankAccountId?: string;
  amount: number;
  suggestedPayeeName?: string;
  allowedMethods?: PaymentMethod[];
  onChange: (result: {
    method: PaymentMethod;
    chequeData: ChequeSelectorData | null;
    isValid: boolean;
  }) => void;
}

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'नगद (Cash)' },
  { value: 'savings_transfer', label: 'बचत खाता (Savings Account)' },
  { value: 'cheque_bank', label: 'चेक/बैंक (Cheque/Bank)' },
  { value: 'bank_transfer', label: 'बैंक ट्रान्सफर (Bank Transfer)' },
  { value: 'mobile_wallet', label: 'मोबाइल वालेट (eSewa/Khalti)' },
];

export function PaymentMethodSelector({
  bankAccountId,
  amount,
  suggestedPayeeName,
  allowedMethods,
  onChange,
}: PaymentMethodSelectorProps) {
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [chequeData, setChequeData] = useState<ChequeSelectorData | null>(null);

  const options = allowedMethods
    ? PAYMENT_METHOD_OPTIONS.filter((o) => allowedMethods.includes(o.value))
    : PAYMENT_METHOD_OPTIONS;

  useEffect(() => {
    const isValid = method === 'cheque_bank' ? chequeData !== null : true;
    onChange({ method, chequeData, isValid });
  }, [method, chequeData]);

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          Payment Method <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setMethod(opt.value);
                if (opt.value !== 'cheque_bank') setChequeData(null);
              }}
              className={`py-2.5 rounded-xl text-xs font-bold border-2 transition cursor-pointer ${
                method === opt.value
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {method === 'cheque_bank' && bankAccountId && (
        <ChequePaymentSelector
          bankAccountId={bankAccountId}
          amount={amount}
          suggestedPayeeName={suggestedPayeeName}
          onValidChange={setChequeData}
        />
      )}

      {method === 'cheque_bank' && !bankAccountId && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Select a bank account first to use cheque payment.
        </div>
      )}
    </div>
  );
}
