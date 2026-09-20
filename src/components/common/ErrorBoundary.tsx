import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw, Home, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by SahakariSathi ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
    window.location.hash = '';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] w-full flex items-center justify-center p-4 bg-slate-50 text-slate-800 font-sans">
          <div className="max-w-xl w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-100 border border-rose-200 text-rose-700 rounded-2xl shrink-0">
                <AlertOctagon className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Application View Error
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  An unexpected UI or state rendering error occurred in this section. The system prevented a full freeze and caught the exception safely.
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            {this.state.error && (
              <div className="p-3.5 bg-rose-50/80 border border-rose-200/80 rounded-xl text-xs space-y-1.5">
                <div className="font-bold text-rose-900 flex items-center justify-between">
                  <span>Error Details:</span>
                  <span className="text-[10px] font-mono text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                    {typeof this.state.error?.name === 'string' ? this.state.error.name : 'Runtime Exception'}
                  </span>
                </div>
                <p className="font-mono text-rose-800 break-words font-semibold">
                  {typeof this.state.error?.message === 'string'
                    ? this.state.error.message
                    : typeof this.state.error === 'string'
                    ? this.state.error
                    : typeof (this.state.error as any)?.error === 'string'
                    ? (this.state.error as any).error
                    : this.state.error
                    ? JSON.stringify(this.state.error)
                    : 'Unknown execution error'}
                </p>
              </div>
            )}

            {/* Collapsible Stack Trace */}
            {this.state.errorInfo && (
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                  className="w-full px-3.5 py-2 bg-slate-100/80 hover:bg-slate-200/60 text-slate-700 font-semibold flex items-center justify-between transition cursor-pointer"
                >
                  <span>Technical Component Trace</span>
                  {this.state.showDetails ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>
                {this.state.showDetails && (
                  <div className="p-3 bg-white text-slate-700 font-mono text-[11px] overflow-x-auto max-h-48 leading-snug">
                    <pre>{this.state.errorInfo.componentStack}</pre>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Recover Component</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs"
              >
                <Home className="w-4 h-4" />
                <span>Reset to Dashboard</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="px-3.5 py-2 bg-slate-50 hover:bg-white text-slate-800 font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs shadow-xs"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Page</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
