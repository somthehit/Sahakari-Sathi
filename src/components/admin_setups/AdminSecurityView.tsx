import React, { useState, useEffect } from 'react';
import { useCoop } from '../../context/CoopContext';
import { useToast } from '../../context/ToastContext';
import { Save, Loader2, AlertCircle, Info } from 'lucide-react';
import {
  fetchSecuritySettings,
  updateSecuritySettings,
  SECURITY_SETTINGS_DEFAULTS,
  type SecuritySettings,
  type SecurityEnforcement,
} from '../../api/security';

interface Props {
  activeSubKey?: string;
}

const DEFAULT_ENFORCEMENT: SecurityEnforcement = {
  passwordPolicy: true,
  passwordExpiry: true,
  sessionTimeout: true,
  enforce2fa: false,
  ipWhitelist: false,
};

/**
 * Banner shown on any tab whose field the server stores but does not act on.
 * The previous version of this screen showed a success toast for every field
 * and enforced none of them, so an admin could believe MFA was mandatory when
 * nothing checked it. Rendering the server's `enforcement` map keeps that from
 * being possible again.
 */
const NotEnforcedNotice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
    <div className="text-[11px] text-amber-800">{children}</div>
  </div>
);

export const AdminSecurityView: React.FC<Props> = ({ activeSubKey = 'admin_password_policy' }) => {
  const { addNotification } = useCoop();
  const toast = useToast();
  const [subTab, setSubTab] = useState<string>(activeSubKey);

  const [secConfig, setSecConfig] = useState<SecuritySettings>(SECURITY_SETTINGS_DEFAULTS);
  const [enforcement, setEnforcement] = useState<SecurityEnforcement>(DEFAULT_ENFORCEMENT);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => { setSubTab(activeSubKey); }, [activeSubKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetchSecuritySettings();
        if (cancelled) return;
        setSecConfig(res.settings);
        setEnforcement(res.enforcement);
        setConfigured(res.configured);
      } catch (err: any) {
        if (!cancelled) setLoadError(err?.response?.data?.error || err?.message || 'Could not load the security policy.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const patch = (p: Partial<SecuritySettings>) => setSecConfig(prev => ({ ...prev, ...p }));

  const handleSaveSecurity = async () => {
    // Mirror the server bounds so the user gets the message before a round trip.
    if (secConfig.minPasswordLength < 6 || secConfig.minPasswordLength > 64) {
      addNotification('Save Failed', 'Minimum password length must be between 6 and 64 characters.', 'alert');
      return;
    }
    if (secConfig.sessionTimeoutMinutes !== 0 && secConfig.sessionTimeoutMinutes < 5) {
      addNotification('Save Failed', 'Session timeout must be 0 (disabled) or at least 5 minutes.', 'alert');
      return;
    }

    setSaving(true);
    try {
      const saved = await updateSecuritySettings(secConfig);
      setSecConfig(saved);
      setConfigured(true);
      addNotification('Security Policy Saved', 'Password rules, expiry and session timeout are now in force for this organization.', 'success');
      toast.showSuccess('Security policy updated.', 'Security Policy Saved');
    } catch (error: any) {
      const detail = error?.response?.data?.error || error?.message || 'Unknown error';
      addNotification('Save Failed', `Could not save the security policy: ${detail}`, 'alert');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">

      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4 max-w-2xl shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">System Security &amp; Hardening Setup</h3>
            <p className="text-slate-500 text-xs">Configure global authentication parameters and workstation access rules.</p>
          </div>
          <button
            onClick={handleSaveSecurity}
            disabled={saving || loading || !!loadError}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg flex items-center gap-2 transition cursor-pointer shadow-xs"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save Security Policy'}
          </button>
        </div>

        {loadError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-rose-800">{loadError}</div>
          </div>
        )}

        {!loading && !loadError && !configured && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5">
            <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-600">
              No policy has been saved for this organization yet. The values below are the system defaults currently in effect — save to make them explicit.
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-slate-500 text-xs">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading security policy…
          </div>
        ) : (
          <>
            {/* Password Policy */}
            {subTab === 'admin_password_policy' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-slate-600 text-xs mb-1">Minimum Password Length (Characters)</label>
                  <input
                    type="number"
                    min={6}
                    max={64}
                    value={secConfig.minPasswordLength}
                    onChange={(e) => patch({ minPasswordLength: Number(e.target.value) })}
                    className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Between 6 and 64. Applied whenever a user sets or changes a password.</span>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={secConfig.requireSpecialChar}
                      onChange={(e) => patch({ requireSpecialChar: e.target.checked })}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Require special characters (!@#$%^&amp;*)
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={secConfig.requireNumber}
                      onChange={(e) => patch({ requireNumber: e.target.checked })}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Require at least one numeric digit (0-9)
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={secConfig.requireUppercase}
                      onChange={(e) => patch({ requireUppercase: e.target.checked })}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Require at least one uppercase letter (A-Z)
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={secConfig.requireLowercase}
                      onChange={(e) => patch({ requireLowercase: e.target.checked })}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Require at least one lowercase letter (a-z)
                  </label>
                </div>

                <div>
                  <label className="block text-slate-600 text-xs mb-1">Mandatory Password Expiry (Days)</label>
                  <input
                    type="number"
                    min={0}
                    max={3650}
                    value={secConfig.passwordExpiryDays}
                    onChange={(e) => patch({ passwordExpiryDays: Number(e.target.value) })}
                    className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Set 0 so passwords never expire. Stamped on the user when their password changes.</span>
                </div>
              </div>
            )}

            {/* 2FA */}
            {subTab === 'admin_2fa' && (
              <div className="space-y-3">
                {!enforcement.enforce2fa && (
                  <NotEnforcedNotice>
                    <span className="font-bold">Recorded, not yet enforced.</span> This installation has no OTP delivery
                    channel configured (no SMS gateway or TOTP enrolment), so logins are not challenged for a second
                    factor. Your preference is stored and will apply once a channel is connected.
                  </NotEnforcedNotice>
                )}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 text-xs">Enforce Multi-Factor Authentication (MFA)</div>
                    <div className="text-slate-500 text-[11px]">Intended for all administrative and teller staff: an SMS OTP or Google Authenticator TOTP token in addition to the password.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={secConfig.enforce2fa}
                    onChange={(e) => patch({ enforce2fa: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Session Mgmt */}
            {subTab === 'admin_session_mgmt' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-slate-600 text-xs mb-1">Inactivity Session Timeout (Minutes)</label>
                  <input
                    type="number"
                    min={0}
                    max={1440}
                    value={secConfig.sessionTimeoutMinutes}
                    onChange={(e) => patch({ sessionTimeoutMinutes: Number(e.target.value) })}
                    className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">User is signed out after this much idle time. Set 0 to disable; otherwise 5 minutes or more.</span>
                </div>
              </div>
            )}

            {/* IP Whitelist */}
            {subTab === 'admin_ip_whitelist' && (
              <div className="space-y-3">
                {!enforcement.ipWhitelist && (
                  <NotEnforcedNotice>
                    <span className="font-bold">Recorded, not yet enforced.</span> Behind a proxy or load balancer the
                    server sees the proxy's address rather than the workstation's, so filtering on it would lock out
                    legitimate staff. Enforcement requires the deployment's <span className="font-mono">TRUST_PROXY</span> setting
                    to be configured first.
                  </NotEnforcedNotice>
                )}
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={secConfig.ipWhitelistEnabled}
                    onChange={(e) => patch({ ipWhitelistEnabled: e.target.checked })}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Restrict logins to the subnets listed below
                </label>
                <div>
                  <label className="block text-slate-600 text-xs mb-1">Whitelisted IP Subnets (Comma Separated)</label>
                  <textarea
                    value={secConfig.ipWhitelist ?? ''}
                    onChange={(e) => patch({ ipWhitelist: e.target.value })}
                    rows={3}
                    placeholder="192.168.1.0/24, 10.0.0.100"
                    className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-lg p-2 text-xs font-mono text-emerald-700 focus:outline-none focus:border-emerald-600"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block font-mono">Branch LAN ranges permitted to reach the login screen.</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
