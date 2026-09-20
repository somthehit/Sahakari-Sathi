import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  RefreshCw, BookOpen, FileText, Ban, AlertOctagon, Coins, Loader2,
} from 'lucide-react';
import { formatNPR } from '../../utils/nepaliCalendar';
import { fetchChequeStats } from '../../api/chequeRegistry';

/** Human labels + tone for leaf statuses shown in the overview breakdown. */
const LEAF_STATUS_META: Record<string, { label: string; cls: string }> = {
  unused: { label: 'Unused', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  issued: { label: 'Issued', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
  presented: { label: 'Presented', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  used: { label: 'Used', cls: 'bg-violet-50 text-violet-700 ring-violet-200' },
  cleared: { label: 'Cleared', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  bounced: { label: 'Bounced', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  stopped: { label: 'Stopped', cls: 'bg-red-50 text-red-700 ring-red-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500 ring-slate-200' },
};

function StatCard({
  icon, label, value, sub, tone = 'emerald',
}: {
  icon: React.ReactNode; label: string; value: React.ReactNode; sub?: React.ReactNode;
  tone?: 'emerald' | 'sky' | 'amber' | 'rose' | 'slate';
}) {
  const toneCls: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    sky: 'bg-sky-50 text-sky-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneCls[tone]}`}>{icon}</span>
        <span className="text-[12px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
      </div>
      <div className="mt-3 text-[26px] font-bold leading-none tracking-tight text-slate-900">{value}</div>
      {sub && <div className="mt-1.5 text-[12px] text-slate-500">{sub}</div>}
    </div>
  );
}

export const ChequeOverviewTab: React.FC<{ onOpenRegister?: () => void }> = ({ onOpenRegister }) => {
  const statsQuery = useQuery({
    queryKey: ['cheque-book-register', 'stats'],
    queryFn: fetchChequeStats,
  });
  const stats = statsQuery.data;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-slate-900">Cheque operations at a glance</h2>
        <button
          onClick={() => statsQuery.refetch()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12.5px] text-slate-500 transition hover:bg-slate-50"
        >
          <RefreshCw size={13} className={statsQuery.isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {statsQuery.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : !stats ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center text-[13px] text-slate-400">
          Unable to load cheque statistics.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              icon={<BookOpen size={18} />}
              label="Cheque books"
              value={stats.books.total.toLocaleString('en-IN')}
              sub={<><span className="font-semibold text-emerald-600">{stats.books.active}</span> active</>}
            />
            <StatCard
              icon={<FileText size={18} />}
              label="Cheque leaves"
              value={stats.leaves.total.toLocaleString('en-IN')}
              tone="sky"
              sub={<><span className="font-semibold text-emerald-600">{stats.leaves.byStatus['cleared'] || 0}</span> cleared · <span className="font-semibold text-violet-600">{stats.leaves.byStatus['used'] || 0}</span> used</>}
            />
            <StatCard
              icon={<Ban size={18} />}
              label="Stop payments"
              value={stats.stopPayments.total.toLocaleString('en-IN')}
              tone="amber"
              sub={<><span className="font-semibold text-amber-600">{stats.stopPayments.pending}</span> pending approval</>}
            />
            <StatCard
              icon={<AlertOctagon size={18} />}
              label="Bounced cheques"
              value={stats.bounces.total.toLocaleString('en-IN')}
              tone="rose"
              sub={<>{formatNPR(stats.bounces.amount)} dishonoured</>}
            />
            <StatCard
              icon={<Coins size={18} />}
              label="Issuance charges"
              value={formatNPR(stats.charges.issuanceTotal)}
              sub="Collected to date"
            />
            <StatCard
              icon={<Coins size={18} />}
              label="Bounce charges"
              value={formatNPR(stats.bounces.charges)}
              tone="rose"
              sub="Penalties collected"
            />
          </div>

          {/* Leaf status breakdown */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[13.5px] font-semibold text-slate-800">Leaf status distribution</h3>
              {onOpenRegister && (
                <button onClick={onOpenRegister} className="text-[12.5px] font-medium text-emerald-700 transition hover:text-emerald-800">
                  Open register →
                </button>
              )}
            </div>
            {Object.keys(stats.leaves.byStatus).length === 0 ? (
              <p className="text-[12.5px] text-slate-400">No leaves issued yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.leaves.byStatus)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, cnt]) => {
                    const meta = LEAF_STATUS_META[status] || { label: status, cls: 'bg-slate-100 text-slate-600 ring-slate-200' };
                    return (
                      <span key={status} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium ring-1 ring-inset ${meta.cls}`}>
                        {meta.label}
                        <span className="font-mono font-bold">{cnt.toLocaleString('en-IN')}</span>
                      </span>
                    );
                  })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
