import React from 'react';
import {
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  Building2,
  CalendarDays,
  Users,
  Wallet,
  LayoutDashboard,
  Sparkles,
} from 'lucide-react';
import { useCoop, type BootstrapStep } from '../../context/CoopContext';

const STEP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  session: ShieldCheck,
  org: Building2,
  fiscal: CalendarDays,
  structure: Users,
  domain: Wallet,
  dashboard: LayoutDashboard,
};

interface AppBootstrapScreenProps {
  /** Server-side JWT validation against /auth/me is running concurrently. */
  sessionValidated: boolean;
  /** Fired once authentication AND workspace bootstrap are both complete. */
  onReady: () => void;
}

/**
 * Post-login workspace preparation screen. This is intentionally a SEPARATE
 * visual state from the login form: authentication already succeeded, so the
 * UI should say so and simply walk the user through the data that is being
 * prepared in the background — it must never look like "still signing in".
 */
export const AppBootstrapScreen: React.FC<AppBootstrapScreenProps> = ({ sessionValidated, onReady }) => {
  const { bootstrapSteps, bootstrapReady } = useCoop();

  React.useEffect(() => {
    if (bootstrapReady && sessionValidated) onReady();
  }, [bootstrapReady, sessionValidated, onReady]);

  const steps: BootstrapStep[] = [
    { key: 'session', label: 'Verifying your session & permissions', status: sessionValidated ? 'done' : 'loading' },
    ...bootstrapSteps,
    { key: 'dashboard', label: 'Preparing your dashboard', status: bootstrapReady ? 'done' : 'pending' },
  ];

  const completed = steps.filter((s) => s.status === 'done' || s.status === 'error').length;
  const pct = Math.round((completed / steps.length) * 100);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        {/* Success badge */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-emerald-400/30 rounded-full blur-lg animate-pulse" />
            <div className="relative w-16 h-16 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">You're signed in!</h1>
          <p className="text-slate-500 text-sm mt-1.5">Setting up your workspace…</p>
        </div>

        {/* Progress card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-6">
          {/* Progress bar */}
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-2">
            <span>Preparing workspace</span>
            <span className="font-mono">{pct}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-5">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          <ul className="space-y-3">
            {steps.map((step) => {
              const Icon = STEP_ICONS[step.key] || CheckCircle2;
              return (
                <li key={step.key} className="flex items-center gap-3">
                  <span className="shrink-0 w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
                    {step.status === 'done' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : step.status === 'error' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    ) : step.status === 'loading' ? (
                      <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                    ) : (
                      <Icon className="w-4 h-4 text-slate-300" />
                    )}
                  </span>
                  <p className={`flex-1 text-sm truncate ${step.status === 'pending' ? 'text-slate-400' : 'text-slate-700'} font-medium`}>
                    {step.label}
                  </p>
                  {step.status === 'done' && (
                    <span className="shrink-0 text-[10px] font-bold text-emerald-600 uppercase">Done</span>
                  )}
                  {step.status === 'error' && (
                    <span className="shrink-0 text-[10px] font-bold text-amber-600 uppercase">Skipped</span>
                  )}
                  {step.status === 'loading' && (
                    <Loader2 className="w-3.5 h-3.5 text-emerald-500 animate-spin shrink-0" />
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Authenticated successfully — this usually takes just a few seconds.
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppBootstrapScreen;