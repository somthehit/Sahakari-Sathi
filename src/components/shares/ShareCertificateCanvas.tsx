import React from 'react';
import { Award, ShieldCheck, CheckCircle2, QrCode, Lock } from 'lucide-react';
import { Member } from '../../types/coop';
import { formatNPR } from '../../utils/nepaliCalendar';
import { resolveCertificateTags, TagContext } from '../../utils/certificateTagEngine';

export type CertificateTheme = 'royal_gold' | 'emerald_heritage' | 'crimson_prestige' | 'executive_navy';

export interface DraggableElement {
  id: string;
  type: 'logo' | 'qr' | 'hologram' | 'tag_badge' | 'custom_text' | 'signature_block';
  label: string;
  tagValue?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
  color?: string;
}

export interface CertificateConfig {
  coopNameNp: string;
  coopNameEn: string;
  regdNo: string;
  addressNp: string;
  addressEn: string;
  certificateTitleNp: string;
  certificateTitleEn: string;
  actLegislationNp: string;
  statementTemplateNp: string;
  statementTemplateEn: string;
  theme: CertificateTheme;
  watermarkType: 'seal' | 'mandala' | 'shield' | 'none';
  showQrCode: boolean;
  showHologram: boolean;
  showCompanyLogo?: boolean;
  companyLogoUrl?: string;
  showAuthorizedSignatures?: boolean;
  signature1Url?: string;
  signature2Url?: string;
  signature3Url?: string;
  signatory1: { titleNp: string; titleEn: string; name: string }; // Chairman
  signatory2: { titleNp: string; titleEn: string; name: string }; // Manager
  signatory3: { titleNp: string; titleEn: string; name: string }; // Treasurer / Auditor
  kittaPrefix: string;
  faceValuePerShare: number;
  // Snap-to-Grid features
  enableSnapToGrid?: boolean;
  gridSize?: number;
  showGridLines?: boolean;
  draggableElements?: DraggableElement[];
}

export const DEFAULT_CERT_CONFIG: CertificateConfig = {
  coopNameNp: 'साझा स्वावलम्बन बचत तथा ऋण सहकारी संस्था लि.',
  coopNameEn: 'Sajha Swabalamban Savings & Credit Co-operative Ltd.',
  regdNo: 'दर्ता नं.: ५६२/०६४/०६५',
  addressNp: 'काठमाडौँ महानगरपालिका-३२, कोटेश्वर, काठमाडौँ',
  addressEn: 'Koteshwor-32, Kathmandu, Nepal',
  certificateTitleNp: 'शेयर प्रमाण-पत्र',
  certificateTitleEn: 'SHARE CERTIFICATE',
  actLegislationNp: 'सहकारी ऐन, २०७४ र संस्थाको विनियमावली बमोजिम जारी गरिएको',
  statementTemplateNp: 'प्रमाणित गरिन्छ कि श्री / श्रीमती / सुश्री {member_name} (नागरिकता नं. {citizenship_no}, ठेगाना: {address}) ले यस संस्थाको चुक्ता कित्ता संख्या {share_count} कित्ता ({kitta_range}) शेयर लिनुभएको छ।',
  statementTemplateEn: 'This certifies that {member_name} (Member No: {member_no}) holds {share_count} shares worth {total_amount}.',
  theme: 'royal_gold',
  watermarkType: 'seal',
  showQrCode: true,
  showHologram: true,
  showCompanyLogo: true,
  companyLogoUrl: '',
  showAuthorizedSignatures: true,
  signature1Url: '',
  signature2Url: '',
  signature3Url: '',
  signatory1: { titleNp: 'अध्यक्ष', titleEn: 'Chairman', name: 'रामकृष्ण शर्मा' },
  signatory2: { titleNp: 'व्यवस्थापक', titleEn: 'General Manager', name: 'सुरेश श्रेष्ठ' },
  signatory3: { titleNp: 'कोषाध्यक्ष', titleEn: 'Treasurer', name: 'सिता अधिकारी' },
  kittaPrefix: 'कित्ता नं.',
  faceValuePerShare: 100,
};

interface ShareCertificateCanvasProps {
  member: Member;
  config?: Partial<CertificateConfig>;
  certificateNo?: string;
  kittaStart?: number;
  kittaEnd?: number;
  issuedDateBS?: string;
  issuedDateAD?: string;
  compact?: boolean;
  onUpdateConfig?: (newConfig: CertificateConfig) => void;
}

// Convert numbers to Nepali words for share amount presentation
export function numberToNepaliWords(num: number): string {
  if (!num || isNaN(num)) return 'शून्य रुपैयाँ मात्र';
  
  const ones = ['', 'एक', 'दुई', 'तीन', 'चार', 'पाँच', 'छ', 'सात', 'आठ', 'नौ', 'दश', 'एघार', 'बाह्र', 'तेह्र', 'चौध', 'पन्ध्र', 'सोह्र', 'सत्र', 'अठार', 'उन्नाइस'];
  const tens = ['', '', 'बीस', 'तीस', 'चालिस', 'पचास', 'साठ्ठी', 'सत्तरी', 'असी', 'नब्बे'];

  if (num === 100) return 'एक सय';
  if (num === 1000) return 'एक हजार';
  if (num === 5000) return 'पाँच हजार';
  if (num === 10000) return 'दश हजार';
  if (num === 50000) return 'पचास हजार';
  if (num === 100000) return 'एक लाख';

  // General formatting fallback
  return `${num.toLocaleString('ne-NP')} रुपैयाँ मात्र`;
}

export const ShareCertificateCanvas: React.FC<ShareCertificateCanvasProps> = ({
  member,
  config: userConfig,
  certificateNo = `SC-2083-${(member?.memberNo || '001').replace(/[^0-9]/g, '').slice(-4) || '0101'}`,
  kittaStart,
  kittaEnd,
  issuedDateBS = member?.membershipDateBS || '2083-04-15',
  issuedDateAD = '2026-07-31',
  compact = false,
  onUpdateConfig,
}) => {
  const cfg: CertificateConfig = { ...DEFAULT_CERT_CONFIG, ...userConfig };

  const canvasRef = React.useRef<HTMLDivElement>(null);
  const [activeDragId, setActiveDragId] = React.useState<string | null>(null);
  const [activeGuide, setActiveGuide] = React.useState<{ x: number | null; y: number | null } | null>(null);

  const totalShares = member?.totalShares || 50;
  const faceValue = cfg.faceValuePerShare || 100;
  const totalAmount = member?.shareAmount || totalShares * faceValue;
  
  const calculatedKittaStart = kittaStart || 1001;
  const calculatedKittaEnd = kittaEnd || calculatedKittaStart + totalShares - 1;

  // Tag Context for dynamic placeholder resolution
  const tagCtx: TagContext = {
    member,
    config: cfg,
    certificateNo,
    kittaStart: calculatedKittaStart,
    kittaEnd: calculatedKittaEnd,
    issuedDateBS,
    issuedDateAD,
  };

  const resolvedStatementNp = resolveCertificateTags(cfg.statementTemplateNp || DEFAULT_CERT_CONFIG.statementTemplateNp, tagCtx);
  const resolvedStatementEn = resolveCertificateTags(cfg.statementTemplateEn || '', tagCtx);

  // Drag and Snap-To-Grid Logic
  const startDragging = (e: React.MouseEvent, elemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    setActiveDragId(elemId);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      let rawX = moveEvent.clientX - rect.left - 40; // centered offset
      let rawY = moveEvent.clientY - rect.top - 15;

      // Bound to container
      rawX = Math.max(0, Math.min(rect.width - 80, rawX));
      rawY = Math.max(0, Math.min(rect.height - 30, rawY));

      const isSnap = cfg.enableSnapToGrid !== false;
      const gridSize = cfg.gridSize || 20;

      const finalX = isSnap ? Math.round(rawX / gridSize) * gridSize : Math.round(rawX);
      const finalY = isSnap ? Math.round(rawY / gridSize) * gridSize : Math.round(rawY);

      setActiveGuide({ x: finalX, y: finalY });

      // Update position in config
      if (cfg.draggableElements) {
        const updatedElements = cfg.draggableElements.map(el => {
          if (el.id === elemId) {
            return { ...el, x: finalX, y: finalY };
          }
          return el;
        });

        if (onUpdateConfig) {
          onUpdateConfig({
            ...cfg,
            draggableElements: updatedElements,
          });
        }
      }
    };

    const onMouseUp = () => {
      setActiveDragId(null);
      setActiveGuide(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Theme style mappings
  const themeStyles = {
    royal_gold: {
      outerBorder: 'border-amber-600/80 bg-gradient-to-br from-amber-50 via-amber-50/30 to-amber-100/40',
      innerBorder: 'border-amber-700/60',
      accentColor: 'text-amber-800',
      headerBg: 'bg-amber-800 text-amber-100',
      titleColor: 'text-amber-900',
      sealBadgeBg: 'from-amber-400 via-amber-500 to-amber-600 text-amber-950',
      badgeBorder: 'border-amber-300',
      cardBg: 'bg-white/90 border-amber-200',
      watermarkText: 'text-amber-900/5',
      primaryBtn: 'bg-amber-700 hover:bg-amber-800 text-white',
    },
    emerald_heritage: {
      outerBorder: 'border-emerald-700 bg-gradient-to-br from-emerald-50 via-emerald-50/20 to-teal-100/30',
      innerBorder: 'border-emerald-800/60',
      accentColor: 'text-emerald-900',
      headerBg: 'bg-emerald-900 text-emerald-100',
      titleColor: 'text-emerald-950',
      sealBadgeBg: 'from-emerald-500 via-emerald-600 to-teal-700 text-white',
      badgeBorder: 'border-emerald-300',
      cardBg: 'bg-white/90 border-emerald-200',
      watermarkText: 'text-emerald-900/5',
      primaryBtn: 'bg-emerald-700 hover:bg-emerald-800 text-white',
    },
    crimson_prestige: {
      outerBorder: 'border-rose-700 bg-gradient-to-br from-rose-50 via-rose-50/20 to-amber-100/30',
      innerBorder: 'border-rose-800/60',
      accentColor: 'text-rose-900',
      headerBg: 'bg-rose-900 text-rose-100',
      titleColor: 'text-rose-950',
      sealBadgeBg: 'from-rose-600 via-rose-700 to-amber-600 text-white',
      badgeBorder: 'border-amber-400',
      cardBg: 'bg-white/90 border-rose-200',
      watermarkText: 'text-rose-900/5',
      primaryBtn: 'bg-rose-700 hover:bg-rose-800 text-white',
    },
    executive_navy: {
      outerBorder: 'border-slate-200 bg-gradient-to-br from-slate-50 via-slate-100/50 to-blue-50/40',
      innerBorder: 'border-slate-300',
      accentColor: 'text-slate-900',
      headerBg: 'bg-white text-slate-800',
      titleColor: 'text-slate-900',
      sealBadgeBg: 'from-slate-700 via-slate-800 to-blue-900 text-white',
      badgeBorder: 'border-slate-400',
      cardBg: 'bg-white/95 border-slate-300',
      watermarkText: 'text-slate-900/5',
      primaryBtn: 'bg-slate-50 hover:bg-white text-white',
    }
  }[cfg.theme] || {
    outerBorder: 'border-amber-600/80 bg-amber-50/30',
    innerBorder: 'border-amber-700/60',
    accentColor: 'text-amber-800',
    headerBg: 'bg-amber-800 text-amber-100',
    titleColor: 'text-amber-900',
    sealBadgeBg: 'from-amber-400 to-amber-600 text-amber-950',
    badgeBorder: 'border-amber-300',
    cardBg: 'bg-white/90 border-amber-200',
    watermarkText: 'text-amber-900/5',
    primaryBtn: 'bg-amber-700 hover:bg-amber-800 text-white',
  };

  return (
    <div 
      className={`relative mx-auto text-slate-900 print:shadow-none print:m-0 print:border-0 print:p-0 select-none transition-all duration-300 ${ compact ? 'max-w-xl text-[11px]' : 'max-w-4xl text-xs' }`}
    >
      {/* Outer Certificate Frame */}
      <div className={`relative p-3 sm:p-5 rounded-xl border-4 ${themeStyles.outerBorder} shadow-xl overflow-hidden`}>
        
        {/* Ornate Corner Rosettes */}
        <div className="absolute top-1 left-1 w-8 h-8 sm:w-12 sm:h-12 border-t-2 border-l-2 border-amber-600 rounded-tl-lg pointer-events-none flex items-center justify-center">
          <div className="w-3 h-3 border border-amber-500 transform rotate-45"></div>
        </div>
        <div className="absolute top-1 right-1 w-8 h-8 sm:w-12 sm:h-12 border-t-2 border-r-2 border-amber-600 rounded-tr-lg pointer-events-none flex items-center justify-center">
          <div className="w-3 h-3 border border-amber-500 transform rotate-45"></div>
        </div>
        <div className="absolute bottom-1 left-1 w-8 h-8 sm:w-12 sm:h-12 border-b-2 border-l-2 border-amber-600 rounded-bl-lg pointer-events-none flex items-center justify-center">
          <div className="w-3 h-3 border border-amber-500 transform rotate-45"></div>
        </div>
        <div className="absolute bottom-1 right-1 w-8 h-8 sm:w-12 sm:h-12 border-b-2 border-r-2 border-amber-600 rounded-br-lg pointer-events-none flex items-center justify-center">
          <div className="w-3 h-3 border border-amber-500 transform rotate-45"></div>
        </div>

        {/* Inner Double Hairline Frame */}
        <div 
          ref={canvasRef}
          className={`p-4 sm:p-6 rounded-lg border-2 border-dashed ${themeStyles.innerBorder} relative bg-white/80 backdrop-blur-xs`}
        >
          {/* Snap-to-Grid Visual Grid Lines Overlay */}
          {cfg.showGridLines && (
            <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden rounded-lg">
              <svg className="w-full h-full opacity-30">
                <defs>
                  <pattern 
                    id={`certGridPattern_${cfg.gridSize || 20}`} 
                    width={cfg.gridSize || 20} 
                    height={cfg.gridSize || 20} 
                    patternUnits="userSpaceOnUse"
                  >
                    <path 
                      d={`M ${cfg.gridSize || 20} 0 L 0 0 0 ${cfg.gridSize || 20}`} 
                      fill="none" 
                      stroke="#0284c7" 
                      strokeWidth="0.8" 
                      strokeDasharray="2,2"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill={`url(#certGridPattern_${cfg.gridSize || 20})`} />
              </svg>
            </div>
          )}

          {/* Dynamic Active Drag Guide Lines (Crosshair Snap Alignment Lines) */}
          {activeGuide && (
            <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
              {activeGuide.x !== null && (
                <div 
                  className="absolute top-0 bottom-0 border-r-2 border-emerald-500 shadow-sm"
                  style={{ left: `${activeGuide.x}px` }}
                >
                  <span className="bg-emerald-600 text-white text-[9px] font-mono px-1 rounded absolute top-2 left-1 shadow-xs">
                    X: {activeGuide.x}px
                  </span>
                </div>
              )}
              {activeGuide.y !== null && (
                <div 
                  className="absolute left-0 right-0 border-b-2 border-emerald-500 shadow-sm"
                  style={{ top: `${activeGuide.y}px` }}
                >
                  <span className="bg-emerald-600 text-white text-[9px] font-mono px-1 rounded absolute left-2 top-1 shadow-xs">
                    Y: {activeGuide.y}px
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Interactive Draggable Custom Elements Overlay */}
          {(cfg.draggableElements || []).map(elem => {
            const isDragging = activeDragId === elem.id;
            const resolvedContent = elem.tagValue 
              ? resolveCertificateTags(elem.tagValue, tagCtx) 
              : elem.label;

            return (
              <div
                key={elem.id}
                onMouseDown={(e) => startDragging(e, elem.id)}
                style={{ 
                  left: `${elem.x}px`, 
                  top: `${elem.y}px`,
                  color: elem.color || '#1e293b',
                  fontSize: `${elem.fontSize || 12}px`,
                }}
                className={`absolute z-30 cursor-move select-none p-1.5 rounded-lg border transition-shadow flex items-center gap-1.5 shadow-md ${ isDragging ? 'border-emerald-500 bg-emerald-100 text-emerald-950 font-bold ring-2 ring-emerald-400 scale-105' : 'border-amber-400 bg-amber-50/90 hover:bg-amber-100 hover:border-amber-600' }`}
              >
                <span className="font-bold font-sans">{resolvedContent}</span>
                <span className="text-[9px] opacity-70 font-mono bg-white/80 px-1 rounded">
                  ({elem.x},{elem.y})
                </span>
              </div>
            );
          })}
          
          {/* Subtle Security Background Guilloché Watermark */}
          {cfg.watermarkType !== 'none' && (
            <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none overflow-hidden">
              <div className="w-96 h-96 rounded-full border-[16px] border-amber-700/40 flex items-center justify-center transform rotate-12">
                <div className="w-72 h-72 rounded-full border-[12px] border-amber-600/30 flex items-center justify-center">
                  <Award className="w-48 h-48 text-amber-800" />
                </div>
              </div>
            </div>
          )}

          {/* Certificate Top Serial & Date Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">प्रमाण-पत्र नं. / Cert No:</span>
              <span className="font-mono font-black text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300 text-xs sm:text-sm">
                {certificateNo}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">सदस्य नं. / Member No:</span>
              <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs">
                {member?.memberNo || 'MBR-2083-0101'}
              </span>
            </div>

            <div className="text-right text-[10px] sm:text-xs font-medium text-slate-600">
              <div><span className="font-bold">जारी मिति:</span> {issuedDateBS} BS</div>
              <div className="text-[10px] text-slate-500 font-mono">Date: {issuedDateAD} AD</div>
            </div>
          </div>

          {/* Cooperative Header & Crest / Logo */}
          <div className="text-center space-y-1 mb-6 relative">
            {cfg.showCompanyLogo !== false && (
              <div className="inline-flex items-center justify-center mb-1">
                {cfg.companyLogoUrl ? (
                  <img
                    src={cfg.companyLogoUrl}
                    alt="Company Logo"
                    className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-sm rounded-lg"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 border-2 border-amber-400 flex items-center justify-center shadow-inner">
                    <Award className="w-7 h-7 text-amber-700" />
                  </div>
                )}
              </div>
            )}

            <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
              {cfg.coopNameNp}
            </h1>
            <p className="text-xs sm:text-sm font-bold text-amber-800 font-serif tracking-wide">
              {cfg.coopNameEn}
            </p>
            <p className="text-[11px] text-slate-600 font-medium">
              {cfg.addressNp} | {cfg.regdNo}
            </p>
            <p className="text-[10px] text-slate-500 italic">
              {cfg.actLegislationNp}
            </p>

            {/* Certificate Title Banner */}
            <div className="pt-3">
              <div className="inline-block relative">
                <div className={`px-6 sm:px-10 py-1.5 rounded-full font-black text-base sm:text-xl tracking-widest uppercase shadow-md ${themeStyles.headerBg}`}>
                  {cfg.certificateTitleNp} / {cfg.certificateTitleEn}
                </div>
              </div>
            </div>
          </div>

          {/* Main Statement & Share Details */}
          <div className="space-y-4 my-6 text-slate-800 leading-relaxed font-serif">
            
            <p className="text-xs sm:text-sm text-center leading-relaxed">
              {resolvedStatementNp}
            </p>

            {resolvedStatementEn && (
              <p className="text-[11px] sm:text-xs text-center text-slate-600 font-sans italic">
                {resolvedStatementEn}
              </p>
            )}

            {/* Share Value Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-4 text-center font-sans">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[10px] font-bold text-slate-500 uppercase">कुल शेयर संख्या (Shares)</div>
                <div className="text-base font-black text-slate-900 font-mono mt-0.5">{totalShares} कित्ता</div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[10px] font-bold text-slate-500 uppercase">प्रति शेयर दर (Face Value)</div>
                <div className="text-base font-black text-amber-800 font-mono mt-0.5">रु. {faceValue}/-</div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Distinctive Kitta Range</div>
                <div className="text-xs font-bold text-purple-800 font-mono mt-1">
                  {calculatedKittaStart} देखि {calculatedKittaEnd} सम्म
                </div>
              </div>

              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="text-[10px] font-bold text-emerald-700 uppercase">कुल चुक्ता रकम (Total Capital)</div>
                <div className="text-base font-black text-emerald-900 font-mono mt-0.5">{formatNPR(totalAmount)}</div>
              </div>
            </div>

            {/* Total Amount in Words */}
            <div className="p-3 bg-amber-50/70 border border-amber-200/90 rounded-xl text-center text-xs font-sans">
              <span className="font-bold text-amber-900">अक्षरेपी (In Words): </span>
              <span className="font-semibold text-slate-900 underline decoration-amber-400 decoration-2 underline-offset-2">
                {numberToNepaliWords(totalAmount)}
              </span>
            </div>

          </div>

          {/* Official Hologram / Security Seal & QR Code Block */}
          <div className="flex flex-wrap items-center justify-between gap-4 my-6 pt-2 border-t border-dashed border-amber-200">
            
            {/* Hologram Emblem */}
            {cfg.showHologram && (
              <div className="flex items-center gap-2.5 bg-gradient-to-r from-amber-100/70 to-amber-200/50 p-2 rounded-xl border border-amber-300 shadow-2xs">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${themeStyles.sealBadgeBg} border-2 ${themeStyles.badgeBorder} flex items-center justify-center shadow-md shrink-0`}>
                  <ShieldCheck className="w-6 h-6 text-slate-800" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-950 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> OFFICIAL SECURE SEAL
                  </div>
                  <div className="text-[9px] text-amber-800 font-medium">डिजिटल प्रमाणित शेयर अभिलेख</div>
                </div>
              </div>
            )}

            {/* QR Code Security Stamp */}
            {cfg.showQrCode && (
              <div className="flex items-center gap-2.5 bg-slate-50 p-2 rounded-xl border border-slate-200">
                <div className="w-10 h-10 bg-white p-1 rounded border border-slate-300 flex items-center justify-center shrink-0">
                  <QrCode className="w-8 h-8 text-slate-800" />
                </div>
                <div className="text-[9px] text-slate-600">
                  <div className="font-bold text-slate-900 font-mono">VERIFY: {certificateNo}</div>
                  <div>स्क्यान गरी आधिकारिकता पुष्टि गर्नुहोस्</div>
                </div>
              </div>
            )}

          </div>

          {/* Signatures Block */}
          {cfg.showAuthorizedSignatures !== false && (
            <div className="grid grid-cols-3 gap-4 pt-10 mt-8 border-t border-amber-200/80 text-center font-sans">
              
              {/* Signatory 1 - Chairman */}
              <div className="space-y-1">
                <div className="h-12 border-b border-slate-400 border-dashed w-3/4 mx-auto flex items-end justify-center pb-1 relative">
                  {cfg.signature1Url ? (
                    <img src={cfg.signature1Url} alt="Signature Chairman" className="h-11 max-w-[120px] object-contain mx-auto -mb-1" />
                  ) : (
                    <span className="font-serif italic text-slate-500 text-[10px]">(डिजिटल हस्ताक्षर)</span>
                  )}
                </div>
                <div className="font-bold text-xs text-slate-900">{cfg.signatory1.name}</div>
                <div className="text-[11px] font-semibold text-amber-800">{cfg.signatory1.titleNp}</div>
                <div className="text-[9px] text-slate-500 uppercase tracking-wider">{cfg.signatory1.titleEn}</div>
              </div>

              {/* Signatory 2 - Manager */}
              <div className="space-y-1">
                <div className="h-12 border-b border-slate-400 border-dashed w-3/4 mx-auto flex items-end justify-center pb-1 relative">
                  {cfg.signature2Url ? (
                    <img src={cfg.signature2Url} alt="Signature Manager" className="h-11 max-w-[120px] object-contain mx-auto -mb-1" />
                  ) : (
                    <span className="font-serif italic text-slate-500 text-[10px]">(डिजिटल हस्ताक्षर)</span>
                  )}
                </div>
                <div className="font-bold text-xs text-slate-900">{cfg.signatory2.name}</div>
                <div className="text-[11px] font-semibold text-amber-800">{cfg.signatory2.titleNp}</div>
                <div className="text-[9px] text-slate-500 uppercase tracking-wider">{cfg.signatory2.titleEn}</div>
              </div>

              {/* Signatory 3 - Treasurer */}
              <div className="space-y-1">
                <div className="h-12 border-b border-slate-400 border-dashed w-3/4 mx-auto flex items-end justify-center pb-1 relative">
                  {cfg.signature3Url ? (
                    <img src={cfg.signature3Url} alt="Signature Treasurer" className="h-11 max-w-[120px] object-contain mx-auto -mb-1" />
                  ) : (
                    <span className="font-serif italic text-slate-500 text-[10px]">(डिजिटल हस्ताक्षर)</span>
                  )}
                </div>
                <div className="font-bold text-xs text-slate-900">{cfg.signatory3.name}</div>
                <div className="text-[11px] font-semibold text-amber-800">{cfg.signatory3.titleNp}</div>
                <div className="text-[9px] text-slate-500 uppercase tracking-wider">{cfg.signatory3.titleEn}</div>
              </div>

            </div>
          )}

          {/* Footer Fine Print */}
          <div className="mt-6 text-[9px] text-center text-slate-500 border-t border-slate-100 pt-2 flex items-center justify-between">
            <span>सम्पर्क: info@sahakarisathi.org.np | Phone: +977-01-4455667</span>
            <span className="flex items-center gap-1"><Lock className="w-2.5 h-2.5" /> SahakariSathi Core CBS Generated</span>
          </div>

        </div>
      </div>
    </div>
  );
};
