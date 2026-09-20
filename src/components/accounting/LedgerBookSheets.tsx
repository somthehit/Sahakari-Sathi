import React, { useState, useEffect, useMemo } from 'react';
import { Voucher } from '../../types/coop';
import { useCoop } from '../../context/CoopContext';
import { formatNPR } from '../../utils/nepaliCalendar';
import { exportToExcel } from '../../utils/exportUtils';
import { 
  Download, 
  FileSpreadsheet, 
  BookOpen, 
  Layers, 
  CheckCircle2, 
  ArrowUpDown,
  Sliders,
  MoveHorizontal,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  Grid,
  Eye
} from 'lucide-react';

interface Props {
  vouchers: Voucher[];
}

export const LedgerBookSheets: React.FC<Props> = ({ vouchers }) => {
  const { setSelectedVoucherForDetail } = useCoop();
  const [activeBookTab, setActiveBookTab] = useState<'assets' | 'liabilities' | 'expenses' | 'income'>('assets');
  const [searchTerm, setSearchTerm] = useState('');

  // Row Height & Density State
  const [rowDensity, setRowDensity] = useState<'compact' | 'standard' | 'spacious' | 'custom'>('standard');
  const [autoRowHeight, setAutoRowHeight] = useState<boolean>(true);
  const [customRowHeight, setCustomRowHeight] = useState<number>(36);
  const [customFontSize, setCustomFontSize] = useState<number>(11);
  const [highlightRedDividers, setHighlightRedDividers] = useState<boolean>(false);
  const [showCustomizer, setShowCustomizer] = useState<boolean>(false);

  // Column Widths State (Map of column keys to width in pixels)
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    sn: 55,
    dateBS: 95,
    voucherNo: 120,
    narration: 240,

    // Assets Columns
    cash_dr: 90, cash_cr: 90, cash_net: 95,
    bank_dr: 90, bank_cr: 90, bank_net: 95,
    inv_dr: 90, inv_cr: 90, inv_net: 95,
    loan_dr: 90, loan_cr: 90, loan_net: 95,
    rec_dr: 90, rec_cr: 90, rec_net: 95,
    ca_dr: 90, ca_cr: 90, ca_net: 95,
    fa_dr: 90, fa_cr: 90, fa_net: 95,
    asset_cum: 130,

    // Liabilities Columns
    share_dr: 90, share_cr: 90, share_net: 95,
    res_dr: 90, res_cr: 90, res_net: 95,
    dep_dr: 90, dep_cr: 90, dep_net: 95,
    lp_dr: 90, lp_cr: 90, lp_net: 95,
    gr_dr: 90, gr_cr: 90, gr_net: 95,
    pay_dr: 90, pay_cr: 90, pay_net: 95,
    op_dr: 90, op_cr: 90, op_net: 95,
    liab_cum: 130,

    // Expenses Columns
    p150_1: 100, p150_2: 100, p150_3: 110, p150_4: 100, p150_5: 110,
    p150_6: 100, p150_7: 100, p150_8: 100, p150_9: 100, p150_10: 100,
    p150_11: 100, p150_12: 110, p150_13: 110, p150_14: 100, p150_15: 110,
    p150_16: 110, exp_total: 115, exp_cum: 125,

    // Income Columns
    p160_1: 105, p160_2: 105, p160_3: 105, p160_4: 100, p160_5: 100,
    p160_6: 105, p160_7: 105, p160_8: 110, p160_9: 100, inc_total: 115, inc_cum: 125,
  });

  // Dragging state for interactive mouse column resize
  const [resizingCol, setResizingCol] = useState<{ key: string; startX: number; startWidth: number } | null>(null);

  const handleMouseDownResize = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const currentWidth = colWidths[colKey] || 90;
    setResizingCol({ key: colKey, startX: e.clientX, startWidth: currentWidth });
  };

  useEffect(() => {
    if (!resizingCol) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizingCol.startX;
      const newWidth = Math.max(45, resizingCol.startWidth + diff);
      setColWidths(prev => ({
        ...prev,
        [resizingCol.key]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      setResizingCol(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol]);

  // Reset column widths to initial defaults
  const handleResetColumnWidths = () => {
    setColWidths({
      sn: 55, dateBS: 95, voucherNo: 120, narration: 240,
      cash_dr: 90, cash_cr: 90, cash_net: 95,
      bank_dr: 90, bank_cr: 90, bank_net: 95,
      inv_dr: 90, inv_cr: 90, inv_net: 95,
      loan_dr: 90, loan_cr: 90, loan_net: 95,
      rec_dr: 90, rec_cr: 90, rec_net: 95,
      ca_dr: 90, ca_cr: 90, ca_net: 95,
      fa_dr: 90, fa_cr: 90, fa_net: 95,
      asset_cum: 130,
      share_dr: 90, share_cr: 90, share_net: 95,
      res_dr: 90, res_cr: 90, res_net: 95,
      dep_dr: 90, dep_cr: 90, dep_net: 95,
      lp_dr: 90, lp_cr: 90, lp_net: 95,
      gr_dr: 90, gr_cr: 90, gr_net: 95,
      pay_dr: 90, pay_cr: 90, pay_net: 95,
      op_dr: 90, op_cr: 90, op_net: 95,
      liab_cum: 130,
      p150_1: 100, p150_2: 100, p150_3: 110, p150_4: 100, p150_5: 110,
      p150_6: 100, p150_7: 100, p150_8: 100, p150_9: 100, p150_10: 100,
      p150_11: 100, p150_12: 110, p150_13: 110, p150_14: 100, p150_15: 110,
      p150_16: 110, exp_total: 115, exp_cum: 125,
      p160_1: 105, p160_2: 105, p160_3: 105, p160_4: 100, p160_5: 100,
      p160_6: 105, p160_7: 105, p160_8: 110, p160_9: 100, inc_total: 115, inc_cum: 125,
    });
  };

  // Helper for inline column width style
  const getColStyle = (key: string) => {
    const w = colWidths[key] || 90;
    return {
      width: `${w}px`,
      minWidth: `${w}px`,
      maxWidth: `${w}px`,
    };
  };

  // Helper to render resizable header handle
  const renderResizeHandle = (key: string) => (
    <div
      onMouseDown={(e) => handleMouseDownResize(key, e)}
      className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize group z-20 flex justify-center items-center select-none ${ resizingCol?.key === key ? 'bg-indigo-500/80' : 'hover:bg-slate-300/40' }`}
      title="Click & Drag to resize column width"
    >
      <div className={`w-0.5 h-full transition ${ resizingCol?.key === key ? 'bg-indigo-200' : highlightRedDividers ? 'bg-red-500/90 group-hover:bg-red-400' : 'bg-transparent group-hover:bg-white/60' }`} />
    </div>
  );

  // Handler for custom row height change with proportional auto-scaling font size
  const handleCustomRowHeightChange = (newHeight: number) => {
    setCustomRowHeight(newHeight);
    const autoFont = Math.min(18, Math.max(8, Math.round(newHeight * 0.31)));
    setCustomFontSize(autoFont);
  };

  // Helper for row padding & typography based on density settings
  const getRowPaddingClass = () => {
    if (autoRowHeight) {
      if (rowDensity === 'compact') return 'px-1.5 py-1 align-middle whitespace-normal break-words leading-tight';
      if (rowDensity === 'spacious') return 'px-2.5 py-2 align-middle whitespace-normal break-words leading-relaxed';
      if (rowDensity === 'custom') return 'px-1.5 py-1 align-middle whitespace-normal break-words leading-tight';
      return 'px-2 py-1.5 align-middle whitespace-normal break-words leading-snug'; // standard
    }

    if (rowDensity === 'compact') return 'px-1.5 align-middle whitespace-nowrap overflow-hidden text-ellipsis';
    if (rowDensity === 'spacious') return 'px-2.5 align-middle whitespace-nowrap overflow-hidden text-ellipsis';
    if (rowDensity === 'custom') return 'px-1.5 align-middle whitespace-nowrap overflow-hidden text-ellipsis';
    return 'px-2 align-middle whitespace-nowrap overflow-hidden text-ellipsis'; // standard
  };

  const getRowStyle = () => {
    let minHeight = 36;
    let fontSize = `${customFontSize}px`;

    if (rowDensity === 'compact') {
      minHeight = 28;
      fontSize = '10px';
    } else if (rowDensity === 'standard') {
      minHeight = 36;
      fontSize = '11px';
    } else if (rowDensity === 'spacious') {
      minHeight = 48;
      fontSize = '13px';
    } else if (rowDensity === 'custom') {
      minHeight = customRowHeight;
      fontSize = `${customFontSize}px`;
    }

    return {
      minHeight: `${minHeight}px`,
      height: autoRowHeight ? 'auto' : `${minHeight}px`,
      fontSize,
    };
  };

  const borderClass = highlightRedDividers ? 'border-r-2 border-red-500/70' : 'border-r border-slate-200';
  const headerBorderClass = highlightRedDividers ? 'border-r-2 border-red-500' : 'border-r border-emerald-800/60';

  const safeVouchers = vouchers || [];

  // Open the shared voucher detail popup (rendered globally in App.tsx) for the clicked voucher
  const openVoucher = (voucherNo: string) => {
    const voucher = safeVouchers.find(v => v.voucherNo === voucherNo);
    if (voucher) setSelectedVoucherForDetail(voucher);
  };

  const VoucherLink = ({ voucherNo }: { voucherNo: string }) => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); openVoucher(voucherNo); }}
      className="inline-flex items-center gap-1 font-mono font-bold underline-offset-2 hover:underline cursor-pointer hover:text-emerald-600 transition"
      title={`View ${voucherNo} voucher details`}
    >
      {voucherNo}
      <Eye className="w-3 h-3 opacity-60" />
    </button>
  );

  // Helper function to check if account matches specific codes/prefixes
  const isCode = (code: string, prefix: string) => code.startsWith(prefix) || code === prefix;

  // 1. ASSETS BOOK ROWS GENERATION
  const assetsBookRows = React.useMemo(() => {
    let cumulativeBalance = 0;
    let cashCum = 0, bankCum = 0, invCum = 0, loanCum = 0, recCum = 0, caCum = 0, faCum = 0;
    const rows: any[] = [];

    safeVouchers.forEach((v, index) => {
      // Find asset entries in this voucher
      const assetEntries = v.entries.filter(e => 
        e.accountCode.startsWith('04') || e.accountCode.startsWith('100')
      );

      if (assetEntries.length === 0) return;

      // Classify entries by asset columns
      const getAssetVals = (codePrefix: string) => {
        const matches = assetEntries.filter(e => isCode(e.accountCode, codePrefix));
        const dr = matches.reduce((sum, e) => sum + e.debit, 0);
        const cr = matches.reduce((sum, e) => sum + e.credit, 0);
        const net = dr - cr;
        return { dr, cr, net };
      };

      const cash = getAssetVals('04-80');
      const bank = getAssetVals('04-90');
      const investment = getAssetVals('04-100');
      const loan = getAssetVals('04-110');
      const receivable = getAssetVals('04-120');
      const currentAsset = getAssetVals('04-130');
      const fixedAsset = getAssetVals('04-140');

      // Total row net effect — always use full sum of ALL asset entries, not just prefix-matched ones
      // This ensures entries with codes like 100xxx, 200xxx etc. are not silently dropped
      const totalRowNet = assetEntries.reduce((sum, e) => sum + (e.debit - e.credit), 0);

      cumulativeBalance += totalRowNet;
      cashCum += cash.net;
      bankCum += bank.net;
      invCum += investment.net;
      loanCum += loan.net;
      recCum += receivable.net;
      caCum += currentAsset.net;
      faCum += fixedAsset.net;

      rows.push({
        sn: rows.length + 1,
        dateBS: v.dateBS,
        voucherNo: v.voucherNo,
        narration: v.narration,
        cash: { ...cash, cum: cashCum },
        bank: { ...bank, cum: bankCum },
        investment: { ...investment, cum: invCum },
        loan: { ...loan, cum: loanCum },
        receivable: { ...receivable, cum: recCum },
        currentAsset: { ...currentAsset, cum: caCum },
        fixedAsset: { ...fixedAsset, cum: faCum },
        rowNetEffect: totalRowNet,
        cumulativeBalance,
      });
    });

    return rows;
  }, [safeVouchers]);

  // 2. LIABILITIES BOOK ROWS GENERATION
  const liabilitiesBookRows = React.useMemo(() => {
    let cumulativeBalance = 0;
    let shareCum = 0, reserveCum = 0, depositCum = 0, lpCum = 0, grantCum = 0, payCum = 0, opCum = 0;
    const rows: any[] = [];

    safeVouchers.forEach((v) => {
      // Find liability or equity entries in this voucher
      const liabEntries = v.entries.filter(e => 
        e.accountCode.startsWith('05') || e.accountCode.startsWith('01') || e.accountCode.startsWith('200') || e.accountCode.startsWith('300')
      );

      if (liabEntries.length === 0) return;

      const getLiabVals = (codePrefix: string) => {
        const matches = liabEntries.filter(e => isCode(e.accountCode, codePrefix));
        const dr = matches.reduce((sum, e) => sum + e.debit, 0);
        const cr = matches.reduce((sum, e) => sum + e.credit, 0);
        const net = cr - dr; // Liabilities increase with Credit
        return { dr, cr, net };
      };

      const share = getLiabVals('01-10');
      const reserve = getLiabVals('01-20');
      const deposit = getLiabVals('05-30');
      const loansPayable = getLiabVals('05-40');
      const grant = getLiabVals('05-50');
      const payable = getLiabVals('05-60');
      const otherPayable = getLiabVals('05-70');

      const totalRowNet = liabEntries.reduce((sum, e) => sum + (e.credit - e.debit), 0);

      cumulativeBalance += totalRowNet;
      shareCum += share.net;
      reserveCum += reserve.net;
      depositCum += deposit.net;
      lpCum += loansPayable.net;
      grantCum += grant.net;
      payCum += payable.net;
      opCum += otherPayable.net;

      rows.push({
        sn: rows.length + 1,
        dateBS: v.dateBS,
        voucherNo: v.voucherNo,
        narration: v.narration,
        share: { ...share, cum: shareCum },
        reserve: { ...reserve, cum: reserveCum },
        deposit: { ...deposit, cum: depositCum },
        loansPayable: { ...loansPayable, cum: lpCum },
        grant: { ...grant, cum: grantCum },
        payable: { ...payable, cum: payCum },
        otherPayable: { ...otherPayable, cum: opCum },
        rowNetEffect: totalRowNet,
        cumulativeBalance,
      });
    });

    return rows;
  }, [safeVouchers]);

  // 3. EXPENSES BOOK ROWS GENERATION
  const expensesBookRows = React.useMemo(() => {
    let cumulativeBalance = 0;
    const rows: any[] = [];

    safeVouchers.forEach((v) => {
      const expEntries = v.entries.filter(e => 
        e.accountCode.startsWith('02') || e.accountCode.startsWith('500')
      );

      if (expEntries.length === 0) return;

      const getAmt = (codePrefix: string) => {
        const matches = expEntries.filter(e => isCode(e.accountCode, codePrefix));
        return matches.reduce((sum, e) => sum + (e.debit - e.credit), 0);
      };

      const p150_1 = getAmt('02-150-001-001'); // Goods Purchases
      const p150_2 = getAmt('02-150-001-002'); // Carriage & Wages
      const p150_3 = getAmt('02-150-002-001'); // Salaries & Allowance
      const p150_4 = getAmt('02-150-002-003'); // Rent & Warehouse / Interest
      const p150_5 = getAmt('02-150-002-005'); // Stationery & Misc
      const p150_6 = getAmt('02-150-001-005'); // Maintenance
      const p150_7 = getAmt('02-150-001-003'); // Interest Paid
      const p150_8 = getAmt('02-150-002-008'); // Misc / Membership Fee
      const p150_9 = getAmt('02-150-002-006'); // Insurance / Tax
      const p150_10 = getAmt('02-150-001-004'); // Fuel & Transport
      const p150_11 = getAmt('02-150-002-001-002-001'); // Meeting Allowance
      const p150_12 = getAmt('02-150-002-004'); // Electricity & Internet
      const p150_13 = getAmt('02-150-002-008'); // Membership Fee Expense (१५०.१३ - 02-150-002-008)
      const p150_14 = getAmt('02-150-002-001-002-002'); // Food & Snacks
      const p150_15 = getAmt('02-150-001-007'); // Trade Discount Allowed (१५०.१५ - 02-150-001-007)

      const rowTotal = expEntries.reduce((sum, e) => sum + (e.debit - e.credit), 0);

      cumulativeBalance += rowTotal;

      rows.push({
        sn: rows.length + 1,
        dateBS: v.dateBS,
        voucherNo: v.voucherNo,
        narration: v.narration,
        p150_1, p150_2, p150_3, p150_4, p150_5, p150_6, p150_7, p150_8, p150_9, p150_10, p150_11, p150_12, p150_13, p150_14, p150_15,
        rowTotal,
        cumulativeBalance,
      });
    });

    return rows;
  }, [safeVouchers]);

  // 4. INCOME BOOK ROWS GENERATION
  const incomeBookRows = React.useMemo(() => {
    let cumulativeBalance = 0;
    const rows: any[] = [];

    safeVouchers.forEach((v) => {
      const incEntries = v.entries.filter(e => 
        e.accountCode.startsWith('03') || e.accountCode.startsWith('400')
      );

      if (incEntries.length === 0) return;

      const getAmt = (codePrefix: string) => {
        const matches = incEntries.filter(e => isCode(e.accountCode, codePrefix));
        return matches.reduce((sum, e) => sum + (e.credit - e.debit), 0);
      };

      const p160_1 = getAmt('03-160-01-001'); // Goods Sales
      const p160_2 = getAmt('03-160-01-002'); // Interest from Loan
      const p160_3 = getAmt('03-160-01-003'); // Interest from Investment
      const p160_4 = getAmt('03-160-02-008'); // Misc Income
      const p160_5 = getAmt('03-160-02-002'); // Entry Fee
      const p160_6 = getAmt('03-160-02-007'); // Discount Received
      const p160_7 = getAmt('03-160-01-004'); // Administrative Grant
      const p160_8 = getAmt('03-160-02-001'); // Membership Fee Received
      const p160_9 = getAmt('03-160-02-003'); // Services Fee

      const rowTotal = incEntries.reduce((sum, e) => sum + (e.credit - e.debit), 0);

      cumulativeBalance += rowTotal;

      rows.push({
        sn: rows.length + 1,
        dateBS: v.dateBS,
        voucherNo: v.voucherNo,
        narration: v.narration,
        p160_1, p160_2, p160_3, p160_4, p160_5, p160_6, p160_7, p160_8, p160_9,
        rowTotal,
        cumulativeBalance,
      });
    });

    return rows;
  }, [safeVouchers]);

  // Column Totals calculations for the footer "जम्मा" total row
  const assetsTotals = React.useMemo(() => {
    const t = {
      cash_dr: 0, cash_cr: 0, cash_net: 0,
      bank_dr: 0, bank_cr: 0, bank_net: 0,
      inv_dr: 0, inv_cr: 0, inv_net: 0,
      loan_dr: 0, loan_cr: 0, loan_net: 0,
      rec_dr: 0, rec_cr: 0, rec_net: 0,
      ca_dr: 0, ca_cr: 0, ca_net: 0,
      fa_dr: 0, fa_cr: 0, fa_net: 0,
      cumulativeBalance: 0,
    };
    assetsBookRows.forEach(r => {
      t.cash_dr += r.cash.dr || 0;
      t.cash_cr += r.cash.cr || 0;
      t.cash_net += r.cash.net || 0;

      t.bank_dr += r.bank.dr || 0;
      t.bank_cr += r.bank.cr || 0;
      t.bank_net += r.bank.net || 0;

      t.inv_dr += r.investment.dr || 0;
      t.inv_cr += r.investment.cr || 0;
      t.inv_net += r.investment.net || 0;

      t.loan_dr += r.loan.dr || 0;
      t.loan_cr += r.loan.cr || 0;
      t.loan_net += r.loan.net || 0;

      t.rec_dr += r.receivable.dr || 0;
      t.rec_cr += r.receivable.cr || 0;
      t.rec_net += r.receivable.net || 0;

      t.ca_dr += r.currentAsset.dr || 0;
      t.ca_cr += r.currentAsset.cr || 0;
      t.ca_net += r.currentAsset.net || 0;

      t.fa_dr += r.fixedAsset.dr || 0;
      t.fa_cr += r.fixedAsset.cr || 0;
      t.fa_net += r.fixedAsset.net || 0;
    });
    t.cumulativeBalance = assetsBookRows.length > 0 ? assetsBookRows[assetsBookRows.length - 1].cumulativeBalance : 0;
    return t;
  }, [assetsBookRows]);

  const liabilitiesTotals = React.useMemo(() => {
    const t = {
      share_dr: 0, share_cr: 0, share_net: 0,
      res_dr: 0, res_cr: 0, res_net: 0,
      dep_dr: 0, dep_cr: 0, dep_net: 0,
      lp_dr: 0, lp_cr: 0, lp_net: 0,
      gr_dr: 0, gr_cr: 0, gr_net: 0,
      pay_dr: 0, pay_cr: 0, pay_net: 0,
      op_dr: 0, op_cr: 0, op_net: 0,
      cumulativeBalance: 0,
    };
    liabilitiesBookRows.forEach(r => {
      t.share_dr += r.share.dr || 0;
      t.share_cr += r.share.cr || 0;
      t.share_net += r.share.net || 0;

      t.res_dr += r.reserve.dr || 0;
      t.res_cr += r.reserve.cr || 0;
      t.res_net += r.reserve.net || 0;

      t.dep_dr += r.deposit.dr || 0;
      t.dep_cr += r.deposit.cr || 0;
      t.dep_net += r.deposit.net || 0;

      t.lp_dr += r.loansPayable.dr || 0;
      t.lp_cr += r.loansPayable.cr || 0;
      t.lp_net += r.loansPayable.net || 0;

      t.gr_dr += r.grant.dr || 0;
      t.gr_cr += r.grant.cr || 0;
      t.gr_net += r.grant.net || 0;

      t.pay_dr += r.payable.dr || 0;
      t.pay_cr += r.payable.cr || 0;
      t.pay_net += r.payable.net || 0;

      t.op_dr += r.otherPayable.dr || 0;
      t.op_cr += r.otherPayable.cr || 0;
      t.op_net += r.otherPayable.net || 0;
    });
    t.cumulativeBalance = liabilitiesBookRows.length > 0 ? liabilitiesBookRows[liabilitiesBookRows.length - 1].cumulativeBalance : 0;
    return t;
  }, [liabilitiesBookRows]);

  const expensesTotals = React.useMemo(() => {
    const t = {
      p150_1: 0, p150_2: 0, p150_3: 0, p150_4: 0, p150_5: 0, p150_6: 0, p150_7: 0, p150_8: 0,
      p150_9: 0, p150_10: 0, p150_11: 0, p150_12: 0, p150_13: 0, p150_14: 0, p150_15: 0, p150_16: 0,
      rowTotal: 0,
      cumulativeBalance: 0,
    };
    expensesBookRows.forEach(r => {
      t.p150_1 += r.p150_1 || 0;
      t.p150_2 += r.p150_2 || 0;
      t.p150_3 += r.p150_3 || 0;
      t.p150_4 += r.p150_4 || 0;
      t.p150_5 += r.p150_5 || 0;
      t.p150_6 += r.p150_6 || 0;
      t.p150_7 += r.p150_7 || 0;
      t.p150_8 += r.p150_8 || 0;
      t.p150_9 += r.p150_9 || 0;
      t.p150_10 += r.p150_10 || 0;
      t.p150_11 += r.p150_11 || 0;
      t.p150_12 += r.p150_12 || 0;
      t.p150_13 += r.p150_13 || 0;
      t.p150_14 += r.p150_14 || 0;
      t.p150_15 += r.p150_15 || 0;
      t.p150_16 += r.p150_16 || 0;
      t.rowTotal += r.rowTotal || 0;
    });
    t.cumulativeBalance = expensesBookRows.length > 0 ? expensesBookRows[expensesBookRows.length - 1].cumulativeBalance : 0;
    return t;
  }, [expensesBookRows]);

  const incomeTotals = React.useMemo(() => {
    const t = {
      p160_1: 0, p160_2: 0, p160_3: 0, p160_4: 0, p160_5: 0, p160_6: 0, p160_7: 0, p160_8: 0, p160_9: 0,
      rowTotal: 0,
      cumulativeBalance: 0,
    };
    incomeBookRows.forEach(r => {
      t.p160_1 += r.p160_1 || 0;
      t.p160_2 += r.p160_2 || 0;
      t.p160_3 += r.p160_3 || 0;
      t.p160_4 += r.p160_4 || 0;
      t.p160_5 += r.p160_5 || 0;
      t.p160_6 += r.p160_6 || 0;
      t.p160_7 += r.p160_7 || 0;
      t.p160_8 += r.p160_8 || 0;
      t.p160_9 += r.p160_9 || 0;
      t.rowTotal += r.rowTotal || 0;
    });
    t.cumulativeBalance = incomeBookRows.length > 0 ? incomeBookRows[incomeBookRows.length - 1].cumulativeBalance : 0;
    return t;
  }, [incomeBookRows]);

  // Export handlers (Enhanced PDF)
  const handleExportAssetsPdf = () => {
    const headers = ['S.N.', 'Date BS', 'Voucher No.', 'Particulars', 'Dr Amount', 'Cr Amount', 'Balance'];
    let runningBalance = 0;
    const dataRows: (string | number)[][] = assetsBookRows.map(r => {
      const dr = r.rowNetEffect > 0 ? r.rowNetEffect : 0;
      const cr = r.rowNetEffect < 0 ? Math.abs(r.rowNetEffect) : 0;
      runningBalance = r.cumulativeBalance;
      return [r.sn, r.dateBS, r.voucherNo, r.narration, dr || '', cr || '', runningBalance];
    });
    const totalDr = assetsBookRows.reduce((s, r) => s + (r.rowNetEffect > 0 ? r.rowNetEffect : 0), 0);
    const totalCr = assetsBookRows.reduce((s, r) => s + (r.rowNetEffect < 0 ? Math.abs(r.rowNetEffect) : 0), 0);
    const cumBal = assetsBookRows.length > 0 ? assetsBookRows[assetsBookRows.length - 1].cumulativeBalance : 0;
    dataRows.push(['', '', '', 'GRAND TOTAL', totalDr, totalCr, cumBal]);
    exportToExcel('Assets_Ledger_Book', 'Assets Ledger', headers, dataRows);
  };

  const handleExportLiabilitiesPdf = () => {
    const headers = ['S.N.', 'Date BS', 'Voucher No.', 'Particulars', 'Dr Amount', 'Cr Amount', 'Balance'];
    let runningBalance = 0;
    const dataRows: (string | number)[][] = liabilitiesBookRows.map(r => {
      const dr = r.rowNetEffect > 0 ? r.rowNetEffect : 0;
      const cr = r.rowNetEffect < 0 ? Math.abs(r.rowNetEffect) : 0;
      runningBalance = r.cumulativeBalance;
      return [r.sn, r.dateBS, r.voucherNo, r.narration, dr || '', cr || '', runningBalance];
    });
    const totalDr = liabilitiesBookRows.reduce((s, r) => s + (r.rowNetEffect > 0 ? r.rowNetEffect : 0), 0);
    const totalCr = liabilitiesBookRows.reduce((s, r) => s + (r.rowNetEffect < 0 ? Math.abs(r.rowNetEffect) : 0), 0);
    const cumBal = liabilitiesBookRows.length > 0 ? liabilitiesBookRows[liabilitiesBookRows.length - 1].cumulativeBalance : 0;
    dataRows.push(['', '', '', 'GRAND TOTAL', totalDr, totalCr, cumBal]);
    exportToExcel('Liabilities_Ledger_Book', 'Liabilities Ledger', headers, dataRows);
  };

  const handleExportExpensesPdf = () => {
    const headers = ['S.N.', 'Date BS', 'Voucher No.', 'Particulars', 'Dr Amount', 'Cr Amount', 'Balance'];
    let runningBalance = 0;
    const dataRows: (string | number)[][] = expensesBookRows.map(r => {
      const dr = r.rowTotal > 0 ? r.rowTotal : 0;
      const cr = r.rowTotal < 0 ? Math.abs(r.rowTotal) : 0;
      runningBalance = r.cumulativeBalance;
      return [r.sn, r.dateBS, r.voucherNo, r.narration, dr || '', cr || '', runningBalance];
    });
    const totalDr = expensesBookRows.reduce((s, r) => s + (r.rowTotal > 0 ? r.rowTotal : 0), 0);
    const totalCr = expensesBookRows.reduce((s, r) => s + (r.rowTotal < 0 ? Math.abs(r.rowTotal) : 0), 0);
    const cumBal = expensesBookRows.length > 0 ? expensesBookRows[expensesBookRows.length - 1].cumulativeBalance : 0;
    dataRows.push(['', '', '', 'GRAND TOTAL', totalDr, totalCr, cumBal]);
    exportToExcel('Expenses_Ledger_Book', 'Expenses Ledger', headers, dataRows);
  };

  const handleExportIncomePdf = () => {
    const headers = ['S.N.', 'Date BS', 'Voucher No.', 'Particulars', 'Dr Amount', 'Cr Amount', 'Balance'];
    let runningBalance = 0;
    const dataRows: (string | number)[][] = incomeBookRows.map(r => {
      const dr = r.rowTotal > 0 ? r.rowTotal : 0;
      const cr = r.rowTotal < 0 ? Math.abs(r.rowTotal) : 0;
      runningBalance = r.cumulativeBalance;
      return [r.sn, r.dateBS, r.voucherNo, r.narration, dr || '', cr || '', runningBalance];
    });
    const totalDr = incomeBookRows.reduce((s, r) => s + (r.rowTotal > 0 ? r.rowTotal : 0), 0);
    const totalCr = incomeBookRows.reduce((s, r) => s + (r.rowTotal < 0 ? Math.abs(r.rowTotal) : 0), 0);
    const cumBal = incomeBookRows.length > 0 ? incomeBookRows[incomeBookRows.length - 1].cumulativeBalance : 0;
    dataRows.push(['', '', '', 'GRAND TOTAL', totalDr, totalCr, cumBal]);
    exportToExcel('Income_Ledger_Book', 'Income Ledger', headers, dataRows);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6 space-y-6 text-slate-800">
      
      {/* Official Cooperative Letterhead Header */}
      <div className="text-center border-b border-slate-200 pb-4 space-y-1">
        <h1 className="text-2xl md:text-3xl font-extrabold text-emerald-950 tracking-tight font-serif">
          श्री दिपशिखा कृषि सहकारी संस्था लि.
        </h1>
        <p className="text-sm font-semibold text-slate-700">
          गौरीगंगा न.पा. ०१, चौमाला
        </p>
        <div className="inline-block bg-emerald-100 text-emerald-900 border border-emerald-300 px-4 py-1 rounded-full text-xs font-bold shadow-xs mt-1">
          {activeBookTab === 'assets' && 'सम्पत्ती हिसाब खाता (Assets Ledger Book)'}
          {activeBookTab === 'liabilities' && 'दायित्व हिसाब खाता (Liabilities Ledger Book)'}
          {activeBookTab === 'expenses' && 'खर्च हिसाब खाता (Expenses Ledger Book)'}
          {activeBookTab === 'income' && 'आम्दानि हिसाब खाता (Income Ledger Book)'}
        </div>
      </div>

      {/* Architecture Concept Explanation Box */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-950 flex items-start gap-3">
        <Layers className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-emerald-900">
            स्वतन्त्र पोष्टिङ वास्तुकला (Independent Ledger Book Posting Rule):
          </p>
          <p className="leading-relaxed text-slate-700 text-[11px]">
            Journal Entry Form ले Debit र Credit का लागि ४ वटा स्वतन्त्र पुस्तकहरूमा अलग-अलग रो (Independent Rows) पोष्ट गर्दछ।
            यी रोहरू shared <strong>भौचर नं. (Voucher No)</strong> र <strong>मिति (Date)</strong> मार्फत जोडिएका हुन्छन्।
            <strong>"जम्मा"</strong> ले उक्त भौचरको तत्कालिन खुद असर (Row Net Effect) देखाउँछ भने <strong>"कुल बाँकी रकम"</strong> ले प्रारम्भिक मौज्दातबाट सुरु भई प्रत्येक ट्रान्ज्याक्सनपछि Carried Down हुने cumulative balance देखाउँछ।
          </p>
        </div>
      </div>

      {/* Book Tabs Navigation & Table Layout Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveBookTab('assets')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${ activeBookTab === 'assets' ? 'bg-emerald-800 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200' }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>सम्पत्ती हिसाब खाता</span>
            <span className="ml-1 bg-white/20 text-slate-800 px-1.5 py-0.5 rounded-md text-[10px]">
              {assetsBookRows.length}
            </span>
          </button>

          <button
            onClick={() => setActiveBookTab('liabilities')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${ activeBookTab === 'liabilities' ? 'bg-teal-800 text-slate-800 shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200' }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>दायित्व हिसाब खाता</span>
            <span className="ml-1 bg-white/20 text-slate-800 px-1.5 py-0.5 rounded-md text-[10px]">
              {liabilitiesBookRows.length}
            </span>
          </button>

          <button
            onClick={() => setActiveBookTab('expenses')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${ activeBookTab === 'expenses' ? 'bg-amber-800 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200' }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>खर्च हिसाब खाता</span>
            <span className="ml-1 bg-white/20 text-slate-800 px-1.5 py-0.5 rounded-md text-[10px]">
              {expensesBookRows.length}
            </span>
          </button>

          <button
            onClick={() => setActiveBookTab('income')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${ activeBookTab === 'income' ? 'bg-emerald-700 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200' }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>आम्दानि हिसाब खाता</span>
            <span className="ml-1 bg-white/20 text-slate-800 px-1.5 py-0.5 rounded-md text-[10px]">
              {incomeBookRows.length}
            </span>
          </button>
        </div>

        {/* Customizer Toggle & Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setAutoRowHeight(!autoRowHeight)}
            title="Auto-adjust row height when columns are resized to wrap text without clipping"
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${ autoRowHeight ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/80 hover:bg-emerald-900/80 shadow-xs' : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200' }`}
          >
            <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>अटो रो उचाई (Auto Row Height): {autoRowHeight ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => setShowCustomizer(!showCustomizer)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${ showCustomizer ? 'bg-white text-slate-800 border-slate-200 shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300' }`}
          >
            <Sliders className="w-3.5 h-3.5 text-emerald-600" />
            <span>रो र स्तम्भ मिलाउनुहोस् (Row/Column Size)</span>
          </button>

          {activeBookTab === 'assets' && (
            <button
              onClick={handleExportAssetsPdf}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              <span>Assets PDF</span>
            </button>
          )}
          {activeBookTab === 'liabilities' && (
            <button
              onClick={handleExportLiabilitiesPdf}
              className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-teal-700" />
              <span>Liabilities PDF</span>
            </button>
          )}
          {activeBookTab === 'expenses' && (
            <button
              onClick={handleExportExpensesPdf}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-800" />
              <span>Expenses PDF</span>
            </button>
          )}
          {activeBookTab === 'income' && (
            <button
              onClick={handleExportIncomePdf}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              <span>Income PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* TABLE CUSTOMIZER CONTROL PANEL */}
      {showCustomizer && (
        <div className="bg-white text-slate-800 p-4 rounded-2xl border border-slate-200 shadow-xl space-y-4 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-red-400" />
              <h4 className="font-bold text-sm text-slate-800">तालिका साइज र स्तम्भ चौडाइ मिलाउने सेटिङ (Custom Row/Column Settings)</h4>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleResetColumnWidths}
                className="px-3 py-1 bg-slate-50 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-300 transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 text-red-400" /> Reset Column Widths
              </button>
              <button
                onClick={() => setShowCustomizer(false)}
                className="text-slate-500 hover:text-slate-800 text-xs px-2 py-1 rounded bg-slate-50 transition cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {/* 1. Row Height & Density */}
            <div className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div>
                <label className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5" /> Row Height & Density (रो उचाई र घनत्व)
                </label>
                <div className="flex flex-wrap items-center gap-1.5 pt-2">
                  <button
                    onClick={() => { setRowDensity('compact'); setCustomFontSize(10); }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${ rowDensity === 'compact' ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-200' }`}
                  >
                    Compact (सानो)
                  </button>
                  <button
                    onClick={() => { setRowDensity('standard'); setCustomFontSize(11); }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${ rowDensity === 'standard' ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-200' }`}
                  >
                    Standard (मध्यम)
                  </button>
                  <button
                    onClick={() => { setRowDensity('spacious'); setCustomFontSize(13); }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${ rowDensity === 'spacious' ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-200' }`}
                  >
                    Spacious (ठूलो)
                  </button>
                  <button
                    onClick={() => setRowDensity('custom')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${ rowDensity === 'custom' ? 'bg-red-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-200' }`}
                  >
                    Custom
                  </button>
                </div>

                <div className="pt-2 mt-2 border-t border-slate-200/80">
                  <label htmlFor="chkAutoRowHeight" className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      id="chkAutoRowHeight"
                      checked={autoRowHeight}
                      onChange={(e) => setAutoRowHeight(e.target.checked)}
                      className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                    />
                    <span className="font-semibold text-slate-700 text-xs">
                      Auto-Fit & Text Wrap (अटो उचाई र पाठ बेर्ने)
                    </span>
                  </label>
                  <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                    स्तम्भको साइज सानो बनाउँदा पाठ नयाँ लाइनमा बेरिन्छ र उचाई आफैं मिल्छ।
                  </p>
                </div>
              </div>

              {rowDensity === 'custom' && (
                <div className="pt-2 space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Height: <strong className="text-red-400">{customRowHeight}px</strong></span>
                  </div>
                  <input
                    type="range"
                    min="22"
                    max="70"
                    value={customRowHeight}
                    onChange={(e) => handleCustomRowHeightChange(parseInt(e.target.value))}
                    className="w-full accent-red-500 cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* 2. Amount / Number Font Size */}
            <div className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div>
                <label className="font-bold text-amber-300 flex items-center gap-1.5">
                  <ArrowUpDown className="w-3.5 h-3.5" /> Amount / Number Font Size (अक्षर र रकमको साइज)
                </label>
                <div className="flex flex-wrap items-center gap-1.5 pt-2">
                  <button
                    onClick={() => setCustomFontSize(9)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${ customFontSize === 9 ? 'bg-amber-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-200' }`}
                  >
                    9px (सानो)
                  </button>
                  <button
                    onClick={() => setCustomFontSize(11)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${ customFontSize === 11 ? 'bg-amber-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-200' }`}
                  >
                    11px (सामान्य)
                  </button>
                  <button
                    onClick={() => setCustomFontSize(13)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${ customFontSize === 13 ? 'bg-amber-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-200' }`}
                  >
                    13px (ठूलो)
                  </button>
                  <button
                    onClick={() => setCustomFontSize(15)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${ customFontSize === 15 ? 'bg-amber-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-200' }`}
                  >
                    15px (अति ठूलो)
                  </button>
                </div>
              </div>

              <div className="pt-2 space-y-1">
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>Font Size: <strong className="text-amber-400">{customFontSize}px</strong></span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="20"
                  value={customFontSize}
                  onChange={(e) => setCustomFontSize(parseInt(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>

            {/* 3. Red Line Column Divider Display */}
            <div className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div>
                <label className="font-bold text-red-400 flex items-center gap-1.5">
                  <Grid className="w-3.5 h-3.5" /> Red Column Dividers (रातो स्तम्भ सीमारेखा)
                </label>
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="chkRedDividers"
                    checked={highlightRedDividers}
                    onChange={(e) => setHighlightRedDividers(e.target.checked)}
                    className="w-4 h-4 accent-red-500 rounded cursor-pointer"
                  />
                  <label htmlFor="chkRedDividers" className="text-slate-700 cursor-pointer select-none font-semibold">
                    Highlight Red Lines (रातो रेखा देखाउनुहोस्)
                  </label>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight pt-1">
                प्रत्येक स्तम्भको दायाँ छेउमा रातो रेखा र Drag-to-resize handle देखिनेछ।
              </p>
            </div>

            {/* 4. Drag Instruction */}
            <div className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div>
                <label className="font-bold text-cyan-400 flex items-center gap-1.5">
                  <MoveHorizontal className="w-3.5 h-3.5" /> Header Width Resizing
                </label>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  💡 तालिकाको जुनसुकै हेडर (Header) को रेखामा <strong>Mouse Drag</strong> गरेर स्तम्भको साइज आफूखुसी घटाउन वा बढाउन सक्नुहुन्छ।
                </p>
              </div>
              <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 pt-1">
                <Sparkles className="w-3 h-3" /> Live Resizing Ready
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. ASSETS BOOK TABLE */}
      {activeBookTab === 'assets' && (
        <div className="space-y-3">
          <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-xs">
            <table className="w-full text-xs text-left border-collapse min-w-[1300px]">
              <thead>
                <tr className="bg-emerald-900 text-white font-bold border-b border-emerald-950 text-center">
                  <th className={`p-2 ${headerBorderClass} relative select-none`} style={getColStyle('sn')} rowSpan={2}>
                    सि.नं.
                    {renderResizeHandle('sn')}
                  </th>
                  <th className={`p-2 ${headerBorderClass} relative select-none`} style={getColStyle('dateBS')} rowSpan={2}>
                    मिति
                    {renderResizeHandle('dateBS')}
                  </th>
                  <th className={`p-2 ${headerBorderClass} relative select-none`} style={getColStyle('voucherNo')} rowSpan={2}>
                    भौचर नं.
                    {renderResizeHandle('voucherNo')}
                  </th>
                  <th className={`p-2 ${headerBorderClass} relative select-none`} style={getColStyle('narration')} rowSpan={2}>
                    विवरण
                    {renderResizeHandle('narration')}
                  </th>

                  <th className={`p-2 ${headerBorderClass}`} colSpan={3}>नगद (८०)</th>
                  <th className={`p-2 ${headerBorderClass}`} colSpan={3}>बैंक (९०)</th>
                  <th className={`p-2 ${headerBorderClass}`} colSpan={3}>लगानी (१००)</th>
                  <th className={`p-2 ${headerBorderClass}`} colSpan={3}>ऋण दिएको हिसाब (११०)</th>
                  <th className={`p-2 ${headerBorderClass}`} colSpan={3}>पाउनू पर्ने (१२०)</th>
                  <th className={`p-2 ${headerBorderClass}`} colSpan={3}>सम्पत्ती (१३०)</th>
                  <th className={`p-2 ${headerBorderClass}`} colSpan={3}>अन्य सम्पत्ती (१४०)</th>

                  <th className="p-2 bg-emerald-950 text-amber-300 relative select-none" style={getColStyle('asset_cum')} rowSpan={2}>
                    कूल बाँकी रकम (डे.)
                    {renderResizeHandle('asset_cum')}
                  </th>
                </tr>
                <tr className="bg-emerald-800 text-white font-semibold text-[10px] text-center border-b border-emerald-900">
                  {/* नगद (80) */}
                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('cash_dr')}>डेबिट {renderResizeHandle('cash_dr')}</th>
                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('cash_cr')}>क्रेडिट {renderResizeHandle('cash_cr')}</th>
                  <th className={`p-1 ${headerBorderClass} bg-emerald-900/60 relative select-none`} style={getColStyle('cash_net')}>जम्मा {renderResizeHandle('cash_net')}</th>

                  {/* बैंक (90) */}
                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('bank_dr')}>डेबिट {renderResizeHandle('bank_dr')}</th>
                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('bank_cr')}>क्रेडिट {renderResizeHandle('bank_cr')}</th>
                  <th className={`p-1 ${headerBorderClass} bg-emerald-900/60 relative select-none`} style={getColStyle('bank_net')}>जम्मा {renderResizeHandle('bank_net')}</th>

                  {/* लगानी (100) */}
                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('inv_dr')}>डेबिट {renderResizeHandle('inv_dr')}</th>
                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('inv_cr')}>क्रेडिट {renderResizeHandle('inv_cr')}</th>
                  <th className={`p-1 ${headerBorderClass} bg-emerald-900/60 relative select-none`} style={getColStyle('inv_net')}>जम्मा {renderResizeHandle('inv_net')}</th>

                  {/* ऋण (110) */}
                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('loan_dr')}>डेबिट {renderResizeHandle('loan_dr')}</th>
                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('loan_cr')}>क्रेडिट {renderResizeHandle('loan_cr')}</th>
                  <th className={`p-1 ${headerBorderClass} bg-emerald-900/60 relative select-none`} style={getColStyle('loan_net')}>जम्मा {renderResizeHandle('loan_net')}</th>

                  {/* पाउनू (120) */}
                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('rec_dr')}>डेबिट {renderResizeHandle('rec_dr')}</th>
                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('rec_cr')}>क्रेडिट {renderResizeHandle('rec_cr')}</th>
                  <th className={`p-1 ${headerBorderClass} bg-emerald-900/60 relative select-none`} style={getColStyle('rec_net')}>जम्मा {renderResizeHandle('rec_net')}</th>

                  {/* सम्पत्ती (130) */}
                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('ca_dr')}>डेबिट {renderResizeHandle('ca_dr')}</th>
                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('ca_cr')}>क्रेडिट {renderResizeHandle('ca_cr')}</th>
                  <th className={`p-1 ${headerBorderClass} bg-emerald-900/60 relative select-none`} style={getColStyle('ca_net')}>जम्मा {renderResizeHandle('ca_net')}</th>

                  {/* अन्य सम्पत्ती (140) */}
                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('fa_dr')}>डेबिट {renderResizeHandle('fa_dr')}</th>
                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('fa_cr')}>क्रेडिट {renderResizeHandle('fa_cr')}</th>
                  <th className={`p-1 ${headerBorderClass} bg-emerald-900/60 relative select-none`} style={getColStyle('fa_net')}>जम्मा {renderResizeHandle('fa_net')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {assetsBookRows.length === 0 ? (
                  <tr>
                    <td colSpan={26} className="p-6 text-center text-slate-500 font-sans">
                      No Asset transactions posted yet.
                    </td>
                  </tr>
                ) : (
                  assetsBookRows.map((r) => (
                    <tr key={r.sn} style={getRowStyle()} className="hover:bg-emerald-50/50">
                      <td style={{ ...getColStyle('sn'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-center font-bold text-slate-600 ${borderClass}`}>{r.sn}</td>
                      <td style={{ ...getColStyle('dateBS'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-center text-slate-700 font-sans ${borderClass}`}>{r.dateBS}</td>
                      <td style={{ ...getColStyle('voucherNo'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-center font-bold text-emerald-800 ${borderClass}`}>
                        <VoucherLink voucherNo={r.voucherNo} />
                      </td>
                      <td style={{ ...getColStyle('narration'), ...getRowStyle() }} className={`${getRowPaddingClass()} font-sans text-slate-800 ${borderClass}`}>{r.narration}</td>

                      {/* Cash 80 */}
                      <td style={{ ...getColStyle('cash_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.cash.dr ? formatNPR(r.cash.dr) : '-'}</td>
                      <td style={{ ...getColStyle('cash_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.cash.cr ? formatNPR(r.cash.cr) : '-'}</td>
                      <td style={{ ...getColStyle('cash_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-bold ${borderClass} bg-emerald-50/80`}>{r.cash.cum ? formatNPR(r.cash.cum) : '-'}</td>

                      {/* Bank 90 */}
                      <td style={{ ...getColStyle('bank_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.bank.dr ? formatNPR(r.bank.dr) : '-'}</td>
                      <td style={{ ...getColStyle('bank_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.bank.cr ? formatNPR(r.bank.cr) : '-'}</td>
                      <td style={{ ...getColStyle('bank_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-bold ${borderClass} bg-emerald-50/80`}>{r.bank.cum ? formatNPR(r.bank.cum) : '-'}</td>

                      {/* Investment 100 */}
                      <td style={{ ...getColStyle('inv_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.investment.dr ? formatNPR(r.investment.dr) : '-'}</td>
                      <td style={{ ...getColStyle('inv_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.investment.cr ? formatNPR(r.investment.cr) : '-'}</td>
                      <td style={{ ...getColStyle('inv_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-bold ${borderClass} bg-emerald-50/80`}>{r.investment.cum ? formatNPR(r.investment.cum) : '-'}</td>

                      {/* Loan 110 */}
                      <td style={{ ...getColStyle('loan_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.loan.dr ? formatNPR(r.loan.dr) : '-'}</td>
                      <td style={{ ...getColStyle('loan_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.loan.cr ? formatNPR(r.loan.cr) : '-'}</td>
                      <td style={{ ...getColStyle('loan_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-bold ${borderClass} bg-emerald-50/80`}>{r.loan.cum ? formatNPR(r.loan.cum) : '-'}</td>

                      {/* Receivable 120 */}
                      <td style={{ ...getColStyle('rec_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.receivable.dr ? formatNPR(r.receivable.dr) : '-'}</td>
                      <td style={{ ...getColStyle('rec_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.receivable.cr ? formatNPR(r.receivable.cr) : '-'}</td>
                      <td style={{ ...getColStyle('rec_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-bold ${borderClass} bg-emerald-50/80`}>{r.receivable.cum ? formatNPR(r.receivable.cum) : '-'}</td>

                      {/* Current Asset 130 */}
                      <td style={{ ...getColStyle('ca_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.currentAsset.dr ? formatNPR(r.currentAsset.dr) : '-'}</td>
                      <td style={{ ...getColStyle('ca_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.currentAsset.cr ? formatNPR(r.currentAsset.cr) : '-'}</td>
                      <td style={{ ...getColStyle('ca_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-bold ${borderClass} bg-emerald-50/80`}>{r.currentAsset.cum ? formatNPR(r.currentAsset.cum) : '-'}</td>

                      {/* Fixed Asset 140 */}
                      <td style={{ ...getColStyle('fa_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.fixedAsset.dr ? formatNPR(r.fixedAsset.dr) : '-'}</td>
                      <td style={{ ...getColStyle('fa_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.fixedAsset.cr ? formatNPR(r.fixedAsset.cr) : '-'}</td>
                      <td style={{ ...getColStyle('fa_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-bold ${borderClass} bg-emerald-50/80`}>{r.fixedAsset.cum ? formatNPR(r.fixedAsset.cum) : '-'}</td>

                      {/* Running Cumulative Total */}
                      <td style={{ ...getColStyle('asset_cum'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-extrabold text-emerald-950 bg-emerald-100/80`}>
                        {formatNPR(r.cumulativeBalance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-[#4278b3] text-slate-800 font-bold border-t-2 border-slate-200 sticky bottom-0 z-10 shadow-md">
                <tr style={getRowStyle()}>
                  <td 
                    colSpan={4} 
                    className={`${getRowPaddingClass()} text-center font-extrabold text-slate-800 tracking-widest text-sm ${borderClass}`}
                  >
                    जम्मा
                  </td>

                  {/* Cash 80 */}
                  <td style={{ ...getColStyle('cash_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(assetsTotals.cash_dr)}</td>
                  <td style={{ ...getColStyle('cash_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(assetsTotals.cash_cr)}</td>
                  <td style={{ ...getColStyle('cash_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-extrabold text-cyan-200 ${borderClass} bg-white`}>{formatNPR(assetsTotals.cash_net)}</td>

                  {/* Bank 90 */}
                  <td style={{ ...getColStyle('bank_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(assetsTotals.bank_dr)}</td>
                  <td style={{ ...getColStyle('bank_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(assetsTotals.bank_cr)}</td>
                  <td style={{ ...getColStyle('bank_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-extrabold text-cyan-200 ${borderClass} bg-white`}>{formatNPR(assetsTotals.bank_net)}</td>

                  {/* Investment 100 */}
                  <td style={{ ...getColStyle('inv_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(assetsTotals.inv_dr)}</td>
                  <td style={{ ...getColStyle('inv_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(assetsTotals.inv_cr)}</td>
                  <td style={{ ...getColStyle('inv_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-extrabold text-cyan-200 ${borderClass} bg-white`}>{formatNPR(assetsTotals.inv_net)}</td>

                  {/* Loan 110 */}
                  <td style={{ ...getColStyle('loan_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(assetsTotals.loan_dr)}</td>
                  <td style={{ ...getColStyle('loan_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(assetsTotals.loan_cr)}</td>
                  <td style={{ ...getColStyle('loan_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-extrabold text-cyan-200 ${borderClass} bg-white`}>{formatNPR(assetsTotals.loan_net)}</td>

                  {/* Receivable 120 */}
                  <td style={{ ...getColStyle('rec_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(assetsTotals.rec_dr)}</td>
                  <td style={{ ...getColStyle('rec_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(assetsTotals.rec_cr)}</td>
                  <td style={{ ...getColStyle('rec_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-extrabold text-cyan-200 ${borderClass} bg-white`}>{formatNPR(assetsTotals.rec_net)}</td>

                  {/* Current Asset 130 */}
                  <td style={{ ...getColStyle('ca_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(assetsTotals.ca_dr)}</td>
                  <td style={{ ...getColStyle('ca_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(assetsTotals.ca_cr)}</td>
                  <td style={{ ...getColStyle('ca_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-extrabold text-cyan-200 ${borderClass} bg-white`}>{formatNPR(assetsTotals.ca_net)}</td>

                  {/* Fixed Asset 140 */}
                  <td style={{ ...getColStyle('fa_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(assetsTotals.fa_dr)}</td>
                  <td style={{ ...getColStyle('fa_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(assetsTotals.fa_cr)}</td>
                  <td style={{ ...getColStyle('fa_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-extrabold text-cyan-200 ${borderClass} bg-white`}>{formatNPR(assetsTotals.fa_net)}</td>

                  {/* Cumulative Total */}
                  <td style={{ ...getColStyle('asset_cum'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-black text-amber-300 bg-emerald-950 text-sm`}>
                    {formatNPR(assetsTotals.cumulativeBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 2. LIABILITIES BOOK TABLE */}
      {activeBookTab === 'liabilities' && (
        <div className="space-y-3">
          <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-xs">
            <table className="w-full text-xs text-left border-collapse min-w-[1300px]">
              <thead>
                <tr className="bg-teal-900 text-slate-800 font-bold border-b border-teal-950 text-center">
                  <th className={`p-2 ${headerBorderClass} relative select-none`} style={getColStyle('sn')} rowSpan={2}>सि.नं. {renderResizeHandle('sn')}</th>
                  <th className={`p-2 ${headerBorderClass} relative select-none`} style={getColStyle('dateBS')} rowSpan={2}>मिति {renderResizeHandle('dateBS')}</th>
                  <th className={`p-2 ${headerBorderClass} relative select-none`} style={getColStyle('voucherNo')} rowSpan={2}>भौचर नं. {renderResizeHandle('voucherNo')}</th>
                  <th className={`p-2 ${headerBorderClass} relative select-none`} style={getColStyle('narration')} rowSpan={2}>विवरण {renderResizeHandle('narration')}</th>

                  <th className={`p-2 ${headerBorderClass}`} colSpan={3}>शेयर (१०)</th>
                  <th className={`p-2 ${headerBorderClass}`} colSpan={3}>कोष (२०)</th>
                  <th className={`p-2 ${headerBorderClass}`} colSpan={3}>बचत (३०)</th>
                  <th className={`p-2 ${headerBorderClass}`} colSpan={3}>कर्जा लिएको (४०)</th>
                  <th className={`p-2 ${headerBorderClass}`} colSpan={3}>अनुदान (५०)</th>
                  <th className={`p-2 ${headerBorderClass}`} colSpan={3}>भुक्तानी दिनु पर्ने (६०)</th>
                  <th className={`p-2 ${headerBorderClass}`} colSpan={3}>अन्य भुक्तानी (७०)</th>
                  <th className="p-2 bg-teal-950 text-amber-300 relative select-none" style={getColStyle('liab_cum')} rowSpan={2}>जम्मा रकम (क्रे.) {renderResizeHandle('liab_cum')}</th>
                </tr>
                <tr className="bg-teal-800 text-slate-800 font-semibold text-[10px] text-center border-b border-teal-900">
                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('share_dr')}>डेबिट {renderResizeHandle('share_dr')}</th>
                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('share_cr')}>क्रेडिट {renderResizeHandle('share_cr')}</th>
                  <th className={`p-1 ${headerBorderClass} bg-teal-900/60 relative select-none`} style={getColStyle('share_net')}>जम्मा {renderResizeHandle('share_net')}</th>

                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('res_dr')}>डेबिट {renderResizeHandle('res_dr')}</th>
                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('res_cr')}>क्रेडिट {renderResizeHandle('res_cr')}</th>
                  <th className={`p-1 ${headerBorderClass} bg-teal-900/60 relative select-none`} style={getColStyle('res_net')}>जम्मा {renderResizeHandle('res_net')}</th>

                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('dep_dr')}>डेबिट {renderResizeHandle('dep_dr')}</th>
                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('dep_cr')}>क्रेडिट {renderResizeHandle('dep_cr')}</th>
                  <th className={`p-1 ${headerBorderClass} bg-teal-900/60 relative select-none`} style={getColStyle('dep_net')}>जम्मा {renderResizeHandle('dep_net')}</th>

                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('lp_dr')}>डेबिट {renderResizeHandle('lp_dr')}</th>
                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('lp_cr')}>क्रेडिट {renderResizeHandle('lp_cr')}</th>
                  <th className={`p-1 ${headerBorderClass} bg-teal-900/60 relative select-none`} style={getColStyle('lp_net')}>जम्मा {renderResizeHandle('lp_net')}</th>

                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('gr_dr')}>डेबिट {renderResizeHandle('gr_dr')}</th>
                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('gr_cr')}>क्रेडिट {renderResizeHandle('gr_cr')}</th>
                  <th className={`p-1 ${headerBorderClass} bg-teal-900/60 relative select-none`} style={getColStyle('gr_net')}>जम्मा {renderResizeHandle('gr_net')}</th>

                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('pay_dr')}>डेबिट {renderResizeHandle('pay_dr')}</th>
                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('pay_cr')}>क्रेडिट {renderResizeHandle('pay_cr')}</th>
                  <th className={`p-1 ${headerBorderClass} bg-teal-900/60 relative select-none`} style={getColStyle('pay_net')}>जम्मा {renderResizeHandle('pay_net')}</th>

                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('op_dr')}>डेबिट {renderResizeHandle('op_dr')}</th>
                  <th className={`p-1 ${headerBorderClass} relative select-none`} style={getColStyle('op_cr')}>क्रेडिट {renderResizeHandle('op_cr')}</th>
                  <th className={`p-1 ${headerBorderClass} bg-teal-900/60 relative select-none`} style={getColStyle('op_net')}>जम्मा {renderResizeHandle('op_net')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {liabilitiesBookRows.length === 0 ? (
                  <tr>
                    <td colSpan={26} className="p-6 text-center text-slate-500 font-sans">
                      No Liability transactions posted yet.
                    </td>
                  </tr>
                ) : (
                  liabilitiesBookRows.map((r) => (
                    <tr key={r.sn} style={getRowStyle()} className="hover:bg-teal-50/50">
                      <td style={{ ...getColStyle('sn'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-center font-bold text-slate-600 ${borderClass}`}>{r.sn}</td>
                      <td style={{ ...getColStyle('dateBS'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-center text-slate-700 font-sans ${borderClass}`}>{r.dateBS}</td>
                      <td style={{ ...getColStyle('voucherNo'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-center font-bold text-teal-800 ${borderClass}`}>
                        <VoucherLink voucherNo={r.voucherNo} />
                      </td>
                      <td style={{ ...getColStyle('narration'), ...getRowStyle() }} className={`${getRowPaddingClass()} font-sans text-slate-800 ${borderClass}`}>{r.narration}</td>

                      {/* Share 10 */}
                      <td style={{ ...getColStyle('share_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.share.dr ? formatNPR(r.share.dr) : '-'}</td>
                      <td style={{ ...getColStyle('share_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.share.cr ? formatNPR(r.share.cr) : '-'}</td>
                      <td style={{ ...getColStyle('share_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-bold ${borderClass} bg-teal-50/80`}>{r.share.cum ? formatNPR(r.share.cum) : '-'}</td>

                      {/* Reserve 20 */}
                      <td style={{ ...getColStyle('res_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.reserve.dr ? formatNPR(r.reserve.dr) : '-'}</td>
                      <td style={{ ...getColStyle('res_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.reserve.cr ? formatNPR(r.reserve.cr) : '-'}</td>
                      <td style={{ ...getColStyle('res_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-bold ${borderClass} bg-teal-50/80`}>{r.reserve.cum ? formatNPR(r.reserve.cum) : '-'}</td>

                      {/* Deposit 30 */}
                      <td style={{ ...getColStyle('dep_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.deposit.dr ? formatNPR(r.deposit.dr) : '-'}</td>
                      <td style={{ ...getColStyle('dep_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.deposit.cr ? formatNPR(r.deposit.cr) : '-'}</td>
                      <td style={{ ...getColStyle('dep_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-bold ${borderClass} bg-teal-50/80`}>{r.deposit.cum ? formatNPR(r.deposit.cum) : '-'}</td>

                      {/* Loans Payable 40 */}
                      <td style={{ ...getColStyle('lp_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.loansPayable.dr ? formatNPR(r.loansPayable.dr) : '-'}</td>
                      <td style={{ ...getColStyle('lp_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.loansPayable.cr ? formatNPR(r.loansPayable.cr) : '-'}</td>
                      <td style={{ ...getColStyle('lp_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-bold ${borderClass} bg-teal-50/80`}>{r.loansPayable.cum ? formatNPR(r.loansPayable.cum) : '-'}</td>

                      {/* Grant 50 */}
                      <td style={{ ...getColStyle('gr_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.grant.dr ? formatNPR(r.grant.dr) : '-'}</td>
                      <td style={{ ...getColStyle('gr_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.grant.cr ? formatNPR(r.grant.cr) : '-'}</td>
                      <td style={{ ...getColStyle('gr_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-bold ${borderClass} bg-teal-50/80`}>{r.grant.cum ? formatNPR(r.grant.cum) : '-'}</td>

                      {/* Payable 60 */}
                      <td style={{ ...getColStyle('pay_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.payable.dr ? formatNPR(r.payable.dr) : '-'}</td>
                      <td style={{ ...getColStyle('pay_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.payable.cr ? formatNPR(r.payable.cr) : '-'}</td>
                      <td style={{ ...getColStyle('pay_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-bold ${borderClass} bg-teal-50/80`}>{r.payable.cum ? formatNPR(r.payable.cum) : '-'}</td>

                      {/* Other Payable 70 */}
                      <td style={{ ...getColStyle('op_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.otherPayable.dr ? formatNPR(r.otherPayable.dr) : '-'}</td>
                      <td style={{ ...getColStyle('op_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.otherPayable.cr ? formatNPR(r.otherPayable.cr) : '-'}</td>
                      <td style={{ ...getColStyle('op_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-bold ${borderClass} bg-teal-50/80`}>{r.otherPayable.cum ? formatNPR(r.otherPayable.cum) : '-'}</td>

                      {/* Cumulative Total */}
                      <td style={{ ...getColStyle('liab_cum'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-extrabold text-teal-950 bg-teal-100/80`}>
                        {formatNPR(r.cumulativeBalance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-[#4278b3] text-slate-800 font-bold border-t-2 border-slate-200 sticky bottom-0 z-10 shadow-md">
                <tr style={getRowStyle()}>
                  <td 
                    colSpan={4} 
                    className={`${getRowPaddingClass()} text-center font-extrabold text-slate-800 tracking-widest text-sm ${borderClass}`}
                  >
                    जम्मा
                  </td>

                  {/* Share 10 */}
                  <td style={{ ...getColStyle('share_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(liabilitiesTotals.share_dr)}</td>
                  <td style={{ ...getColStyle('share_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(liabilitiesTotals.share_cr)}</td>
                  <td style={{ ...getColStyle('share_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-extrabold text-cyan-200 ${borderClass} bg-white`}>{formatNPR(liabilitiesTotals.share_net)}</td>

                  {/* Reserve 20 */}
                  <td style={{ ...getColStyle('res_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(liabilitiesTotals.res_dr)}</td>
                  <td style={{ ...getColStyle('res_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(liabilitiesTotals.res_cr)}</td>
                  <td style={{ ...getColStyle('res_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-extrabold text-cyan-200 ${borderClass} bg-white`}>{formatNPR(liabilitiesTotals.res_net)}</td>

                  {/* Deposit 30 */}
                  <td style={{ ...getColStyle('dep_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(liabilitiesTotals.dep_dr)}</td>
                  <td style={{ ...getColStyle('dep_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(liabilitiesTotals.dep_cr)}</td>
                  <td style={{ ...getColStyle('dep_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-extrabold text-cyan-200 ${borderClass} bg-white`}>{formatNPR(liabilitiesTotals.dep_net)}</td>

                  {/* Loans Payable 40 */}
                  <td style={{ ...getColStyle('lp_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(liabilitiesTotals.lp_dr)}</td>
                  <td style={{ ...getColStyle('lp_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(liabilitiesTotals.lp_cr)}</td>
                  <td style={{ ...getColStyle('lp_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-extrabold text-cyan-200 ${borderClass} bg-white`}>{formatNPR(liabilitiesTotals.lp_net)}</td>

                  {/* Grant 50 */}
                  <td style={{ ...getColStyle('gr_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(liabilitiesTotals.gr_dr)}</td>
                  <td style={{ ...getColStyle('gr_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(liabilitiesTotals.gr_cr)}</td>
                  <td style={{ ...getColStyle('gr_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-extrabold text-cyan-200 ${borderClass} bg-white`}>{formatNPR(liabilitiesTotals.gr_net)}</td>

                  {/* Payable 60 */}
                  <td style={{ ...getColStyle('pay_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(liabilitiesTotals.pay_dr)}</td>
                  <td style={{ ...getColStyle('pay_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(liabilitiesTotals.pay_cr)}</td>
                  <td style={{ ...getColStyle('pay_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-extrabold text-cyan-200 ${borderClass} bg-white`}>{formatNPR(liabilitiesTotals.pay_net)}</td>

                  {/* Other Payable 70 */}
                  <td style={{ ...getColStyle('op_dr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(liabilitiesTotals.op_dr)}</td>
                  <td style={{ ...getColStyle('op_cr'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(liabilitiesTotals.op_cr)}</td>
                  <td style={{ ...getColStyle('op_net'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-extrabold text-cyan-200 ${borderClass} bg-white`}>{formatNPR(liabilitiesTotals.op_net)}</td>

                  {/* Cumulative Total */}
                  <td style={{ ...getColStyle('liab_cum'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-black text-amber-300 bg-teal-950 text-sm`}>
                    {formatNPR(liabilitiesTotals.cumulativeBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 3. EXPENSES BOOK TABLE */}
      {activeBookTab === 'expenses' && (
        <div className="space-y-3">
          <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-xs">
            <table className="w-full text-xs text-left border-collapse min-w-[1500px]">
              <thead>
                <tr className="bg-amber-900 text-white font-bold border-b border-amber-950 text-center">
                  <th className={`p-2 ${headerBorderClass} relative select-none`} style={getColStyle('sn')}>सि.नं. {renderResizeHandle('sn')}</th>
                  <th className={`p-2 ${headerBorderClass} relative select-none`} style={getColStyle('dateBS')}>मिति {renderResizeHandle('dateBS')}</th>
                  <th className={`p-2 ${headerBorderClass} relative select-none`} style={getColStyle('narration')}>विवरण {renderResizeHandle('narration')}</th>
                  <th className={`p-2 ${headerBorderClass} relative select-none`} style={getColStyle('voucherNo')}>भौचर नं. {renderResizeHandle('voucherNo')}</th>
                  
                  <th className={`p-1.5 ${headerBorderClass} relative select-none`} style={getColStyle('p150_1')}>सामान खरीद (१५०.१) {renderResizeHandle('p150_1')}</th>
                  <th className={`p-1.5 ${headerBorderClass} relative select-none`} style={getColStyle('p150_2')}>ढुवानि तथा ज्याला (१५०.२) {renderResizeHandle('p150_2')}</th>
                  <th className={`p-1.5 ${headerBorderClass} relative select-none`} style={getColStyle('p150_3')}>तलब तथा भत्ता (१५०.३) {renderResizeHandle('p150_3')}</th>
                  <th className={`p-1.5 ${headerBorderClass} relative select-none`} style={getColStyle('p150_4')}>घर गोदाम भाडा (१५०.४) {renderResizeHandle('p150_4')}</th>
                  <th className={`p-1.5 ${headerBorderClass} relative select-none`} style={getColStyle('p150_5')}>मसलन्द तथा स्टेशनरी (१५०.५) {renderResizeHandle('p150_5')}</th>
                  <th className={`p-1.5 ${headerBorderClass} relative select-none`} style={getColStyle('p150_6')}>मर्मत (१५०.६) {renderResizeHandle('p150_6')}</th>
                  <th className={`p-1.5 ${headerBorderClass} relative select-none`} style={getColStyle('p150_7')}>तिरेको ब्याज (१५०.७) {renderResizeHandle('p150_7')}</th>
                  <th className={`p-1.5 ${headerBorderClass} relative select-none`} style={getColStyle('p150_8')}>विविध खर्च (१५०.८) {renderResizeHandle('p150_8')}</th>
                  <th className={`p-1.5 ${headerBorderClass} relative select-none`} style={getColStyle('p150_9')}>तिरेको कर (१५०.९) {renderResizeHandle('p150_9')}</th>
                  <th className={`p-1.5 ${headerBorderClass} relative select-none`} style={getColStyle('p150_10')}>इन्धन खर्च (१५०.१०) {renderResizeHandle('p150_10')}</th>
                  <th className={`p-1.5 ${headerBorderClass} relative select-none`} style={getColStyle('p150_11')}>बैठक भत्ता (१५०.११) {renderResizeHandle('p150_11')}</th>
                  <th className={`p-1.5 ${headerBorderClass} relative select-none`} style={getColStyle('p150_12')}>सञ्चार तथा विद्युत (१५०.१२) {renderResizeHandle('p150_12')}</th>
                  <th className={`p-1.5 ${headerBorderClass} bg-amber-950 text-amber-200 relative select-none`} style={getColStyle('p150_13')}>यातायात खर्च (१५०.१३) {renderResizeHandle('p150_13')}</th>
                  <th className={`p-1.5 ${headerBorderClass} relative select-none`} style={getColStyle('p150_14')}>खाना तथा नास्ता (१५०.१४) {renderResizeHandle('p150_14')}</th>
                  <th className={`p-1.5 ${headerBorderClass} bg-amber-950 text-amber-200 relative select-none`} style={getColStyle('p150_15')}>व्यापारिक छूट दिएको (१५०.१५) {renderResizeHandle('p150_15')}</th>
                  <th className={`p-1.5 ${headerBorderClass} bg-amber-950 text-emerald-300 relative select-none`} style={getColStyle('p150_16')}>सदस्यता शुल्क खर्च (१५०.१६) {renderResizeHandle('p150_16')}</th>
                  
                  <th className={`p-2 ${headerBorderClass} bg-amber-950 text-amber-100 relative select-none`} style={getColStyle('exp_total')}>कूल खर्च रकम {renderResizeHandle('exp_total')}</th>
                  <th className="p-2 bg-white text-amber-300 relative select-none" style={getColStyle('exp_cum')}>कुल बाँकी खर्च (रु) {renderResizeHandle('exp_cum')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                {expensesBookRows.length === 0 ? (
                  <tr>
                    <td colSpan={22} className="p-6 text-center text-slate-500 font-sans">
                      No Expense transactions posted yet.
                    </td>
                  </tr>
                ) : (
                  expensesBookRows.map((r) => (
                    <tr key={r.sn} style={getRowStyle()} className="hover:bg-amber-50/50">
                      <td style={{ ...getColStyle('sn'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-center font-bold text-slate-600 ${borderClass}`}>{r.sn}</td>
                      <td style={{ ...getColStyle('dateBS'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-center text-slate-700 font-sans ${borderClass}`}>{r.dateBS}</td>
                      <td style={{ ...getColStyle('narration'), ...getRowStyle() }} className={`${getRowPaddingClass()} font-sans text-slate-800 ${borderClass}`}>{r.narration}</td>
                      <td style={{ ...getColStyle('voucherNo'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-center font-bold text-amber-900 ${borderClass}`}>
                        <VoucherLink voucherNo={r.voucherNo} />
                      </td>

                      <td style={{ ...getColStyle('p150_1'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.p150_1 ? formatNPR(r.p150_1) : '-'}</td>
                      <td style={{ ...getColStyle('p150_2'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.p150_2 ? formatNPR(r.p150_2) : '-'}</td>
                      <td style={{ ...getColStyle('p150_3'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.p150_3 ? formatNPR(r.p150_3) : '-'}</td>
                      <td style={{ ...getColStyle('p150_4'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.p150_4 ? formatNPR(r.p150_4) : '-'}</td>
                      <td style={{ ...getColStyle('p150_5'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.p150_5 ? formatNPR(r.p150_5) : '-'}</td>
                      <td style={{ ...getColStyle('p150_6'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.p150_6 ? formatNPR(r.p150_6) : '-'}</td>
                      <td style={{ ...getColStyle('p150_7'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.p150_7 ? formatNPR(r.p150_7) : '-'}</td>
                      <td style={{ ...getColStyle('p150_8'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.p150_8 ? formatNPR(r.p150_8) : '-'}</td>
                      <td style={{ ...getColStyle('p150_9'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.p150_9 ? formatNPR(r.p150_9) : '-'}</td>
                      <td style={{ ...getColStyle('p150_10'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.p150_10 ? formatNPR(r.p150_10) : '-'}</td>
                      <td style={{ ...getColStyle('p150_11'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.p150_11 ? formatNPR(r.p150_11) : '-'}</td>
                      <td style={{ ...getColStyle('p150_12'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.p150_12 ? formatNPR(r.p150_12) : '-'}</td>
                      <td style={{ ...getColStyle('p150_13'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass} bg-amber-50/70 font-semibold`}>{r.p150_13 ? formatNPR(r.p150_13) : '-'}</td>
                      <td style={{ ...getColStyle('p150_14'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.p150_14 ? formatNPR(r.p150_14) : '-'}</td>
                      <td style={{ ...getColStyle('p150_15'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass} bg-amber-50/70 font-semibold`}>{r.p150_15 ? formatNPR(r.p150_15) : '-'}</td>
                      <td style={{ ...getColStyle('p150_16'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass} bg-emerald-50/70 font-semibold text-emerald-900`}>{r.p150_16 ? formatNPR(r.p150_16) : '-'}</td>

                      <td style={{ ...getColStyle('exp_total'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-bold text-amber-950 bg-amber-100/80 ${borderClass}`}>{formatNPR(r.rowTotal)}</td>
                      <td style={{ ...getColStyle('exp_cum'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-extrabold text-slate-950 bg-slate-100`}>{formatNPR(r.cumulativeBalance)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-[#4278b3] text-slate-800 font-bold border-t-2 border-slate-200 sticky bottom-0 z-10 shadow-md">
                <tr style={getRowStyle()}>
                  <td 
                    colSpan={4} 
                    className={`${getRowPaddingClass()} text-center font-extrabold text-slate-800 tracking-widest text-sm ${borderClass}`}
                  >
                    जम्मा
                  </td>

                  <td style={{ ...getColStyle('p150_1'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(expensesTotals.p150_1)}</td>
                  <td style={{ ...getColStyle('p150_2'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(expensesTotals.p150_2)}</td>
                  <td style={{ ...getColStyle('p150_3'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(expensesTotals.p150_3)}</td>
                  <td style={{ ...getColStyle('p150_4'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(expensesTotals.p150_4)}</td>
                  <td style={{ ...getColStyle('p150_5'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(expensesTotals.p150_5)}</td>
                  <td style={{ ...getColStyle('p150_6'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(expensesTotals.p150_6)}</td>
                  <td style={{ ...getColStyle('p150_7'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(expensesTotals.p150_7)}</td>
                  <td style={{ ...getColStyle('p150_8'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(expensesTotals.p150_8)}</td>
                  <td style={{ ...getColStyle('p150_9'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(expensesTotals.p150_9)}</td>
                  <td style={{ ...getColStyle('p150_10'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(expensesTotals.p150_10)}</td>
                  <td style={{ ...getColStyle('p150_11'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(expensesTotals.p150_11)}</td>
                  <td style={{ ...getColStyle('p150_12'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(expensesTotals.p150_12)}</td>
                  <td style={{ ...getColStyle('p150_13'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(expensesTotals.p150_13)}</td>
                  <td style={{ ...getColStyle('p150_14'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(expensesTotals.p150_14)}</td>
                  <td style={{ ...getColStyle('p150_15'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(expensesTotals.p150_15)}</td>
                  <td style={{ ...getColStyle('p150_16'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(expensesTotals.p150_16)}</td>

                  <td style={{ ...getColStyle('exp_total'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-extrabold text-cyan-200 ${borderClass} bg-white`}>{formatNPR(expensesTotals.rowTotal)}</td>
                  <td style={{ ...getColStyle('exp_cum'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-black text-amber-300 bg-amber-950 text-sm`}>{formatNPR(expensesTotals.cumulativeBalance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 4. INCOME BOOK TABLE */}
      {activeBookTab === 'income' && (
        <div className="space-y-3">
          <div className="overflow-x-auto border border-slate-300 rounded-xl shadow-xs">
            <table className="w-full text-xs text-left border-collapse min-w-[1300px]">
              <thead>
                <tr className="bg-emerald-800 text-white font-bold border-b border-emerald-950 text-center">
                  <th className={`p-2 ${headerBorderClass} relative select-none`} style={getColStyle('sn')}>सि.नं. {renderResizeHandle('sn')}</th>
                  <th className={`p-2 ${headerBorderClass} relative select-none`} style={getColStyle('dateBS')}>मिति {renderResizeHandle('dateBS')}</th>
                  <th className={`p-2 ${headerBorderClass} relative select-none`} style={getColStyle('narration')}>विवरण {renderResizeHandle('narration')}</th>
                  <th className={`p-2 ${headerBorderClass} relative select-none`} style={getColStyle('voucherNo')}>भौचर नं. {renderResizeHandle('voucherNo')}</th>
                  
                  <th className={`p-1.5 ${headerBorderClass} relative select-none`} style={getColStyle('p160_1')}>सामान बिक्री (१६०.१) {renderResizeHandle('p160_1')}</th>
                  <th className={`p-1.5 ${headerBorderClass} relative select-none`} style={getColStyle('p160_2')}>कर्जाबाट ब्याज (१६०.२) {renderResizeHandle('p160_2')}</th>
                  <th className={`p-1.5 ${headerBorderClass} relative select-none`} style={getColStyle('p160_3')}>लगानीबाट ब्याज (१६०.३) {renderResizeHandle('p160_3')}</th>
                  <th className={`p-1.5 ${headerBorderClass} relative select-none`} style={getColStyle('p160_4')}>विविध आम्दानी (१६०.४) {renderResizeHandle('p160_4')}</th>
                  <th className={`p-1.5 ${headerBorderClass} relative select-none`} style={getColStyle('p160_5')}>प्रवेश शुल्क (१६०.५) {renderResizeHandle('p160_5')}</th>
                  <th className={`p-1.5 ${headerBorderClass} relative select-none`} style={getColStyle('p160_6')}>व्यापारिक छूट प्राप्त (१६०.६) {renderResizeHandle('p160_6')}</th>
                  <th className={`p-1.5 ${headerBorderClass} relative select-none`} style={getColStyle('p160_7')}>प्रशासनिक अनुदान (१६०.७) {renderResizeHandle('p160_7')}</th>
                  <th className={`p-1.5 ${headerBorderClass} bg-emerald-900 text-amber-200 relative select-none`} style={getColStyle('p160_8')}>सदस्यता शुल्क (१६०.८) {renderResizeHandle('p160_8')}</th>
                  <th className={`p-1.5 ${headerBorderClass} relative select-none`} style={getColStyle('p160_9')}>सेवा शुल्क (१६०.९) {renderResizeHandle('p160_9')}</th>
                  
                  <th className={`p-2 ${headerBorderClass} bg-emerald-950 text-emerald-100 relative select-none`} style={getColStyle('inc_total')}>जम्मा (रो असर) {renderResizeHandle('inc_total')}</th>
                  <th className="p-2 bg-white text-emerald-300 relative select-none" style={getColStyle('inc_cum')}>जम्मा बाँकी (रु) {renderResizeHandle('inc_cum')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                {incomeBookRows.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="p-6 text-center text-slate-500 font-sans">
                      No Income transactions posted yet.
                    </td>
                  </tr>
                ) : (
                  incomeBookRows.map((r) => (
                    <tr key={r.sn} style={getRowStyle()} className="hover:bg-emerald-50/50">
                      <td style={{ ...getColStyle('sn'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-center font-bold text-slate-600 ${borderClass}`}>{r.sn}</td>
                      <td style={{ ...getColStyle('dateBS'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-center text-slate-700 font-sans ${borderClass}`}>{r.dateBS}</td>
                      <td style={{ ...getColStyle('narration'), ...getRowStyle() }} className={`${getRowPaddingClass()} font-sans text-slate-800 ${borderClass}`}>{r.narration}</td>
                      <td style={{ ...getColStyle('voucherNo'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-center font-bold text-emerald-800 ${borderClass}`}>
                        <VoucherLink voucherNo={r.voucherNo} />
                      </td>

                      <td style={{ ...getColStyle('p160_1'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.p160_1 ? formatNPR(r.p160_1) : '-'}</td>
                      <td style={{ ...getColStyle('p160_2'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.p160_2 ? formatNPR(r.p160_2) : '-'}</td>
                      <td style={{ ...getColStyle('p160_3'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.p160_3 ? formatNPR(r.p160_3) : '-'}</td>
                      <td style={{ ...getColStyle('p160_4'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.p160_4 ? formatNPR(r.p160_4) : '-'}</td>
                      <td style={{ ...getColStyle('p160_5'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.p160_5 ? formatNPR(r.p160_5) : '-'}</td>
                      <td style={{ ...getColStyle('p160_6'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.p160_6 ? formatNPR(r.p160_6) : '-'}</td>
                      <td style={{ ...getColStyle('p160_7'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.p160_7 ? formatNPR(r.p160_7) : '-'}</td>
                      <td style={{ ...getColStyle('p160_8'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass} bg-emerald-50 font-semibold`}>{r.p160_8 ? formatNPR(r.p160_8) : '-'}</td>
                      <td style={{ ...getColStyle('p160_9'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{r.p160_9 ? formatNPR(r.p160_9) : '-'}</td>

                      <td style={{ ...getColStyle('inc_total'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-bold text-emerald-950 bg-emerald-100/80 ${borderClass}`}>{formatNPR(r.rowTotal)}</td>
                      <td style={{ ...getColStyle('inc_cum'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-extrabold text-slate-950 bg-slate-100`}>{formatNPR(r.cumulativeBalance)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-[#4278b3] text-slate-800 font-bold border-t-2 border-slate-200 sticky bottom-0 z-10 shadow-md">
                <tr style={getRowStyle()}>
                  <td 
                    colSpan={4} 
                    className={`${getRowPaddingClass()} text-center font-extrabold text-slate-800 tracking-widest text-sm ${borderClass}`}
                  >
                    जम्मा
                  </td>

                  <td style={{ ...getColStyle('p160_1'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(incomeTotals.p160_1)}</td>
                  <td style={{ ...getColStyle('p160_2'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(incomeTotals.p160_2)}</td>
                  <td style={{ ...getColStyle('p160_3'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(incomeTotals.p160_3)}</td>
                  <td style={{ ...getColStyle('p160_4'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(incomeTotals.p160_4)}</td>
                  <td style={{ ...getColStyle('p160_5'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(incomeTotals.p160_5)}</td>
                  <td style={{ ...getColStyle('p160_6'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(incomeTotals.p160_6)}</td>
                  <td style={{ ...getColStyle('p160_7'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(incomeTotals.p160_7)}</td>
                  <td style={{ ...getColStyle('p160_8'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(incomeTotals.p160_8)}</td>
                  <td style={{ ...getColStyle('p160_9'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right ${borderClass}`}>{formatNPR(incomeTotals.p160_9)}</td>

                  <td style={{ ...getColStyle('inc_total'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-extrabold text-cyan-200 ${borderClass} bg-white`}>{formatNPR(incomeTotals.rowTotal)}</td>
                  <td style={{ ...getColStyle('inc_cum'), ...getRowStyle() }} className={`${getRowPaddingClass()} text-right font-black text-amber-300 bg-emerald-950 text-sm`}>{formatNPR(incomeTotals.cumulativeBalance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
