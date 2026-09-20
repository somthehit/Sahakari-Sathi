import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, Building2, Users, Globe, TrendingUp, Server, Database,
  Activity, AlertTriangle, CheckCircle2, Clock, ArrowUpRight, Sparkles,
  Zap, HardDrive, Cpu, Wifi, BarChart2, RefreshCw, UserCircle2, BookOpenCheck, Landmark, Receipt
} from 'lucide-react';
import { useSuperAdminAuth } from '../../../stores/superAdminAuthStore';
import { superAdminApi } from '../../../lib/superAdminApi';

interface PlatformStats {
  organizations: number;
  activeOrganizations: number;
  users: number;
  members: number;
  savingsAccounts: number;
  loanAccounts: number;
  auditLogs: number;
  superAdmins: number;
}

interface RecentLog {
  id: string;
  username: string | null;
  organizationCode: string | null;
  event: string;
  reason: string | null;
  createdAt: string;
}

export const SuperAdminDashboardView: React.FC = () => {
  const { accessToken } = useSuperAdminAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const [statsData, logsData] = await Promise.all([
        superAdminApi.getPlatformStats(accessToken),
        superAdminApi.getAuditLogs(accessToken, 8),
      ]);
      setStats(statsData);
      setRecentLogs(Array.isArray(logsData) ? logsData : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load platform statistics.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const kpis = stats ? [
    { label: 'Total Organizations', value: String(stats.organizations), change: `${stats.activeOrganizations} active`, icon: Building2, color: 'bg-emerald-100 text-emerald-800', key: null },
    { label: 'Platform Users', value: String(stats.users), change: 'system accounts', icon: Users, color: 'bg-indigo-100 text-indigo-800', key: null },
    { label: 'Total Members', value: stats.members.toLocaleString(), change: 'registered members', icon: Globe, color: 'bg-teal-100 text-teal-800', key: null },
    { label: 'Savings Accounts', value: stats.savingsAccounts.toLocaleString(), change: 'active accounts', icon: Landmark, color: 'bg-amber-100 text-amber-800', key: null },
    { label: 'Loan Accounts', value: stats.loanAccounts.toLocaleString(), change: 'loan portfolio', icon: Receipt, color: 'bg-purple-100 text-purple-800', key: null },
    { label: 'Audit Log Entries', value: stats.auditLogs.toLocaleString(), change: 'auth events recorded', icon: Activity, color: 'bg-rose-100 text-rose-800', key: null },
    { label: 'Super Admins', value: String(stats.superAdmins), change: 'platform admins', icon: ShieldAlert, color: 'bg-cyan-100 text-cyan-800', key: null },
    { label: 'Storage Used', value: '—', change: 'not available', icon: HardDrive, color: 'bg-orange-100 text-orange-800', key: null },
  ] : [];

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
              <ShieldAlert className="w-6 h-6 text-emerald-700" />
              <span>Platform Dashboard</span>
            </h1>
            <p className="text-slate-500 text-xs mt-1">Live platform overview across all organizations, users, and infrastructure.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadStats} className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-xl transition cursor-pointer" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* KPI Grid */}
      {loading && !stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs animate-pulse">
              <div className="h-4 w-10 bg-slate-200 rounded mb-3" />
              <div className="h-6 w-16 bg-slate-200 rounded mb-2" />
              <div className="h-3 w-20 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.label}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:border-emerald-300 hover:shadow-sm transition group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-xl ${kpi.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-lg font-extrabold text-slate-900">{kpi.value}</div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">{kpi.label}</div>
                <div className="text-[10px] text-slate-500 mt-1">{kpi.change}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-900 text-sm">Recent Platform Activity</h2>
        </div>
        <div className="space-y-3">
          {recentLogs.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-10 text-center text-slate-500">
              <Activity className="w-8 h-8 text-slate-600 mb-2" />
              <p className="text-sm font-bold text-slate-600">No activity recorded yet</p>
              <p className="text-xs mt-1">Login and authentication events will appear here.</p>
            </div>
          )}
          {loading && <div className="text-center py-10 text-slate-500 text-xs">Loading activity...</div>}
          {recentLogs.map(log => (
            <div key={log.id} className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
              <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${log.event?.toUpperCase().includes('FAILED') ? 'bg-red-500' : log.event?.toUpperCase().includes('LOGIN') ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-800 truncate">
                  {log.event} <span className="text-slate-500 font-normal">· {log.organizationCode || 'SYSTEM'}</span>
                </div>
                <div className="text-[11px] text-slate-500 truncate">{log.reason || ''}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {log.username || 'system'} · {log.createdAt ? new Date(log.createdAt).toLocaleString() : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
