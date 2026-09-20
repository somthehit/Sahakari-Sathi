import React from 'react';
import { formatNPR, formatBSDate } from '../../utils/nepaliCalendar';
import { numberToNepaliWords } from '../../utils/certificateTagEngine';
import type { ShareTransferDetail } from '../../types/coop';

interface Props {
  detail: ShareTransferDetail;
}

/**
 * A4 printable Share Transfer Certificate (दाखेल खारेज / सेयर हस्तान्तरण प्रमाणपत्र).
 * Formal Nepali legal certificate with member details, share particulars,
 * amount-in-words and signature blocks. Print via #share-transfer-certificate-document.
 */
export const ShareTransferCertificate: React.FC<Props> = ({ detail }) => {
  const org = detail.organization || {};
  const orgNameNp = org.organizationName || 'सहकारी संस्था';
  const orgAddress =
    [org.municipality, org.wardNo ? `वडा नं. ${org.wardNo}` : null, org.district]
      .filter(Boolean)
      .join(', ') || org.address || '';

  return (
    <div id="share-transfer-certificate-document" className="bg-white text-slate-900 text-xs font-serif leading-relaxed">
      {/* Ornate frame */}
      <div className="border-4 border-double border-slate-200 p-1">
        <div className="border border-slate-200 p-4 sm:p-6">

          {/* Letterhead */}
          <div className="text-center">
            <h1 className="text-2xl font-black uppercase tracking-tight">{orgNameNp}</h1>
            <p className="text-[11px] text-slate-600 mt-1">{orgAddress}</p>
            {org.registrationNo && <p className="text-[10px] text-slate-500 mt-0.5">दर्ता नं. {org.registrationNo}{org.govtRegNo ? ` • ${org.govtRegNo}` : ''}</p>}
            <div className="w-48 h-0.5 bg-white mx-auto mt-3" />
          </div>

          {/* Title */}
          <div className="text-center mt-4">
            <div className="inline-block px-6 py-1.5 border-2 border-slate-200 font-black tracking-[0.2em] text-[13px] uppercase">
              सेयर हस्तान्तरण प्रमाणपत्र
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold">Share Transfer Certificate</div>
          </div>

          {/* Doc numbers */}
          <div className="grid grid-cols-3 gap-3 mt-5 text-[11px]">
            <div className="border border-slate-300 px-2 py-1.5">
              <span className="block text-slate-500 text-[9px] font-bold uppercase tracking-widest">Certificate No.</span>
              <span className="font-mono font-bold">{detail.certificateNo || '—'}</span>
            </div>
            <div className="border border-slate-300 px-2 py-1.5">
              <span className="block text-slate-500 text-[9px] font-bold uppercase tracking-widest">Transfer No.</span>
              <span className="font-mono font-bold">{detail.transferNo}</span>
            </div>
            <div className="border border-slate-300 px-2 py-1.5">
              <span className="block text-slate-500 text-[9px] font-bold uppercase tracking-widest">Miti (BS/AD)</span>
              <span className="font-mono">{formatBSDate(detail.dateBs)} / {detail.dateAd}</span>
            </div>
          </div>

          {/* Body — formal Nepali */}
          <div className="mt-5 space-y-3 text-justify leading-relaxed">
            <p>
              <b>श्री {detail.fromMemberName}</b> (सदस्य नं. {detail.fromMemberNo}) ले आफ्नो स्वामित्वमा रहेको{' '}
              <b>{detail.numberOfShares} कित्ता</b> {detail.shareTypeName} सेयर (अंकित मूल्य रु.{' '}
              {formatNPR(detail.faceValuePerShare)} प्रति कित्ता) श्री{' '}
              <b>{detail.toMemberName}</b> (सदस्य नं. {detail.toMemberNo}) लाई हस्तान्तरण गरेको कुरा यस संस्थाको
              नियमानुसार प्रमाणित गरिन्छ।
            </p>
            <p>
              सो कार्यानुसार हस्तान्तरणकर्ताको नामबाट {detail.numberOfShares} कित्ता सेयर खारेज गरी प्रापकको
              नाममा दाखिल खारेज गरी नयाँ सेयर प्रमाणपत्र जारी गरिएको छ। यस हस्तान्तरणको कुल रकम रु.{' '}
              {formatNPR(detail.totalAmount)} (अक्षरूपी: {numberToNepaliWords(detail.totalAmount)}) रहेको छ।
            </p>
            {detail.remarks && <p>टिप्पणी: {detail.remarks}</p>}
          </div>

          {/* Share particulars table */}
          <table className="w-full border border-slate-400 mt-5 border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 p-1.5 text-left">विवरण (Particulars)</th>
                <th className="border border-slate-400 p-1.5 text-right">रकम (रु.)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-300 p-1.5">हस्तान्तरित सेयर ({detail.shareTypeName}) — {detail.numberOfShares} कित्ता × रु. {formatNPR(detail.faceValuePerShare)}</td>
                <td className="border border-slate-300 p-1.5 text-right font-mono font-bold">{formatNPR(detail.totalAmount)}</td>
              </tr>
            </tbody>
          </table>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-8 mt-14 text-center text-[11px] font-semibold text-slate-600">
            <div><div className="border-t-2 border-slate-500 pt-2">हस्तान्तरणकर्ता (Transferor)</div><div className="font-normal text-slate-500 mt-0.5">{detail.fromMemberName}</div></div>
            <div><div className="border-t-2 border-slate-500 pt-2">अध्यक्ष (Chairman)</div></div>
            <div><div className="border-t-2 border-slate-500 pt-2">प्रबन्धक / सचिव (Manager/Secretary)</div></div>
          </div>

          <p className="text-[9px] text-slate-500 text-center mt-6">
            जारी मिति: {formatBSDate(detail.dateBs)} • कर्मचारी: {detail.processedBy}
          </p>

        </div>
      </div>
    </div>
  );
};
