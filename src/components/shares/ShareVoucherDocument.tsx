import React from 'react';
import { formatNumber } from '../../utils/nepaliCalendar';
import { numberToNepaliWords } from '../../utils/certificateTagEngine';
import type { OrganizationHeader } from '../../types/coop';

export type VoucherVariant = 'issue' | 'return' | 'transfer';

export interface VoucherEntry {
  accountId?: string;
  accountCode?: string;
  accountName: string;
  debit: number;
  credit: number;
  narration?: string | null;
}

interface Props {
  variant: VoucherVariant;
  voucherNo: string;
  transferNo?: string;
  dateBs: string;
  dateAd?: string;
  organization?: OrganizationHeader | null;
  fromMemberName?: string;
  fromMemberNo?: string;
  toMemberName?: string;
  toMemberNo?: string;
  memberName?: string;
  memberNo?: string;
  shareTypeName: string;
  numberOfShares: number;
  faceValuePerShare: number;
  totalAmount: number;
  remarks?: string | null;
  processedBy: string;
  entries: VoucherEntry[];
}

const TITLES: Record<VoucherVariant, { np: string; en: string }> = {
  issue: { np: 'शेयर खरिद भौचर', en: 'Share Purchase Voucher' },
  return: { np: 'शेयर फिर्ता भौचर', en: 'Share Return Voucher' },
  transfer: { np: 'शेयर नामसारी भौचर', en: 'Share Transfer Voucher' },
};

/**
 * A4 printable Nepali share voucher — भौचर. Renders the org letterhead,
 * voucher meta, party details (transferor/transferee or member), the Dr/Cr
 * table in Devanagari numerals, अक्षरूपी, and signature lines.
 * Print via printDocumentById('share-voucher-document', ...).
 */
export const ShareVoucherDocument: React.FC<Props> = ({
  variant, voucherNo, transferNo, dateBs, dateAd, organization,
  fromMemberName, fromMemberNo, toMemberName, toMemberNo,
  memberName, memberNo, shareTypeName, numberOfShares,
  faceValuePerShare, totalAmount, remarks, processedBy, entries,
}) => {
  const org = organization || {};
  const orgName = org.organizationName || 'सहकारी संस्था';
  const orgAddress =
    [org.municipality, org.wardNo ? `वडा नं. ${org.wardNo}` : null, org.district]
      .filter(Boolean)
      .join(', ') || org.address || '';
  const title = TITLES[variant];

  const debitTotal = entries.reduce((s, e) => s + Number(e.debit || 0), 0);
  const creditTotal = entries.reduce((s, e) => s + Number(e.credit || 0), 0);

  // Nepali particulars for each row based on variant + party names.
  const particulars = entries.map((e, i) => {
    const isDebit = Number(e.debit || 0) > 0;
    if (variant === 'transfer') {
      const name = isDebit ? fromMemberName : toMemberName;
      const role = isDebit ? 'फिर्ता' : 'खरिद';
      return `सेयर पूँजी खाता (${name} - ${role})`;
    }
    if (variant === 'issue') {
      return isDebit ? e.accountName : `सेयर पूँजी खाता (${memberName} - खरिद)`;
    }
    // return
    return isDebit ? `सेयर पूँजी खाता (${memberName} - फिर्ता)` : e.accountName;
  });

  return (
    <div id="share-voucher-document" className="bg-white text-slate-900 text-xs font-serif leading-relaxed">
      {/* Letterhead */}
      <div className="text-center border-b-4 border-slate-200 pb-3">
        <h1 className="text-2xl font-black tracking-tight uppercase">{orgName}</h1>
        <p className="text-[11px] text-slate-600 mt-1">{orgAddress}</p>
        {org.registrationNo && <p className="text-[10px] text-slate-500 mt-0.5">दर्ता नं. {org.registrationNo}{org.govtRegNo ? ` • ${org.govtRegNo}` : ''}</p>}
        {org.pan && <p className="text-[10px] text-slate-500">पान नं. {org.pan}</p>}
        <div className="border-t-2 border-slate-200 w-44 mx-auto mt-2" />
        <div className="mt-3 inline-block px-8 py-1.5 border-2 border-slate-200 font-bold font-mono text-[11px] uppercase tracking-[0.25em]">
          {title.en}
        </div>
        <div className="mt-1.5 font-bold text-[15px]">{title.np}</div>
      </div>

      {/* Meta row */}
      <div className="grid grid-cols-3 gap-4 mt-4">
        <div className="border-2 border-slate-300 p-2">
          <span className="block text-slate-500 text-[10px] font-bold uppercase tracking-widest">भौचर नं.</span>
          <span className="font-mono font-bold">{voucherNo}</span>
        </div>
        {transferNo && (
          <div className="border-2 border-slate-300 p-2">
            <span className="block text-slate-500 text-[10px] font-bold uppercase tracking-widest">नामसारी नं.</span>
            <span className="font-mono font-bold">{transferNo}</span>
          </div>
        )}
        <div className="border-2 border-slate-300 p-2">
          <span className="block text-slate-500 text-[10px] font-bold uppercase tracking-widest">मिति (BS)</span>
          <span className="font-mono font-bold">{dateBs}</span>
        </div>
        {dateAd && (
          <div className="border-2 border-slate-300 p-2">
            <span className="block text-slate-500 text-[10px] font-bold uppercase tracking-widest">मिति (AD)</span>
            <span className="font-mono">{dateAd}</span>
          </div>
        )}
      </div>

      {/* Party details */}
      {(variant === 'transfer'
        ? fromMemberName && toMemberName
        : memberName) && (
        <div className="mt-4 space-y-1.5 border-2 border-slate-300 p-3">
          {variant === 'transfer' ? (
            <>
              <div className="flex">
                <span className="w-52 shrink-0 font-semibold text-slate-600">सेयर दिने सदस्य (Transferor):</span>
                <span className="font-bold">{fromMemberName}</span>
                {fromMemberNo && <span className="text-slate-500 ml-1.5">({fromMemberNo})</span>}
              </div>
              <div className="flex">
                <span className="w-52 shrink-0 font-semibold text-slate-600">सेयर लिने सदस्य (Transferee):</span>
                <span className="font-bold">{toMemberName}</span>
                {toMemberNo && <span className="text-slate-500 ml-1.5">({toMemberNo})</span>}
              </div>
            </>
          ) : (
            <div className="flex">
              <span className="w-52 shrink-0 font-semibold text-slate-600">सदस्य (Member):</span>
              <span className="font-bold">{memberName}</span>
              {memberNo && <span className="text-slate-500 ml-1.5">({memberNo})</span>}
            </div>
          )}
          <div className="flex">
            <span className="w-52 shrink-0 font-semibold text-slate-600">सेयरको प्रकार (Class):</span>
            <span>{shareTypeName}</span>
          </div>
          <div className="flex">
            <span className="w-52 shrink-0 font-semibold text-slate-600">कित्ता संख्या (Shares):</span>
            <span className="font-bold">{formatNumber(numberOfShares)} कित्ता × रु. {formatNumber(faceValuePerShare)}</span>
          </div>
        </div>
      )}

      {/* Dr/Cr table */}
      <table className="w-full border-2 border-slate-200 mt-4 border-collapse">
        <thead>
          <tr className="bg-slate-100 border-b-2 border-slate-200">
            <th className="text-left p-2 w-10">क्र.सं.</th>
            <th className="text-left p-2">विवरण (Particulars)</th>
            <th className="text-right p-2 w-28">डेबिट (Dr.)</th>
            <th className="text-right p-2 w-28">क्रेडिट (Cr.)</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i} className="border-b border-slate-300">
              <td className="p-2 text-center">{formatNumber(i + 1)}</td>
              <td className="p-2 font-bold">{particulars[i]}</td>
              <td className="p-2 text-right font-mono">{Number(e.debit) > 0 ? formatNumber(Number(e.debit)) : '—'}</td>
              <td className="p-2 text-right font-mono">{Number(e.credit) > 0 ? formatNumber(Number(e.credit)) : '—'}</td>
            </tr>
          ))}
          <tr className="bg-slate-100 border-t-2 border-slate-200 font-bold">
            <td colSpan={2} className="p-2 text-right uppercase tracking-wide">कुल (Total):</td>
            <td className="p-2 text-right font-mono">{formatNumber(debitTotal)}</td>
            <td className="p-2 text-right font-mono">{formatNumber(creditTotal)}</td>
          </tr>
        </tbody>
      </table>

      {/* Amount in words */}
      <div className="border-2 border-slate-300 p-3 mt-4">
        <span className="block text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">अक्षरूपी</span>
        <p className="font-semibold">{numberToNepaliWords(totalAmount)}</p>
      </div>

      {/* Narration */}
      {remarks && (
        <div className="mt-2">
          <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">विवरण:</span>
          <p className="font-semibold mt-0.5">{remarks}</p>
        </div>
      )}

      {/* Signatures */}
      {variant === 'transfer' ? (
        <div className="grid grid-cols-3 gap-6 mt-12 text-center text-[11px] font-semibold text-slate-600">
          <div><div className="border-t-2 border-slate-500 pt-2">सेयर दिनेको सही</div><div className="font-normal text-slate-500 mt-0.5">{fromMemberName}</div></div>
          <div><div className="border-t-2 border-slate-500 pt-2">सेयर लिनेको सही</div><div className="font-normal text-slate-500 mt-0.5">{toMemberName}</div></div>
          <div><div className="border-t-2 border-slate-500 pt-2">प्रबन्धक / एकाउन्टेन्ट</div><div className="font-normal text-slate-500 mt-0.5">{processedBy}</div></div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6 mt-12 text-center text-[11px] font-semibold text-slate-600">
          <div><div className="border-t-2 border-slate-500 pt-2">प्राप्त गरेको / भुक्तानी गरेको सही</div><div className="font-normal text-slate-500 mt-0.5">{memberName}</div></div>
          <div><div className="border-t-2 border-slate-500 pt-2">प्रबन्धक / एकाउन्टेन्ट</div><div className="font-normal text-slate-500 mt-0.5">{processedBy}</div></div>
          <div><div className="border-t-2 border-slate-500 pt-2">मुनासिब / क्यासियर</div></div>
        </div>
      )}

      <p className="text-[9px] text-slate-500 text-center mt-6">
        यो कम्प्युटरद्वारा उत्पन्न भौचर हो। कम्प्युटर उत्पन्न भौचरमा लिखित सही अनिवार्य नहुने।
      </p>
    </div>
  );
};
