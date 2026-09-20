import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── COLORS ────────────────────────────────────────────────────────────
const C = {
  primary: [0, 97, 48] as [number, number, number],      // Emerald-700
  primaryLight: [209, 250, 229] as [number, number, number], // Emerald-100
  accent: [5, 150, 105] as [number, number, number],     // Emerald-600
  slate: [30, 41, 59] as [number, number, number],       // Slate-800
  slateMid: [100, 116, 139] as [number, number, number], // Slate-500
  slateLight: [248, 250, 252] as [number, number, number], // Slate-50
  white: [255, 255, 255] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],        // Red-600
  redLight: [254, 226, 226] as [number, number, number], // Red-100
  green: [22, 163, 74] as [number, number, number],      // Green-600
  greenLight: [220, 252, 231] as [number, number, number], // Green-100
  amber: [217, 119, 6] as [number, number, number],      // Amber-600
  amberLight: [254, 243, 199] as [number, number, number], // Amber-100
  sky: [3, 105, 161] as [number, number, number],        // Sky-600
  skyLight: [224, 242, 254] as [number, number, number], // Sky-100
};

type RGB = readonly [number, number, number];

// ─── HELPERS ───────────────────────────────────────────────────────────
function createDoc(): jsPDF {
  return new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
}

function drawHeader(doc: jsPDF, orgName: string, orgReg: string) {
  // Green banner
  doc.setFillColor(...C.primary);
  doc.rect(0, 0, 210, 24, 'F');

  // Organization name
  doc.setTextColor(...C.white);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(orgName || 'SahakariSathi CBS', 14, 11);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Reg. No: ${orgReg || 'N/A'}`, 14, 18);

  doc.setFontSize(7);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`, 210 - 14, 11, { align: 'right' });
  doc.text('SahakariSathi CBS - Cooperative Management System', 210 - 14, 18, { align: 'right' });
}

function drawTitle(doc: jsPDF, title: string, subtitle: string, y: number): number {
  doc.setTextColor(...C.slate);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, y);

  if (subtitle) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.slateMid);
    doc.text(subtitle, 14, y + 5);
    return y + 11;
  }
  return y + 7;
}

function drawSectionHeader(doc: jsPDF, title: string, y: number, color: RGB = C.primary): number {
  doc.setFillColor(...color);
  doc.rect(14, y, 182, 7, 'F');
  doc.setTextColor(...C.white);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 17, y + 5);
  return y + 8;
}

function drawFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...C.slateMid);
    doc.text(
      `Page ${i} of ${pageCount}  |  Confidential - Internal Cooperative Document`,
      14, 297 - 8
    );
    // Thin line
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 297 - 12, 196, 297 - 12);
  }
}

function fmt(n: number): string {
  return `NPR ${(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtShort(n: number): string {
  return (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pctChange(current: number, prior: number): string {
  if (prior === 0) return current > 0 ? '+∞%' : '0%';
  const pct = ((current - prior) / Math.abs(prior)) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

// ═══════════════════════════════════════════════════════════════════════
// BALANCE SHEET
// ═══════════════════════════════════════════════════════════════════════
export interface BsAccount {
  code: string; name: string; balance: number; priorBalance: number;
  varAmount: number; varPercent: number;
}

export function exportBalanceSheetPdf(
  filename: string,
  orgName: string, orgReg: string,
  periodStart: string, periodEnd: string,
  assetAccounts: BsAccount[], totalAssets: number, priorAssets: number,
  liabilityAccounts: BsAccount[], totalLiabilities: number, priorLiabilities: number,
  equityAccounts: BsAccount[], totalEquity: number, priorEquity: number,
  netSurplus: number,
) {
  const doc = createDoc();
  drawHeader(doc, orgName, orgReg);
  let y = drawTitle(doc, 'Statement of Financial Position (Balance Sheet)',
    `आर्थिक अवस्था विवरण (ब्यालन्स सिट)  |  Period BS ${periodStart || '—'} to ${periodEnd || '—'}`, 32);

  // ── ASSETS ──
  y = drawSectionHeader(doc, 'ASSETS (सम्पत्तिहरू)', y, C.primary);
  const assetRows: any[] = assetAccounts.map(a => [
    a.code, a.name, fmt(a.priorBalance), fmt(a.balance), fmt(a.varAmount), pctChange(a.balance, a.priorBalance),
  ]);
  assetRows.push([{ content: 'TOTAL ASSETS', colSpan: 2, styles: { fontStyle: 'bold', fillColor: C.primaryLight } as any },
    fmt(priorAssets), fmt(totalAssets), fmt(totalAssets - priorAssets), { content: '', styles: { fillColor: C.primaryLight } as any }]);

  autoTable(doc, {
    startY: y,
    head: [['Code', 'Account Head', 'Prior Balance', 'Current Balance', 'Variance', 'Shift %']],
    body: assetRows as any,
    theme: 'grid',
    headStyles: { fillColor: C.slate, textColor: C.white, fontStyle: 'bold', fontSize: 7, halign: 'left' },
    bodyStyles: { fontSize: 7, textColor: C.slate, cellPadding: 1.5 },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    alternateRowStyles: { fillColor: C.slateLight },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // ── LIABILITIES ──
  y = drawSectionHeader(doc, 'LIABILITIES (दायित्वहरू)', y, C.red);
  const liabRows: any[] = liabilityAccounts.map(l => [
    l.code, l.name, fmt(l.priorBalance), fmt(l.balance), fmt(l.varAmount), pctChange(l.balance, l.priorBalance),
  ]);
  liabRows.push([{ content: 'TOTAL LIABILITIES', colSpan: 2, styles: { fontStyle: 'bold', fillColor: C.redLight } as any },
    fmt(priorLiabilities), fmt(totalLiabilities), fmt(totalLiabilities - priorLiabilities), { content: '', styles: { fillColor: C.redLight } as any }]);

  autoTable(doc, {
    startY: y,
    head: [['Code', 'Account Head', 'Prior Balance', 'Current Balance', 'Variance', 'Shift %']],
    body: liabRows as any,
    theme: 'grid',
    headStyles: { fillColor: C.slate, textColor: C.white, fontStyle: 'bold', fontSize: 7, halign: 'left' },
    bodyStyles: { fontSize: 7, textColor: C.slate, cellPadding: 1.5 },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    alternateRowStyles: { fillColor: C.slateLight },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // ── EQUITY ──
  y = drawSectionHeader(doc, 'MEMBER EQUITY & RESERVES (शेयर पुँजी तथा कोष)', y, C.sky);
  const eqRows: any[] = equityAccounts.map(e => [
    e.code, e.name, fmt(e.priorBalance), fmt(e.balance), fmt(e.varAmount), pctChange(e.balance, e.priorBalance),
  ]);
  eqRows.push(['', 'RETAINED SURPLUS (P&L)', '-', fmt(netSurplus), '-', '-']);
  const grandLiabEq = totalLiabilities + totalEquity + Math.max(0, netSurplus);
  const priorGrandLiabEq = priorLiabilities + priorEquity;
  eqRows.push([{ content: 'GRAND TOTAL LIAB. & EQUITY', colSpan: 2, styles: { fontStyle: 'bold', fillColor: C.skyLight } as any },
    fmt(priorGrandLiabEq), fmt(grandLiabEq), fmt(grandLiabEq - priorGrandLiabEq), { content: '', styles: { fillColor: C.skyLight } as any }]);

  autoTable(doc, {
    startY: y,
    head: [['Code', 'Account Head', 'Prior Balance', 'Current Balance', 'Variance', 'Shift %']],
    body: eqRows as any,
    theme: 'grid',
    headStyles: { fillColor: C.slate, textColor: C.white, fontStyle: 'bold', fontSize: 7, halign: 'left' },
    bodyStyles: { fontSize: 7, textColor: C.slate, cellPadding: 1.5 },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    alternateRowStyles: { fillColor: C.slateLight },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Verification note
  const variance = Math.abs(totalAssets - grandLiabEq);
  doc.setFontSize(7.5);
  if (variance < 0.01) {
    doc.setTextColor(...C.green);
    doc.setFont('helvetica', 'bold');
    doc.text('BALANCE SHEET BALANCED (सन्तुलित) - Total Assets equal Total Liabilities & Equity.', 14, y);
  } else {
    doc.setTextColor(...C.red);
    doc.setFont('helvetica', 'bold');
    doc.text(`UNBALANCED (असन्तुलित) - Discrepancy of NPR ${fmt(variance)}.`, 14, y);
  }

  drawFooter(doc);
  doc.save(`${filename}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════
// INCOME & EXPENDITURE (P&L)
// ═══════════════════════════════════════════════════════════════════════
export interface PlAccount {
  code: string; name: string; periodAmount: number; priorBalance: number;
  varAmount: number; varPercent: number;
}

export function exportProfitLossPdf(
  filename: string,
  orgName: string, orgReg: string,
  periodStart: string, periodEnd: string,
  incomeHeads: PlAccount[], totalIncome: number, priorIncome: number,
  expenseHeads: PlAccount[], totalExpense: number, priorExpense: number,
) {
  const doc = createDoc();
  drawHeader(doc, orgName, orgReg);
  let y = drawTitle(doc, 'Statement of Income & Expenditure (Profit & Loss)',
    `नाफा र घाटा विवरण  |  Period BS ${periodStart || '—'} to ${periodEnd || '—'}`, 32);

  // ── REVENUE ──
  y = drawSectionHeader(doc, 'REVENUE & INCOME HEADS (राजस्व र आम्दानी)', y, C.green);
  const incRows: any[] = incomeHeads.map(h => [
    h.code, h.name, fmt(h.priorBalance), fmt(h.periodAmount), fmt(h.varAmount), pctChange(h.periodAmount, h.priorBalance),
  ]);
  incRows.push([{ content: 'TOTAL REVENUE INCOME', colSpan: 2, styles: { fontStyle: 'bold', fillColor: C.greenLight } as any },
    fmt(priorIncome), fmt(totalIncome), fmt(totalIncome - priorIncome), { content: '', styles: { fillColor: C.greenLight } as any }]);

  autoTable(doc, {
    startY: y,
    head: [['Code', 'Account Head', 'Prior Period', 'Current Period', 'Variance', 'Var %']],
    body: incRows as any,
    theme: 'grid',
    headStyles: { fillColor: C.green, textColor: C.white, fontStyle: 'bold', fontSize: 7, halign: 'left' },
    bodyStyles: { fontSize: 7, textColor: C.slate, cellPadding: 1.5 },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    alternateRowStyles: { fillColor: C.slateLight },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // ── EXPENSES ──
  y = drawSectionHeader(doc, 'OPERATING EXPENSE HEADS (सञ्चालन खर्च)', y, C.red);
  const expRows: any[] = expenseHeads.map(h => [
    h.code, h.name, fmt(h.priorBalance), fmt(h.periodAmount), fmt(h.varAmount), pctChange(h.periodAmount, h.priorBalance),
  ]);
  expRows.push([{ content: 'TOTAL OPERATING EXPENSES', colSpan: 2, styles: { fontStyle: 'bold', fillColor: C.redLight } as any },
    fmt(priorExpense), fmt(totalExpense), fmt(totalExpense - priorExpense), { content: '', styles: { fillColor: C.redLight } as any }]);

  autoTable(doc, {
    startY: y,
    head: [['Code', 'Account Head', 'Prior Period', 'Current Period', 'Variance', 'Var %']],
    body: expRows as any,
    theme: 'grid',
    headStyles: { fillColor: C.red, textColor: C.white, fontStyle: 'bold', fontSize: 7, halign: 'left' },
    bodyStyles: { fontSize: 7, textColor: C.slate, cellPadding: 1.5 },
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    alternateRowStyles: { fillColor: C.slateLight },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // ── NET SURPLUS ──
  const netProfit = totalIncome - totalExpense;
  const priorNetProfit = priorIncome - priorExpense;
  const netColor = netProfit >= 0 ? C.green : C.red;
  const netBg = netProfit >= 0 ? C.greenLight : C.redLight;

  y = drawSectionHeader(doc, 'NET SURPLUS / (DEFICIT) (नाफा / घाटा)', y, netColor);
  autoTable(doc, {
    startY: y,
    head: [['', 'Prior Period', 'Current Period', 'Variance', 'Status']],
    body: [
      ['Net Result', fmt(priorNetProfit), fmt(netProfit), fmt(netProfit - priorNetProfit),
       netProfit >= 0 ? 'Profitable' : 'Loss Making'],
    ],
    theme: 'grid',
    headStyles: { fillColor: C.slate, textColor: C.white, fontStyle: 'bold', fontSize: 8, halign: 'left' },
    bodyStyles: { fontSize: 8, textColor: C.slate, fontStyle: 'bold', cellPadding: 2 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    alternateRowStyles: { fillColor: netBg },
    margin: { left: 14, right: 14 },
  });

  drawFooter(doc);
  doc.save(`${filename}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════
// TRIAL BALANCE
// ═══════════════════════════════════════════════════════════════════════
export interface TbAccount {
  code: string; name: string; category: string;
  openingBalance: number; debitMovement: number; creditMovement: number;
  closingBalance: number; variance: number;
}

export function exportTrialBalancePdf(
  filename: string,
  orgName: string, orgReg: string,
  periodStart: string, periodEnd: string,
  accounts: TbAccount[],
  totals: { opening: number; debit: number; credit: number; closing: number; variance: number },
) {
  const doc = createDoc();
  drawHeader(doc, orgName, orgReg);
  let y = drawTitle(doc, 'Trial Balance (खाता जाँच)',
    `Period BS ${periodStart || '—'} to ${periodEnd || '—'}`, 32);

  // Group by category
  const categories = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];
  const catColors: Record<string, RGB> = { Asset: C.primary, Liability: C.red, Equity: C.sky, Income: C.green, Expense: C.amber };
  const catBgs: Record<string, RGB> = { Asset: C.primaryLight, Liability: C.redLight, Equity: C.skyLight, Income: C.greenLight, Expense: C.amberLight };

  for (const cat of categories) {
    const catAccounts = accounts.filter(a => a.category === cat);
    if (catAccounts.length === 0) continue;

    y = drawSectionHeader(doc, `${cat.toUpperCase()}S`, y, catColors[cat] || C.primary);

    const rows: any[] = catAccounts.map(a => [
      a.code, a.name, fmtShort(a.openingBalance), fmtShort(a.debitMovement),
      fmtShort(a.creditMovement), fmtShort(a.closingBalance), fmtShort(a.variance),
    ]);

    // Category subtotal
    const catOpening = catAccounts.reduce((s, a) => s + a.openingBalance, 0);
    const catDebit = catAccounts.reduce((s, a) => s + a.debitMovement, 0);
    const catCredit = catAccounts.reduce((s, a) => s + a.creditMovement, 0);
    const catClosing = catAccounts.reduce((s, a) => s + a.closingBalance, 0);
    const catVar = catAccounts.reduce((s, a) => s + a.variance, 0);
    rows.push([{ content: `SUBTOTAL ${cat.toUpperCase()}`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: catBgs[cat] } as any },
      fmtShort(catOpening), fmtShort(catDebit), fmtShort(catCredit), fmtShort(catClosing), fmtShort(catVar)]);

    autoTable(doc, {
      startY: y,
      head: [['Code', 'Account Name', 'Opening', 'Debit', 'Credit', 'Closing', 'Variance']],
      body: rows as any,
      theme: 'grid',
      headStyles: { fillColor: C.slate, textColor: C.white, fontStyle: 'bold', fontSize: 7, halign: 'left' },
      bodyStyles: { fontSize: 7, textColor: C.slate, cellPadding: 1.5 },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
      alternateRowStyles: { fillColor: C.slateLight },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  }

  // ── GRAND TOTALS ──
  y = drawSectionHeader(doc, 'GRAND TOTALS', y, C.primary);
  autoTable(doc, {
    startY: y,
    head: [['', 'Opening', 'Debit', 'Credit', 'Closing', 'Variance']],
    body: [
      ['TOTAL', fmtShort(totals.opening), fmtShort(totals.debit), fmtShort(totals.credit), fmtShort(totals.closing), fmtShort(totals.variance)],
    ],
    theme: 'grid',
    headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold', fontSize: 8, halign: 'left' },
    bodyStyles: { fontSize: 8, textColor: C.slate, fontStyle: 'bold', cellPadding: 2 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
    alternateRowStyles: { fillColor: C.primaryLight },
    margin: { left: 14, right: 14 },
  });

  drawFooter(doc);
  doc.save(`${filename}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════
// CASH FLOW STATEMENT
// ═══════════════════════════════════════════════════════════════════════
export interface CfEntry {
  voucherNo?: string; dateBs: string; particulars: string; amount: number;
}

export function exportCashFlowPdf(
  filename: string,
  orgName: string, orgReg: string,
  periodStart: string, periodEnd: string,
  receipts: CfEntry[], totalReceipts: number,
  payments: CfEntry[], totalPayments: number,
  closingBalance: number,
) {
  const doc = createDoc();
  drawHeader(doc, orgName, orgReg);
  let y = drawTitle(doc, 'Cash Flow Statement (नगद प्रवाह विवरण)',
    `Period BS ${periodStart || '—'} to ${periodEnd || '—'}`, 32);

  // ── CASH RECEIPTS ──
  y = drawSectionHeader(doc, 'CASH RECEIPTS / INFLOWS (नगद प्राप्ति)', y, C.green);
  const rcptRows: any[] = receipts.map(r => [
    r.voucherNo || '-', r.dateBs, r.particulars, fmt(r.amount),
  ]);
  rcptRows.push([{ content: 'TOTAL RECEIPTS', colSpan: 3, styles: { fontStyle: 'bold', fillColor: C.greenLight } as any },
    { content: fmt(totalReceipts), styles: { fontStyle: 'bold', fillColor: C.greenLight } as any }]);

  autoTable(doc, {
    startY: y,
    head: [['Voucher No', 'Date (BS)', 'Particulars / Account', 'Amount (NPR)']],
    body: rcptRows as any,
    theme: 'grid',
    headStyles: { fillColor: C.green, textColor: C.white, fontStyle: 'bold', fontSize: 7, halign: 'left' },
    bodyStyles: { fontSize: 7, textColor: C.slate, cellPadding: 1.5 },
    columnStyles: { 3: { halign: 'right' } },
    alternateRowStyles: { fillColor: C.slateLight },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // ── CASH PAYMENTS ──
  y = drawSectionHeader(doc, 'CASH PAYMENTS / OUTFLOWS (नगद भुक्तानी)', y, C.red);
  const pmtRows: any[] = payments.map(p => [
    p.voucherNo || '-', p.dateBs, p.particulars, fmt(p.amount),
  ]);
  pmtRows.push([{ content: 'TOTAL PAYMENTS', colSpan: 3, styles: { fontStyle: 'bold', fillColor: C.redLight } as any },
    { content: fmt(totalPayments), styles: { fontStyle: 'bold', fillColor: C.redLight } as any }]);

  autoTable(doc, {
    startY: y,
    head: [['Voucher No', 'Date (BS)', 'Particulars / Account', 'Amount (NPR)']],
    body: pmtRows as any,
    theme: 'grid',
    headStyles: { fillColor: C.red, textColor: C.white, fontStyle: 'bold', fontSize: 7, halign: 'left' },
    bodyStyles: { fontSize: 7, textColor: C.slate, cellPadding: 1.5 },
    columnStyles: { 3: { halign: 'right' } },
    alternateRowStyles: { fillColor: C.slateLight },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // ── NET CASH FLOW ──
  const netFlow = totalReceipts - totalPayments;
  const netColor = netFlow >= 0 ? C.green : C.red;
  const netBg = netFlow >= 0 ? C.greenLight : C.redLight;

  y = drawSectionHeader(doc, 'NET CASH FLOW & CLOSING BALANCE', y, netColor);
  autoTable(doc, {
    startY: y,
    head: [['Description', 'Amount (NPR)']],
    body: [
      ['Net Cash Flow (Receipts - Payments)', fmt(netFlow)],
      ['Closing Cash & Bank Balance', fmt(closingBalance)],
    ],
    theme: 'grid',
    headStyles: { fillColor: C.slate, textColor: C.white, fontStyle: 'bold', fontSize: 8, halign: 'left' },
    bodyStyles: { fontSize: 8, textColor: C.slate, fontStyle: 'bold', cellPadding: 2 },
    columnStyles: { 1: { halign: 'right' } },
    alternateRowStyles: { fillColor: netBg },
    margin: { left: 14, right: 14 },
  });

  drawFooter(doc);
  doc.save(`${filename}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════
// FINANCIAL RATIOS (PEARLS / CAMEL)
// ═══════════════════════════════════════════════════════════════════════
export interface RatioItem {
  code: string; title: string; category: string;
  value: number; benchmark: number | string; status: string;
  formula?: string; description?: string;
}

export function exportFinancialRatiosPdf(
  filename: string,
  orgName: string, orgReg: string,
  periodStart: string, periodEnd: string,
  ratios: RatioItem[],
) {
  const doc = createDoc();
  drawHeader(doc, orgName, orgReg);
  let y = drawTitle(doc, 'Financial Ratio Analysis (PEARLS / CAMEL)',
    `वित्तीय अनुपात विश्लेषण  |  Period BS ${periodStart || '—'} to ${periodEnd || '—'}`, 32);

  // Summary cards row
  const statusCounts = { satisfactory: 0, warning: 0, critical: 0 };
  ratios.forEach(r => {
    if (r.status === 'Satisfactory' || r.status === 'Pass') statusCounts.satisfactory++;
    else if (r.status === 'Warning') statusCounts.warning++;
    else statusCounts.critical++;
  });

  autoTable(doc, {
    startY: y,
    head: [['Overall Status', 'Satisfactory', 'Warning', 'Critical']],
    body: [[
      `Total Ratios: ${ratios.length}`,
      `${statusCounts.satisfactory} ratios`,
      `${statusCounts.warning} ratios`,
      `${statusCounts.critical} ratios`,
    ]],
    theme: 'grid',
    headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: C.slate, cellPadding: 2 },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Ratio table
  const rows = ratios.map(r => [
    r.code, r.title, r.category,
    typeof r.benchmark === 'number' ? `${r.benchmark.toFixed(1)}%` : r.benchmark,
    `${r.value.toFixed(2)}%`, r.status,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Code', 'Indicator', 'Category', 'Benchmark', 'Current Value', 'Status']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: C.slate, textColor: C.white, fontStyle: 'bold', fontSize: 7, halign: 'left' },
    bodyStyles: { fontSize: 7, textColor: C.slate, cellPadding: 2 },
    columnStyles: { 4: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        const val = data.cell.raw as string;
        if (val === 'Satisfactory' || val === 'Pass') data.cell.styles.textColor = C.green;
        else if (val === 'Warning') data.cell.styles.textColor = C.amber;
        else data.cell.styles.textColor = C.red;
        data.cell.styles.fontStyle = 'bold';
      }
    },
    alternateRowStyles: { fillColor: C.slateLight },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Individual ratio detail cards
  for (const r of ratios) {
    const statusColor = r.status === 'Satisfactory' || r.status === 'Pass' ? C.green : r.status === 'Warning' ? C.amber : C.red;

    autoTable(doc, {
      startY: y,
      head: [[`${r.code} — ${r.title}`]],
      body: [
        ['Category', r.category],
        ['Formula', r.formula || '—'],
        ['Current Value', `${r.value.toFixed(2)}%`],
        ['Benchmark', typeof r.benchmark === 'number' ? `${r.benchmark.toFixed(1)}%` : r.benchmark],
        ['Status', r.status],
        ['Description', r.description || '—'],
      ],
      theme: 'grid',
      headStyles: { fillColor: statusColor, textColor: C.white, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7, textColor: C.slate, cellPadding: 1.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 } },
      alternateRowStyles: { fillColor: C.slateLight },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    // Page break if needed
    if (y > 260) {
      doc.addPage();
      y = 14;
    }
  }

  drawFooter(doc);
  doc.save(`${filename}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════
// GENERAL LEDGER SHEET
// ═══════════════════════════════════════════════════════════════════════
export interface LedgerRow {
  sn: number; dateBs: string; voucherNo: string; particulars: string;
  amounts: number[]; rowTotal: number; cumulative: number;
}

export function exportLedgerSheetPdf(
  filename: string,
  orgName: string, orgReg: string,
  sheetTitle: string,
  columnHeaders: string[],
  rows: LedgerRow[],
  grandTotalRow: number[],
  cumulativeTotal: number,
) {
  const doc = createDoc();
  drawHeader(doc, orgName, orgReg);
  let y = drawTitle(doc, `General Ledger — ${sheetTitle}`, '', 32);

  // Build table rows
  const tableRows = (rows || []).map(r => {
    const cells: (string | number)[] = [r.sn, r.dateBs, r.voucherNo, r.particulars];
    (r.amounts || []).forEach(a => cells.push(fmtShort(a)));
    cells.push(fmtShort(r.rowTotal), fmtShort(r.cumulative));
    return cells;
  });

  // Grand total row
  const totalRow: (string | number)[] = ['', '', '', 'GRAND TOTAL'];
  (grandTotalRow || []).forEach(a => totalRow.push(fmtShort(a)));
  totalRow.push('', fmtShort(cumulativeTotal));

  const allHeaders = ['S.N.', 'Date BS', 'Voucher', 'Particulars', ...columnHeaders, 'Row Total', 'Cumulative'];

  autoTable(doc, {
    startY: y,
    head: [allHeaders],
    body: [...tableRows, totalRow as any],
    theme: 'grid',
    headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold', fontSize: 6.5, halign: 'left' },
    bodyStyles: { fontSize: 6.5, textColor: C.slate, cellPadding: 1 },
    columnStyles: (() => {
      const styles: Record<number, any> = { 0: { halign: 'center' } };
      for (let i = 4; i < allHeaders.length; i++) styles[i] = { halign: 'right' };
      return styles;
    })(),
    alternateRowStyles: { fillColor: C.slateLight },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const lastRow = data.table.body.length - 1;
        if (data.row.index === lastRow) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = C.primaryLight;
        }
      }
    },
    margin: { left: 10, right: 10 },
    tableWidth: 'auto',
  });

  drawFooter(doc);
  doc.save(`${filename}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════
// AUDIT OPINION & FINDINGS REPORT
// ═══════════════════════════════════════════════════════════════════════
export interface AuditOpinionData {
  runId: string;
  runDate: string;
  suggestedClassification: string;
  finalClassification?: string;
  overrideReason?: string;
  basisSummary: string;
}

export interface AuditFindingData {
  title: string;
  description: string;
  severity: string;
  status: string;
  category: string;
  expectedValue?: string;
  actualValue?: string;
  variance?: string;
  resolutionNote?: string;
}

export interface AuditSignoffData {
  stage: string;
  decision: string;
  userName: string;
  timestamp: string;
  comments?: string;
}

export function exportAuditOpinionPdf(
  filename: string,
  orgName: string,
  orgReg: string,
  opinion: AuditOpinionData,
  findings: AuditFindingData[],
  signoffs: AuditSignoffData[],
) {
  const doc = createDoc();
  drawHeader(doc, orgName, orgReg);
  let y = drawTitle(doc, 'Independent Auditor\'s Report', `Audit Run: ${opinion.runId.slice(0, 8)} — ${opinion.runDate}`, 32);

  doc.setTextColor(...C.slate);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('INDEPENDENT AUDITOR\'S REPORT', 105, y, { align: 'center' });
  y += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('To the Board of Directors / Governing Body', 105, y, { align: 'center' });
  y += 10;

  y = drawSectionHeader(doc, '1. OPINION', y);
  y += 6;

  const classification = opinion.finalClassification || opinion.suggestedClassification;
  const opinionText = classification === 'unqualified'
    ? 'We have audited the financial statements of the cooperative, which comprise the balance sheet, income statement, and cash flow statement.'
    : classification === 'qualified'
    ? 'In our opinion, except for the effects of the matter(s) described in the Basis for Qualified Opinion section, the financial statements present fairly, in all material respects.'
    : classification === 'adverse'
    ? 'In our opinion, because of the significance of the matter(s) described in the Basis for Adverse Opinion section, the financial statements do not present fairly.'
    : 'We were unable to obtain sufficient appropriate audit evidence to form an opinion on the financial statements.';

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.slate);
  const opinionLines = doc.splitTextToSize(opinionText, 180);
  doc.text(opinionLines, 14, y);
  y += opinionLines.length * 4.5 + 4;

  const badgeColor = classification === 'unqualified' ? C.green : classification === 'qualified' ? C.amber : C.red;
  doc.setFillColor(...badgeColor);
  doc.roundedRect(14, y, 60, 8, 2, 2, 'F');
  doc.setTextColor(...C.white);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Classification: ${classification.toUpperCase()}`, 17, y + 5.5);
  y += 14;

  if (opinion.finalClassification && opinion.finalClassification !== opinion.suggestedClassification) {
    doc.setFillColor(...C.amberLight);
    doc.roundedRect(14, y, 182, 10, 2, 2, 'F');
    doc.setTextColor(...C.amber);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`Auditor Override: ${opinion.finalClassification}`, 17, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(opinion.overrideReason || '', 17, y + 8);
    y += 14;
  }

  if (opinion.basisSummary) {
    y = drawSectionHeader(doc, '2. BASIS FOR OPINION', y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.slate);
    const basisLines = doc.splitTextToSize(opinion.basisSummary, 180);
    doc.text(basisLines, 14, y);
    y += basisLines.length * 4.5 + 6;
  }

  y = drawSectionHeader(doc, '3. KEY FINDINGS', y);
  y += 6;

  if (findings.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('No findings identified during this audit.', 14, y);
    y += 8;
  } else {
    const findingRows = findings.map((f, i) => [
      `${i + 1}`,
      f.title,
      f.severity.charAt(0).toUpperCase() + f.severity.slice(1),
      f.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
      f.expectedValue || '-',
      f.actualValue || '-',
      f.variance || '-',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['#', 'Finding', 'Severity', 'Status', 'Expected', 'Actual', 'Variance']],
      body: findingRows,
      theme: 'grid',
      headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 7, textColor: C.slate, cellPadding: 1.5 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        2: { halign: 'center' },
        3: { halign: 'center' },
      },
      alternateRowStyles: { fillColor: C.slateLight },
      margin: { left: 10, right: 10 },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (signoffs.length > 0) {
    y = drawSectionHeader(doc, '4. SIGN-OFF CHAIN', y);
    y += 6;

    const signoffRows = signoffs.map(s => [
      s.stage.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
      s.decision.charAt(0).toUpperCase() + s.decision.slice(1),
      s.userName,
      new Date(s.timestamp).toLocaleDateString('en-IN', { dateStyle: 'medium' }),
      s.comments || '',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Stage', 'Decision', 'Approver', 'Date', 'Comments']],
      body: signoffRows,
      theme: 'grid',
      headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 7, textColor: C.slate, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: C.slateLight },
      margin: { left: 10, right: 10 },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (y > 240) {
    doc.addPage();
    y = 30;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, 196, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.slate);
  doc.text('Prepared by: ___________________________', 14, y);
  doc.text('Approved by: ___________________________', 110, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.slateMid);
  doc.text('Date: _______________', 14, y);
  doc.text('Date: _______________', 110, y);
  y += 6;
  doc.text('Signature: _______________', 14, y);
  doc.text('Signature: _______________', 110, y);

  drawFooter(doc);
  doc.save(`${filename}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════
// AUDIT WORKPAPER PACKAGE
// ═══════════════════════════════════════════════════════════════════════
export interface AuditRuleData {
  name: string;
  ruleType: string;
  category: string;
  passed: boolean;
}

export function exportWorkpaperPackagePdf(
  filename: string,
  orgName: string,
  orgReg: string,
  runId: string,
  runDate: string,
  findings: AuditFindingData[],
  workpapers: { findingTitle: string; procedure: string; conclusion: string; evidence?: string }[],
  rules?: AuditRuleData[],
) {
  const doc = createDoc();
  drawHeader(doc, orgName, orgReg);
  let y = drawTitle(doc, `Audit Workpaper Package`, `Run: ${runId.slice(0, 8)} — ${runDate}`, 32);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.slate);
  doc.text('WORKPAPER PACKAGE — FOR EXTERNAL AUDITOR USE', 105, y, { align: 'center' });
  y += 10;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...C.slateMid);
  doc.text('This package contains all findings, financial statements, and evidence for your review and opinion.', 105, y, { align: 'center' });
  y += 12;

  const totalFindings = findings.length;
  const criticalFindings = findings.filter(f => f.severity === 'critical').length;
  const highFindings = findings.filter(f => f.severity === 'high').length;

  doc.setFillColor(...C.slateLight);
  doc.roundedRect(14, y, 182, 12, 2, 2, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Findings: ${totalFindings}  |  Critical: ${criticalFindings}  |  High: ${highFindings}  |  Medium: ${totalFindings - criticalFindings - highFindings}`, 105, y + 7, { align: 'center' });
  y += 18;

  // ── Rules Evaluated Summary ──
  if (rules && rules.length > 0) {
    y = drawSectionHeader(doc, 'RULES EVALUATED', y);
    y += 6;

    const passedRules = rules.filter(r => r.passed).length;
    const failedRules = rules.filter(r => !r.passed).length;

    const ruleRows = rules.map(r => [
      r.name,
      r.ruleType.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
      r.category,
      r.passed ? 'PASS' : 'FAIL',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Rule Name', 'Type', 'Category', 'Result']],
      body: ruleRows,
      theme: 'grid',
      headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 7, textColor: C.slate, cellPadding: 1.5 },
      columnStyles: {
        3: { halign: 'center' },
      },
      alternateRowStyles: { fillColor: C.slateLight },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const val = String(data.cell.raw);
          if (val === 'PASS') data.cell.styles.textColor = C.green;
          else data.cell.styles.textColor = C.red;
          data.cell.styles.fontStyle = 'bold';
        }
      },
      margin: { left: 10, right: 10 },
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Summary: ${passedRules} passed, ${failedRules} failed out of ${rules.length} rules evaluated.`, 14, y);
    y += 8;
  }

  for (let i = 0; i < findings.length; i++) {
    const f = findings[i];
    const wp = workpapers.find(w => w.findingTitle === f.title);

    if (y > 250) {
      doc.addPage();
      y = 30;
    }

    const sevColor = f.severity === 'critical' ? C.red : f.severity === 'high' ? C.amber : C.sky;

    doc.setFillColor(...sevColor);
    doc.roundedRect(14, y, 182, 7, 2, 2, 'F');
    doc.setTextColor(...C.white);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`Finding ${i + 1}: ${f.title} [${f.severity.toUpperCase()}]`, 17, y + 5);
    y += 10;

    doc.setTextColor(...C.slate);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const descLines = doc.splitTextToSize(f.description, 178);
    doc.text(descLines, 17, y);
    y += descLines.length * 3.5 + 3;

    if (f.expectedValue) {
      doc.setFont('helvetica', 'bold');
      doc.text(`Expected: ${f.expectedValue}  |  Actual: ${f.actualValue}  |  Variance: ${f.variance}`, 17, y);
      y += 5;
    }

    if (wp) {
      doc.setFillColor(...C.primaryLight);
      doc.roundedRect(14, y, 182, 18, 2, 2, 'F');
      doc.setTextColor(...C.primary);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('AUDIT PROCEDURE:', 17, y + 4);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.slate);
      const procLines = doc.splitTextToSize(wp.procedure, 175);
      doc.text(procLines.slice(0, 2), 17, y + 8);

      doc.setFont('helvetica', 'bold');
      doc.text('CONCLUSION:', 17, y + 14);
      doc.setFont('helvetica', 'normal');
      const concLines = doc.splitTextToSize(wp.conclusion, 175);
      doc.text(concLines.slice(0, 1), 100, y + 14);
      y += 22;
    }

    y += 4;
  }

  drawFooter(doc);
  doc.save(`${filename}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════════
// CONSOLIDATED AUDIT REPORT (single PDF with everything)
// ═══════════════════════════════════════════════════════════════════════
export function exportConsolidatedAuditReportPdf(
  filename: string,
  orgName: string,
  orgReg: string,
  opinion: AuditOpinionData,
  findings: AuditFindingData[],
  signoffs: AuditSignoffData[],
  rules: AuditRuleData[],
  bsData: { assetAccs: BsAccount[]; totalAssets: number; priorAssets: number; liabAccs: BsAccount[]; totalLiab: number; priorLiab: number; eqAccs: BsAccount[]; totalEq: number; priorEq: number; netSurplus: number },
  plData: { incAccs: PlAccount[]; totalInc: number; priorInc: number; expAccs: PlAccount[]; totalExp: number; priorExp: number },
  tbData: { tbAccs: TbAccount[]; tbTotals: { opening: number; debit: number; credit: number; closing: number; variance: number } },
) {
  const doc = createDoc();
  drawHeader(doc, orgName, orgReg);
  let y = drawTitle(doc, 'CONSOLIDATED AUDIT REPORT', `Run: ${opinion.runId.slice(0, 8)} — ${opinion.runDate}`, 32);

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...C.slate);
  doc.text('CONSOLIDATED AUDIT REPORT', 105, y + 10, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Cooperative Financial Statements & Audit Findings', 105, y + 18, { align: 'center' });
  doc.text(`Prepared: ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}`, 105, y + 24, { align: 'center' });
  y += 35;

  const classification = opinion.finalClassification || opinion.suggestedClassification || 'disclaimer';
  const badgeColor = classification === 'unqualified' ? C.green : classification === 'qualified' ? C.amber : C.red;
  doc.setFillColor(...badgeColor);
  doc.roundedRect(60, y, 90, 10, 3, 3, 'F');
  doc.setTextColor(...C.white);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`AUDIT OPINION: ${classification.toUpperCase()}`, 105, y + 7, { align: 'center' });
  y += 18;

  const approvedCount = signoffs.filter(s => s.decision === 'approved').length;
  doc.setFontSize(9);
  doc.setTextColor(...C.slateMid);
  doc.text(`Sign-off: ${approvedCount}/5 approved  |  Rules: ${rules.length}  |  Findings: ${findings.length}`, 105, y, { align: 'center' });
  y += 15;

  // 1. OPINION
  if (y > 230) { doc.addPage(); y = 30; }
  y = drawSectionHeader(doc, '1. AUDIT OPINION', y);
  y += 6;
  const opinionText = classification === 'unqualified'
    ? 'We have audited the financial statements of the cooperative, which comprise the balance sheet, income statement, and cash flow statement.'
    : classification === 'qualified'
    ? 'In our opinion, except for the effects of the matter(s) described, the financial statements present fairly.'
    : classification === 'adverse'
    ? 'In our opinion, the financial statements do not present fairly due to the matters described below.'
    : 'We were unable to obtain sufficient appropriate audit evidence to form an opinion.';
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C.slate);
  const opinionLines = doc.splitTextToSize(opinionText, 180);
  doc.text(opinionLines, 14, y);
  y += opinionLines.length * 4.5 + 6;

  if (opinion.basisSummary) {
    doc.setFont('helvetica', 'bold');
    doc.text('Basis:', 14, y);
    doc.setFont('helvetica', 'normal');
    const basisLines = doc.splitTextToSize(opinion.basisSummary, 170);
    doc.text(basisLines, 30, y);
    y += basisLines.length * 4.5 + 6;
  }

  // 2. RULES
  if (y > 230) { doc.addPage(); y = 30; }
  y = drawSectionHeader(doc, '2. RULES EVALUATED', y);
  y += 6;
  if (rules.length > 0) {
    const ruleRows = rules.map(r => [r.name, r.ruleType.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()), r.category, r.passed ? 'PASS' : 'FAIL']);
    autoTable(doc, {
      startY: y, head: [['Rule', 'Type', 'Category', 'Result']], body: ruleRows,
      theme: 'grid', headStyles: { fillColor: C.slate, textColor: C.white, fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 7, textColor: C.slate, cellPadding: 1.5 },
      columnStyles: { 3: { halign: 'center' } },
      alternateRowStyles: { fillColor: C.slateLight },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          data.cell.styles.textColor = String(data.cell.raw) === 'PASS' ? C.green : C.red;
          data.cell.styles.fontStyle = 'bold';
        }
      },
      margin: { left: 10, right: 10 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
    doc.setFontSize(8);
    doc.text(`${rules.filter(r => r.passed).length} passed, ${rules.filter(r => !r.passed).length} failed out of ${rules.length}`, 14, y);
    y += 8;
  }

  // 3. FINDINGS
  if (y > 230) { doc.addPage(); y = 30; }
  y = drawSectionHeader(doc, '3. AUDIT FINDINGS', y);
  y += 6;
  if (findings.length > 0) {
    const findingRows = findings.map((f, i) => [`${i + 1}`, f.title, f.severity.charAt(0).toUpperCase() + f.severity.slice(1), f.status.replace('_', ' '), f.expectedValue || '-', f.actualValue || '-', f.variance || '-']);
    autoTable(doc, {
      startY: y, head: [['#', 'Finding', 'Severity', 'Status', 'Expected', 'Actual', 'Variance']], body: findingRows,
      theme: 'grid', headStyles: { fillColor: C.red, textColor: C.white, fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 7, textColor: C.slate, cellPadding: 1.5 },
      columnStyles: { 0: { halign: 'center', cellWidth: 8 }, 2: { halign: 'center' }, 3: { halign: 'center' } },
      alternateRowStyles: { fillColor: C.slateLight }, margin: { left: 10, right: 10 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
    for (const f of findings) {
      if (y > 260) { doc.addPage(); y = 30; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.slate);
      doc.text(f.title, 14, y); y += 4;
      doc.setFont('helvetica', 'normal');
      const dl = doc.splitTextToSize(f.description, 180);
      doc.text(dl, 14, y); y += dl.length * 3.5 + 4;
    }
  } else {
    doc.setFontSize(9); doc.text('No findings identified.', 14, y); y += 8;
  }

  // 4. BALANCE SHEET
  if (y > 200) { doc.addPage(); y = 30; }
  y = drawSectionHeader(doc, '4. BALANCE SHEET', y); y += 6;
  const bsA: any[] = bsData.assetAccs.map(a => [a.code, a.name, fmt(a.priorBalance), fmt(a.balance), fmt(a.varAmount)]);
  bsA.push([{ content: 'TOTAL ASSETS', colSpan: 2, styles: { fontStyle: 'bold', fillColor: C.primaryLight } as any }, fmt(bsData.priorAssets), fmt(bsData.totalAssets), fmt(bsData.totalAssets - bsData.priorAssets)]);
  autoTable(doc, { startY: y, head: [['Code', 'Account', 'Prior', 'Current', 'Variance']], body: bsA as any, theme: 'grid', headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold', fontSize: 6.5 }, bodyStyles: { fontSize: 6.5, cellPadding: 1 }, columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }, alternateRowStyles: { fillColor: C.slateLight }, margin: { left: 10, right: 10 } });
  y = (doc as any).lastAutoTable.finalY + 5;
  const bsL: any[] = bsData.liabAccs.map(a => [a.code, a.name, fmt(a.priorBalance), fmt(a.balance), fmt(a.varAmount)]);
  bsL.push([{ content: 'TOTAL LIABILITIES', colSpan: 2, styles: { fontStyle: 'bold', fillColor: C.redLight } as any }, fmt(bsData.priorLiab), fmt(bsData.totalLiab), fmt(bsData.totalLiab - bsData.priorLiab)]);
  autoTable(doc, { startY: y, head: [['Code', 'Account', 'Prior', 'Current', 'Variance']], body: bsL as any, theme: 'grid', headStyles: { fillColor: C.red, textColor: C.white, fontStyle: 'bold', fontSize: 6.5 }, bodyStyles: { fontSize: 6.5, cellPadding: 1 }, columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }, alternateRowStyles: { fillColor: C.slateLight }, margin: { left: 10, right: 10 } });
  y = (doc as any).lastAutoTable.finalY + 5;
  const bsE: any[] = bsData.eqAccs.map(a => [a.code, a.name, fmt(a.priorBalance), fmt(a.balance), fmt(a.varAmount)]);
  bsE.push([{ content: 'NET SURPLUS', colSpan: 2, styles: { fontStyle: 'bold', fillColor: C.skyLight } as any }, fmt(0), fmt(bsData.netSurplus), fmt(bsData.netSurplus)]);
  bsE.push([{ content: 'TOTAL L+E', colSpan: 2, styles: { fontStyle: 'bold', fillColor: C.primaryLight } as any }, fmt(bsData.priorLiab + bsData.priorEq), fmt(bsData.totalLiab + bsData.totalEq + bsData.netSurplus), fmt((bsData.totalLiab + bsData.totalEq + bsData.netSurplus) - (bsData.priorLiab + bsData.priorEq))]);
  autoTable(doc, { startY: y, head: [['Code', 'Account', 'Prior', 'Current', 'Variance']], body: bsE as any, theme: 'grid', headStyles: { fillColor: C.sky, textColor: C.white, fontStyle: 'bold', fontSize: 6.5 }, bodyStyles: { fontSize: 6.5, cellPadding: 1 }, columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }, alternateRowStyles: { fillColor: C.slateLight }, margin: { left: 10, right: 10 } });
  y = (doc as any).lastAutoTable.finalY + 8;

  // 5. INCOME & EXPENDITURE
  if (y > 200) { doc.addPage(); y = 30; }
  y = drawSectionHeader(doc, '5. INCOME & EXPENDITURE', y); y += 6;
  const plI: any[] = plData.incAccs.map(a => [a.code, a.name, fmt(a.priorBalance), fmt(a.periodAmount), fmt(a.varAmount)]);
  plI.push([{ content: 'TOTAL INCOME', colSpan: 2, styles: { fontStyle: 'bold', fillColor: C.greenLight } as any }, fmt(plData.priorInc), fmt(plData.totalInc), fmt(plData.totalInc - plData.priorInc)]);
  autoTable(doc, { startY: y, head: [['Code', 'Account', 'Prior', 'Current', 'Variance']], body: plI as any, theme: 'grid', headStyles: { fillColor: C.green, textColor: C.white, fontStyle: 'bold', fontSize: 6.5 }, bodyStyles: { fontSize: 6.5, cellPadding: 1 }, columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }, alternateRowStyles: { fillColor: C.slateLight }, margin: { left: 10, right: 10 } });
  y = (doc as any).lastAutoTable.finalY + 5;
  const plE: any[] = plData.expAccs.map(a => [a.code, a.name, fmt(a.priorBalance), fmt(a.periodAmount), fmt(a.varAmount)]);
  plE.push([{ content: 'TOTAL EXPENSES', colSpan: 2, styles: { fontStyle: 'bold', fillColor: C.redLight } as any }, fmt(plData.priorExp), fmt(plData.totalExp), fmt(plData.totalExp - plData.priorExp)]);
  autoTable(doc, { startY: y, head: [['Code', 'Account', 'Prior', 'Current', 'Variance']], body: plE as any, theme: 'grid', headStyles: { fillColor: C.red, textColor: C.white, fontStyle: 'bold', fontSize: 6.5 }, bodyStyles: { fontSize: 6.5, cellPadding: 1 }, columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }, alternateRowStyles: { fillColor: C.slateLight }, margin: { left: 10, right: 10 } });
  y = (doc as any).lastAutoTable.finalY + 5;
  doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text(`NET SURPLUS: ${fmt(plData.totalInc - plData.totalExp)}`, 14, y); y += 10;

  // 6. TRIAL BALANCE
  if (y > 200) { doc.addPage(); y = 30; }
  y = drawSectionHeader(doc, '6. TRIAL BALANCE', y); y += 6;
  const tbRows = tbData.tbAccs.map(a => [a.code, a.name, a.category, fmtShort(a.openingBalance), fmtShort(a.debitMovement), fmtShort(a.creditMovement), fmtShort(a.closingBalance)]);
  autoTable(doc, { startY: y, head: [['Code', 'Account', 'Type', 'Opening', 'Debit', 'Credit', 'Closing']], body: tbRows, theme: 'grid', headStyles: { fillColor: C.slate, textColor: C.white, fontStyle: 'bold', fontSize: 6.5 }, bodyStyles: { fontSize: 6.5, cellPadding: 1 }, columnStyles: { 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } }, alternateRowStyles: { fillColor: C.slateLight }, margin: { left: 10, right: 10 } });
  y = (doc as any).lastAutoTable.finalY + 5;

  // 7. SIGN-OFF
  if (y > 200) { doc.addPage(); y = 30; }
  y = drawSectionHeader(doc, '7. SIGN-OFF CHAIN', y); y += 6;
  if (signoffs.length > 0) {
    const soRows = signoffs.map(s => [s.stage.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()), s.decision.charAt(0).toUpperCase() + s.decision.slice(1), s.userName, new Date(s.timestamp).toLocaleDateString('en-IN', { dateStyle: 'medium' }), s.comments || '']);
    autoTable(doc, { startY: y, head: [['Stage', 'Decision', 'Approver', 'Date', 'Comments']], body: soRows, theme: 'grid', headStyles: { fillColor: C.primary, textColor: C.white, fontStyle: 'bold', fontSize: 7 }, bodyStyles: { fontSize: 7, cellPadding: 1.5 }, alternateRowStyles: { fillColor: C.slateLight }, margin: { left: 10, right: 10 } });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // SIGNATURES
  if (y > 240) { doc.addPage(); y = 30; }
  doc.setDrawColor(200, 200, 200); doc.line(14, y, 196, y); y += 8;
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.slate);
  doc.text('Prepared by: ___________________________', 14, y);
  doc.text('Internal Auditor: ___________________________', 110, y); y += 8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.slateMid);
  doc.text('Date: _______________', 14, y); doc.text('Date: _______________', 110, y); y += 5;
  doc.text('Signature: _______________', 14, y); doc.text('Signature: _______________', 110, y); y += 12;
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.slate);
  doc.text('External Auditor: ___________________________', 14, y);
  doc.text('Board President: ___________________________', 110, y); y += 8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.slateMid);
  doc.text('Date: _______________', 14, y); doc.text('Date: _______________', 110, y); y += 5;
  doc.text('Signature: _______________', 14, y); doc.text('Signature: _______________', 110, y);

  drawFooter(doc);
  doc.save(`${filename}.pdf`);
}
