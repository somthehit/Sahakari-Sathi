import React from 'react';
import { Save, RefreshCw, Trash2, X, Sparkles } from 'lucide-react';

interface AutoSaveBannerProps {
  isVisible: boolean;
  timestamp: string | null;
  formName: string;
  onRestore: () => void;
  onDiscard: () => void;
  onDismiss?: () => void;
}

export const AutoSaveBanner: React.FC<AutoSaveBannerProps> = ({
  isVisible,
  timestamp,
  formName,
  onRestore,
  onDiscard,
  onDismiss,
}) => {
  if (!isVisible) return null;

  return (
    <div className="mb-4 p-3 bg-amber-50 border-2 border-amber-300 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-amber-200/80 text-amber-900 rounded-xl shrink-0">
          <Save className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 font-bold text-xs">
            <span>Unsaved Draft Found for {formName}</span>
            {timestamp && (
              <span className="px-1.5 py-0.5 bg-amber-200/60 rounded text-[10px] font-mono font-medium">
                Saved at {timestamp}
              </span>
            )}
          </div>
          <p className="text-[11px] text-amber-800">
            You have unsaved form entries from a previous session. Would you like to restore your progress?
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
        <button
          type="button"
          onClick={onRestore}
          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Restore Draft</span>
        </button>

        <button
          type="button"
          onClick={onDiscard}
          className="px-3 py-1.5 bg-white hover:bg-rose-50 hover:text-rose-700 border border-amber-300 hover:border-rose-300 text-amber-900 font-semibold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
          <span>Discard</span>
        </button>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 text-amber-700 hover:text-amber-950 rounded-lg hover:bg-amber-100 transition cursor-pointer"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
