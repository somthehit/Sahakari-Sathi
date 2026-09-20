import React, { useEffect, useRef } from 'react';
import { X, Printer, CheckCircle2, Landmark } from 'lucide-react';
import type { DisbursementResult } from '../../api/loanServicing';
import { useAuthStore } from '../../stores/authStore';

interface Props {
  result: DisbursementResult;
  onClose: () => void;
}

export const DisbursementVoucherModal: React.FC<Props> = ({ result, onClose }) => {
  const orgName = useAuthStore((s) => s.user?.organizationName || 'Sahakari Sathi');
  const autoPrintDone = useRef(false);

  const handlePrint = (copyLabel: string) => {
    const content = document.getElementById(`disbursement-voucher-${copyLabel.replace(/\s/g, '')}`);
    if (!content) { window.print(); return; }

    const printWindow = window.open('', '_blank', 'width=850,height=950');
    if (!printWindow) { window.print(); return; }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Disbursement Voucher - ${result.voucherNo} - ${copyLabel}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            body { font-family: system-ui, -apple-system, sans-serif; background: #ffffff; color: #0f172a; padding: 20px; }
            .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
          </style>
        </head>
        <body class="bg-white p-4">
          <div class="max-w-xl mx-auto bg-white">
            ${content.innerHTML}
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => { window.print(); window.close(); }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  useEffect(() => {
    if (autoPrintDone.current) return;
    autoPrintDone.current = true;
    const timer = setTimeout(() => {
      handlePrint('Member Copy');
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const renderVoucher = (copyLabel: string) => (
    <div id={`disbursement-voucher-${copyLabel.replace(/\s/g, '')}`} className="space-y-4 text-xs">
      {/* Header */}
      <div className="text-center border-b-2 border-blue-600 pb-3">
        <div className="text-[10px] text-slate-500 uppercase tracking-widest">{orgName}</div>
        <h2 className="text-base font-extrabold text-blue-800 mt-0.5">Loan Disbursement Voucher</h2>
        <div className="text-[10px] text-slate-500 mt-0.5">{result.branchName} • {result.branchAddress}</div>
        <div className="inline-block mt-2 px-4 py-1 border border-blue-300 rounded text-blue-700 font-mono text-[10px] font-bold uppercase tracking-widest">
          {copyLabel}
        </div>
      </div>

      {/* Voucher Info */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="text-[10px] text-slate-500 uppercase font-semibold">Voucher No</div>
          <div className="font-mono font-bold text-blue-700">{result.voucherNo}</div>
        </div>
        <div className="space-y-1">
          <div className="text-[10px] text-slate-500 uppercase font-semibold">Date (BS)</div>
          <div className="font-mono font-bold">{result.dateBs}</div>
        </div>
        <div className="space-y-1">
          <div className="text-[10px] text-slate-500 uppercase font-semibold">Date (AD)</div>
          <div className="font-mono font-bold">{result.dateAd}</div>
        </div>
        <div className="space-y-1">
          <div className="text-[10px] text-slate-500 uppercase font-semibold">Disbursed By</div>
          <div className="font-bold">{result.disbursedBy}</div>
        </div>
      </div>

      {/* Member & Loan Info */}
      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Member</div>
            <div className="font-bold">{result.memberName}</div>
            <div className="font-mono text-slate-600">{result.memberNo}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Loan Account</div>
            <div className="font-mono font-bold text-blue-700">{result.loanNo}</div>
            <div className="text-slate-600">Maturity: {result.maturityDateBs}</div>
          </div>
        </div>
      </div>

      {/* Amount Breakdown */}
      <div className="border-2 border-blue-200 rounded-lg overflow-hidden">
        <div className="bg-blue-600 text-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider">
          Disbursement Breakdown
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-blue-50 border-b border-blue-200">
              <th className="text-left px-3 py-1.5 font-bold text-blue-900">Description</th>
              <th className="text-right px-3 py-1.5 font-bold text-blue-900">Amount (NPR)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="px-3 py-1.5 text-slate-600">Loan Principal</td>
              <td className="px-3 py-1.5 text-right font-mono font-bold text-blue-700">{result.principal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
            {result.processingFee > 0 && (
              <tr className="border-b border-slate-100">
                <td className="px-3 py-1.5 text-slate-600">Processing Fee</td>
                <td className="px-3 py-1.5 text-right font-mono font-bold text-amber-700">({result.processingFee.toLocaleString(undefined, { minimumFractionDigits: 2 })})</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-blue-50 border-t-2 border-blue-300 font-bold">
              <td className="px-3 py-2 text-blue-900">Net Disbursed</td>
              <td className="px-3 py-2 text-right font-mono text-blue-900 text-sm">{result.netDisbursed.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Loan Terms */}
      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Monthly EMI</div>
            <div className="font-mono font-bold text-blue-700 text-sm">{result.monthlyEmi.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Total Interest</div>
            <div className="font-mono font-bold text-amber-700 text-sm">{result.totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-semibold">Installments</div>
            <div className="font-mono font-bold text-slate-900 text-sm">{result.installmentCount}</div>
          </div>
        </div>
      </div>

      {/* Cheque Info */}
      {result.chequeLeaf && (
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-blue-800">
            <Landmark className="w-3.5 h-3.5" />
            Bank Cheque: {result.chequeLeaf.chequeNumber}
          </div>
        </div>
      )}

      {/* GL Journal Entries */}
      {result.glEntries && result.glEntries.length > 0 && (
        <div className="border-2 border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-700 text-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between">
            <span>General Ledger — Journal Entries</span>
            <span className="font-mono">{result.voucherNo}</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-1.5 font-bold text-slate-700">Account</th>
                <th className="text-right px-3 py-1.5 font-bold text-slate-700 w-24">Debit (NPR)</th>
                <th className="text-right px-3 py-1.5 font-bold text-slate-700 w-24">Credit (NPR)</th>
              </tr>
            </thead>
            <tbody>
              {result.glEntries.map((entry, idx) => (
                <tr key={idx} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-1.5">
                    <div className="font-semibold text-slate-800">{entry.accountName}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{entry.accountCode}</div>
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono font-bold text-red-700">
                    {entry.debit > 0 ? entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-700">
                    {entry.credit > 0 ? entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                <td className="px-3 py-2 text-slate-800">Total</td>
                <td className="px-3 py-2 text-right font-mono text-red-800">
                  {result.glEntries.reduce((s, e) => s + e.debit, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-3 py-2 text-right font-mono text-emerald-800">
                  {result.glEntries.reduce((s, e) => s + e.credit, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="grid grid-cols-3 gap-4 pt-6 text-[10px] text-slate-500 text-center">
        <div>
          <div className="border-t border-slate-400 pt-1.5 mt-6 font-semibold">Prepared By</div>
          <div className="mt-0.5 font-bold text-slate-700">{result.disbursedBy}</div>
        </div>
        <div>
          <div className="border-t border-slate-400 pt-1.5 mt-6 font-semibold">Authorized Signature</div>
          <div className="mt-0.5 font-bold text-slate-700">&nbsp;</div>
        </div>
        <div>
          <div className="border-t border-slate-400 pt-1.5 mt-6 font-semibold">Member Signature</div>
          <div className="mt-0.5 font-bold text-slate-700">&nbsp;</div>
        </div>
      </div>

      {/* Print timestamp */}
      <div className="text-center text-[9px] text-slate-400 pt-2">
        Printed: {new Date().toLocaleString()} • This is a computer-generated voucher.
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-sm text-slate-900">Disbursement Posted Successfully</h3>
              <p className="text-[11px] text-slate-500">Voucher: {result.voucherNo}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Summary */}
        <div className="p-4 bg-blue-50 border-b border-blue-100">
          <div className="text-center">
            <div className="text-[10px] text-blue-600 uppercase font-semibold">Amount Disbursed</div>
            <div className="text-2xl font-extrabold text-blue-800 font-mono mt-0.5">
              NPR {result.netDisbursed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-blue-700 mt-1">
              to {result.memberName} ({result.loanNo})
            </div>
          </div>
        </div>

        {/* Print Buttons */}
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handlePrint('Member Copy')}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition cursor-pointer shadow-sm text-xs"
            >
              <Printer className="w-4 h-4" />
              Print Member Copy
            </button>
            <button
              onClick={() => handlePrint('Office Copy')}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl transition cursor-pointer shadow-sm text-xs"
            >
              <Printer className="w-4 h-4" />
              Print Office Copy
            </button>
          </div>

          {/* Hidden printable vouchers */}
          <div className="hidden">
            {renderVoucher('Member Copy')}
            {renderVoucher('Office Copy')}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition cursor-pointer text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
