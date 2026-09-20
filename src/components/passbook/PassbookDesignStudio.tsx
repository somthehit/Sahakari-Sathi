import React from 'react';
import {
  SlidersHorizontal, RefreshCw, Ruler, Rows3, Columns3, Type, Grid3x3, Eye,
  Plus, Trash2, Printer, LayoutGrid,
} from 'lucide-react';
import {
  PassbookLayoutConfig, PassbookColumn, PassbookColumnKey, PassbookTextAlign,
  PASSBOOK_LAYOUT_BOUNDS, DEFAULT_PASSBOOK_LAYOUT, DEFAULT_A4_STATEMENT_LAYOUT,
  paginatePassbook, groupRowsByPage,
} from '../../utils/passbookLayout';
import { PassbookPage, PassbookPositionedRowData, toPassbookRow } from './PassbookPage';
import { printPassbook, PassbookPrintMode } from '../../utils/printPassbook';

const PX_PER_MM = 96 / 25.4;

const ALL_COLUMN_KEYS: { key: PassbookColumnKey; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'particulars', label: 'Particulars' },
  { key: 'voucher', label: 'Voucher' },
  { key: 'withdrawal', label: 'Withdrawal' },
  { key: 'deposit', label: 'Deposit' },
  { key: 'balance', label: 'Balance' },
  { key: 'teller', label: 'Teller' },
];

const SIZE_PRESETS: { label: string; w: number; h: number }[] = [
  { label: 'Booklet panel (105 × 165 mm)', w: 105, h: 165 },
  { label: 'Booklet wide (120 × 90 mm)', w: 120, h: 90 },
  { label: 'A4 statement (210 × 297 mm)', w: 210, h: 297 },
  { label: 'Thermal roll (80 mm)', w: 80, h: 200 },
];

/** Stable sample transactions used to render the calibration preview. */
const SAMPLE_TXNS = [
  { bsDate: '२०८३-०४-०१', dateAd: '2026-07-16', voucherNo: 'DP-2201', particulars: 'नगद जम्मा', debit: 0, credit: 5000, balance: 5000, tellerName: 'Sita' },
  { bsDate: '२०८३-०४-०३', dateAd: '2026-07-18', voucherNo: 'DP-2210', particulars: 'Cash deposit', debit: 0, credit: 12000, balance: 17000, tellerName: 'Sita' },
  { bsDate: '२०८३-०४-०७', dateAd: '2026-07-22', voucherNo: 'WD-3301', particulars: 'नगद भुक्तानी', debit: 2500, credit: 0, balance: 14500, tellerName: 'Ram' },
  { bsDate: '२०८३-०४-१२', dateAd: '2026-07-27', voucherNo: 'INT-9001', particulars: 'ब्याज जम्मा', debit: 0, credit: 187.5, balance: 14687.5, tellerName: 'System' },
  { bsDate: '२०८३-०४-१५', dateAd: '2026-07-30', voucherNo: 'WD-3340', particulars: 'ATM withdrawal', debit: 3000, credit: 0, balance: 11687.5, tellerName: 'Ram' },
  { bsDate: '२०८३-०४-२०', dateAd: '2026-08-04', voucherNo: 'DP-2255', particulars: 'चेक जम्मा', debit: 0, credit: 8000, balance: 19687.5, tellerName: 'Gita' },
  { bsDate: '२०८३-०४-२५', dateAd: '2026-08-09', voucherNo: 'CHG-101', particulars: 'सेवा शुल्क', debit: 50, credit: 0, balance: 19637.5, tellerName: 'System' },
  { bsDate: '२०८३-०४-२९', dateAd: '2026-08-13', voucherNo: 'DP-2270', particulars: 'Salary credit', debit: 0, credit: 25000, balance: 44637.5, tellerName: 'Gita' },
];

export interface PassbookDesignStudioProps {
  config: PassbookLayoutConfig;
  onConfigChange: (next: PassbookLayoutConfig) => void;
  mode: PassbookPrintMode;
  idForPrint?: string;
}

const inputCls = 'w-full mt-0.5 bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-800 focus:outline-none focus:border-emerald-500';
const numCls = 'w-full mt-0.5 bg-slate-50 border border-slate-200 rounded-lg p-1.5 font-medium text-slate-800 focus:outline-none focus:border-emerald-500';
const sectionCls = 'space-y-2.5 pt-3 border-t border-slate-100';

export const PassbookDesignStudio: React.FC<PassbookDesignStudioProps> = ({
  config, onConfigChange, mode, idForPrint = 'passbook-studio-print',
}) => {
  const [showBaselines, setShowBaselines] = React.useState(true);
  const [showColumnGuides, setShowColumnGuides] = React.useState(false);
  const [fillFull, setFillFull] = React.useState(false);
  const [gridInTest, setGridInTest] = React.useState(true);

  const B = PASSBOOK_LAYOUT_BOUNDS;
  const patch = (p: Partial<PassbookLayoutConfig>) => onConfigChange({ ...config, ...p });
  const patchCol = (idx: number, p: Partial<PassbookColumn>) =>
    onConfigChange({ ...config, columns: config.columns.map((c, i) => (i === idx ? { ...c, ...p } : c)) });
  const removeCol = (idx: number) =>
    onConfigChange({ ...config, columns: config.columns.filter((_, i) => i !== idx) });

  const usedKeys = new Set(config.columns.map((c) => c.key));
  const availableKeys = ALL_COLUMN_KEYS.filter((k) => !usedKeys.has(k.key));

  const addCol = (key: PassbookColumnKey) => {
    const meta = ALL_COLUMN_KEYS.find((k) => k.key === key);
    const rightmost = config.columns.reduce((m, c) => Math.max(m, c.xMm + c.widthMm), 0);
    const col: PassbookColumn = {
      key,
      label: meta?.label ?? key,
      xMm: Math.min(config.pageWidthMm - 12, Math.round(rightmost + 2)),
      widthMm: 14,
      align: key === 'withdrawal' || key === 'deposit' || key === 'balance' ? 'right' : 'left',
    };
    onConfigChange({ ...config, columns: [...config.columns, col] });
  };

  const resetDefault = () => onConfigChange(mode === 'a4' ? { ...DEFAULT_A4_STATEMENT_LAYOUT } : { ...DEFAULT_PASSBOOK_LAYOUT });

  // ── Build the preview page from sample data ──────────────────────
  const sampleCount = fillFull ? config.linesPerPage : Math.min(config.linesPerPage, SAMPLE_TXNS.length);
  const sampleTxns = Array.from({ length: sampleCount }, (_, i) => SAMPLE_TXNS[i % SAMPLE_TXNS.length]);
  const pagination = paginatePassbook(sampleTxns.length, {
    startLine: 0,
    linesPerPage: config.linesPerPage,
    marginTopMm: config.marginTopMm,
    lineHeightMm: config.lineHeightMm,
  });
  const firstPageRows: PassbookPositionedRowData[] = groupRowsByPage(pagination.rows)[0]?.map((r) => ({
    data: toPassbookRow(sampleTxns[r.rowIndex], config.dateFormat),
    line: r.line,
    topMm: r.topMm,
  })) ?? [];

  const titleLines = config.showHeader
    ? ['SAHAKARI SATHI SACCOS', 'Account Statement — Sample Member (A/C 001-0100-0000123)', 'Branch: Koteshwor  ·  Printed for calibration']
    : undefined;

  const scale = Math.min(1.5, 460 / (config.pageWidthMm * PX_PER_MM));
  const scaledW = config.pageWidthMm * PX_PER_MM * scale;
  const scaledH = config.pageHeightMm * PX_PER_MM * scale;

  const runTestPrint = () => {
    printPassbook(idForPrint, mode, {
      pageWidthMm: config.pageWidthMm,
      pageHeightMm: config.pageHeightMm,
      thermalWidthMm: config.pageWidthMm,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs text-slate-800">
      {/* Controls */}
      <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">Passbook Layout & Calibration</h3>
          </div>
          <button type="button" onClick={resetDefault}
            className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1 font-medium cursor-pointer">
            <RefreshCw className="w-3 h-3" /> Reset
          </button>
        </div>

        {/* Page size */}
        <div className="space-y-2">
          <label className="font-bold text-slate-800 flex items-center gap-1.5">
            <Ruler className="w-3.5 h-3.5 text-emerald-600" /> Page Size (mm)
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            {SIZE_PRESETS.map((p) => {
              const active = config.pageWidthMm === p.w && config.pageHeightMm === p.h;
              return (
                <button key={p.label} type="button" onClick={() => patch({ pageWidthMm: p.w, pageHeightMm: p.h })}
                  className={`px-2.5 py-1.5 rounded-lg border text-left transition cursor-pointer ${active ? 'border-emerald-600 bg-emerald-50 font-bold text-emerald-900' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-500 font-semibold">Width (mm)</span>
              <input type="number" min={B.pageWidthMm.min} max={B.pageWidthMm.max} value={config.pageWidthMm}
                onChange={(e) => patch({ pageWidthMm: Number(e.target.value) || config.pageWidthMm })} className={numCls} />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-semibold">Height (mm)</span>
              <input type="number" min={B.pageHeightMm.min} max={B.pageHeightMm.max} value={config.pageHeightMm}
                onChange={(e) => patch({ pageHeightMm: Number(e.target.value) || config.pageHeightMm })} className={numCls} />
            </div>
          </div>
        </div>

        {/* Line grid */}
        <div className={sectionCls}>
          <label className="font-bold text-slate-800 flex items-center gap-1.5">
            <Rows3 className="w-3.5 h-3.5 text-emerald-600" /> Line Grid
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-500 font-semibold">Top offset (mm)</span>
              <input type="number" step={0.5} min={B.marginTopMm.min} max={B.marginTopMm.max} value={config.marginTopMm}
                onChange={(e) => patch({ marginTopMm: Number(e.target.value) })} className={numCls} />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-semibold">Left inset (mm)</span>
              <input type="number" step={0.5} min={B.marginLeftMm.min} max={B.marginLeftMm.max} value={config.marginLeftMm}
                onChange={(e) => patch({ marginLeftMm: Number(e.target.value) })} className={numCls} />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-semibold">Line height (mm)</span>
              <input type="number" step={0.1} min={B.lineHeightMm.min} max={B.lineHeightMm.max} value={config.lineHeightMm}
                onChange={(e) => patch({ lineHeightMm: Number(e.target.value) || config.lineHeightMm })} className={numCls} />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-semibold">Lines / page</span>
              <input type="number" min={B.linesPerPage.min} max={B.linesPerPage.max} value={config.linesPerPage}
                onChange={(e) => patch({ linesPerPage: Number(e.target.value) || config.linesPerPage })} className={numCls} />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-semibold">Base font (pt)</span>
              <input type="number" step={0.5} min={B.fontSizePt.min} max={B.fontSizePt.max} value={config.fontSizePt}
                onChange={(e) => patch({ fontSizePt: Number(e.target.value) || config.fontSizePt })} className={numCls} />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-semibold">Date column</span>
              <select value={config.dateFormat} onChange={(e) => patch({ dateFormat: e.target.value as PassbookLayoutConfig['dateFormat'] })}
                className={numCls}>
                <option value="bs">BS only</option>
                <option value="ad">AD only</option>
                <option value="both">BS · AD</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <label className="flex items-center justify-between p-2 bg-slate-50 rounded-lg font-medium text-slate-700">
              Ruled table
              <input type="checkbox" checked={config.showColumnRules} onChange={(e) => patch({ showColumnRules: e.target.checked })} className="w-4 h-4 accent-emerald-600 rounded cursor-pointer" />
            </label>
            <label className="flex items-center justify-between p-2 bg-slate-50 rounded-lg font-medium text-slate-700">
              Column header
              <input type="checkbox" checked={config.showHeader} onChange={(e) => patch({ showHeader: e.target.checked })} className="w-4 h-4 accent-emerald-600 rounded cursor-pointer" />
            </label>
          </div>
        </div>

        {/* Columns */}
        <div className={sectionCls}>
          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-800 flex items-center gap-1.5">
              <Columns3 className="w-3.5 h-3.5 text-emerald-600" /> Columns ({config.columns.length})
            </label>
            {availableKeys.length > 0 && (
              <select value="" onChange={(e) => { if (e.target.value) addCol(e.target.value as PassbookColumnKey); }}
                className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-2 py-1 font-semibold cursor-pointer">
                <option value="">+ Add column…</option>
                {availableKeys.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              </select>
            )}
          </div>
          <div className="space-y-1.5">
            {config.columns.map((c, idx) => (
              <div key={c.key} className="rounded-xl border border-slate-200 bg-slate-50 p-2 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-500">{c.key}</span>
                  <input type="text" value={c.label} onChange={(e) => patchCol(idx, { label: e.target.value })}
                    className="flex-1 bg-white border border-slate-200 rounded-md px-2 py-1 font-semibold text-slate-800 focus:outline-none focus:border-emerald-500" />
                  <button type="button" onClick={() => removeCol(idx)} className="text-rose-400 hover:text-rose-600 cursor-pointer shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <div>
                    <span className="text-[9px] text-slate-500 font-semibold">X (mm)</span>
                    <input type="number" step={0.5} min={0} max={config.pageWidthMm} value={c.xMm}
                      onChange={(e) => patchCol(idx, { xMm: Number(e.target.value) })} className={numCls} />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-semibold">W (mm)</span>
                    <input type="number" step={0.5} min={1} max={config.pageWidthMm} value={c.widthMm}
                      onChange={(e) => patchCol(idx, { widthMm: Number(e.target.value) || c.widthMm })} className={numCls} />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-semibold">Align</span>
                    <select value={c.align} onChange={(e) => patchCol(idx, { align: e.target.value as PassbookTextAlign })} className={numCls}>
                      <option value="left">L</option>
                      <option value="center">C</option>
                      <option value="right">R</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-semibold">Font pt</span>
                    <input type="number" step={0.5} min={B.fontSizePt.min} max={B.fontSizePt.max} value={c.fontSizePt ?? ''}
                      placeholder={String(config.fontSizePt)}
                      onChange={(e) => patchCol(idx, { fontSizePt: e.target.value === '' ? undefined : Number(e.target.value) })} className={numCls} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Calibration aids */}
        <div className={sectionCls}>
          <label className="font-bold text-slate-800 flex items-center gap-1.5">
            <Grid3x3 className="w-3.5 h-3.5 text-emerald-600" /> Calibration
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center justify-between p-2 bg-slate-50 rounded-lg font-medium text-slate-700">
              Line numbers
              <input type="checkbox" checked={showBaselines} onChange={(e) => setShowBaselines(e.target.checked)} className="w-4 h-4 accent-emerald-600 rounded cursor-pointer" />
            </label>
            <label className="flex items-center justify-between p-2 bg-slate-50 rounded-lg font-medium text-slate-700">
              Column guides
              <input type="checkbox" checked={showColumnGuides} onChange={(e) => setShowColumnGuides(e.target.checked)} className="w-4 h-4 accent-emerald-600 rounded cursor-pointer" />
            </label>
            <label className="flex items-center justify-between p-2 bg-slate-50 rounded-lg font-medium text-slate-700">
              Fill whole page
              <input type="checkbox" checked={fillFull} onChange={(e) => setFillFull(e.target.checked)} className="w-4 h-4 accent-emerald-600 rounded cursor-pointer" />
            </label>
            <label className="flex items-center justify-between p-2 bg-slate-50 rounded-lg font-medium text-slate-700">
              Grid in test
              <input type="checkbox" checked={gridInTest} onChange={(e) => setGridInTest(e.target.checked)} className="w-4 h-4 accent-emerald-600 rounded cursor-pointer" />
            </label>
          </div>
          <button type="button" onClick={runTestPrint}
            className="w-full mt-1 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer">
            <Printer className="w-3.5 h-3.5" /> Print test grid ({mode})
          </button>
          <p className="text-[10px] text-slate-500">
            Print onto the physical booklet, hold it to the light, and nudge the top offset / line height until the ruled lines match.
          </p>
        </div>
      </div>

      {/* Live preview */}
      <div className="lg:col-span-7 space-y-3">
        <div className="flex items-center justify-between bg-slate-100 px-4 py-2.5 rounded-2xl border border-slate-200">
          <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-emerald-600" /> Live Preview
          </span>
          <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
            {config.pageWidthMm} × {config.pageHeightMm} mm · {config.linesPerPage} lines · {mode}
          </span>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 overflow-auto flex justify-center">
          <div style={{ width: scaledW, height: scaledH }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: config.pageWidthMm * PX_PER_MM }}>
              <PassbookPage
                layout={config}
                rows={firstPageRows}
                titleLines={titleLines}
                showBaselines={showBaselines}
                showColumnGuides={showColumnGuides}
                screenBorder
              />
            </div>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
          <LayoutGrid className="w-3.5 h-3.5" /> The preview renders at true millimetre scale — it is the exact geometry the printer overprints.
        </p>
      </div>

      {/* Offscreen print portal for the test grid */}
      <div id={idForPrint} style={{ position: 'fixed', left: -100000, top: 0 }} aria-hidden>
        <PassbookPage
          layout={config}
          rows={firstPageRows}
          titleLines={titleLines}
          showBaselines={gridInTest}
          showColumnGuides={false}
        />
      </div>
    </div>
  );
};
