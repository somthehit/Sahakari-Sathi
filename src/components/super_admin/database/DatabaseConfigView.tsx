import React, { useState, useEffect, useCallback } from 'react';
import {
  Database, Shield, Server, Activity, RefreshCw, Save, Eye, EyeOff,
  CheckCircle2, XCircle, AlertTriangle, HardDrive, Link2, Copy,
  Clock, Zap, Info, Loader2,
} from 'lucide-react';
import { useSuperAdminAuth } from '../../../stores/superAdminAuthStore';
import { superAdminApi } from '../../../lib/superAdminApi';

type Tab = 'connection' | 'pooling' | 'replica' | 'monitoring';

interface DbConfig {
  id?: string;
  environment?: string;
  host: string;
  port: number;
  databaseName: string;
  username: string;
  hasPassword: boolean;
  passwordPreview: string;
  sslMode: string;
  minPoolSize: number;
  maxPoolSize: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
  statementTimeoutMs: number;
  readReplicaEnabled: boolean;
  readReplicaHost: string;
  readReplicaPort: number;
  healthCheckIntervalSec: number;
  slowQueryThresholdMs: number;
  updatedAt?: string;
}

interface TestResult {
  success: boolean;
  latencyMs?: number;
  serverVersion?: string;
  databaseName?: string;
  error?: string;
}

const SSL_MODES = ['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'];
const ENVIRONMENTS = ['development', 'staging', 'production'];

export const DatabaseConfigView: React.FC = () => {
  const { accessToken } = useSuperAdminAuth();
  const [activeTab, setActiveTab] = useState<Tab>('connection');
  const [config, setConfig] = useState<DbConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordValue, setPasswordValue] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await superAdminApi.getDbConfig(accessToken);
      setConfig(data);
    } catch (err: any) {
      setConfig({
        host: '', port: 5432, databaseName: 'postgres', username: '',
        hasPassword: false, passwordPreview: '', sslMode: 'require',
        minPoolSize: 2, maxPoolSize: 10, connectionTimeoutMs: 5000,
        idleTimeoutMs: 30000, statementTimeoutMs: 30000,
        readReplicaEnabled: false, readReplicaHost: '', readReplicaPort: 5432,
        healthCheckIntervalSec: 30, slowQueryThresholdMs: 1000,
      });
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const update = (field: keyof DbConfig, value: any) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
    setDirty(true);
    setSaveMessage(null);
  };

  const handleTestConnection = async () => {
    if (!accessToken || !config) return;
    setTesting(true);
    setTestResult(null);
    try {
      const payload: any = {
        host: config.host,
        port: config.port,
        databaseName: config.databaseName,
        username: config.username,
        sslMode: config.sslMode,
        connectionTimeoutMs: config.connectionTimeoutMs,
      };
      if (passwordValue) payload.password = passwordValue;
      const result = await superAdminApi.testDbConnection(accessToken, payload);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!accessToken || !config) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const payload: any = { ...config };
      if (passwordValue) payload.password = passwordValue;
      else delete payload.password;
      delete payload.hasPassword;
      delete payload.passwordPreview;
      const result = await superAdminApi.updateDbConfig(accessToken, payload);
      setConfig(result.config);
      setPasswordValue('');
      setDirty(false);
      setSaveMessage({ type: 'success', text: 'Configuration saved. Pool hot-swap will take effect within seconds.' });
    } catch (err: any) {
      setSaveMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        <span className="ml-3 text-sm text-slate-500">Loading database configuration...</span>
      </div>
    );
  }

  if (!config) return null;

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'connection', label: 'Connection', icon: Link2 },
    { key: 'pooling', label: 'Connection Pooling', icon: Database },
    { key: 'replica', label: 'Read Replica', icon: Copy },
    { key: 'monitoring', label: 'Monitoring', icon: Activity },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-600" />
            Database Configuration
          </h2>
          <p className="text-xs text-slate-500 mt-1">Production-scale database connection settings with live pool management</p>
        </div>
        <div className="flex items-center gap-2">
          {config.environment && (
            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wide ${
              config.environment === 'production' ? 'bg-emerald-100 text-emerald-700' :
              config.environment === 'staging' ? 'bg-amber-100 text-amber-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              {config.environment}
            </span>
          )}
          {dirty && <span className="px-2 py-1 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700">Modified</span>}
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:cursor-not-allowed"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-medium ${
          saveMessage.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' :
          'bg-rose-50 border border-rose-200 text-rose-700'
        }`}>
          {saveMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          {saveMessage.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeTab === t.key
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Connection Tab */}
      {activeTab === 'connection' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Environment</label>
              <select
                value={config.environment || 'production'}
                onChange={e => update('environment', e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
              >
                {ENVIRONMENTS.map(env => <option key={env} value={env}>{env.charAt(0).toUpperCase() + env.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">SSL Mode</label>
              <select
                value={config.sslMode || 'require'}
                onChange={e => update('sslMode', e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
              >
                {SSL_MODES.map(mode => <option key={mode} value={mode}>{mode}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Database Host *</label>
              <input
                type="text"
                value={config.host}
                onChange={e => update('host', e.target.value)}
                placeholder="e.g. db.example.supabase.co"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-emerald-500 focus:outline-none placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Port *</label>
              <input
                type="number"
                value={config.port}
                onChange={e => update('port', parseInt(e.target.value) || 5432)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Database Name *</label>
            <input
              type="text"
              value={config.databaseName}
              onChange={e => update('databaseName', e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Username *</label>
            <input
              type="text"
              value={config.username}
              onChange={e => update('username', e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password {config.hasPassword && !showPassword ? '(stored — click Change to update)' : '*'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordValue}
                onChange={e => { setPasswordValue(e.target.value); setDirty(true); }}
                placeholder={config.hasPassword && !showPassword ? '••••••••' : 'Enter database password'}
                className="w-full px-3 py-2.5 pr-20 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-emerald-500 focus:outline-none placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Test Connection */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:cursor-not-allowed"
              >
                {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              {testResult && (
                <div className={`flex items-center gap-2 text-xs font-medium ${
                  testResult.success ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  {testResult.success ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Connected ({testResult.latencyMs}ms) — {testResult.serverVersion}</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>{testResult.error}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pooling Tab */}
      {activeTab === 'pooling' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
            <Info className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-xs text-indigo-700">Pool changes apply immediately without server restart.</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Min Pool Size</label>
              <input
                type="number"
                value={config.minPoolSize}
                onChange={e => update('minPoolSize', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">Minimum idle connections maintained</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Max Pool Size</label>
              <input
                type="number"
                value={config.maxPoolSize}
                onChange={e => update('maxPoolSize', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">Maximum concurrent connections</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Connection Timeout (ms)</label>
              <input
                type="number"
                value={config.connectionTimeoutMs}
                onChange={e => update('connectionTimeoutMs', parseInt(e.target.value) || 1000)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">Max wait for new connection</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Idle Timeout (ms)</label>
              <input
                type="number"
                value={config.idleTimeoutMs}
                onChange={e => update('idleTimeoutMs', parseInt(e.target.value) || 5000)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">Before idle connection closes</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Statement Timeout (ms)</label>
              <input
                type="number"
                value={config.statementTimeoutMs}
                onChange={e => update('statementTimeoutMs', parseInt(e.target.value) || 1000)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">Max query execution time</p>
            </div>
          </div>
        </div>
      )}

      {/* Read Replica Tab */}
      {activeTab === 'replica' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Enable Read Replica</h3>
              <p className="text-xs text-slate-500 mt-0.5">Route read queries to a replica to offload the primary</p>
            </div>
            <button
              onClick={() => update('readReplicaEnabled', !config.readReplicaEnabled)}
              className={`relative w-12 h-6 rounded-full transition cursor-pointer ${
                config.readReplicaEnabled ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                config.readReplicaEnabled ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {config.readReplicaEnabled && (
            <>
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="text-xs text-amber-700">Reports and analytics queries route here automatically. Write operations always use the primary.</span>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Replica Host</label>
                  <input
                    type="text"
                    value={config.readReplicaHost || ''}
                    onChange={e => update('readReplicaHost', e.target.value)}
                    placeholder="e.g. replica-db.example.supabase.co"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-emerald-500 focus:outline-none placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Replica Port</label>
                  <input
                    type="number"
                    value={config.readReplicaPort || 5432}
                    onChange={e => update('readReplicaPort', parseInt(e.target.value) || 5432)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}

          {!config.readReplicaEnabled && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-6 text-center">
              <Copy className="w-5 h-5 text-slate-400 mx-auto" />
              <span className="text-xs text-slate-500">Enable read replica to configure a secondary database for read-heavy workloads</span>
            </div>
          )}
        </div>
      )}

      {/* Monitoring Tab */}
      {activeTab === 'monitoring' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Health Check Interval (sec)</label>
              <input
                type="number"
                value={config.healthCheckIntervalSec}
                onChange={e => update('healthCheckIntervalSec', parseInt(e.target.value) || 10)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">How often to ping the database</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Slow Query Threshold (ms)</label>
              <input
                type="number"
                value={config.slowQueryThresholdMs}
                onChange={e => update('slowQueryThresholdMs', parseInt(e.target.value) || 100)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:border-emerald-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">Queries slower than this are flagged</p>
            </div>
          </div>

          {config.updatedAt && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              Last updated: {new Date(config.updatedAt).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
