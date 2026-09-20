import React, { useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

interface Props {
  /** Card title shown in the header (e.g. "Issue New Shares (प्राप्ति)"). */
  title: string;
  /** Optional sub-heading under the title. */
  subtitle?: string;
  /** Header icon tile (typically 16-20px). */
  icon: React.ReactNode;
  /** Optional status pill rendered on the right side of the header. */
  badge?: React.ReactNode;
  /** Optional action controls (e.g. transaction-type switcher) on the right side. */
  headerActions?: React.ReactNode;
  /** Form fields / body content. */
  children: React.ReactNode;
}

/**
 * Modular centered card wrapper for Share Issue / Return / Transfer forms.
 * - Compact centered layout (max-w-2xl) instead of a stretched full-width page.
 * - Standard Emerald Green theme (emerald-700/800).
 * - Fullscreen toggle button (Maximize2 / Minimize2) in the card header that
 *   overlays ONLY the form card on the viewport (fixed inset-0 z-50).
 */
export const ShareTransactionFormContainer: React.FC<Props> = ({
  title,
  subtitle,
  icon,
  badge,
  headerActions,
  children,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => setIsFullscreen(f => !f);

  return (
    <div
      className={`transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto flex items-start justify-center'
          : 'w-full py-1 flex justify-center'
      }`}
    >
      {/* Centered form card */}
      <div
        className={`bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden transition-all duration-300 ${
          isFullscreen
            ? 'w-full max-w-6xl rounded-2xl flex flex-col justify-start'
            : 'w-full max-w-2xl border-t-4 border-t-emerald-700'
        }`}
      >
        {/* Card header (green theme + fullscreen toggle) */}
        <div className="bg-slate-50 px-4 sm:px-6 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg shrink-0">
              {icon}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-800 leading-tight">{title}</h3>
              {subtitle && (
                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {headerActions}
            {badge}
            {/* Fullscreen / exit-fullscreen toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen View'}
              className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Form body */}
        <div className={`p-4 sm:p-6 space-y-4 ${isFullscreen ? 'flex-1 overflow-y-auto' : ''}`}>
          {children}
        </div>
      </div>
    </div>
  );
};