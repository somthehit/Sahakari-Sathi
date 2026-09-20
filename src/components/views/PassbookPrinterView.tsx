import React from 'react';
import { PassbookWorkspace } from '../passbook/PassbookWorkspace';

/**
 * Full-page passbook entry point. The entire subsystem — continuation printing,
 * book issuance/renewal, print records, and layout calibration — now lives in the
 * consolidated PassbookWorkspace, shared verbatim with the quick-action modal.
 */
export const PassbookPrinterView: React.FC = () => {
  return (
    <div className="w-full bg-slate-50">
      <PassbookWorkspace />
    </div>
  );
};
