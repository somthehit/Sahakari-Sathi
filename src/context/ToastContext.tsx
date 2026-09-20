import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
  showSuccess: (message: string, title?: string) => string;
  showError: (message: string, title?: string) => string;
  showWarning: (message: string, title?: string) => string;
  showInfo: (message: string, title?: string) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ title, message, type, duration = 4500 }: Omit<ToastItem, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastItem = { id, title, message, type, duration };

      setToasts((prev) => [newToast, ...prev].slice(0, 5)); // Keep max 5 visible toasts

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast]
  );

  const showSuccess = useCallback(
    (message: string, title = 'Operation Successful') =>
      addToast({ message, title, type: 'success' }),
    [addToast]
  );

  const showError = useCallback(
    (message: string, title = 'Action Failed') =>
      addToast({ message, title, type: 'error', duration: 6000 }),
    [addToast]
  );

  const showWarning = useCallback(
    (message: string, title = 'Warning') =>
      addToast({ message, title, type: 'warning', duration: 5000 }),
    [addToast]
  );

  const showInfo = useCallback(
    (message: string, title = 'Notice') =>
      addToast({ message, title, type: 'info' }),
    [addToast]
  );

  // Global listener for uncaught errors and unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      let errMsg = 'An unexpected async operation error occurred.';
      if (reason instanceof Error) {
        errMsg = reason.message;
      } else if (typeof reason === 'string') {
        errMsg = reason;
      } else if (reason && typeof reason === 'object' && 'message' in reason) {
        errMsg = String(reason.message);
      }
      showError(errMsg, 'System Promise Failure');
    };

    const handleGlobalError = (event: ErrorEvent) => {
      if (event.message) {
        showError(event.message, 'Runtime Script Error');
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleGlobalError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleGlobalError);
    };
  }, [showError]);

  // Memoized value: every method is a stable useCallback, so the context value
  // identity never changes across renders. This prevents consumer components
  // that reference `toast` inside a useCallback/useEffect dependency from
  // re-firing on every toast add/remove (which caused an infinite refetch loop
  // when an error toast was shown inside a fetch effect).
  const value = useMemo(
    () => ({
      addToast,
      removeToast,
      showSuccess,
      showError,
      showWarning,
      showInfo,
    }),
    [addToast, removeToast, showSuccess, showError, showWarning, showInfo]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Floating Toast Container */}
      <div
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-2"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg transition-all duration-200 transform translate-y-0 animate-in fade-in slide-in-from-top-3 ${ toast.type === 'success' ? 'bg-emerald-900/95 border-emerald-700 text-emerald-50' : toast.type === 'error' ? 'bg-rose-950/95 border-rose-800 text-rose-50' : toast.type === 'warning' ? 'bg-amber-950/95 border-amber-800 text-amber-50' : 'bg-white border-slate-300 text-slate-800' }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400" />}
              {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-sky-400" />}
            </div>

            <div className="flex-1 text-xs space-y-0.5 min-w-0">
              {toast.title && <div className="font-bold tracking-tight text-xs">{toast.title}</div>}
              <div className="text-slate-700 leading-relaxed break-words">{toast.message}</div>
            </div>

            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white/10 transition cursor-pointer"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
