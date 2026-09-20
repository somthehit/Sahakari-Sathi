/**
 * SetupShareCertificateFormatView
 * SETUPS → Share Settings → Share Certificate Format
 *
 * Singular setup page: mounts the already-built ShareCertificateDesigner in
 * its `embedded` mode (hides Register/Batch/Issue tabs) and wires real
 * save/load to the API instead of local-only state. The saved design is
 * persisted as the org's default certificate format, so the Share page prints
 * exactly what the admin designed here.
 *
 * Data-fetching convention matches the rest of the Setup pages (plain
 * apiClient + useEffect + useToast — no React Query).
 */
import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { useToast } from '../../context/ToastContext';
import { useAuthStore } from '../../stores/authStore';
import { ShareCertificateDesigner } from '../shares/ShareCertificateDesigner';
import type { CertificateConfig } from '../shares/ShareCertificateCanvas';

export const SetupShareCertificateFormatView: React.FC = () => {
  const toast = useToast();
  const authUser = useAuthStore((s) => s.user);
  const isAdmin = !!authUser?.isOrgAdmin || authUser?.role === 'org_admin';

  const [config, setConfig] = useState<Partial<CertificateConfig> | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    apiClient
      .get('/share-settings/certificate-format')
      .then((res) => {
        if (!active) return;
        const cfg = res.data?.config;
        setConfig(cfg && typeof cfg === 'object' ? cfg : undefined);
      })
      .catch(() => {
        // Non-fatal: fall back to the default certificate design.
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSaveConfig = async (fullConfig: CertificateConfig) => {
    setSaving(true);
    try {
      await apiClient.put('/share-settings/certificate-format', fullConfig);
      toast.showSuccess('Certificate design saved.');
    } catch (err: any) {
      const msg = err.response?.data?.error ?? err.message ?? 'Failed to save certificate design';
      toast.showError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading certificate format…
      </div>
    );
  }

  return (
    <ShareCertificateDesigner
      embedded
      initialConfig={config}
      onSaveConfig={isAdmin ? handleSaveConfig : undefined}
      saving={saving}
    />
  );
};
