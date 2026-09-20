import React, { useEffect, useState } from 'react';
import { X, Printer, FileText, Award, Loader2 } from 'lucide-react';
import { fetchShareTransferDetail } from '../../api/shares';
import { printDocumentById } from '../../utils/printDocument';
import { ShareTransferVoucher } from '../shares/ShareTransferVoucher';
import { ShareTransferCertificate } from '../shares/ShareTransferCertificate';
import type { ShareTransferResult, ShareTransferDetail } from '../../types/coop';

interface Props {
  transfer: ShareTransferResult | null;
  onClose: () => void;
}

type DocTab = 'voucher' | 'certificate';

/**
 * Post-transfer print dialog. Renders the A4 Journal Voucher and the formal
 * Nepali Transfer Certificate, each printable via the shared printDocumentById.
 */
export const ShareTransferPrintModal: React.FC<Props> = ({ transfer, onClose }) => {
  const [tab, setTab] = useState<DocTab>('voucher');
  const [detail, setDetail] = useState<ShareTransferDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!transfer?.transferId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchShareTransferDetail(transfer.transferId)
      .then(d => {
        if (!cancelled) setDetail(d);
      })
      .catch(err => {
        if (!cancelled) setError(err?.response?.data?.error ?? err?.message ?? 'Failed to load transfer document');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [transfer?.transferId]);

  if (!transfer) return null;

  const handlePrint = () => {
    if (tab === 'voucher') {
      printDocumentById('share-transfer-voucher-document', `Voucher_${transfer.voucherNo}`);
    } else {
      printDocumentById('share-transfer-certificate-document', `Certificate_${transfer.transferNo}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 sm:p-6" onClick={onClose}>
      <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Transfer Documents</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {transfer.transferNo} • {transfer.fromMemberName} → {transfer.toMemberName} • {transfer.numberOfShares} shares
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex items-center justify-between gap-2 shrink-0 no-print flex-wrap">
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setTab('voucher')}
              className={`px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition ${ tab === 'voucher' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 ' }`}
            >
              <FileText className="w-3.5 h-3.5" /> Journal Voucher
            </button>
            <button
              onClick={() => setTab('certificate')}
              className={`px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition ${ tab === 'certificate' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100 ' }`}
            >
              <Award className="w-3.5 h-3.5" /> Transfer Certificate
            </button>
          </div>
          <button
            onClick={handlePrint}
            disabled={loading || !detail}
            className="px-3 py-1.5 bg-white text-slate-800 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" /> Print {tab === 'voucher' ? 'Voucher' : 'Certificate'}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200 print:bg-white">
          {loading && (
            <div className="flex items-center justify-center py-16 text-slate-500 text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading document…
            </div>
          )}
          {!loading && error && (
            <div className="bg-red-50 /40 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">{error}</div>
          )}
          {!loading && !error && detail && (
            tab === 'voucher' ? <ShareTransferVoucher detail={detail} /> : <ShareTransferCertificate detail={detail} />
          )}
          {!loading && !error && !detail && (
            <div className="text-center py-16 text-slate-500 text-xs">No document data available.</div>
          )}
        </div>
      </div>
    </div>
  );
};
