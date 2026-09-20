import React, { useState } from 'react';
import { X, Lock, Eye, EyeOff, Check, AlertCircle, Loader2, ShieldCheck, KeyRound } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../stores/authStore';

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
  username?: string;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ open, onClose, username = 'User' }) => {
  const setSession = useAuthStore((s) => s.setSession);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const reqLength  = newPassword.length >= 8;
  const reqUpper   = /[A-Z]/.test(newPassword);
  const reqLower   = /[a-z]/.test(newPassword);
  const reqNum     = /[0-9]/.test(newPassword);
  const reqSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const pwMatch    = newPassword === confirmPassword && newPassword !== '';
  const isValid    = currentPassword.length > 0 && reqLength && reqUpper && reqLower && reqNum && reqSpecial && pwMatch;

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPw(false);
    setError('');
    setSuccess(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/auth/change-password', {
        currentPassword,
        newPassword,
        confirmPassword,
      });
      // GoTrue revokes the old session on password change, so the backend re-issues a
      // fresh session here; swap it in so the user stays signed in after the change.
      if (res.data?.accessToken && res.data.user) {
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${res.data.accessToken}`;
        setSession(
          res.data.accessToken,
          res.data.user,
          new Date(Date.now() + 55 * 60 * 1000)
        );
      }
      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 1400);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to change password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) return null;

  const req = (met: boolean, label: string) => (
    <div className={`flex items-center gap-1.5 text-[11px] font-medium ${met ? 'text-emerald-600' : 'text-slate-500'}`}>
      <Check className={`w-3.5 h-3.5 ${met ? 'opacity-100' : 'opacity-20'}`} /> {label}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">

        {/* Header */}
        <div className="p-4 bg-white text-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <KeyRound className="w-5 h-5 text-slate-800" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight text-slate-800">Change Password</h3>
              <p className="text-xs text-emerald-100">Update your account credentials</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-800/80 hover:text-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {success ? (
            <div className="py-8 text-center">
              <div className="w-14 h-14 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-3">
                <ShieldCheck className="w-7 h-7 text-emerald-700" />
              </div>
              <p className="font-bold text-slate-800 text-sm">Password Updated Successfully</p>
              <p className="text-xs text-slate-500 mt-1">Your new password is now active.</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs font-medium border border-red-200 rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Current Password */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Current Password <span className="text-emerald-600">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-slate-500" />
                    </div>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-600 transition"
                      placeholder="Enter your current password"
                      autoFocus
                    />
                    <button type="button" onClick={() => setShowPw(p => !p)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-600 cursor-pointer">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    New Password <span className="text-emerald-600">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-slate-500" />
                    </div>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-600 transition"
                      placeholder="Create a strong password"
                    />
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Confirm New Password <span className="text-emerald-600">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-slate-500" />
                    </div>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className={`w-full bg-slate-50 border placeholder-slate-400 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none transition ${ confirmPassword.length > 0 && !pwMatch ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-emerald-700 focus:ring-1 focus:ring-emerald-600' }`}
                      placeholder="Repeat your new password"
                    />
                  </div>
                </div>

                {/* Requirements */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <p className="text-[11px] font-bold text-slate-700 mb-2 uppercase tracking-wider">Password Requirements</p>
                  <div className="grid grid-cols-2 gap-2">
                    {req(reqLength,  '8+ characters')}
                    {req(reqUpper,   'Uppercase letter')}
                    {req(reqLower,   'Lowercase letter')}
                    {req(reqNum,     'Number')}
                    {req(reqSpecial, 'Special character')}
                    {req(pwMatch,    'Passwords match')}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!isValid || isLoading}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition shadow-xs flex items-center justify-center gap-2 ${isValid && !isLoading ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
                >
                  {isLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating Password…</>
                    : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
