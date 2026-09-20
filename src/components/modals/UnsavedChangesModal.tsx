import React from 'react';
import { useCoop } from '../../context/CoopContext';
import { AlertTriangle, X } from 'lucide-react';

export const UnsavedChangesModal: React.FC = () => {
  const { pendingCloseTabId, setPendingCloseTabId, confirmCloseDirtyTab } = useCoop();

  if (!pendingCloseTabId) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 w-full max-w-md rounded-xl shadow-2xl overflow-hidden text-slate-800 p-5 space-y-4 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-200 ease-out">
        
        <div className="flex items-start gap-3">
          <div className="p-2 bg-rose-50 text-rose-600 rounded-lg shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-900">Unsaved Changes Warning</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              This Virtual Tab contains unsaved form input or transaction details. Closing this tab will discard your changes.
            </p>
          </div>
          <button 
            onClick={() => setPendingCloseTabId(null)}
            className="p-1 text-slate-500 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 text-xs">
          <button
            onClick={() => setPendingCloseTabId(null)}
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition cursor-pointer"
          >
            Keep Tab Open
          </button>
          <button
            onClick={confirmCloseDirtyTab}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold transition cursor-pointer shadow-xs"
          >
            Discard & Close Tab
          </button>
        </div>

      </div>
    </div>
  );
};
