import React, { useState } from 'react';
import { X, Award, Loader2 } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { useToast } from '../../context/ToastContext';
import {
  ShareCertificateDesigner,
} from '../shares/ShareCertificateDesigner';
import {
  CertificateConfig,
  DEFAULT_CERT_CONFIG,
} from '../shares/ShareCertificateCanvas';

interface CertificateDesignerModalProps {
  /** Share certificate format row id being designed. */
  formatId: string;
  /** Saved design (configJson) already loaded with the list row, if any. */
  initialConfig?: Partial<CertificateConfig> | null;
  onClose: () => void;
  /** Called after a successful persist with the saved config. */
  onSaved: (config: CertificateConfig) => void;
}

/**
 * Full-screen designer modal for SETUPS → Share Settings → Share Certificate
 * Format. Embeds the ShareCertificateDesigner (designer tab only) and persists
 * the designed CertificateConfig back to the certificate format via
 * `PUT /share-settings/certificate-formats/:id`.
 */
export const CertificateDesignerModal: React.FC<CertificateDesignerModalProps> = ({
  formatId,
  initialConfig,
  onClose,
  onSaved,
}) => {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  // Stable seed so the embedded designer applies it once on mount.
  const [seedConfig] = useState<Partial<CertificateConfig>>(() => ({
    ...DEFAULT_CERT_CONFIG,
    ...(initialConfig || {}),
  }));

  const handleSave = async (config: CertificateConfig) => {
    setSaving(true);
    try {
      await apiClient.put(`/share-settings/certificate-formats/${formatId}`, {
        configJson: config,
      });
      toast.showSuccess('Share certificate design saved.');
      onSaved(config);
    } catch (err: any) {
      toast.showError(
        err?.response?.data?.error ?? err?.message ?? 'Failed to save design.',
        'Save Failed'
      );
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9500] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-50 border border-slate-200 w-full max-w-[1400px] h-[94vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 /40 text-amber-800 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm">
                Share Certificate Design Studio
              </h2>
              <p className="text-xs text-slate-500">
                Design the certificate visually, then save. The Share page renders this exact design.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <X className="w-4 h-4" /> Close
            </button>
          </div>
        </div>

        {/* Body — embedded designer (Save button lives in the designer header) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          <ShareCertificateDesigner
            embedded
            initialConfig={seedConfig}
            onSaveConfig={handleSave}
            saving={saving}
          />
        </div>

        {/* Saving overlay indicator */}
        {saving && (
          <div className="absolute inset-0 z-[1] bg-white backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-xl px-5 py-3 shadow-xl flex items-center gap-3 text-sm font-bold text-slate-800">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              Saving design…
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
