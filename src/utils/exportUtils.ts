import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface ExportColumn {
  header: string;
  dataKey: string;
}

/**
 * Export tabular data to a formatted Excel file (.xlsx)
 */
export const exportToExcel = (
  filename: string,
  sheetName: string,
  headers: string[],
  dataRows: (string | number)[][]
) => {
  const worksheetData = [headers, ...dataRows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Auto-fit column widths
  const colWidths = headers.map((h, colIndex) => {
    let maxLen = h.toString().length;
    dataRows.forEach(row => {
      const cellVal = row[colIndex] ? row[colIndex].toString() : '';
      if (cellVal.length > maxLen) maxLen = cellVal.length;
    });
    return { wch: Math.min(Math.max(maxLen + 3, 12), 40) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || 'Report');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

/**
 * Export tabular data to a beautifully formatted PDF document
 */
export const exportToPdf = (
  filename: string,
  title: string,
  subtitle: string,
  headers: string[],
  dataRows: (string | number)[][]
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Header Banner
  doc.setFillColor(0, 97, 48); // #006130 Sahakari Emerald
  doc.rect(0, 0, 210, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SahakariSathi CBS - Cooperative Management System', 14, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, 210 - 14, 12, { align: 'right' });

  // Document Title & Subtitle
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 32);

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(subtitle, 14, 38);
  }

  const startY = subtitle ? 44 : 38;

  // Render Table
  autoTable(doc, {
    startY,
    head: [headers],
    body: dataRows,
    theme: 'grid',
    headStyles: {
      fillColor: [0, 97, 48],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // Slate-50
    },
    margin: { left: 14, right: 14, bottom: 20 },
    didDrawPage: (data) => {
      // Footer page number
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount} | Confidential - Internal Cooperative Document`,
        14,
        297 - 10
      );
    },
  });

  doc.save(`${filename}.pdf`);
};

/**
 * Export a comprehensive Member 360° Profile PDF with all member details
 */
export const exportMemberProfilePdf = (opts: {
  memberNo: string;
  fullName: string;
  nameNepali?: string;
  citizenshipNo: string;
  phone: string;
  email?: string;
  joinedDate?: string;
  kycStatus: string;
  membershipType: string;
  gender?: string;
  dobBS?: string;
  dobAD?: string;
  bloodGroup?: string;
  maritalStatus?: string;
  photoUrl?: string;
  address?: string;
  district?: string;
  permProvince?: string;
  permDistrict?: string;
  permMunicipality?: string;
  permWard?: string;
  permTole?: string;
  tempProvince?: string;
  tempDistrict?: string;
  tempMunicipality?: string;
  tempWard?: string;
  tempTole?: string;
  secondaryPhone?: string;
  fatherName?: string;
  motherName?: string;
  grandfatherName?: string;
  spouseName?: string;
  nomineeName?: string;
  nomineeRelation?: string;
  nomineePhone?: string;
  nomineeCitizenshipNo?: string;
  occupation?: string;
  employerName?: string;
  annualIncome?: string;
  sourceOfFunds?: string;
  isPEP?: boolean;
  pepDetails?: string;
  groupName?: string;
  memberCategory?: string;
  totalShares: number;
  shareAmount: number;
  totalSavingsBalance: number;
  totalLoanBalance: number;
  educationLevel?: string;
  dependentsCount?: string | number;
  guardianName?: string;
  guardianRelation?: string;
  accounts?: { type: string; accountNo: string; productName: string; balance: number; status: string }[];
  // Cooperative info
  orgName?: string;
  orgAddress?: string;
  orgPhone?: string;
  orgEmail?: string;
  orgRegNo?: string;
  // Document images
  citizenshipFrontUrl?: string;
  citizenshipBackUrl?: string;
  signatureUrl?: string;
  // Additional member documents from member_documents table
  additionalDocs?: { fileName: string; fileUrl: string; documentType: string; mimeType?: string; uploadedAt?: string }[];
}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const GREEN = [0, 97, 48] as [number, number, number];
  const SLATE_800 = [30, 41, 59] as [number, number, number];
  const SLATE_500 = [100, 116, 139] as [number, number, number];
  const SLATE_200 = [226, 232, 240] as [number, number, number];
  const SLATE_50 = [248, 250, 252] as [number, number, number];
  const EMERALD = [16, 185, 129] as [number, number, number];
  const WHITE = [255, 255, 255] as [number, number, number];

  let y = 0;
  const pageW = 210;
  const margin = 14;
  const contentW = pageW - 2 * margin;

  // === HEADER BANNER ===
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pageW, 32, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const coopName = opts.orgName || 'SahakariSathi CBS';
  doc.text(coopName, margin, 11);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  const coopDetails = [opts.orgAddress, opts.orgPhone && `Ph: ${opts.orgPhone}`, opts.orgEmail, opts.orgRegNo && `Reg: ${opts.orgRegNo}`].filter(Boolean).join('  |  ');
  if (coopDetails) doc.text(coopDetails, margin, 16);
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - margin, 11, { align: 'right' });
  doc.setFontSize(9);
  doc.text('Member 360° Profile Statement', margin, opts.orgAddress || opts.orgPhone || opts.orgEmail || opts.orgRegNo ? 23 : 21);
  y = opts.orgAddress || opts.orgPhone || opts.orgEmail || opts.orgRegNo ? 38 : 34;

  // === MEMBER HEADER ===
  doc.setFillColor(...SLATE_50);
  doc.roundedRect(margin, y, contentW, 22, 2, 2, 'F');
  doc.setDrawColor(...SLATE_200);
  doc.roundedRect(margin, y, contentW, 22, 2, 2, 'S');

  // Member photo (PP size)
  if (opts.photoUrl) {
    try {
      doc.addImage(opts.photoUrl, 'JPEG', pageW - margin - 16, y + 2, 14, 14);
      doc.setDrawColor(...SLATE_200);
      doc.roundedRect(pageW - margin - 16, y + 2, 14, 14, 1, 1, 'S');
    } catch {}
  }

  doc.setTextColor(...GREEN);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(opts.fullName, margin + 4, y + 7);
  if (opts.nameNepali) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_500);
    doc.text(`(${opts.nameNepali})`, margin + 4 + doc.getTextWidth(opts.fullName) + 3, y + 7);
  }

  doc.setFontSize(8);
  doc.setTextColor(...SLATE_500);
  doc.setFont('helvetica', 'normal');
  const memberLine = `Member No: ${opts.memberNo}  |  Citizenship: ${opts.citizenshipNo}  |  Phone: ${opts.phone}  |  Joined: ${opts.joinedDate || '-'}`;
  doc.text(memberLine, margin + 4, y + 13);

  doc.setFontSize(7);
  doc.text(`KYC: ${opts.kycStatus}  |  Type: ${opts.membershipType}  |  Status: Active`, margin + 4, y + 16.5);
  y += 26;

  // === FINANCIAL SUMMARY CARDS ===
  const cardW = (contentW - 8) / 3;
  const cards = [
    { label: 'Total Share Capital', value: `${opts.totalShares} Shares`, sub: `Valuation: Rs. ${(opts.shareAmount || 0).toLocaleString()}`, color: EMERALD },
    { label: 'Total Savings Balance', value: `Rs. ${(opts.totalSavingsBalance || 0).toLocaleString()}`, sub: '', color: SLATE_800 },
    { label: 'Outstanding Loans', value: `Rs. ${(opts.totalLoanBalance || 0).toLocaleString()}`, sub: '', color: SLATE_800 },
  ];

  cards.forEach((c, i) => {
    const cx = margin + i * (cardW + 4);
    doc.setFillColor(...WHITE);
    doc.roundedRect(cx, y, cardW, 16, 2, 2, 'F');
    doc.setDrawColor(...SLATE_200);
    doc.roundedRect(cx, y, cardW, 16, 2, 2, 'S');

    doc.setFontSize(7);
    doc.setTextColor(...SLATE_500);
    doc.setFont('helvetica', 'normal');
    doc.text(c.label, cx + 3, y + 5);

    doc.setFontSize(10);
    doc.setTextColor(...c.color);
    doc.setFont('helvetica', 'bold');
    doc.text(c.value, cx + 3, y + 11);

    if (c.sub) {
      doc.setFontSize(6);
      doc.setTextColor(...SLATE_500);
      doc.setFont('helvetica', 'normal');
      doc.text(c.sub, cx + 3, y + 14.5);
    }
  });
  y += 20;

  // Helper: section header
  const drawSectionHeader = (num: string, label: string) => {
    doc.setFillColor(...GREEN);
    doc.roundedRect(margin, y, contentW, 7, 1, 1, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`${num}. ${label}`, margin + 3, y + 5);
    y += 9;
  };

  // Helper: key-value row
  const drawKV = (items: { label: string; value: string }[], rowY?: number) => {
    const ry = rowY || y;
    const colW = contentW / items.length;
    items.forEach((item, i) => {
      const cx = margin + i * colW;
      doc.setFontSize(6.5);
      doc.setTextColor(...SLATE_500);
      doc.setFont('helvetica', 'normal');
      doc.text(item.label + ':', cx, ry);
      doc.setFontSize(7.5);
      doc.setTextColor(...SLATE_800);
      doc.setFont('helvetica', 'bold');
      doc.text(item.value || '-', cx, ry + 3.5);
    });
    if (!rowY) y += 8;
  };

  const drawKVPair = (items: { label: string; value: string }[]) => {
    const colW = contentW / items.length;
    items.forEach((item, i) => {
      const cx = margin + i * colW;
      doc.setFontSize(6.5);
      doc.setTextColor(...SLATE_500);
      doc.setFont('helvetica', 'normal');
      doc.text(item.label + ':', cx, y);
      doc.setFontSize(7.5);
      doc.setTextColor(...SLATE_800);
      doc.setFont('helvetica', 'bold');
      doc.text(item.value || '-', cx, y + 3.5);
    });
    y += 8;
  };

  // === SECTION 1: PERSONAL & IDENTITY ===
  drawSectionHeader('1', 'PERSONAL & IDENTITY DETAILS');
  drawKV([
    { label: 'Full Name (English)', value: opts.fullName },
    { label: 'Full Name (Nepali)', value: opts.nameNepali || '-' },
    { label: 'Gender & Blood Group', value: `${opts.gender || '-'} ${opts.bloodGroup ? '• ' + opts.bloodGroup : ''}` },
  ]);
  drawKV([
    { label: 'Date of Birth (BS)', value: opts.dobBS ? `${opts.dobBS} BS` : '-' },
    { label: 'Date of Birth (AD)', value: opts.dobAD ? `${opts.dobAD} AD` : '-' },
    { label: 'Marital Status', value: opts.maritalStatus || '-' },
  ]);
  drawKV([
    { label: 'Citizenship No', value: opts.citizenshipNo },
    { label: 'Issue District', value: opts.district || '-' },
    { label: 'Citizenship Issue Date', value: opts.joinedDate || '-' },
  ]);
  y += 2;

  // === SECTION 2: CONTACT & ADDRESSES ===
  drawSectionHeader('2', 'CONTACT & ADDRESSES');
  drawKV([
    { label: 'Primary Phone', value: opts.phone },
    { label: 'Secondary Phone', value: opts.secondaryPhone || 'N/A' },
  ]);
  drawKV([
    { label: 'Email Address', value: opts.email || '-' },
  ]);
  doc.setFontSize(6.5);
  doc.setTextColor(...GREEN);
  doc.setFont('helvetica', 'bold');
  doc.text('PERMANENT ADDRESS:', margin, y);
  y += 4;
  doc.setFontSize(7);
  doc.setTextColor(...SLATE_800);
  doc.setFont('helvetica', 'normal');
  const permAddr = [opts.permTole, opts.permWard ? `Ward ${opts.permWard}` : '', opts.permMunicipality, opts.permDistrict, opts.permProvince].filter(Boolean).join(', ');
  doc.text(permAddr || opts.address || '-', margin + 2, y);
  y += 5;

  doc.setFontSize(6.5);
  doc.setTextColor(...GREEN);
  doc.setFont('helvetica', 'bold');
  doc.text('TEMPORARY / CURRENT ADDRESS:', margin, y);
  y += 4;
  doc.setFontSize(7);
  doc.setTextColor(...SLATE_800);
  doc.setFont('helvetica', 'normal');
  const tempAddr = [opts.tempTole, opts.tempWard ? `Ward ${opts.tempWard}` : '', opts.tempMunicipality, opts.tempDistrict, opts.tempProvince].filter(Boolean).join(', ');
  doc.text(tempAddr || '-', margin + 2, y);
  y += 6;

  // === SECTION 3: FAMILY & NOMINEE ===
  drawSectionHeader('3', 'FAMILY & REGISTERED NOMINEE');
  drawKV([
    { label: "Father's Name", value: opts.fatherName || '-' },
    { label: "Mother's Name", value: opts.motherName || '-' },
  ]);
  drawKV([
    { label: "Grandfather's Name", value: opts.grandfatherName || '-' },
    { label: 'Spouse Name', value: opts.spouseName || '-' },
  ]);
  if (opts.guardianName) {
    drawKV([
      { label: 'Guardian Name', value: opts.guardianName || '-' },
      { label: 'Guardian Relation', value: opts.guardianRelation || '-' },
    ]);
  }
  doc.setFontSize(6.5);
  doc.setTextColor(...GREEN);
  doc.setFont('helvetica', 'bold');
  doc.text('REGISTERED NOMINEE:', margin, y);
  y += 4;
  drawKV([
    { label: 'Nominee Name', value: opts.nomineeName || '-' },
    { label: 'Relation', value: opts.nomineeRelation || '-' },
    { label: 'Phone', value: opts.nomineePhone || '-' },
  ]);
  y += 2;

  // === SECTION 4: OCCUPATION & FINANCIALS ===
  drawSectionHeader('4', 'OCCUPATION, FINANCIALS & COMPLIANCE');
  drawKV([
    { label: 'Primary Occupation', value: opts.occupation || '-' },
    { label: 'Employer / Firm', value: opts.employerName || '-' },
  ]);
  drawKV([
    { label: 'Estimated Annual Income', value: opts.annualIncome ? `${opts.annualIncome} NPR` : '-' },
    { label: 'Source of Funds', value: opts.sourceOfFunds || '-' },
  ]);
  drawKV([
    { label: 'Education Level', value: opts.educationLevel || '-' },
    { label: 'Group', value: opts.groupName || '-' },
    { label: 'Category', value: opts.memberCategory || '-' },
  ]);
  if (opts.isPEP) {
    drawKV([{ label: 'PEP Status', value: `Yes - ${opts.pepDetails || 'N/A'}` }]);
  }
  y += 2;

  // === SECTION 5: ACCOUNT DETAILS TABLE ===
  if (opts.accounts && opts.accounts.length > 0) {
    drawSectionHeader('5', 'ACCOUNT DETAILS');
    autoTable(doc, {
      startY: y,
      head: [['Account Type', 'Account Number', 'Product Name', 'Current Balance', 'Status']],
      body: opts.accounts.map(a => [a.type, a.accountNo, a.productName, `NPR ${a.balance.toLocaleString()}`, a.status]),
      theme: 'grid',
      headStyles: {
        fillColor: GREEN,
        textColor: WHITE,
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'left',
      },
      bodyStyles: { fontSize: 7, textColor: SLATE_800 },
      alternateRowStyles: { fillColor: SLATE_50 },
      margin: { left: margin, right: margin, bottom: 20 },
    });
  }

  // === SECTION 6: DOCUMENTS ===
  const hasCoreDocs = opts.citizenshipFrontUrl || opts.citizenshipBackUrl || opts.signatureUrl;
  const hasAdditionalDocs = (opts.additionalDocs?.length ?? 0) > 0;
  if (hasCoreDocs || hasAdditionalDocs) {
    if (y > 220) { doc.addPage(); y = 34; }
    drawSectionHeader('6', 'ATTACHED DOCUMENTS');
    y += 4;

    const docW = (contentW - 8) / 2;
    let docY = y;

    if (opts.citizenshipFrontUrl) {
      try {
        doc.setFontSize(7); doc.setTextColor(...SLATE_500); doc.setFont('helvetica', 'bold');
        doc.text('Citizenship (Front)', margin, docY);
        docY += 3;
        doc.addImage(opts.citizenshipFrontUrl, 'JPEG', margin, docY, docW, 36);
        doc.setDrawColor(...SLATE_200);
        doc.roundedRect(margin, docY, docW, 36, 1, 1, 'S');
        docY += 40;
      } catch { docY += 4; }
    }
    if (opts.citizenshipBackUrl) {
      try {
        const rightX = margin + docW + 8;
        let backY = y + 3;
        doc.setFontSize(7); doc.setTextColor(...SLATE_500); doc.setFont('helvetica', 'bold');
        doc.text('Citizenship (Back)', rightX, y);
        doc.addImage(opts.citizenshipBackUrl, 'JPEG', rightX, backY, docW, 36);
        doc.setDrawColor(...SLATE_200);
        doc.roundedRect(rightX, backY, docW, 36, 1, 1, 'S');
        if (backY + 40 > docY) docY = backY + 40;
      } catch {}
    }
    if (opts.signatureUrl) {
      if (docY > 240) { doc.addPage(); y = 34; docY = y; }
      try {
        doc.setFontSize(7); doc.setTextColor(...SLATE_500); doc.setFont('helvetica', 'bold');
        doc.text('Member Signature', margin, docY);
        docY += 3;
        doc.addImage(opts.signatureUrl, 'PNG', margin, docY, 50, 20);
        doc.setDrawColor(...SLATE_200);
        doc.roundedRect(margin, docY, 50, 20, 1, 1, 'S');
        docY += 24;
      } catch {}
    }

    // Additional member documents
    if (hasAdditionalDocs) {
      if (docY > 240) { doc.addPage(); y = 34; docY = y; }
      if (hasCoreDocs) { docY += 4; }
      doc.setFontSize(8); doc.setTextColor(...SLATE_800); doc.setFont('helvetica', 'bold');
      doc.text('Other Uploaded Documents:', margin, docY);
      docY += 5;

      for (const ad of opts.additionalDocs!) {
        if (docY > 250) { doc.addPage(); y = 34; docY = y; }
        const isImage = ad.mimeType?.startsWith('image/') || ad.fileUrl.match(/\.(jpg|jpeg|png|webp)$/i);
        if (isImage) {
          try {
            doc.setFontSize(7); doc.setTextColor(...SLATE_500); doc.setFont('helvetica', 'bold');
            doc.text(`${ad.documentType}: ${ad.fileName}`, margin, docY);
            docY += 3;
            doc.addImage(ad.fileUrl, 'JPEG', margin, docY, docW, 36);
            doc.setDrawColor(...SLATE_200);
            doc.roundedRect(margin, docY, docW, 36, 1, 1, 'S');
            docY += 40;
          } catch { docY += 4; }
        } else {
          doc.setFontSize(7); doc.setTextColor(...SLATE_500); doc.setFont('helvetica', 'normal');
          doc.text(`[${ad.documentType}] ${ad.fileName} (PDF/Document - see attached file)`, margin, docY);
          docY += 5;
        }
      }
    }

    y = docY + 2;
  }

  // === FOOTER ===
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${pageCount} | Confidential - Internal Cooperative Document | ${coopName}`,
      margin,
      297 - 8
    );
  }

  doc.save(`Member_Profile_${opts.memberNo}.pdf`);
};
