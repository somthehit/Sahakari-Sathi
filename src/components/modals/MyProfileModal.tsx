import React, { useEffect, useRef, useState } from 'react';
import {
  X, User, Building2, MapPin, ShieldCheck, CheckCircle2, AlertCircle,
  KeyRound, Mail, Camera, Pencil, Save, Loader2, Check
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useCoop } from '../../context/CoopContext';
import { useToast } from '../../context/ToastContext';
import { updateMyProfile } from '../../api/security';
import { uploadMedia, resolveMediaUrl } from '../../api/storage';
import { resolveMediaUrl as resolveUrl } from '../../api/storage';

interface MyProfileModalProps {
  open: boolean;
  onClose: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  org_admin: 'System Administrator',
  administrator: 'System Administrator',
  admin: 'System Administrator',
  manager: 'Branch Manager',
  branch_manager: 'Branch Manager',
  teller: 'Senior Cashier / Teller',
  cashier: 'Senior Cashier / Teller',
  loan_officer: 'Credit & Loan Officer',
  accountant: 'Chief Accountant',
  member_service: 'Member Service Officer',
  collection_agent: 'Door-to-Door Agent',
  viewer: 'Viewer',
};

export const MyProfileModal: React.FC<MyProfileModalProps> = ({ open, onClose }) => {
  const { user, updateProfile } = useAuthStore();
  const { activeBranch, branches, activeRole } = useCoop();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (user) setEditName(user.fullName || '');
  }, [user, open]);

  if (!open) return null;

  const fullName = user?.fullName || user?.username || 'User';
  const username = user?.username || '';
  const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const roleLabel = ROLE_LABELS[user?.role || ''] || ROLE_LABELS[activeRole] || 'User';
  const branchLabel = activeBranch?.name || branches.find(b => b.id === (user as any)?.activeBranchId)?.name || '—';
  const mobile = user?.mobileNumber || 'Not verified';
  const avatarUrl = user?.avatarUrl ? resolveUrl(user.avatarUrl) : undefined;

  const securityItems = [
    { label: 'Password', value: user?.passwordChanged || user?.securitySetupCompleted ? 'Configured' : 'Temporary', ok: !!(user?.passwordChanged || user?.securitySetupCompleted) },
    { label: 'Security Setup', value: user?.securitySetupCompleted ? 'Completed' : 'Pending', ok: !!user?.securitySetupCompleted },
    { label: 'Mobile Verified', value: user?.mobileVerified ? 'Verified' : 'Not Verified', ok: !!user?.mobileVerified },
    { label: 'Email Verified', value: user?.emailVerified ? 'Verified' : 'Not Verified', ok: !!user?.emailVerified },
  ];

  const handleSaveName = async () => {
    if (!editName.trim() || editName.trim() === fullName) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await updateMyProfile({ fullName: editName.trim() });
      updateProfile({ fullName: editName.trim() });
      setEditing(false);
      toast?.showSuccess?.('Profile name updated.', 'Updated');
    } catch (err: any) {
      toast?.showError?.(err?.message || 'Failed to update name.', 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast?.showError?.('Image must be under 5 MB.', 'File Too Large');
      return;
    }

    setUploadingAvatar(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await uploadMedia('user_avatar', dataUrl, { fileName: `avatar-${user?.userId}` });
      const url = result.url || result.storagePath;
      await updateMyProfile({ avatarUrl: url });
      updateProfile({ avatarUrl: url });
      toast?.showSuccess?.('Profile photo updated.', 'Updated');
    } catch (err: any) {
      toast?.showError?.(err?.message || 'Failed to upload photo.', 'Upload Error');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-xl">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight">My Profile</h3>
              <p className="text-xs text-emerald-100">Account & organization context</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/15 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Identity Card with Avatar */}
        <div className="p-5">
          <div className="flex items-center gap-4 mb-5">
            {/* Avatar */}
            <div className="relative group shrink-0">
              <div
                className="w-16 h-16 rounded-2xl overflow-hidden bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center text-xl shadow-md border-2 border-white cursor-pointer"
                onClick={() => !uploadingAvatar && fileInputRef.current?.click()}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <button
                type="button"
                onClick={() => !uploadingAvatar && fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-md border-2 border-white hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Camera className="w-3 h-3" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>

            {/* Name + Username + Role */}
            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                    className="flex-1 px-2.5 py-1.5 border border-emerald-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={saving}
                    className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => { setEditing(false); setEditName(fullName); }}
                    className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="font-extrabold text-slate-900 text-base truncate">{fullName}</div>
                  <button
                    onClick={() => setEditing(true)}
                    className="p-1 text-slate-400 hover:text-emerald-600 transition cursor-pointer"
                    title="Edit name"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="text-xs text-slate-500 font-mono mt-0.5">@{username}</div>
              <div className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                <ShieldCheck className="w-3 h-3" /> {roleLabel}
              </div>
            </div>
          </div>

          {/* Context */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center gap-2 text-slate-500 font-semibold">
                <Building2 className="w-4 h-4 text-[#006130]" /> Organization
              </div>
              <div className="text-right">
                <div className="font-bold text-slate-800 truncate max-w-[190px]">{user?.organizationName || user?.organizationCode || '—'}</div>
                <div className="text-[10px] text-slate-500 font-mono">{user?.organizationCode}</div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center gap-2 text-slate-500 font-semibold">
                <MapPin className="w-4 h-4 text-[#115cb9]" /> Branch
              </div>
              <div className="font-bold text-slate-800 text-right truncate max-w-[190px]">{branchLabel}</div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center gap-2 text-slate-500 font-semibold">
                <KeyRound className="w-4 h-4 text-amber-600" /> Mobile
              </div>
              <div className="font-mono font-bold text-slate-800">{mobile}</div>
            </div>
          </div>

          {/* Security Status */}
          <div className="mt-4">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Account Security</p>
            <div className="grid grid-cols-2 gap-2">
              {securityItems.map(item => (
                <div key={item.label} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    {item.ok
                      ? <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      : <AlertCircle className="w-3 h-3 text-amber-500" />}
                    {item.label}
                  </div>
                  <div className={`text-[11px] font-bold mt-0.5 ${item.ok ? 'text-emerald-700' : 'text-amber-700'}`}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500">
            <Mail className="w-3.5 h-3.5" />
            Username-based login · No email required
          </div>
        </div>
      </div>
    </div>
  );
};
