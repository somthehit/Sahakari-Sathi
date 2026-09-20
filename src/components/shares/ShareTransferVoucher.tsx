import React from 'react';
import type { ShareTransferDetail } from '../../types/coop';
import { ShareVoucherDocument } from './ShareVoucherDocument';

interface Props {
  detail: ShareTransferDetail;
}

/**
 * A4 printable Share Transfer Journal Voucher (शेयर नामसारी भौचर).
 * Renders the org letterhead, transferor/transferee details, Dr/Cr entry rows
 * in Devanagari numerals, amount-in-words and signature blocks.
 * Print via #share-transfer-voucher-document.
 */
export const ShareTransferVoucher: React.FC<Props> = ({ detail }) => {
  return (
    <div id="share-transfer-voucher-document">
      <ShareVoucherDocument
        variant="transfer"
        voucherNo={detail.voucherNo}
        transferNo={detail.transferNo}
        dateBs={detail.dateBs}
        dateAd={detail.dateAd}
        organization={detail.organization || null}
        fromMemberName={detail.fromMemberName}
        fromMemberNo={detail.fromMemberNo}
        toMemberName={detail.toMemberName}
        toMemberNo={detail.toMemberNo}
        shareTypeName={detail.shareTypeName}
        numberOfShares={detail.numberOfShares}
        faceValuePerShare={detail.faceValuePerShare}
        totalAmount={detail.totalAmount}
        remarks={detail.remarks}
        processedBy={detail.processedBy}
        entries={detail.entries}
      />
    </div>
  );
};
