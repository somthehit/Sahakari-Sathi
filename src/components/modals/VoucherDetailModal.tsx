import React, { useState } from 'react';
import { useCoop } from '../../context/CoopContext';
import { X, Printer, FileText, ChevronDown, LayoutTemplate, Check } from 'lucide-react';

type TemplateId = 'classic' | 'modern' | 'compact';

interface VoucherTemplate {
  id: TemplateId;
  label: string;
  description: string;
}

const TEMPLATES: VoucherTemplate[] = [
  { id: 'classic', label: 'Classic Formal', description: 'Traditional serif voucher with signature blocks' },
  { id: 'modern', label: 'Modern Clean', description: 'Banded emerald layout with rounded cards' },
  { id: 'compact', label: 'Compact Dense', description: 'Space-saving condensed print layout' },
];

const getSavedTemplate = (): TemplateId => {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('voucher_print_template') : null;
  if (saved === 'classic' || saved === 'modern' || saved === 'compact') return saved;
  return 'classic';
};

// Per-template class theme applied to the printable voucher document
const THEME: Record<TemplateId, Record<string, string>> = {
  classic: {
    doc: 'space-y-5 text-xs bg-white text-slate-900 font-serif',
    header: 'text-center pb-3 border-b-2 border-slate-200',
    topRule: 'border-t-4 border-slate-200 w-40 mx-auto mb-2',
    title: 'text-xl font-black tracking-wide uppercase',
    subtitle: 'text-[11px] mt-1 text-slate-600',
    badge: 'mt-3 inline-block px-6 py-1.5 border-2 border-slate-200 text-slate-900 font-bold font-mono text-[11px] uppercase tracking-[0.2em]',
    metaCard: 'grid grid-cols-2 gap-y-3 gap-x-6 border-2 border-slate-300 p-4',
    metaLabel: 'text-slate-500 font-semibold block text-[10px] uppercase tracking-widest',
    tableWrap: 'border-2 border-slate-400',
    tableHead: 'bg-slate-100 text-slate-800 border-b-2 border-slate-400',
    entryCode: 'bg-slate-100 border border-slate-300 px-2 py-0.5 text-[11px]',
    entryName: 'font-bold',
    tfoot: 'border-t-2 border-slate-400 bg-slate-100',
    narration: 'border-2 border-slate-300 p-4',
    footer: 'grid grid-cols-3 gap-6 pt-12 text-center text-[11px] font-semibold text-slate-600',
    footerLine: 'border-t-2 border-slate-500 pt-2',
  },
  modern: {
    doc: 'space-y-5 text-xs bg-white text-slate-900',
    header: 'bg-gradient-to-r from-emerald-700 to-teal-600 text-white rounded-xl px-6 py-5 shadow-sm',
    topRule: '',
    title: 'text-lg font-black tracking-tight',
    subtitle: 'text-emerald-50/90 text-[11px] mt-0.5',
    badge: 'mt-3 inline-flex items-center gap-1.5 bg-white/15 border border-white/30 text-white px-4 py-1 rounded-full font-bold text-[10px] uppercase tracking-widest',
    metaCard: 'grid grid-cols-2 gap-y-3 gap-x-4 bg-white border border-slate-200 p-4 rounded-xl shadow-xs',
    metaLabel: 'text-slate-500 font-semibold block text-[10px] uppercase tracking-wider',
    tableWrap: 'border border-slate-200 rounded-xl overflow-hidden shadow-xs',
    tableHead: 'bg-emerald-50 text-emerald-900 border-b border-slate-200',
    entryCode: 'bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-md font-mono text-[11px]',
    entryName: 'font-bold',
    tfoot: 'bg-slate-50 border-t border-slate-200',
    narration: 'bg-emerald-50/60 border border-emerald-100 p-4 rounded-xl',
    footer: 'flex items-center justify-between text-[10px] text-slate-500 pt-1',
    footerLine: '',
  },
  compact: {
    doc: 'space-y-3 text-[10px] bg-white text-slate-900',
    header: 'flex items-start justify-between border-b border-slate-300 pb-2',
    topRule: '',
    title: 'text-xs font-black uppercase tracking-wide',
    subtitle: 'text-[9px] text-slate-500 mt-0.5',
    badge: 'inline-block border border-slate-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest',
    metaCard: 'grid grid-cols-4 gap-2',
    metaLabel: 'text-slate-500 text-[8px] uppercase tracking-wide',
    tableWrap: 'border border-slate-300',
    tableHead: 'bg-slate-50 border-b border-slate-300 text-slate-700',
    entryCode: 'font-mono font-bold text-[10px]',
    entryName: '',
    tfoot: 'border-t border-slate-300 bg-slate-50',
    narration: 'border-t border-slate-200 pt-1.5',
    footer: 'hidden',
    footerLine: '',
  },
};

export const VoucherDetailModal: React.FC = () => {
  const { selectedVoucherForDetail, setSelectedVoucherForDetail, activeBranch } = useCoop();
  const [templateId, setTemplateId] = useState<TemplateId>(getSavedTemplate);
  const [tplMenuOpen, setTplMenuOpen] = useState(false);

  if (!selectedVoucherForDetail) return null;

  const v = selectedVoucherForDetail;
  const tpl = THEME[templateId];

  const selectTemplate = (id: TemplateId) => {
    setTemplateId(id);
    setTplMenuOpen(false);
    try {
      localStorage.setItem('voucher_print_template', id);
    } catch {
      /* ignore */
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('printable-voucher-document');
    if (!printContent) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=850,height=950');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Voucher_${v.voucherNo}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @page { size: A4 portrait; margin: 12mm; }
              body { font-family: system-ui, -apple-system, sans-serif; background: #ffffff; color: #0f172a; padding: 20px; }
              .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
              .font-serif { font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif; }
            </style>
          </head>
          <body class="bg-white p-4">
            <div class="max-w-2xl mx-auto bg-white">
              ${printContent.innerHTML}
            </div>
            <script>
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                  window.close();
                }, 300);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      window.print();
    }
  };

  const totalDebit = v.entries.reduce((a, b) => a + (b.debit || 0), 0);
  const totalCredit = v.entries.reduce((a, b) => a + (b.credit || 0), 0);

  const formattedVoucherType = v.voucherType
    ? v.voucherType.toUpperCase().replace(/\s*VOUCHER$/i, '') + ' VOUCHER'
    : 'RECEIPT VOUCHER';

  const renderThumb = (id: TemplateId) => {
    if (id === 'classic') {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-0.5 p-1">
          <div className="w-6 h-0.5 bg-slate-700" />
          <div className="w-8 h-1 bg-slate-700 mt-0.5" />
          <div className="w-9 h-0.5 bg-slate-300 mt-0.5" />
          <div className="w-9 h-2 bg-slate-200 mt-0.5" />
          <div className="w-9 h-2 bg-slate-100 mt-0.5" />
        </div>
      );
    }
    if (id === 'modern') {
      return (
        <div className="h-full bg-gradient-to-b from-emerald-600 to-emerald-500 p-1">
          <div className="h-2 bg-white/90 rounded-sm" />
          <div className="h-4 bg-white/80 rounded-sm mt-1" />
          <div className="h-1.5 bg-white/40 rounded-sm mt-1" />
        </div>
      );
    }
    return (
      <div className="h-full p-1 space-y-0.5">
        <div className="flex justify-between">
          <div className="w-4 h-0.5 bg-slate-400" />
          <div className="w-3 h-0.5 bg-slate-400" />
        </div>
        <div className="w-full h-0.5 bg-slate-300" />
        <div className="w-full h-0.5 bg-slate-300" />
        <div className="w-3/4 h-0.5 bg-slate-300" />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden text-slate-800 flex flex-col animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-200 ease-out max-h-[90vh]">

        {/* Modal Header Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between no-print shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2.5 font-bold text-sm text-slate-900">
            <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
              <FileText className="w-4 h-4" />
            </div>
            <span>Accounting Voucher Details</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Template Style Selector / Gallery */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setTplMenuOpen(o => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer shadow-xs"
                title="Choose voucher document style"
              >
                <LayoutTemplate className="w-3.5 h-3.5 text-emerald-700" />
                <span>{TEMPLATES.find(t => t.id === templateId)?.label}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${tplMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {tplMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setTplMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl p-3 z-50 space-y-1.5 animate-in fade-in zoom-in-95 duration-150">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1 pb-1">
                      Voucher Print Template
                    </div>
                    {TEMPLATES.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => selectTemplate(t.id)}
                        className={`w-full flex items-start gap-3 p-2.5 rounded-xl border transition cursor-pointer text-left ${ templateId === t.id ? 'border-emerald-500 bg-emerald-50/60' : 'border-slate-200 hover:bg-slate-50' }`}
                      >
                        <div className="w-12 h-14 rounded border border-slate-200 bg-white shadow-xs flex-shrink-0 overflow-hidden">
                          {renderThumb(t.id)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-800">{t.label}</span>
                            {templateId === t.id && <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />}
                          </div>
                          <span className="block text-[10px] text-slate-500 leading-tight mt-0.5">{t.description}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Voucher</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedVoucherForDetail(null)}
              className="p-1.5 text-slate-500 hover:text-slate-700 bg-slate-200/60 rounded-xl transition cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Container / Printable Voucher Paper */}
        <div className="p-6 bg-white overflow-y-auto">
          <div id="printable-voucher-document" className={`printable-voucher-document ${tpl.doc}`}>

            {/* Voucher Letterhead (template-specific) */}
            {templateId === 'classic' && (
              <div className={tpl.header}>
                <div className={tpl.topRule} />
                <h1 className={tpl.title}>SAHAKARI SAVINGS & CREDIT CO-OPERATIVE LTD.</h1>
                <p className={tpl.subtitle}>
                  {activeBranch?.name || 'Head Office - Kathmandu'} • {activeBranch?.address || 'New Road, Kathmandu'} • Ph: {activeBranch?.phone || '01-4235890'}
                </p>
                <div className={tpl.badge}>{formattedVoucherType}</div>
              </div>
            )}

            {templateId === 'modern' && (
              <div className={tpl.header}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className={tpl.title}>SAHAKARI SAVINGS & CREDIT CO-OPERATIVE LTD.</h1>
                    <p className={tpl.subtitle}>
                      {activeBranch?.name || 'Head Office - Kathmandu'} • {activeBranch?.address || 'New Road, Kathmandu'} • Ph: {activeBranch?.phone || '01-4235890'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[9px] uppercase tracking-widest text-emerald-100/80">Voucher</div>
                    <div className="font-mono font-black text-sm mt-0.5">{v.voucherNo}</div>
                  </div>
                </div>
                <div className={tpl.badge}>{formattedVoucherType}</div>
              </div>
            )}

            {templateId === 'compact' && (
              <div className={tpl.header}>
                <div>
                  <h1 className={tpl.title}>SAHAKARI SAVINGS & CREDIT CO-OPERATIVE LTD.</h1>
                  <p className={tpl.subtitle}>
                    {activeBranch?.name || 'Head Office - Kathmandu'} • {activeBranch?.address || 'New Road, Kathmandu'} • Ph: {activeBranch?.phone || '01-4235890'}
                  </p>
                </div>
                <div className="text-right shrink-0 space-y-0.5">
                  <div className={tpl.badge}>{formattedVoucherType}</div>
                  <div className="font-mono font-black text-[10px]">{v.voucherNo}</div>
                </div>
              </div>
            )}

            {/* Voucher Metadata */}
            <div className={tpl.metaCard}>
              <div>
                <span className={`${tpl.metaLabel} block`}>Voucher Number:</span>
                <span className="font-mono font-black text-slate-900 text-sm mt-0.5 block">{v.voucherNo}</span>
              </div>
              <div className="text-right">
                <span className={`${tpl.metaLabel} block`}>Date (BS / AD):</span>
                <span className="font-bold text-emerald-700 text-xs mt-0.5 inline-block">
                  {v.dateBS} BS <span className="text-slate-500 font-normal">({v.dateAD})</span>
                </span>
              </div>
              <div>
                <span className={`${tpl.metaLabel} block`}>Prepared By:</span>
                <span className="font-bold text-slate-800 text-xs mt-0.5 block">{v.preparedBy || 'Teller Staff'}</span>
              </div>
              <div className="text-right">
                <span className={`${tpl.metaLabel} block`}>Status:</span>
                <span className="font-extrabold text-emerald-700 bg-emerald-50 px-3 py-0.5 rounded-md border border-emerald-200 text-xs inline-block mt-0.5">
                  {v.status || 'Posted'}
                </span>
              </div>
            </div>

            {/* Account Entries Table */}
            <div className={tpl.tableWrap}>
              <table className="w-full text-left border-collapse">
                <thead className={`text-xs font-bold ${tpl.tableHead}`}>
                  <tr>
                    <th className="py-3 px-4">Account Code & Title</th>
                    <th className="py-3 px-4 text-right">Debit (रु.)</th>
                    <th className="py-3 px-4 text-right">Credit (रु.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 text-xs">
                  {v.entries.map((e, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <span className={`${tpl.entryCode} font-mono font-bold shrink-0`}>
                            {e.accountCode}
                          </span>
                          <span className={`${tpl.entryName} text-slate-900`}>{e.accountName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                        {e.debit > 0 ? e.debit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                        {e.credit > 0 ? e.credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className={`font-extrabold text-slate-900 text-xs ${tpl.tfoot}`}>
                  <tr>
                    <td className="py-3.5 px-4 text-right uppercase text-slate-600 tracking-wider">
                      TOTAL BALANCED AMOUNT:
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-700 text-sm">
                      रु. {totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-700 text-sm">
                      रु. {totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Narration Box */}
            <div className={tpl.narration}>
              <span className="text-slate-500 font-extrabold block text-[10px] uppercase tracking-wider">
                NARRATION / DESCRIPTION:
              </span>
              <p className="text-slate-800 mt-1 italic font-serif leading-relaxed text-xs">
                {v.narration}
              </p>
            </div>

            {/* Signatures / Footer (template-specific) */}
            {templateId === 'classic' && (
              <div className={tpl.footer}>
                <div className={`${tpl.footerLine} mt-auto`}>Prepared By (Teller)</div>
                <div className={`${tpl.footerLine} mt-auto`}>Verified By (Accountant)</div>
                <div className={`${tpl.footerLine} mt-auto`}>Approved By (Manager)</div>
              </div>
            )}

            {templateId === 'modern' && (
              <div className={tpl.footer}>
                <span>Generated by Sahakari Sathi</span>
                <span className="font-mono">{v.voucherNo}</span>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};
