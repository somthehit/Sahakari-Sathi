import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings, Database, Mail, Smartphone, Palette, Shield, Globe,
  Save, RotateCcw, Eye, EyeOff, Check, AlertTriangle, Loader2, Info,
  X, Clock, Trash2, CalendarClock, Lock
} from 'lucide-react';
import { useSuperAdminAuth } from '../../../stores/superAdminAuthStore';
import { superAdminApi } from '../../../lib/superAdminApi';
import { useCoop } from '../../../context/CoopContext';
import { ImageUploadField } from '../../branding/ImageUploadField';
import { ColorPickerField } from '../../branding/ColorPickerField';
import { BrandingLivePreview } from '../../branding/BrandingLivePreview';
import { DatabaseConfigView } from '../database/DatabaseConfigView';

interface Setting {
  id: string;
  category: string;
  key: string;
  value: string | null;
  valueType: string;
  label: string | null;
  description: string | null;
  isSecret: boolean;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CategoryGroup {
  category: string;
  settings: Setting[];
}

const CATEGORY_META: Record<string, { label: string; icon: React.FC<any>; color: string }> = {
  general: { label: 'General', icon: Globe, color: 'emerald' },
  database: { label: 'Database', icon: Database, color: 'blue' },
  email: { label: 'SMTP Server', icon: Mail, color: 'violet' },
  sms: { label: 'SMS Gateway', icon: Smartphone, color: 'amber' },
  branding: { label: 'Default Branding', icon: Palette, color: 'rose' },
  security: { label: 'Security', icon: Shield, color: 'red' },
};

const SECRET_KEY_PATTERNS = ['password', 'secret', 'api_key', 'access_token', 'pass'];

function isSecretField(setting: Setting): boolean {
  if (setting.isSecret) return true;
  const lower = setting.key.toLowerCase();
  return SECRET_KEY_PATTERNS.some(p => lower.includes(p));
}

const logPlatformAudit = async (action: string, category: string, keys: string[]) => {
  try {
    await fetch('/api/v1/super-admin/audit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        category,
        keys,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // non-blocking
  }
};

export const SystemSettingsView: React.FC = () => {
  const { addNotification } = useCoop();
  const token = useSuperAdminAuth(s => s.accessToken);

  const [activeTab, setActiveTab] = useState('general');
  const [groupedSettings, setGroupedSettings] = useState<CategoryGroup[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [originalValues, setOriginalValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Set<string>>(new Set());

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetModalCategory, setResetModalCategory] = useState<string | null>(null);
  const [resetConfirmText, setResetConfirmText] = useState('');

  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [maintenanceStartTime, setMaintenanceStartTime] = useState('');
  const [maintenanceEndTime, setMaintenanceEndTime] = useState('');
  const [maintenancePendingValue, setMaintenancePendingValue] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await superAdminApi.getSettingsGrouped(token);
      setGroupedSettings(data);

      const values: Record<string, string> = {};
      for (const group of data) {
        for (const s of group.settings) {
          values[s.key] = s.value ?? '';
        }
      }
      setFormValues(values);
      setOriginalValues(values);
      setDirtyKeys(new Set());
    } catch (err: any) {
      addNotification('Error', err.message || 'Failed to load settings', 'alert');
    } finally {
      setLoading(false);
    }
  }, [token, addNotification]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleChange = (key: string, value: string) => {
    if (key === 'platform_version') return;
    setFormValues(prev => ({ ...prev, [key]: value }));
    setDirtyKeys(prev => {
      const next = new Set(prev);
      if (value !== originalValues[key]) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!token || dirtyKeys.size === 0) return;
    setSaving(true);
    try {
      const settingsToUpdate = Array.from(dirtyKeys).map(key => ({
        key,
        value: formValues[key],
      }));
      await superAdminApi.bulkUpdateSettings(token, settingsToUpdate);

      const newOriginals = { ...originalValues };
      for (const { key, value } of settingsToUpdate) {
        newOriginals[key] = value;
      }
      setOriginalValues(newOriginals);
      setDirtyKeys(new Set());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      addNotification('Settings Saved', 'System configuration updated successfully.', 'success');

      const cats = [...new Set(settingsToUpdate.map(s => {
        const g = groupedSettings.find(gr => gr.settings.some(st => st.key === s.key));
        return g?.category ?? 'unknown';
      }))];
      for (const cat of cats) {
        logPlatformAudit('bulk_update', cat, settingsToUpdate.filter(s => {
          const g = groupedSettings.find(gr => gr.settings.some(st => st.key === s.key));
          return g?.category === cat;
        }).map(s => s.key));
      }
    } catch (err: any) {
      addNotification('Error', err.message || 'Failed to save settings', 'alert');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = (category?: string) => {
    setResetModalCategory(category ?? null);
    setResetConfirmText('');
    setResetModalOpen(true);
  };

  const handleResetConfirm = async () => {
    const category = resetModalCategory;
    const expected = category ? 'RESET' : 'RESET ALL';
    if (resetConfirmText !== expected) return;
    if (!token) return;
    setResetting(true);
    setResetModalOpen(false);
    try {
      await superAdminApi.resetSystemSettings(token, category ?? undefined);
      await fetchSettings();
      addNotification('Settings Reset', `${category ? `${category} ` : ''}Settings restored to defaults.`, 'success');
      logPlatformAudit('reset', category ?? 'all', category
        ? (groupedSettings.find(g => g.category === category)?.settings.map(s => s.key) ?? [])
        : groupedSettings.flatMap(g => g.settings.map(s => s.key))
      );
    } catch (err: any) {
      addNotification('Error', err.message || 'Failed to reset settings', 'alert');
    } finally {
      setResetting(false);
    }
  };

  const handleMaintenanceToggle = (isEnabled: boolean) => {
    setMaintenancePendingValue(isEnabled ? 'true' : 'false');
    setMaintenanceMessage('');
    setMaintenanceStartTime('');
    setMaintenanceEndTime('');
    setMaintenanceModalOpen(true);
  };

  const handleMaintenanceConfirm = () => {
    if (maintenancePendingValue === null) return;
    handleChange('maintenance_mode', maintenancePendingValue);
    setMaintenanceModalOpen(false);
    setMaintenancePendingValue(null);
  };

  const togglePasswordVisibility = (key: string) => {
    setShowPasswords(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const activeGroup = groupedSettings.find(g => g.category === activeTab);

  const dirtyCategories = Array.from(dirtyKeys).reduce<Set<string>>((acc, key) => {
    const group = groupedSettings.find(g => g.settings.some(s => s.key === key));
    if (group) acc.add(group.category);
    return acc;
  }, new Set());

  const renderInput = (setting: Setting) => {
    const value = formValues[setting.key] ?? '';
    const isDirty = dirtyKeys.has(setting.key);
    const borderClass = isDirty
      ? 'border-amber-400 bg-amber-50/50 focus:border-amber-500'
      : 'border-slate-300 focus:border-emerald-700';

    if (setting.key === 'platform_version') {
      return (
        <div key={setting.key} className="mb-4">
          <label className="text-xs font-bold text-slate-700 block mb-1">{setting.label}</label>
          {setting.description && <p className="text-[11px] text-slate-500 mb-1">{setting.description}</p>}
          <div className="relative">
            <input
              type="text"
              value={value}
              readOnly
              disabled
              className="w-full border border-slate-200 bg-slate-100 rounded-xl px-3 py-2 text-xs font-mono text-slate-500 cursor-not-allowed"
            />
            <Lock className="absolute right-3 top-2 w-4 h-4 text-slate-400" />
          </div>
        </div>
      );
    }

    if (setting.valueType === 'boolean') {
      const isEnabled = value === 'true';
      return (
        <div key={setting.key} className="flex items-center justify-between py-3 border-b border-slate-200 last:border-0">
          <div className="flex-1 min-w-0 mr-4">
            <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
              {setting.label}
              {isDirty && <span className="text-[10px] text-amber-600 font-bold bg-amber-100 px-1.5 py-0.5 rounded">Modified</span>}
            </div>
            {setting.description && <p className="text-[11px] text-slate-500 mt-0.5">{setting.description}</p>}
          </div>
          <button
            type="button"
            onClick={() => {
              if (setting.key === 'maintenance_mode') {
                handleMaintenanceToggle(!isEnabled);
              } else {
                handleChange(setting.key, isEnabled ? 'false' : 'true');
              }
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${isEnabled ? 'bg-emerald-600' : 'bg-slate-300'}`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      );
    }

    if (setting.valueType === 'password' || isSecretField(setting)) {
      const showKey = showPasswords.has(setting.key);
      return (
        <div key={setting.key} className="mb-4">
          <label className="text-xs font-bold text-slate-700 block mb-1">{setting.label}</label>
          {setting.description && <p className="text-[11px] text-slate-500 mb-1">{setting.description}</p>}
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={value}
              onChange={e => handleChange(setting.key, e.target.value)}
              placeholder={setting.label || ''}
              className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none font-mono transition ${borderClass}`}
            />
            <button
              type="button"
              onClick={() => togglePasswordVisibility(setting.key)}
              className="absolute right-3 top-2 text-slate-500 hover:text-slate-600 cursor-pointer"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {isDirty && <p className="text-[10px] text-amber-600 mt-1 font-bold">Modified</p>}
        </div>
      );
    }

    if (setting.valueType === 'number') {
      return (
        <div key={setting.key} className="mb-4">
          <label className="text-xs font-bold text-slate-700 block mb-1">{setting.label}</label>
          {setting.description && <p className="text-[11px] text-slate-500 mb-1">{setting.description}</p>}
          <input
            type="number"
            value={value}
            onChange={e => handleChange(setting.key, e.target.value)}
            placeholder={setting.label || ''}
            className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none font-mono transition ${borderClass}`}
          />
          {isDirty && <p className="text-[10px] text-amber-600 mt-1 font-bold">Modified</p>}
        </div>
      );
    }

    if (setting.key.includes('color')) {
      return (
        <div key={setting.key} className="mb-4">
          <label className="text-xs font-bold text-slate-700 block mb-1">{setting.label}</label>
          {setting.description && <p className="text-[11px] text-slate-500 mb-1">{setting.description}</p>}
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value || '#000000'}
              onChange={e => handleChange(setting.key, e.target.value)}
              className="w-10 h-10 p-0 border-0 rounded cursor-pointer"
            />
            <input
              type="text"
              value={value}
              onChange={e => handleChange(setting.key, e.target.value)}
              placeholder="#000000"
              className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none font-mono uppercase transition ${borderClass}`}
            />
          </div>
          {isDirty && <p className="text-[10px] text-amber-600 mt-1 font-bold">Modified</p>}
        </div>
      );
    }

    return (
      <div key={setting.key} className="mb-4">
        <label className="text-xs font-bold text-slate-700 block mb-1">{setting.label}</label>
        {setting.description && <p className="text-[11px] text-slate-500 mb-1">{setting.description}</p>}
        <input
          type="text"
          value={value}
          onChange={e => handleChange(setting.key, e.target.value)}
          placeholder={setting.label || ''}
          className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none transition ${borderClass}`}
        />
        {isDirty && <p className="text-[10px] text-amber-600 mt-1 font-bold">Modified</p>}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
            <span className="ml-2 text-sm text-slate-500">Loading settings...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Reset Confirmation Modal */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-red-50 border-b border-red-200 px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-red-900">
                  {resetModalCategory ? `Reset ${resetModalCategory} Settings` : 'Reset All Settings'}
                </h3>
                <p className="text-xs text-red-700">This action cannot be undone</p>
              </div>
            </div>
            <div className="px-6 py-5">
              {!resetModalCategory && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                  <p className="text-xs font-bold text-red-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Warning: Resetting Database and SMTP settings may break login and password-reset for every cooperative.
                  </p>
                </div>
              )}
              <p className="text-xs text-slate-700 mb-3">
                {resetModalCategory
                  ? `This will reset all ${resetModalCategory} settings to their default values:`
                  : 'This will reset ALL settings across every category to their defaults:'}
              </p>
              <ul className="text-xs text-slate-600 space-y-1 mb-4 list-disc list-inside">
                {!resetModalCategory && (
                  <>
                    <li>Database</li>
                    <li>SMTP Server</li>
                    <li>Default Branding</li>
                    <li>SMS Gateway</li>
                    <li>Security</li>
                    <li>General</li>
                  </>
                )}
                {resetModalCategory && <li>{CATEGORY_META[resetModalCategory]?.label ?? resetModalCategory}</li>}
              </ul>
              <div className="mb-4">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Type <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{resetModalCategory ? 'RESET' : 'RESET ALL'}</span> to confirm
                </label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={e => setResetConfirmText(e.target.value)}
                  placeholder={resetModalCategory ? 'RESET' : 'RESET ALL'}
                  className="w-full border border-slate-300 focus:border-red-500 rounded-xl px-3 py-2 text-xs focus:outline-none font-mono transition"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => { setResetModalOpen(false); setResetConfirmText(''); }}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleResetConfirm}
                disabled={resetConfirmText !== (resetModalCategory ? 'RESET' : 'RESET ALL')}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {resetting ? 'Resetting...' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Mode Confirmation Modal */}
      {maintenanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className={`px-6 py-4 flex items-center gap-3 border-b ${
              maintenancePendingValue === 'true'
                ? 'bg-amber-50 border-amber-200'
                : 'bg-emerald-50 border-emerald-200'
            }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                maintenancePendingValue === 'true' ? 'bg-amber-100' : 'bg-emerald-100'
              }`}>
                <Clock className={`w-5 h-5 ${
                  maintenancePendingValue === 'true' ? 'text-amber-600' : 'text-emerald-600'
                }`} />
              </div>
              <div>
                <h3 className={`font-extrabold ${
                  maintenancePendingValue === 'true' ? 'text-amber-900' : 'text-emerald-900'
                }`}>
                  {maintenancePendingValue === 'true' ? 'Enable' : 'Disable'} Maintenance Mode
                </h3>
                <p className={`text-xs ${
                  maintenancePendingValue === 'true' ? 'text-amber-700' : 'text-emerald-700'
                }`}>
                  {maintenancePendingValue === 'true'
                    ? 'All cooperative users will be locked out'
                    : 'Users will regain access to the platform'}
                </p>
              </div>
            </div>
            <div className="px-6 py-5">
              {maintenancePendingValue === 'true' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                  <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    This will lock out ALL cooperative users across the entire platform.
                  </p>
                </div>
              )}
              <div className="mb-4">
                <label className="text-xs font-bold text-slate-700 block mb-1">Maintenance Message</label>
                <p className="text-[11px] text-slate-500 mb-1">Message shown to locked-out users</p>
                <textarea
                  value={maintenanceMessage}
                  onChange={e => setMaintenanceMessage(e.target.value)}
                  placeholder="System is under maintenance. Please try again later."
                  rows={3}
                  className="w-full border border-slate-300 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs focus:outline-none transition resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                    <CalendarClock className="w-3 h-3" /> Start (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={maintenanceStartTime}
                    onChange={e => setMaintenanceStartTime(e.target.value)}
                    className="w-full border border-slate-300 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                    <CalendarClock className="w-3 h-3" /> End (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={maintenanceEndTime}
                    onChange={e => setMaintenanceEndTime(e.target.value)}
                    className="w-full border border-slate-300 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs focus:outline-none transition"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => { setMaintenanceModalOpen(false); setMaintenancePendingValue(null); }}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleMaintenanceConfirm}
                className={`px-4 py-2 font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer ${
                  maintenancePendingValue === 'true'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                {maintenancePendingValue === 'true' ? 'Enable Maintenance' : 'Disable Maintenance'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
              <Settings className="w-6 h-6 text-emerald-700" />
              <span>Global System Settings</span>
            </h1>
            <p className="text-slate-500 text-xs mt-1">Configure core infrastructure, APIs, and default branding.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleReset()}
              disabled={resetting}
              className="px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              {resetting ? 'Resetting...' : 'Reset All'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || dirtyKeys.size === 0}
              className={`px-4 py-2.5 font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-xs cursor-pointer disabled:opacity-50 ${
                saved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
            >
              {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : saved ? 'Saved!' : `Save Configuration${dirtyKeys.size > 0 ? ` (${dirtyKeys.size})` : ''}`}
            </button>
          </div>
        </div>

        {/* Unsaved Changes Banner */}
        {dirtyKeys.size > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-800">
                  {dirtyKeys.size} unsaved change{dirtyKeys.size !== 1 ? 's' : ''} across {dirtyCategories.size} {dirtyCategories.size !== 1 ? 'categories' : 'category'}
                </p>
                <p className="text-[11px] text-amber-700">
                  {Array.from(dirtyCategories).map(c => CATEGORY_META[c]?.label ?? c).join(', ')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setFormValues({ ...originalValues });
                  setDirtyKeys(new Set());
                }}
                className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-50 text-amber-700 font-bold text-[11px] rounded-lg transition cursor-pointer"
              >
                Discard All
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] rounded-lg flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3 h-3" />
                Save All
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-6 mt-5">
          {/* Tabs Sidebar */}
          <div className="w-full md:w-48 shrink-0 flex flex-col gap-1">
            {groupedSettings.map(group => {
              const meta = CATEGORY_META[group.category] || { label: group.category, icon: Settings, color: 'slate' };
              const Icon = meta.icon;
              const hasDirtyInTab = group.settings.some(s => dirtyKeys.has(s.key));
              return (
                <button
                  key={group.category}
                  onClick={() => setActiveTab(group.category)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer text-left ${
                    activeTab === group.category
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {meta.label}
                  {hasDirtyInTab && <span className="ml-auto w-2 h-2 bg-amber-400 rounded-full" />}
                </button>
              );
            })}
          </div>

          {/* Content Area */}
          <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 p-5">
            {activeGroup ? (
              (() => {
                const meta = CATEGORY_META[activeGroup.category] || { label: activeGroup.category, icon: Settings, color: 'emerald' };
                const Icon = meta.icon;
                const categoryDirtyCount = activeGroup.settings.filter(s => dirtyKeys.has(s.key)).length;
                return (
                  <div className="max-w-2xl">
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="font-bold text-slate-900">{meta.label}</h2>
                          <p className="text-[11px] text-slate-500">
                            {activeGroup.settings.length} setting{activeGroup.settings.length !== 1 ? 's' : ''}
                            {categoryDirtyCount > 0 && (
                              <span className="ml-1 text-amber-600 font-bold">
                                &middot; {categoryDirtyCount} modified
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleReset(activeGroup.category)}
                        disabled={resetting}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[11px] rounded-lg flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset
                      </button>
                    </div>

                    {activeGroup.category === 'general' && activeTab === 'general' && (
                      <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-xl text-xs font-medium flex items-start gap-2 mb-4">
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        General platform settings. Maintenance mode disables access for non-admin users.
                      </div>
                    )}

                    {activeGroup.category === 'security' && activeTab === 'security' && (
                      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs font-medium flex items-start gap-2 mb-4">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        Security settings affect all organizations. Changes take effect immediately.
                      </div>
                    )}

                    {activeGroup.category === 'database' ? (
                      <DatabaseConfigView />
                    ) : activeGroup.category === 'branding' ? (
                      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">
                        <div className="space-y-5">
                          <ImageUploadField
                            label="Favicon"
                            helpText="Browser tab icon"
                            currentUrl={formValues.favicon_url || ''}
                            onUpload={(url) => handleChange('favicon_url', url)}
                            recommendedSpec="ICO or PNG, 32x32 or 64x64"
                            aspectRatioHint="square"
                          />
                          <ImageUploadField
                            label="App Logo"
                            helpText="Logo used in the app header and navigation"
                            currentUrl={formValues.logo_url || ''}
                            onUpload={(url) => handleChange('logo_url', url)}
                            recommendedSpec="PNG with transparent background, min 512x512"
                            aspectRatioHint="square"
                          />
                          <ImageUploadField
                            label="Print / Document Logo"
                            helpText="High-resolution logo for receipts, vouchers, and certificates"
                            currentUrl={formValues.print_logo_url || ''}
                            onUpload={(url) => handleChange('print_logo_url', url)}
                            recommendedSpec="PNG or SVG, min 1000x1000 for print quality"
                            aspectRatioHint="wide"
                          />
                          <ColorPickerField
                            label="Primary Color"
                            helpText="Platform primary theme color"
                            value={formValues.primary_color || '#047857'}
                            onChange={(hex) => handleChange('primary_color', hex)}
                          />
                          <ColorPickerField
                            label="Secondary Color"
                            helpText="Complementary accent for alerts, charts, and secondary buttons"
                            value={formValues.secondary_color || '#059669'}
                            onChange={(hex) => handleChange('secondary_color', hex)}
                          />
                          <ColorPickerField
                            label="Text / Dark Color"
                            helpText="Primary text color for headers and body text"
                            value={formValues.text_color || '#1E293B'}
                            onChange={(hex) => handleChange('text_color', hex)}
                          />
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700">App Display Name</label>
                            <p className="text-[11px] text-slate-500">Name shown in the UI header, browser title, and login page</p>
                            <input
                              type="text"
                              value={formValues.app_display_name || ''}
                              onChange={e => handleChange('app_display_name', e.target.value)}
                              placeholder="Sahakari Sathi"
                              className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none transition ${dirtyKeys.has('app_display_name') ? 'border-amber-400 bg-amber-50/50' : 'border-slate-300 focus:border-emerald-700'}`}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700">Footer Text</label>
                            <p className="text-[11px] text-slate-500">Default footer text shown at the bottom of pages</p>
                            <input
                              type="text"
                              value={formValues.footer_text || ''}
                              onChange={e => handleChange('footer_text', e.target.value)}
                              placeholder="Powered by Sahakari Sathi"
                              className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none transition ${dirtyKeys.has('footer_text') ? 'border-amber-400 bg-amber-50/50' : 'border-slate-300 focus:border-emerald-700'}`}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-700">Support Email</label>
                              <input
                                type="email"
                                value={formValues.support_email || ''}
                                onChange={e => handleChange('support_email', e.target.value)}
                                placeholder="support@sahakarisathi.com"
                                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none transition ${dirtyKeys.has('support_email') ? 'border-amber-400 bg-amber-50/50' : 'border-slate-300 focus:border-emerald-700'}`}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-700">Support Phone</label>
                              <input
                                type="tel"
                                value={formValues.support_phone || ''}
                                onChange={e => handleChange('support_phone', e.target.value)}
                                placeholder="+977-XXXXXXXXX"
                                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none transition ${dirtyKeys.has('support_phone') ? 'border-amber-400 bg-amber-50/50' : 'border-slate-300 focus:border-emerald-700'}`}
                              />
                            </div>
                          </div>
                          <ImageUploadField
                            label="Login Page Background"
                            helpText="Background image for the login page"
                            currentUrl={formValues.login_background_url || ''}
                            onUpload={(url) => handleChange('login_background_url', url)}
                            recommendedSpec="JPG or PNG, 1920x1080 recommended"
                            aspectRatioHint="wide"
                          />
                        </div>

                        <BrandingLivePreview
                          logoUrl={formValues.logo_url || ''}
                          faviconUrl={formValues.favicon_url || ''}
                          primaryColor={formValues.primary_color || '#047857'}
                          secondaryColor={formValues.secondary_color || '#059669'}
                          textColor={formValues.text_color || '#1E293B'}
                          footerText={formValues.footer_text || 'Powered by Sahakari Sathi'}
                          appDisplayName={formValues.app_display_name || 'Sahakari Sathi'}
                        />
                      </div>
                    ) : (
                      <form
                        onSubmit={e => {
                          e.preventDefault();
                          handleSave();
                        }}
                      >
                        {activeGroup.settings.map(s => renderInput(s))}
                      </form>
                    )}

                    {categoryDirtyCount > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-200">
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                          {saving ? 'Saving...' : `Save ${meta.label} Settings`}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <Settings className="w-12 h-12 text-slate-600 mb-3" />
                <h3 className="font-bold text-slate-700 text-sm">No Settings Found</h3>
                <p className="text-xs mt-1 text-center max-w-sm">No settings configured for this category.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
