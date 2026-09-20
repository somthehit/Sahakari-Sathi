import React, { useEffect, useState } from 'react';
import { Award, Activity, RefreshCw, Server, CheckCircle2, AlertCircle } from 'lucide-react';
import { NotConfiguredPanel } from '../common/NotConfiguredPanel';
import { checkApiHealth, type ApiHealth } from '../../api/system';

interface Props {
  activeSubKey?: string;
}

/**
 * Licensing, version and system monitoring.
 *
 * Every panel on this screen used to be fabricated: an invented serial key and
 * "LICENSED & VALIDATED" badge, a hardcoded build number that "Check for
 * Software Updates" always confirmed was current, CPU/RAM/DB-pool gauges with
 * made-up numbers, and a "Clear Cache" button that flushed nothing. The only
 * runtime fact the server actually exposes is `GET /api/health`, so the health
 * tab now shows a real reachability probe and the rest state plainly that the
 * information is not tracked here.
 */
export const AdminLicenseMonitoringView: React.FC<Props> = ({ activeSubKey = 'admin_license_info' }) => {
  const subTab = activeSubKey;

  return (
    <div className="space-y-6">

      {/* 1. LICENSE / ACTIVATION */}
      {(subTab === 'admin_license_info' || subTab === 'admin_prod_activation') && (
        <NotConfiguredPanel title="No software licence is registered" icon={Award}>
          <p>
            The application is not gated by a licence key, so there is no serial, branch cap, seat
            count or expiry to display. The earlier "Licensed &amp; Validated" panel and its serial
            number were placeholders, not a real entitlement.
          </p>
          <p>
            Any commercial terms for your deployment are held with your provider, outside this
            software.
          </p>
        </NotConfiguredPanel>
      )}

      {/* 2. VERSION / UPDATES */}
      {(subTab === 'admin_version_info' || subTab === 'admin_updates') && (
        <NotConfiguredPanel title="Build version and updates are not tracked here" icon={RefreshCw}>
          <p>
            There is no update channel wired to the application, so it cannot check for or apply new
            releases, and the build number shown previously was hardcoded rather than read from the
            running server.
          </p>
          <p>
            Updates are delivered by redeploying the application; check the deployed build with
            whoever manages hosting.
          </p>
        </NotConfiguredPanel>
      )}

      {/* 3. HEALTH — the one genuinely available signal */}
      {subTab === 'admin_system_health' && <SystemHealthPanel />}

      {/* 4. CACHE */}
      {subTab === 'admin_cache_mgmt' && (
        <NotConfiguredPanel title="There is no server cache to clear from here" icon={Activity}>
          <p>
            The application does not expose a cache-flush operation, so this action did nothing
            beyond showing a success message. To reload the interface, refresh the page in your
            browser.
          </p>
        </NotConfiguredPanel>
      )}

      {/* 5. RUNNING JOBS — routed here, but there is no job runner */}
      {subTab === 'admin_running_jobs' && (
        <NotConfiguredPanel title="No background jobs are running" icon={Activity}>
          <p>
            The application has no background worker or job queue, so there is no running-task list
            to show. Long operations such as interest posting happen inside the request that
            triggers them, while you wait.
          </p>
        </NotConfiguredPanel>
      )}
    </div>
  );
};

/**
 * Live API reachability. Replaces the invented CPU/RAM/pool gauges with the one
 * thing that can actually be measured from the browser: whether the server's
 * health endpoint answers, and how quickly.
 */
const SystemHealthPanel: React.FC = () => {
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [checking, setChecking] = useState(true);

  const runCheck = React.useCallback(async () => {
    setChecking(true);
    const result = await checkApiHealth();
    setHealth(result);
    setChecking(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void checkApiHealth().then((result) => {
      if (!cancelled) {
        setHealth(result);
        setChecking(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const reachable = health?.reachable === true;

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4 max-w-2xl shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Server className="w-4 h-4 text-slate-500" />
          API Health
        </h3>
        <button
          onClick={runCheck}
          disabled={checking}
          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[11px] rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Checking…' : 'Re-check'}
        </button>
      </div>

      <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
        reachable ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
      }`}>
        {reachable
          ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
        <div className={`text-xs ${reachable ? 'text-emerald-800' : 'text-rose-800'}`}>
          {checking
            ? 'Contacting the server…'
            : reachable
              ? 'The server is reachable and reporting healthy.'
              : `The server did not respond as healthy${health?.error ? ` (${health.error})` : ''}.`}
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
          <dt className="text-slate-500 font-semibold">Response time</dt>
          <dd className="text-lg font-bold text-slate-800 font-mono">
            {health ? `${health.latencyMs} ms` : '—'}
          </dd>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
          <dt className="text-slate-500 font-semibold">Server time</dt>
          <dd className="text-xs font-bold text-slate-800 font-mono break-all">
            {health?.serverTime ?? '—'}
          </dd>
        </div>
      </dl>

      <p className="text-[11px] text-slate-500 leading-relaxed">
        Host metrics such as CPU load, memory and database-pool usage are not exposed by the
        server, so they are not shown. This check only confirms the API is answering.
      </p>
    </div>
  );
};
