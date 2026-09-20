import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, Info, Lightbulb } from 'lucide-react';

export interface FormHelpTooltipProps {
  content: string | React.ReactNode;
  title?: string;
  example?: string;
  position?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  iconSize?: string;
}

export const FormHelpTooltip: React.FC<FormHelpTooltipProps> = ({
  content,
  title,
  example,
  position = 'top',
  className = '',
  iconSize = 'w-3.5 h-3.5',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside or escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsVisible(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsVisible(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[position];

  return (
    <div className={`relative inline-flex items-center align-middle ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsVisible(!isVisible)}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        className="text-slate-500 hover:text-emerald-700 focus:text-emerald-700 transition cursor-pointer p-0.5 rounded-full hover:bg-emerald-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        aria-label="Field information guidance"
        title="Click or hover for help"
      >
        <HelpCircle className={`${iconSize} stroke-[2.2]`} />
      </button>

      {isVisible && (
        <div
          className={`absolute z-[9999] w-64 p-3 bg-white text-slate-800 rounded-xl shadow-xl text-xs font-normal border border-slate-300 pointer-events-none animate-in fade-in zoom-in-95 duration-100 ${positionClasses}`}
          role="tooltip"
        >
          {title && (
            <div className="font-bold text-emerald-400 mb-1 flex items-center gap-1.5 border-b border-slate-200 pb-1">
              <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{title}</span>
            </div>
          )}

          <div className="text-slate-700 leading-relaxed text-[11px] font-sans">
            {content}
          </div>

          {example && (
            <div className="mt-2 pt-1.5 border-t border-slate-200 text-[10px] text-amber-300 font-mono flex items-center gap-1">
              <Lightbulb className="w-3 h-3 text-amber-400 shrink-0" />
              <span>E.g., {example}</span>
            </div>
          )}

          {/* Arrow */}
          <div
            className={`absolute w-2 h-2 bg-white border-slate-300 rotate-45 ${ position === 'top' ? 'top-full -mt-1 left-1/2 -translate-x-1/2 border-b border-r' : position === 'bottom' ? 'bottom-full -mb-1 left-1/2 -translate-x-1/2 border-t border-l' : position === 'left' ? 'left-full -ml-1 top-1/2 -translate-y-1/2 border-t border-r' : 'right-full -mr-1 top-1/2 -translate-y-1/2 border-b border-l' }`}
          />
        </div>
      )}
    </div>
  );
};

export interface FormLabelWithHelpProps {
  label: string;
  helpText: string | React.ReactNode;
  helpTitle?: string;
  example?: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
}

export const FormLabelWithHelp: React.FC<FormLabelWithHelpProps> = ({
  label,
  helpText,
  helpTitle,
  example,
  required = false,
  htmlFor,
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-1.5 mb-1 ${className}`}>
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-700">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <FormHelpTooltip content={helpText} title={helpTitle || label} example={example} />
    </div>
  );
};
