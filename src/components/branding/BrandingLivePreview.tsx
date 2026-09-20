import React from 'react';
import { Eye } from 'lucide-react';

interface BrandingLivePreviewProps {
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  footerText: string;
  appDisplayName: string;
}

export const BrandingLivePreview: React.FC<BrandingLivePreviewProps> = ({
  logoUrl,
  faviconUrl,
  primaryColor,
  secondaryColor,
  textColor,
  footerText,
  appDisplayName,
}) => {
  const pc = primaryColor || '#047857';
  const sc = secondaryColor || '#059669';
  const tc = textColor || '#1E293B';
  const name = appDisplayName || 'Sahakari Sathi';

  return (
    <div className="sticky top-4 space-y-4">
      <h3 className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
        <Eye className="w-3.5 h-3.5" />
        Live Preview
      </h3>

      {/* Mock browser tab */}
      <div className="rounded-lg border border-slate-200 bg-slate-100 p-2">
        <div className="flex items-center gap-1.5 rounded-t-md bg-white px-2.5 py-1.5 shadow-sm w-fit">
          {faviconUrl ? (
            <img src={faviconUrl} className="h-3.5 w-3.5 rounded-sm" alt="" />
          ) : (
            <div className="h-3.5 w-3.5 rounded-sm bg-slate-200" />
          )}
          <span className="text-[11px] text-slate-500 max-w-[120px] truncate font-medium">
            {name}
          </span>
        </div>
      </div>

      {/* Mock app header */}
      <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        <div
          className="flex items-center gap-2.5 px-4 py-3"
          style={{ backgroundColor: pc }}
        >
          {logoUrl ? (
            <img src={logoUrl} className="h-7 w-7 rounded object-contain bg-white/90 p-0.5" alt="" />
          ) : (
            <div className="h-7 w-7 rounded bg-white/20 flex items-center justify-center text-white text-[10px] font-bold">
              {name[0]}
            </div>
          )}
          <span className="font-bold text-white text-sm">{name}</span>
        </div>

        {/* Mock body content */}
        <div className="bg-white p-4 space-y-2.5">
          <div className="h-2.5 w-3/4 rounded" style={{ backgroundColor: `${tc}15` }} />
          <div className="h-2.5 w-1/2 rounded" style={{ backgroundColor: `${tc}10` }} />
          <div className="flex gap-2 mt-3">
            <button
              className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white transition"
              style={{ backgroundColor: pc }}
            >
              Primary Action
            </button>
            <button
              className="rounded-lg px-3 py-1.5 text-[11px] font-bold border transition"
              style={{ borderColor: sc, color: sc }}
            >
              Secondary
            </button>
          </div>
        </div>

        {/* Mock sidebar accent */}
        <div className="flex border-t border-slate-100">
          <div className="w-16 h-10 flex items-center justify-center" style={{ backgroundColor: `${pc}10` }}>
            <div className="w-4 h-4 rounded" style={{ backgroundColor: pc }} />
          </div>
          <div className="flex-1 p-2.5 flex items-center">
            <div className="h-2 w-20 rounded" style={{ backgroundColor: `${tc}10` }} />
          </div>
        </div>

        {/* Mock footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-center">
          <span className="text-[10px]" style={{ color: `${tc}80` }}>
            {footerText || 'Powered by Sahakari Sathi'}
          </span>
        </div>
      </div>

      {/* Mock print/receipt header */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-2 text-[10px] font-bold uppercase text-slate-400 tracking-wider">Print / Receipt Preview</p>
        <div className="flex items-center gap-2.5 border-b pb-2.5" style={{ borderColor: `${tc}15` }}>
          {logoUrl ? (
            <img src={logoUrl} className="h-10 w-10 object-contain" alt="" />
          ) : (
            <div className="h-10 w-10 rounded bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-bold">
              {name[0]}
            </div>
          )}
          <div>
            <p className="text-xs font-bold" style={{ color: tc }}>{name}</p>
            <p className="text-[10px]" style={{ color: `${tc}60` }}>Reg. No. XXXXX | Nepal</p>
          </div>
        </div>
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-[10px]" style={{ color: `${tc}50` }}>
            <span>Date</span><span className="font-mono">2082/06/15</span>
          </div>
          <div className="flex justify-between text-[10px]" style={{ color: `${tc}50` }}>
            <span>Amount</span><span className="font-mono font-bold" style={{ color: pc }}>NPR 5,000.00</span>
          </div>
        </div>
      </div>

      {/* Color swatches summary */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="mb-2 text-[10px] font-bold uppercase text-slate-400 tracking-wider">Color Palette</p>
        <div className="flex gap-2">
          <div className="flex-1 text-center">
            <div className="h-8 rounded-lg mb-1" style={{ backgroundColor: pc }} />
            <span className="text-[9px] text-slate-500 font-mono">{pc}</span>
            <p className="text-[9px] text-slate-400">Primary</p>
          </div>
          <div className="flex-1 text-center">
            <div className="h-8 rounded-lg mb-1" style={{ backgroundColor: sc }} />
            <span className="text-[9px] text-slate-500 font-mono">{sc}</span>
            <p className="text-[9px] text-slate-400">Secondary</p>
          </div>
          <div className="flex-1 text-center">
            <div className="h-8 rounded-lg mb-1 border border-slate-200" style={{ backgroundColor: tc }} />
            <span className="text-[9px] text-slate-500 font-mono">{tc}</span>
            <p className="text-[9px] text-slate-400">Text</p>
          </div>
        </div>
      </div>
    </div>
  );
};
