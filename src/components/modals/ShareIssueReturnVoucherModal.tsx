import React from 'react';
import { X, Printer, FileText, CheckCircle2 } from 'lucide-react';
import { printDocumentById } from '../../utils/printDocument';
import { ShareVoucherDocument } from '../shares/ShareVoucherDocument';
import type { ShareTransactionResult } from '../../api/shares';

interface Props {
  result: ShareTransactionResult | null;
  onClose: () => void;
}

/**
 * Post-issue / post-return print dialog. Renders the A4 Nepali share
 * purchase/return voucher (शेयर खरिद/फिर्ता भौचर) for immediate printing.
 */
export const ShareIssueReturnVoucherModal: React.FC<Props> = ({ result, onClose }) => {
  if (!result) return null;

  const variant = result.transactionType === 'RETURN' ? 'return' : 'issue';

  const handlePrint = () => {
    printDocumentById('share-voucher-document', `Voucher_${result.voucherNo}`);
  };

  const memberLabel = `${result.memberName}${result.memberNo ? ` (${result.memberNo})` : ''}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 sm:p-6" onClick={onClose}>
      <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {variant === 'return' ? 'Share Return Voucher' : 'Share Purchase Voucher'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {result.voucherNo} • {memberLabel} • {result.numberOfShares} shares • रु. {result.totalAmount.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex items-center justify-between gap-2 shrink-0 no-print flex-wrap">
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
            <button className="px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 bg-emerald-600 text-white cursor-default">
              <FileText className="w-3.5 h-3.5" /> Voucher
            </button>
          </div>
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-white text-slate-800 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer hover:opacity-90"
          >
            <Printer className="w-3.5 h-3.5" /> Print Voucher
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200 print:bg-white">
          <ShareVoucherDocument
            variant={variant}
            voucherNo={result.voucherNo}
            dateBs={result.dateBs || ''}
            dateAd={result.dateAd || ''}
            organization={result.organization || null}
            memberName={result.memberName}
            memberNo={result.memberNo}
            shareTypeName={result.shareType}
            numberOfShares={result.numberOfShares}
            faceValuePerShare={result.faceValuePerShare || 0}
            totalAmount={result.totalAmount}
            processedBy={result.memberName}
            entries={(result.entries || []).map(e => ({
              accountId: e.accountId,
              accountCode: e.accountCode,
              accountName: e.accountName,
              debit: e.debit,
              credit: e.credit,
              narration: e.narration,
            }))}
          />
        </div>
      </div>
    </div>
  );
};
