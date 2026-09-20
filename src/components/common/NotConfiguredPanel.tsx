import React from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Honest placeholder for an admin capability that has no backing service yet.
 *
 * The screens that use this (database backup, cron scheduler, licensing,
 * update channel, bulk import) previously rendered fabricated data and fired
 * success notifications without calling anything. An administrator could
 * believe a nightly backup existed, or that 150 members had been imported,
 * when nothing had happened at all. Showing the absence plainly is the only
 * safe state until a real service is wired up.
 */
interface NotConfiguredPanelProps {
  /** The capability the screen is about, e.g. "Database backups". */
  title: string;
  /** Why it cannot run from here yet, in plain language. */
  children: React.ReactNode;
  /** Optional: where the capability actually lives today. */
  footer?: React.ReactNode;
  /** Lucide icon for the capability. Defaults to a warning glyph. */
  icon?: React.ComponentType<{ className?: string }>;
}

export const NotConfiguredPanel: React.FC<NotConfiguredPanelProps> = ({
  title,
  children,
  footer,
  icon: Icon = AlertCircle,
}) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 max-w-2xl shadow-xs">
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-amber-600" />
      </div>
      <div className="space-y-1.5">
        <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
        <div className="text-slate-600 text-xs leading-relaxed space-y-2">{children}</div>
      </div>
    </div>

    {footer && (
      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 leading-relaxed">
        {footer}
      </div>
    )}
  </div>
);
