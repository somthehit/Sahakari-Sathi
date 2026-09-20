import React, { useState } from 'react';
import { Lock, ShieldAlert, Check, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { extractErrorMessage } from '../../utils/errorMessage';

interface ForcePasswordChangeViewProps {
  onSuccess: (session?: { accessToken?: string; user?: any }) => void;
  username?: string;
}

export const ForcePasswordChangeView: React.FC<ForcePasswordChangeViewProps> = ({ onSuccess, username = 'User' }) => {
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw]                   = useState(false);
  const [isLoading, setIsLoading]             = useState(false);
  const [error, setError]                     = useState('');

  const reqLength  = newPassword.length >= 8;
  const reqUpper   = /[A-Z]/.test(newPassword);
  const reqLower   = /[a-z]/.test(newPassword);
  const reqNum     = /[0-9]/.test(newPassword);
  const reqSpecial = /[^A-Za-z0-9]/.test(newPassword);
  const pwMatch    = newPassword === confirmPassword && newPassword !== '';
  const isValid    = reqLength && reqUpper && reqLower && reqNum && reqSpecial && pwMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/auth/change-password', {
        newPassword,
        confirmPassword,
      });
      onSuccess(res.data);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to change password. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const req = (met: boolean, label: string) => (
    <div className={`flex items-center gap-1.5 text-[11px] font-medium ${met ? 'text-emerald-600' : 'text-slate-500'}`}>
      <Check className={`w-3.5 h-3.5 ${met ? 'opacity-100' : 'opacity-20'}`} /> {label}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">

        {/* Header */}
        <div className="bg-amber-50 border-b border-amber-100 p-6 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">Action Required</h1>
          <p className="text-sm text-slate-600 mt-2">
            Welcome, <strong>{username}</strong>! Your account was created with a temporary password.
            You must set a permanent password before accessing the system.
          </p>
        </div>

        {/* Form */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs font-medium border border-red-200 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

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
                  className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-600 transition"
                  placeholder="Create a strong password"
                  autoFocus
                />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-600 cursor-pointer">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
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
                  className={`w-full bg-white border rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none transition ${ confirmPassword.length > 0 && !pwMatch ? 'border-red-300 focus:border-red-500' : 'border-slate-300 focus:border-emerald-700 focus:ring-1 focus:ring-emerald-600' }`}
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
              className={`w-full py-3 mt-2 rounded-xl font-bold text-sm transition shadow-xs flex items-center justify-center gap-2 ${isValid && !isLoading ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
            >
              {isLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating Password…</>
                : 'Set New Password & Continue'}
            </button>
          </form>
        </div>

        {/* Footer note */}
        <div className="px-6 pb-5 text-center">
          <p className="text-[11px] text-slate-500">
            Email verification is not required to proceed. You can verify your email later from Profile → Security.
          </p>
        </div>
      </div>
    </div>
  );
};
