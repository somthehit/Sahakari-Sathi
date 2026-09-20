import React from 'react';
import { Landmark, ScanLine } from 'lucide-react';
import { resolveChequeTags, ChequeTagContext } from '../../utils/chequeTagEngine';

/**
 * Cheque leaf canvas — the visual, drag-positioned rendering of a single cheque
 * leaf. Unlike the share-certificate canvas (pixel space, A4 target), cheque
 * stationery is measured in MILLIMETRES: element coordinates are mm from the
 * top-left of a fixed `widthMm × heightMm` leaf. Rendering uses CSS `mm`/`pt`
 * units so the on-screen preview and the physical print are the same scale
 * (1:1 on paper), and the drag engine converts pointer pixels back to mm using
 * the measured canvas rect.
 */

export type ChequeElementType =
  | 'tag_text'
  | 'field_label'
  | 'amount_box'
  | 'signature_block'
  | 'logo'
  | 'crossing'
  | 'custom_text'
  | 'date_boxes'
  | 'line'
  | 'rect';

export interface ChequeDraggableElement {
  id: string;
  type: ChequeElementType;
  label: string;
  tagValue?: string;
  x: number; // mm from left
  y: number; // mm from top
  widthMm?: number;
  heightMm?: number;
  fontSizePt?: number;
  bold?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right';
  /** date_boxes: number of digit cells to draw when empty (defaults to 8). */
  boxCount?: number;
}

export interface ChequeDesignConfig {
  widthMm: number;
  heightMm: number;
  bankNameNp: string;
  bankNameEn: string;
  branchName: string;
  logoUrl?: string;
  signatureUrl?: string;
  signatoryTitle?: string;
  accentColor: string;
  bgColor: string;
  showLogo: boolean;
  showAccountPayeeCrossing: boolean;
  showMicrBand: boolean;
  micrCode?: string;
  micrTemplate: string;
  micrFontSizePt: number;
  enableSnapToGrid: boolean;
  gridSizeMm: number;
  showGridLines: boolean;
  draggableElements: ChequeDraggableElement[];
}

export const DEFAULT_CHEQUE_CONFIG: ChequeDesignConfig = {
  widthMm: 200,
  heightMm: 92,
  bankNameNp: 'साझा स्वावलम्बन बचत तथा ऋण सहकारी संस्था लि.',
  bankNameEn: 'Sajha Swabalamban Savings & Credit Co-operative Ltd.',
  branchName: 'कोटेश्वर शाखा, काठमाडौँ',
  logoUrl: '',
  signatureUrl: '',
  signatoryTitle: 'अधिकृत हस्ताक्षर / Authorised Signatory',
  accentColor: '#047857',
  bgColor: '#f8fdfb',
  showLogo: true,
  showAccountPayeeCrossing: true,
  showMicrBand: true,
  micrCode: '',
  micrTemplate: '⑈ {cheque_number} ⑈   {micr_code}   ⑆ {account_no} ⑆',
  micrFontSizePt: 11,
  enableSnapToGrid: true,
  gridSizeMm: 2.5,
  showGridLines: false,
  draggableElements: [
    { id: 'logo', type: 'logo', label: 'Logo', x: 6, y: 5, widthMm: 16, heightMm: 16 },
    { id: 'bank-np', type: 'tag_text', label: 'Institution (NP)', tagValue: '{bank_name_np}', x: 24, y: 5, fontSizePt: 11, bold: true, color: '#0f172a' },
    { id: 'bank-en', type: 'tag_text', label: 'Institution (EN)', tagValue: '{bank_name_en}', x: 24, y: 11, fontSizePt: 8, color: '#334155' },
    { id: 'branch', type: 'tag_text', label: 'Branch', tagValue: '{branch_name}', x: 24, y: 15.5, fontSizePt: 7.5, color: '#475569' },
    { id: 'date-label', type: 'field_label', label: 'मिति / Date', x: 150, y: 6, fontSizePt: 7.5, color: '#475569' },
    { id: 'date-boxes', type: 'date_boxes', label: 'Date boxes', tagValue: '{date_boxes_bs}', x: 150, y: 10, widthMm: 5, heightMm: 6, boxCount: 8, fontSizePt: 10, bold: true, color: '#0f172a' },
    { id: 'pay-label', type: 'field_label', label: 'भुक्तानी पाउने / Pay', x: 6, y: 30, fontSizePt: 9, bold: true, color: '#0f172a' },
    { id: 'payee', type: 'tag_text', label: 'Payee', tagValue: '{payee_name}  —  {or_bearer}', x: 34, y: 30, fontSizePt: 11, color: '#0f172a' },
    { id: 'words-label', type: 'field_label', label: 'रुपैयाँ / Rupees', x: 6, y: 42, fontSizePt: 9, bold: true, color: '#0f172a' },
    { id: 'amount-words', type: 'tag_text', label: 'Amount in words', tagValue: '{amount_words}', x: 34, y: 42, fontSizePt: 10, color: '#0f172a' },
    { id: 'amount-box', type: 'amount_box', label: 'Amount', tagValue: '{amount_figures}', x: 150, y: 40, widthMm: 44, heightMm: 11, fontSizePt: 12, bold: true, color: '#0f172a' },
    { id: 'acct-label', type: 'field_label', label: 'खाता नं. / A/C No.', x: 6, y: 66, fontSizePt: 7.5, color: '#475569' },
    { id: 'acct-no', type: 'tag_text', label: 'Account No.', tagValue: '{account_no}', x: 34, y: 65.5, fontSizePt: 9.5, bold: true, color: '#0f172a' },
    { id: 'signature', type: 'signature_block', label: 'Signature', x: 138, y: 62, widthMm: 56, heightMm: 18, fontSizePt: 7.5, color: '#475569' },
    { id: 'crossing', type: 'crossing', label: 'A/C Payee', x: 8, y: 3, widthMm: 30, heightMm: 12 },
  ],
};

interface ChequeLeafCanvasProps {
  config: ChequeDesignConfig;
  ctx: Omit<ChequeTagContext, 'config'>;
  onUpdateConfig?: (next: ChequeDesignConfig) => void;
  /** DOM id used by the print routine to isolate this leaf. */
  idForPrint?: string;
  /** Disable interaction (drag) — used for print/preview-only renders. */
  readOnly?: boolean;
}

export const ChequeLeafCanvas: React.FC<ChequeLeafCanvasProps> = ({
  config,
  ctx,
  onUpdateConfig,
  idForPrint,
  readOnly = false,
}) => {
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const [activeDragId, setActiveDragId] = React.useState<string | null>(null);
  const [guide, setGuide] = React.useState<{ x: number; y: number } | null>(null);

  const tagCtx: ChequeTagContext = { ...ctx, config };

  const startDragging = (e: React.MouseEvent, elemId: string) => {
    if (readOnly || !onUpdateConfig) return;
    e.preventDefault();
    e.stopPropagation();
    if (!canvasRef.current) return;

    setActiveDragId(elemId);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const pxPerMmX = rect.width / config.widthMm;
      const pxPerMmY = rect.height / config.heightMm;

      let rawX = (moveEvent.clientX - rect.left) / pxPerMmX;
      let rawY = (moveEvent.clientY - rect.top) / pxPerMmY;

      const snap = config.enableSnapToGrid !== false;
      const grid = config.gridSizeMm || 2.5;
      let finalX = snap ? Math.round(rawX / grid) * grid : Math.round(rawX * 10) / 10;
      let finalY = snap ? Math.round(rawY / grid) * grid : Math.round(rawY * 10) / 10;

      finalX = Math.max(0, Math.min(config.widthMm - 2, finalX));
      finalY = Math.max(0, Math.min(config.heightMm - 2, finalY));

      setGuide({ x: finalX, y: finalY });

      onUpdateConfig({
        ...config,
        draggableElements: config.draggableElements.map((el) =>
          el.id === elemId ? { ...el, x: finalX, y: finalY } : el
        ),
      });
    };

    const onMouseUp = () => {
      setActiveDragId(null);
      setGuide(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const renderElementBody = (elem: ChequeDraggableElement) => {
    const resolved = elem.tagValue ? resolveChequeTags(elem.tagValue, tagCtx) : elem.label;

    switch (elem.type) {
      case 'logo':
        return config.logoUrl ? (
          <img
            src={config.logoUrl}
            alt="Logo"
            style={{ width: `${elem.widthMm ?? 16}mm`, height: `${elem.heightMm ?? 16}mm`, objectFit: 'contain' }}
          />
        ) : (
          <div
            className="flex items-center justify-center rounded-full border"
            style={{
              width: `${elem.widthMm ?? 16}mm`,
              height: `${elem.heightMm ?? 16}mm`,
              borderColor: config.accentColor,
              color: config.accentColor,
            }}
          >
            <Landmark style={{ width: '7mm', height: '7mm' }} />
          </div>
        );

      case 'amount_box':
        return (
          <div
            className="flex items-center justify-end rounded font-mono"
            style={{
              width: `${elem.widthMm ?? 44}mm`,
              height: `${elem.heightMm ?? 11}mm`,
              border: `0.4mm solid ${config.accentColor}`,
              padding: '0 2mm',
              fontSize: `${elem.fontSizePt ?? 12}pt`,
              fontWeight: elem.bold ? 700 : 500,
              color: elem.color ?? '#0f172a',
              background: 'rgba(255,255,255,0.6)',
            }}
          >
            {resolved}
          </div>
        );

      case 'signature_block':
        return (
          <div
            className="flex flex-col items-center justify-end"
            style={{ width: `${elem.widthMm ?? 56}mm`, height: `${elem.heightMm ?? 18}mm` }}
          >
            {config.signatureUrl ? (
              <img
                src={config.signatureUrl}
                alt="Signature"
                style={{ maxHeight: '10mm', maxWidth: '100%', objectFit: 'contain', marginBottom: '0.5mm' }}
              />
            ) : (
              <div style={{ flex: 1 }} />
            )}
            <div style={{ borderTop: `0.3mm solid ${config.accentColor}`, width: '100%', paddingTop: '0.8mm' }}>
              <div
                className="text-center"
                style={{ fontSize: `${elem.fontSizePt ?? 7.5}pt`, color: elem.color ?? '#475569' }}
              >
                {config.signatoryTitle || 'Authorised Signatory'}
              </div>
            </div>
          </div>
        );

      case 'crossing':
        return (
          <div
            className="relative"
            style={{ width: `${elem.widthMm ?? 30}mm`, height: `${elem.heightMm ?? 12}mm` }}
          >
            <svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
              <line x1="8" y1="0" x2="8" y2="40" stroke={config.accentColor} strokeWidth="1.5" />
              <line x1="22" y1="0" x2="22" y2="40" stroke={config.accentColor} strokeWidth="1.5" />
            </svg>
            <span
              className="absolute font-bold"
              style={{ left: '26%', top: '30%', fontSize: '7pt', color: config.accentColor, whiteSpace: 'nowrap' }}
            >
              A/C PAYEE
            </span>
          </div>
        );

      case 'date_boxes': {
        // A comb of single-digit cells. Digits come from the resolved tag
        // (BS YYYYMMDD by default); non-digits are dropped so separators never
        // leak in. A blank leaf resolves to no digits → empty cells to hand-fill.
        const raw = elem.tagValue ? resolveChequeTags(elem.tagValue, tagCtx) : '';
        const digits = raw.replace(/\D/g, '');
        const count = elem.boxCount ?? 8;
        const cells = digits ? digits.split('') : Array.from({ length: count }, () => '');
        const cellW = elem.widthMm ?? 5;
        const cellH = elem.heightMm ?? 6;
        return (
          <div style={{ display: 'flex' }}>
            {cells.map((ch, i) => (
              <div
                key={i}
                className="flex items-center justify-center font-mono"
                style={{
                  width: `${cellW}mm`,
                  height: `${cellH}mm`,
                  borderTop: `0.3mm solid ${config.accentColor}`,
                  borderBottom: `0.3mm solid ${config.accentColor}`,
                  borderRight: `0.3mm solid ${config.accentColor}`,
                  borderLeft: i === 0 ? `0.3mm solid ${config.accentColor}` : '0',
                  fontSize: `${elem.fontSizePt ?? 10}pt`,
                  fontWeight: elem.bold ? 700 : 500,
                  color: elem.color ?? '#0f172a',
                  lineHeight: 1,
                }}
              >
                {ch}
              </div>
            ))}
          </div>
        );
      }

      case 'line':
        // A freeform rule: a filled bar sized in mm. Make it wide + short for a
        // horizontal line, or narrow + tall for a vertical one.
        return (
          <div
            style={{
              width: `${elem.widthMm ?? 60}mm`,
              height: `${elem.heightMm ?? 0.4}mm`,
              background: elem.color ?? config.accentColor,
              borderRadius: '0.2mm',
            }}
          />
        );

      case 'rect':
        // A freeform box outline (transparent fill so it frames content). Bold
        // thickens the stroke.
        return (
          <div
            style={{
              width: `${elem.widthMm ?? 24}mm`,
              height: `${elem.heightMm ?? 16}mm`,
              border: `${elem.bold ? 0.6 : 0.3}mm solid ${elem.color ?? config.accentColor}`,
              borderRadius: '0.6mm',
              background: 'transparent',
            }}
          />
        );

      case 'field_label':
      case 'tag_text':
      case 'custom_text':
      default:
        return (
          <span
            style={{
              fontSize: `${elem.fontSizePt ?? 10}pt`,
              fontWeight: elem.bold ? 700 : 400,
              color: elem.color ?? '#0f172a',
              textAlign: elem.align ?? 'left',
              whiteSpace: 'nowrap',
            }}
          >
            {resolved}
          </span>
        );
    }
  };

  return (
    <div className="w-full overflow-x-auto">
      <div
        id={idForPrint}
        ref={canvasRef}
        className="relative mx-auto select-none"
        style={{
          width: `${config.widthMm}mm`,
          height: `${config.heightMm}mm`,
          background: config.bgColor || '#ffffff',
          border: `0.5mm solid ${config.accentColor}`,
          borderRadius: '2mm',
          boxShadow: '0 6px 24px rgba(15,23,42,0.12)',
          overflow: 'hidden',
          fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {/* Guilloché-style security wash */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            opacity: 0.06,
            backgroundImage:
              `repeating-linear-gradient(45deg, ${config.accentColor} 0, ${config.accentColor} 0.2mm, transparent 0.2mm, transparent 2.2mm)`,
          }}
        />

        {/* Optional grid overlay (screen only). SVG path data is unitless, so the
            mm grid step is converted to CSS pixels (~3.78 px/mm at 96 dpi). */}
        {config.showGridLines && !readOnly && (() => {
          const stepPx = (config.gridSizeMm || 2.5) * 3.7795;
          return (
            <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" style={{ opacity: 0.35 }}>
              <defs>
                <pattern id="chequeGrid" width={stepPx} height={stepPx} patternUnits="userSpaceOnUse">
                  <path d={`M ${stepPx} 0 L 0 0 0 ${stepPx}`} fill="none" stroke="#0284c7" strokeWidth="0.3" strokeDasharray="1,1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#chequeGrid)" />
            </svg>
          );
        })()}

        {/* Active drag guide */}
        {guide && (
          <div className="pointer-events-none absolute inset-0 z-40">
            <div className="absolute top-0 bottom-0" style={{ left: `${guide.x}mm`, borderRight: '0.3mm solid #10b981' }} />
            <div className="absolute left-0 right-0" style={{ top: `${guide.y}mm`, borderBottom: '0.3mm solid #10b981' }} />
            <span className="absolute rounded bg-emerald-600 px-1 font-mono text-white" style={{ left: `${guide.x}mm`, top: `${guide.y}mm`, fontSize: '6pt' }}>
              {guide.x.toFixed(1)}, {guide.y.toFixed(1)} mm
            </span>
          </div>
        )}

        {/* Draggable elements */}
        {config.draggableElements
          .filter((el) => (el.type === 'logo' ? config.showLogo : true))
          .filter((el) => (el.type === 'crossing' ? config.showAccountPayeeCrossing : true))
          .map((elem) => {
            const isDragging = activeDragId === elem.id;
            return (
              <div
                key={elem.id}
                onMouseDown={(e) => startDragging(e, elem.id)}
                className={`absolute z-30 ${readOnly ? '' : 'cursor-move'} ${isDragging ? 'ring-2 ring-emerald-400' : ''}`}
                style={{
                  left: `${elem.x}mm`,
                  top: `${elem.y}mm`,
                  outline: !readOnly && !isDragging ? '0.2mm dashed rgba(4,120,87,0.35)' : undefined,
                  borderRadius: '1mm',
                }}
              >
                {renderElementBody(elem)}
              </div>
            );
          })}

        {/* MICR clearing band pinned to the bottom */}
        {config.showMicrBand && (
          <div
            className="absolute left-0 right-0 flex items-center gap-2 px-3"
            style={{
              bottom: 0,
              height: '10mm',
              borderTop: `0.3mm solid ${config.accentColor}`,
              background: 'rgba(255,255,255,0.55)',
            }}
          >
            <ScanLine style={{ width: '4mm', height: '4mm', color: config.accentColor }} className="shrink-0" />
            <span
              style={{
                fontFamily: "'Courier New', ui-monospace, monospace",
                fontSize: `${config.micrFontSizePt || 11}pt`,
                letterSpacing: '0.5mm',
                color: '#0f172a',
                whiteSpace: 'nowrap',
              }}
            >
              {resolveChequeTags(config.micrTemplate, tagCtx)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
