import React, { useState, useEffect } from 'react';
import { Maximize2, Minimize2, ChevronDown, ChevronUp, Sparkles, X, Plus } from 'lucide-react';

interface ExpandableFormCardProps {
  title: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  onSubmit?: (e: React.FormEvent) => void;
  defaultMinimized?: boolean;
  allowExpand?: boolean;
  allowMinimize?: boolean;
  footerActions?: React.ReactNode;
}

export const ExpandableFormCard: React.FC<ExpandableFormCardProps> = ({
  title,
  subtitle,
  icon,
  badge,
  headerActions,
  children,
  className = '',
  onSubmit,
  defaultMinimized = false,
  allowExpand = true,
  allowMinimize = true,
  footerActions,
}) => {
  const [isMinimized, setIsMinimized] = useState(defaultMinimized);
  const [isExpanded, setIsExpanded] = useState(false);

  // Handle ESC key to exit fullscreen expanded view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  const toggleMinimize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMinimized(!isMinimized);
  };

  const toggleExpand = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMinimized) setIsMinimized(false);
    setIsExpanded(!isExpanded);
  };

  const CardWrapper = onSubmit ? 'form' : 'div';

  // Render Header Content
  const renderHeader = (inModal = false) => (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3 bg-white">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-extrabold text-slate-900 text-sm md:text-base tracking-tight truncate">{title}</h3>
            {badge}
            {inModal && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold">
                Expanded Fullscreen
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-slate-600 font-medium truncate mt-0.5">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {headerActions}

        {/* Minimize Button */}
        {allowMinimize && !inModal && (
          <button
            type="button"
            onClick={toggleMinimize}
            title={isMinimized ? "Expand / Restore Form" : "Minimize Form"}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer border border-slate-200"
          >
            {isMinimized ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        )}

        {/* Fullscreen Expand Button */}
        {allowExpand && (
          <button
            type="button"
            onClick={toggleExpand}
            title={inModal || isExpanded ? "Exit Fullscreen" : "Expand Fullscreen Mode"}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-emerald-700 hover:text-emerald-800 transition cursor-pointer border border-slate-200"
          >
            {inModal || isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );

  // MINIMIZED BAR STATE
  if (isMinimized && !isExpanded) {
    return (
      <div className={`bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md ${className}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && <div className="text-emerald-700 shrink-0">{icon}</div>}
            <div className="truncate">
              <span className="text-xs font-bold text-slate-900 truncate block">{title}</span>
              {subtitle && <span className="text-[11px] text-slate-500 truncate block">{subtitle}</span>}
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono">
              Minimized
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleMinimize}
              className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Expand Form</span>
            </button>
            {allowExpand && (
              <button
                type="button"
                onClick={toggleExpand}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer border border-slate-200"
                title="Fullscreen Form"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // FULLSCREEN EXPANDED MODAL OVERLAY STATE
  if (isExpanded) {
    return (
      <>
        {/* Placeholder in normal DOM position so layout isn't destroyed */}
        <div className={`bg-slate-100 p-4 rounded-2xl border border-dashed border-slate-300 text-center text-xs text-slate-500 ${className}`}>
          Form opened in Expanded Workspace mode. Press <kbd className="px-1.5 py-0.5 bg-slate-200 rounded border border-slate-300 text-slate-700">ESC</kbd> or click minimize to restore.
        </div>

        {/* Modal Fullscreen Portal */}
        <div className="modal-overlay">
          <CardWrapper
            onSubmit={onSubmit}
            className="bg-white w-full max-w-5xl max-h-[92vh] rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden text-xs text-slate-800"
          >
            {/* Header */}
            <div className="p-4 md:p-5 bg-white border-b border-slate-200 sticky top-0 z-10">
              {renderHeader(true)}
            </div>

            {/* Scrollable Form Body */}
            <div className="p-5 md:p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar bg-white">
              {children}
            </div>

            {/* Optional Footer */}
            {(footerActions || onSubmit) && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 sticky bottom-0 z-10">
                {footerActions || (
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs text-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add / Save Entry</span>
                  </button>
                )}
              </div>
            )}
          </CardWrapper>
        </div>
      </>
    );
  }

  // INLINE NORMAL STATE
  return (
    <CardWrapper
      onSubmit={onSubmit}
      className={`bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 text-xs text-slate-800 transition-all ${className}`}
    >
      {renderHeader(false)}
      <div className="space-y-4 bg-white">{children}</div>
      {(footerActions || onSubmit) && (
        <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
          {footerActions || (
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add / Save Entry</span>
            </button>
          )}
        </div>
      )}
    </CardWrapper>
  );
};
