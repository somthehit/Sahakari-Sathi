import React, { useState, useRef, useEffect } from 'react';
import { useCoop } from '../../context/CoopContext';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Upload, 
  FileText, 
  Paperclip, 
  X, 
  Search, 
  RefreshCw, 
  Sparkles, 
  ArrowRight,
  Calculator,
  Printer,
  Calendar,
  Layers,
  HelpCircle
} from 'lucide-react';
import { NepaliDatePicker } from '../common/NepaliDatePicker';
import { getTodayBS, convertBSToAD } from '../../utils/nepaliCalendar';
import { ChartOfAccount, VoucherEntryItem } from '../../types/coop';

interface ManualJournalVoucherEntryProps {
  onVoucherPosted?: () => void;
}

interface LineItemRow {
  id: string;
  accountCode: string;
  accountName: string;
  accountId: string;
  lineNarration: string;
  debit: string;
  credit: string;
}

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
}

export const ManualJournalVoucherEntry: React.FC<ManualJournalVoucherEntryProps> = ({
  onVoucherPosted
}) => {
  const { 
    chartOfAccounts, 
    postManualVoucher, 
    activeBranch, 
    activeBranchId,
    setSelectedVoucherForDetail 
  } = useCoop();

  const safeChart = chartOfAccounts || [];

  // 1. Voucher Header Meta State
  const [voucherType, setVoucherType] = useState<'Journal' | 'Payment' | 'Receipt' | 'Contra'>('Journal');
  const [voucherNo, setVoucherNo] = useState<string>(`VCH-2083-${Math.floor(1000 + Math.random() * 9000)}`);
  const [isVoucherNoEditable, setIsVoucherNoEditable] = useState<boolean>(false);
  
  const todayBS = getTodayBS();
  const [dateBS, setDateBS] = useState<string>(todayBS);
  const [dateAD, setDateAD] = useState<string>(convertBSToAD(todayBS));

  const [preparedBy, setPreparedBy] = useState<string>('Rajesh Manandhar (Accountant)');
  const [voucherNarration, setVoucherNarration] = useState<string>('Member Cash Deposit & Journal Adjustment for FY 2083/84');
  const [submitting, setSubmitting] = useState(false);

  // 2. Line Items Grid State (Compound Entries)
  const [rows, setRows] = useState<LineItemRow[]>([
    {
      id: 'row-1',
      accountCode: '1001', // Cash in Vault
      accountName: 'Cash in Vault (नगद हिसाब)',
      accountId: safeChart.find(c => c.code === '1001')?.id || '1001',
      lineNarration: 'Cash received from member',
      debit: '25000',
      credit: '0',
    },
    {
      id: 'row-2',
      accountCode: '2001', // General Saving Account
      accountName: 'General Saving Account (साधारण बचत)',
      accountId: safeChart.find(c => c.code === '2001')?.id || '2001',
      lineNarration: 'Credit to Member Account SAV-101-0042',
      debit: '0',
      credit: '25000',
    },
  ]);

  // 3. File Attachments State
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 4. Combobox State for each row
  const [activeComboboxRowId, setActiveComboboxRowId] = useState<string | null>(null);
  const [accountSearchQuery, setAccountSearchQuery] = useState<string>('');
  const comboboxRef = useRef<HTMLDivElement>(null);

  // Close combobox when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setActiveComboboxRowId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Regenerate Voucher No
  const handleRegenerateVoucherNo = () => {
    const prefix = voucherType === 'Journal' ? 'JV' : voucherType === 'Payment' ? 'PV' : voucherType === 'Receipt' ? 'RV' : 'CV';
    setVoucherNo(`${prefix}-2083-${Math.floor(1000 + Math.random() * 9000)}`);
  };

  // Date Change Handler
  const handleDateChange = (newBS: string, newAD: string) => {
    setDateBS(newBS);
    setDateAD(newAD);
  };

  // Calculated Totals
  const totalDebit = rows.reduce((acc, r) => acc + (parseFloat(r.debit) || 0), 0);
  const totalCredit = rows.reduce((acc, r) => acc + (parseFloat(r.credit) || 0), 0);
  const diff = Math.abs(totalDebit - totalCredit);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  // Validation Check
  const hasEmptyAccounts = rows.some(r => !r.accountCode || !r.accountName);
  const canPost = isBalanced && !hasEmptyAccounts && rows.length >= 2;

  // Amount in Words Converter
  const formatAmountInWords = (amount: number): string => {
    if (!amount || isNaN(amount) || amount <= 0) return 'शून्य रुपैयाँ मात्र';
    
    // Format NPR words
    const intPart = Math.floor(amount);
    const formattedStr = intPart.toLocaleString('en-IN');
    return `${formattedStr} रुपैयाँ मात्र (NPR ${formattedStr} Only)`;
  };

  // Add Row
  const handleAddRow = (type: 'debit' | 'credit' = 'debit') => {
    const newId = `row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const remainingDiff = totalDebit > totalCredit ? totalDebit - totalCredit : totalCredit - totalDebit;
    
    let defaultDebit = '0';
    let defaultCredit = '0';

    if (type === 'debit' && totalCredit > totalDebit) {
      defaultDebit = remainingDiff > 0 ? remainingDiff.toString() : '0';
    } else if (type === 'credit' && totalDebit > totalCredit) {
      defaultCredit = remainingDiff > 0 ? remainingDiff.toString() : '0';
    }

    setRows(prev => [
      ...prev,
      {
        id: newId,
        accountCode: '',
        accountName: '',
        accountId: '',
        lineNarration: '',
        debit: defaultDebit,
        credit: defaultCredit,
      }
    ]);
  };

  // Delete Row
  const handleDeleteRow = (id: string) => {
    if (rows.length <= 2) return;
    setRows(prev => prev.filter(r => r.id !== id));
  };

  // Update Line Item
  const handleRowChange = (id: string, field: keyof LineItemRow, value: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      
      const updated = { ...r, [field]: value };
      
      // Mutual exclusion for Debit and Credit
      if (field === 'debit' && value !== '' && parseFloat(value) > 0) {
        updated.credit = '0';
      } else if (field === 'credit' && value !== '' && parseFloat(value) > 0) {
        updated.debit = '0';
      }
      
      return updated;
    }));
  };

  // Auto-Balance Feature
  const handleAutoBalance = (rowId?: string) => {
    if (totalDebit === totalCredit) return;
    
    const targetRowId = rowId || rows[rows.length - 1].id;
    const difference = totalDebit - totalCredit;

    setRows(prev => prev.map(r => {
      if (r.id !== targetRowId) return r;
      if (difference > 0) {
        // Debit is higher, add difference to Credit
        const curCr = parseFloat(r.credit) || 0;
        return { ...r, credit: (curCr + difference).toString(), debit: '0' };
      } else {
        // Credit is higher, add difference to Debit
        const curDr = parseFloat(r.debit) || 0;
        return { ...r, debit: (curDr + Math.abs(difference)).toString(), credit: '0' };
      }
    }));
  };

  // Select Account from Combobox
  const handleSelectAccount = (rowId: string, acc: ChartOfAccount) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      return {
        ...r,
        accountCode: acc.code,
        accountName: `${acc.name} (${acc.code})`,
        accountId: acc.id,
      };
    }));
    setActiveComboboxRowId(null);
    setAccountSearchQuery('');
  };

  // File Upload Handlers
  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAttachments(prev => [
          ...prev,
          {
            id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: e.target?.result as string,
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // Quick Compound Templates
  const loadPresetTemplate = (preset: 'cash_deposit' | 'rent_tds' | 'loan_disb' | 'multi_exp') => {
    if (preset === 'cash_deposit') {
      setVoucherType('Receipt');
      setRows([
        {
          id: 'p1',
          accountCode: '1001',
          accountName: 'Cash in Vault (नगद हिसाब)',
          accountId: safeChart.find(c => c.code === '1001')?.id || '1001',
          lineNarration: 'Cash received from member',
          debit: '25000',
          credit: '0',
        },
        {
          id: 'p2',
          accountCode: '2001',
          accountName: 'General Saving Account (साधारण बचत)',
          accountId: safeChart.find(c => c.code === '2001')?.id || '2001',
          lineNarration: 'Credit to Saving A/C SAV-101-0042',
          debit: '0',
          credit: '24950',
        },
        {
          id: 'p3',
          accountCode: '4003',
          accountName: 'Service Charge & Form Fee (सेवा शुल्क)',
          accountId: safeChart.find(c => c.code === '4003')?.id || '4003',
          lineNarration: 'Deposit processing service charge',
          debit: '0',
          credit: '50',
        },
      ]);
      setVoucherNarration('Member Cash Deposit into Saving Account SAV-101-0042 with Service Charge deduction');
    } else if (preset === 'rent_tds') {
      setVoucherType('Payment');
      setRows([
        {
          id: 'p1',
          accountCode: '5003',
          accountName: 'Office Rent Expense (कार्यालय भाडा)',
          accountId: safeChart.find(c => c.code === '5003')?.id || '5003',
          lineNarration: 'Monthly Office Rent for Kathmandu Branch',
          debit: '50000',
          credit: '0',
        },
        {
          id: 'p2',
          accountCode: '2005',
          accountName: 'TDS Payable 10% (अग्रिम कर दायित्व)',
          accountId: safeChart.find(c => c.code === '2005')?.id || '2005',
          lineNarration: 'House rent TDS 10% deducted at source',
          debit: '0',
          credit: '5000',
        },
        {
          id: 'p3',
          accountCode: '1002',
          accountName: 'Bank Account - Nabil Bank (नबिल बैंक)',
          accountId: safeChart.find(c => c.code === '1002')?.id || '1002',
          lineNarration: 'Net rent payment via Account Payee Cheque',
          debit: '0',
          credit: '45000',
        },
      ]);
      setVoucherNarration('Monthly Office Rent Payment with 10% House Rent TDS Deduction');
    } else if (preset === 'loan_disb') {
      setVoucherType('Journal');
      setRows([
        {
          id: 'p1',
          accountCode: '1005',
          accountName: 'Member Loan Portfolio (ऋण लगानी)',
          accountId: safeChart.find(c => c.code === '1005')?.id || '1005',
          lineNarration: 'Approved Loan LN-2083-0099 for Ram Prasad Shrestha',
          debit: '200000',
          credit: '0',
        },
        {
          id: 'p2',
          accountCode: '4002',
          accountName: 'Loan Processing Fee Income (ऋण प्रशासनिक शुल्क)',
          accountId: safeChart.find(c => c.code === '4002')?.id || '4002',
          lineNarration: '1% loan processing fee',
          debit: '0',
          credit: '2000',
        },
        {
          id: 'p3',
          accountCode: '1001',
          accountName: 'Cash in Vault (नगद हिसाब)',
          accountId: safeChart.find(c => c.code === '1001')?.id || '1001',
          lineNarration: 'Net cash disbursed to borrower',
          debit: '0',
          credit: '198000',
        },
      ]);
      setVoucherNarration('Member Loan Disbursement with 1% Loan Service Fee deduction');
    } else if (preset === 'multi_exp') {
      setVoucherType('Payment');
      setRows([
        {
          id: 'p1',
          accountCode: '5001',
          accountName: 'Stationery & Office Printing (छपाई तथा फाराम)',
          accountId: safeChart.find(c => c.code === '5001')?.id || '5001',
          lineNarration: 'Passbook & Voucher Pad printing',
          debit: '8500',
          credit: '0',
        },
        {
          id: 'p2',
          accountCode: '5002',
          accountName: 'Tea & Refreshment Expense (जलपान खर्च)',
          accountId: safeChart.find(c => c.code === '5002')?.id || '5002',
          lineNarration: 'Staff & Board meeting refreshments',
          debit: '3200',
          credit: '0',
        },
        {
          id: 'p3',
          accountCode: '1001',
          accountName: 'Cash in Vault (नगद हिसाब)',
          accountId: safeChart.find(c => c.code === '1001')?.id || '1001',
          lineNarration: 'Petty cash reimbursement to Teller',
          debit: '0',
          credit: '11700',
        },
      ]);
      setVoucherNarration('Petty cash expense claims reimbursement for Stationery & Tea expenses');
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPost || submitting) return;
    setSubmitting(true);

    try {
      const formattedEntries: VoucherEntryItem[] = rows.map(r => ({
        accountId: r.accountId || r.accountCode,
        accountCode: r.accountCode,
        accountName: r.accountName.split('(')[0].trim(),
        debit: parseFloat(r.debit) || 0,
        credit: parseFloat(r.credit) || 0,
        narration: r.lineNarration || undefined,
      }));

      await postManualVoucher({
        voucherType,
        dateBS,
        dateAD,
        branchId: activeBranchId,
        preparedBy,
        totalAmount: totalDebit,
        narration: voucherNarration || `Manual ${voucherType} Voucher Posting`,
        entries: formattedEntries,
      });

      if (onVoucherPosted) {
        onVoucherPosted();
      }
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || 'Failed to post voucher');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-lg space-y-7 text-xs max-w-5xl mx-auto"
    >
      {/* 1. Header Banner & Status */}
      <div className="border-b border-slate-100 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[11px] font-black uppercase tracking-wider">
              {voucherType} Voucher
            </span>
            <h2 className="text-lg font-black text-slate-900">Double-Entry Journal Posting (गोश्वारा भौचर)</h2>
          </div>
          <p className="text-slate-500 text-xs mt-1">
            Create multi-line compound journal entries with auto-balanced Debit & Credit validation
          </p>
        </div>

        {/* Dynamic Balance Status Badge */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          {isBalanced ? (
            <div className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200/90 rounded-2xl shadow-2xs font-bold text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="block text-[10px] text-emerald-600 uppercase tracking-wider font-semibold">Balance Status</span>
                <span>Balanced Compound Entry (रु. {totalDebit.toLocaleString('en-IN')})</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-2 bg-rose-50 text-rose-800 border border-rose-200/90 rounded-2xl shadow-2xs font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 animate-pulse" />
              <div>
                <span className="block text-[10px] text-rose-600 uppercase tracking-wider font-semibold">Out of Balance</span>
                <span>Diff: रु. {diff.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Compound Preset Bar */}
      <div className="bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-extrabold text-slate-600 flex items-center gap-1.5 px-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Quick Compound Templates:</span>
        </span>
        <button
          type="button"
          onClick={() => loadPresetTemplate('cash_deposit')}
          className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded-xl transition cursor-pointer font-semibold shadow-2xs text-[11px]"
        >
          Cash Deposit + Fee (1 Dr, 2 Cr)
        </button>
        <button
          type="button"
          onClick={() => loadPresetTemplate('rent_tds')}
          className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded-xl transition cursor-pointer font-semibold shadow-2xs text-[11px]"
        >
          Office Rent + TDS (1 Dr, 2 Cr)
        </button>
        <button
          type="button"
          onClick={() => loadPresetTemplate('loan_disb')}
          className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded-xl transition cursor-pointer font-semibold shadow-2xs text-[11px]"
        >
          Loan Disbursement (1 Dr, 2 Cr)
        </button>
        <button
          type="button"
          onClick={() => loadPresetTemplate('multi_exp')}
          className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded-xl transition cursor-pointer font-semibold shadow-2xs text-[11px]"
        >
          Multi-Expense Claim (2 Dr, 1 Cr)
        </button>
      </div>

      {/* 3. Essential Accounting Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-200/80">
        
        {/* Voucher Type */}
        <div className="space-y-1.5 xl:col-span-3">
          <label className="text-slate-700 font-bold block text-xs">Voucher Type *</label>
          <select
            value={voucherType}
            onChange={(e) => setVoucherType(e.target.value as any)}
            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold text-xs focus:border-emerald-500 focus:outline-none shadow-2xs"
          >
            <option value="Journal">Journal Voucher (गोश्वारा भौचर)</option>
            <option value="Payment">Payment Voucher (भुक्तानी भौचर)</option>
            <option value="Receipt">Receipt Voucher (रसिद भौचर)</option>
            <option value="Contra">Contra Voucher (नगद/बैंक हस्तान्तरण)</option>
          </select>
        </div>

        {/* Voucher Date Picker */}
        <div className="space-y-1.5 xl:col-span-4">
          <label className="text-slate-700 font-bold block text-xs">Voucher Date (BS / AD) *</label>
          <NepaliDatePicker
            value={dateBS}
            onChange={handleDateChange}
            className="w-full"
          />
        </div>

        {/* Voucher Number */}
        <div className="space-y-1.5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <label className="text-slate-700 font-bold block text-xs">Voucher Number *</label>
            <button
              type="button"
              onClick={handleRegenerateVoucherNo}
              className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
              title="Regenerate auto Voucher ID"
            >
              <RefreshCw className="w-3 h-3" /> Auto
            </button>
          </div>
          <div className="relative">
            <input
              type="text"
              required
              value={voucherNo}
              readOnly={!isVoucherNoEditable}
              onChange={(e) => setVoucherNo(e.target.value)}
              className={`w-full bg-white border border-slate-200 rounded-xl p-2.5 font-mono font-black text-slate-900 text-xs shadow-2xs focus:border-emerald-500 focus:outline-none ${!isVoucherNoEditable ? 'bg-slate-100/70 text-slate-700' : ''}`}
            />
            <button
              type="button"
              onClick={() => setIsVoucherNoEditable(!isVoucherNoEditable)}
              className="absolute right-2.5 top-2.5 text-[10px] text-slate-500 hover:text-slate-600 font-bold cursor-pointer"
            >
              {isVoucherNoEditable ? 'Lock' : 'Edit'}
            </button>
          </div>
        </div>

        {/* Prepared By */}
        <div className="space-y-1.5 xl:col-span-3">
          <label className="text-slate-700 font-bold block text-xs">Prepared By *</label>
          <input
            type="text"
            required
            value={preparedBy}
            onChange={(e) => setPreparedBy(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-900 font-semibold text-xs focus:border-emerald-500 focus:outline-none shadow-2xs"
          />
        </div>

      </div>

      {/* 4. Line-Item Compound Entry Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-slate-900 text-sm">Line-Item Accounting Grid</h3>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold border border-slate-200">
              {rows.length} Entries
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleAddRow('debit')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl font-bold transition cursor-pointer text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Debit Line</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddRow('credit')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl font-bold transition cursor-pointer text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Credit Line</span>
            </button>
          </div>
        </div>

        {/* Dynamic Grid Table */}
        <div className="border border-slate-200/90 rounded-2xl overflow-visible bg-white shadow-2xs">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/90 text-slate-700 text-xs font-bold border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-3 w-12 text-center">#</th>
                <th className="py-3 px-4 w-72 sm:w-80">Account Code & Title *</th>
                <th className="py-3 px-3">Line Description / Particulars</th>
                <th className="py-3 px-3 w-32 text-right">Debit (Dr रु.)</th>
                <th className="py-3 px-3 w-32 text-right">Credit (Cr रु.)</th>
                <th className="py-3 px-2 w-10 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 text-xs">
              {rows.map((row, index) => {
                const isDebitRow = (parseFloat(row.debit) || 0) > 0;
                const isCreditRow = (parseFloat(row.credit) || 0) > 0;
                const isComboboxOpen = activeComboboxRowId === row.id;

                // Account Search Filter
                const filteredAccounts = safeChart.filter(c => {
                  if (!accountSearchQuery.trim()) return true;
                  const q = accountSearchQuery.toLowerCase();
                  return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q);
                });

                return (
                  <tr key={row.id} className="hover:bg-slate-50/40 transition-colors">
                    {/* Index & Dr/Cr Badge */}
                    <td className="py-3 px-3 text-center font-bold text-slate-500">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-slate-500 font-mono">#{index + 1}</span>
                        {isDebitRow ? (
                          <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded mt-0.5">Dr</span>
                        ) : isCreditRow ? (
                          <span className="text-[9px] font-black bg-slate-200 text-slate-800 px-1 py-0.2 rounded mt-0.5">Cr</span>
                        ) : (
                          <span className="text-[9px] text-slate-600">-</span>
                        )}
                      </div>
                    </td>

                    {/* Account Search Combobox */}
                    <td className="py-3 px-4 relative">
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={row.accountName}
                          onClick={() => {
                            setActiveComboboxRowId(row.id);
                            setAccountSearchQuery('');
                          }}
                          onChange={(e) => {
                            handleRowChange(row.id, 'accountName', e.target.value);
                            setAccountSearchQuery(e.target.value);
                            setActiveComboboxRowId(row.id);
                          }}
                          placeholder="Search Code or Title (e.g. 1001)..."
                          className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl py-2 px-3 text-xs font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none transition shadow-2xs"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
                      </div>

                      {/* Searchable Account Dropdown List */}
                      {isComboboxOpen && (
                        <div 
                          ref={comboboxRef}
                          className="absolute z-50 left-4 right-4 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-56 overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
                        >
                          <div className="p-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 flex justify-between items-center">
                            <span>SELECT CHART OF ACCOUNT</span>
                            <span>{filteredAccounts.length} match(es)</span>
                          </div>
                          {filteredAccounts.length === 0 ? (
                            <div className="p-4 text-center text-slate-500 italic text-xs">
                              No matching account head found
                            </div>
                          ) : (
                            filteredAccounts.map(acc => (
                              <div
                                key={acc.id}
                                onClick={() => handleSelectAccount(row.id, acc)}
                                className="p-2.5 hover:bg-emerald-50 border-b border-slate-100 last:border-0 cursor-pointer transition flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-bold text-slate-900 flex items-center gap-2">
                                    <span className="font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 text-[10px]">
                                      {acc.code}
                                    </span>
                                    <span>{acc.name}</span>
                                  </div>
                                  <span className="text-[10px] text-slate-500 font-medium">Type: {acc.type}</span>
                                </div>
                                <span className="font-mono font-bold text-slate-600 text-[11px]">
                                  रु. {(acc.balance || 0).toLocaleString('en-IN')}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </td>

                    {/* Particulars / Line Narration */}
                    <td className="py-3 px-3">
                      <input
                        type="text"
                        value={row.lineNarration}
                        onChange={(e) => handleRowChange(row.id, 'lineNarration', e.target.value)}
                        placeholder="Line note (optional)..."
                        className="w-full bg-slate-50/50 border border-slate-200/80 rounded-xl py-2 px-3 text-xs text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none transition"
                      />
                    </td>

                    {/* Debit Amount */}
                    <td className="py-3 px-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={row.debit}
                        onChange={(e) => handleRowChange(row.id, 'debit', e.target.value)}
                        className={`w-full bg-slate-50/80 border border-slate-200/90 rounded-xl py-2 px-3 text-right font-mono font-bold text-xs focus:bg-white focus:border-emerald-500 focus:outline-none shadow-2xs ${ parseFloat(row.debit) > 0 ? 'text-emerald-800 font-black' : 'text-slate-500' }`}
                      />
                    </td>

                    {/* Credit Amount */}
                    <td className="py-3 px-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={row.credit}
                        onChange={(e) => handleRowChange(row.id, 'credit', e.target.value)}
                        className={`w-full bg-slate-50/80 border border-slate-200/90 rounded-xl py-2 px-3 text-right font-mono font-bold text-xs focus:bg-white focus:border-emerald-500 focus:outline-none shadow-2xs ${ parseFloat(row.credit) > 0 ? 'text-emerald-800 font-black' : 'text-slate-500' }`}
                      />
                    </td>

                    {/* Action Trash Icon */}
                    <td className="py-3 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(row.id)}
                        disabled={rows.length <= 2}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        title={rows.length <= 2 ? 'Minimum 2 rows required for double entry' : 'Delete Row'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Auto-Balancing Table Footer */}
            <tfoot className="bg-slate-50/90 font-extrabold border-t-2 border-slate-200 text-slate-900 text-xs">
              <tr>
                <td colSpan={3} className="py-3.5 px-4 text-right uppercase text-slate-600 tracking-wider">
                  <div className="flex items-center justify-end gap-3">
                    {!isBalanced && (
                      <button
                        type="button"
                        onClick={() => handleAutoBalance()}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] font-bold transition cursor-pointer shadow-2xs"
                      >
                        <Calculator className="w-3.5 h-3.5 text-amber-600" />
                        <span>Auto-Balance Last Row (रु. {diff.toLocaleString('en-IN', { minimumFractionDigits: 2 })})</span>
                      </button>
                    )}
                    <span>TOTAL BALANCED AMOUNT:</span>
                  </div>
                </td>
                <td className="py-3.5 px-3 text-right font-mono text-emerald-800 text-sm font-black">
                  रु. {totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-3.5 px-3 text-right font-mono text-emerald-800 text-sm font-black">
                  रु. {totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 5. Amount in Words Banner */}
      {isBalanced && totalDebit > 0 && (
        <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200/80 flex items-center gap-3">
          <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-emerald-700 font-extrabold uppercase tracking-wider block">
              AMOUNT IN WORDS (अक्षरेपी):
            </span>
            <p className="text-slate-900 font-bold text-xs mt-0.5 italic">
              {formatAmountInWords(totalDebit)}
            </p>
          </div>
        </div>
      )}

      {/* 6. Voucher Narration & File Attachments */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        
        {/* Main Narration */}
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-slate-700 font-bold block text-xs">
            Overall Voucher Narration / Description *
          </label>
          <textarea
            required
            rows={3}
            value={voucherNarration}
            onChange={(e) => setVoucherNarration(e.target.value)}
            placeholder="Detailed accounting justification, member name, voucher ref, or approval memo..."
            className="w-full bg-slate-50/80 border border-slate-200 rounded-2xl p-3 text-slate-900 text-xs focus:bg-white focus:border-emerald-500 focus:outline-none transition shadow-2xs leading-relaxed"
          />
        </div>

        {/* File Attachments Zone */}
        <div className="space-y-1.5">
          <label className="text-slate-700 font-bold block text-xs flex items-center justify-between">
            <span>Supporting Attachments</span>
            <span className="text-[10px] text-slate-500 font-normal">Receipts, Bills, Notes</span>
          </label>

          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx"
          />

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFileUpload(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition ${ isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-400 bg-slate-50/50' }`}
          >
            <Upload className="w-5 h-5 text-slate-500 mx-auto mb-1" />
            <p className="font-semibold text-slate-700 text-[11px]">Drop physical receipt files here</p>
            <p className="text-slate-500 text-[10px] mt-0.5">or click to browse files</p>
          </div>

          {/* Attached Files List */}
          {attachments.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {attachments.map(file => (
                <div key={file.id} className="flex items-center justify-between bg-slate-100/70 p-2 rounded-xl border border-slate-200 text-[11px]">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Paperclip className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span className="font-medium text-slate-800 truncate">{file.name}</span>
                    <span className="text-[9px] text-slate-500 font-mono shrink-0">({(file.size / 1024).toFixed(0)} KB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleRemoveAttachment(file.id); }}
                    className="p-1 text-slate-500 hover:text-rose-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* 7. Footer Actions */}
      <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {isBalanced ? (
            <div className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 text-emerald-800 border border-emerald-300/80 rounded-xl text-xs font-bold shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Balanced</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-2 bg-rose-50 text-rose-800 border border-rose-300/80 rounded-xl text-xs font-bold shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Out of Balance by रु. {diff.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="submit"
            disabled={!canPost || submitting}
            className={`w-full sm:w-auto px-7 py-3 rounded-2xl font-bold text-xs transition cursor-pointer shadow-md flex items-center justify-center gap-2 ${ canPost && !submitting ? 'bg-emerald-800 hover:bg-emerald-700 text-white shadow-emerald-950/10' : 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none' }`}
          >
            {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{submitting ? 'Posting...' : 'Post Double-Entry Voucher'}</span>
          </button>
        </div>
      </div>
    </form>
  );
};
