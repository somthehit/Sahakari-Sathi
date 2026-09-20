import React, { useState, useEffect } from 'react';
import { X, Building2, Lock, Eye, EyeOff, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import type { Branch } from '../../types/coop';

interface BranchSwitchModalProps {
  open: boolean;
  onClose: () => void;
  branches: Branch[];
  currentBranchId: string;
  onSwitched: (branchId: string) => void;
}

export const BranchSwitchModal: React.FC<BranchSwitchModalProps> = ({
  open,
  onClose,
  branches,
  currentBranchId,
  onSwitched,
}) => {
  const [branchId, setBranchId] = useState(currentBranchId);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      setBranchId(currentBranchId);
      setPassword('');
      setShowPw(false);
      setError('');
      setSuccess(false);
    }
  }, [open, currentBranchId]);

  const handleClose = () => {
    if (isLoading) return;
    setPassword('');
    setError('');
    setSuccess(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId || !password || isLoading) return;
    setIsLoading(true);
    setError('');
    try {
      const { data } = await apiClient.post('/org/switch-branch', { branchId, password });
      setSuccess(true);
      onSwitched(data.activeBranchId);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to switch branch. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">

        {/* Header */}
        <div className="p-4 bg-white text-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Building2 className="w-5 h-5 text-slate-800" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight text-slate-800">Switch Branch</h3>
              <p className="text-xs text-emerald-100">Re-enter your password to confirm</p>
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
                <CheckCircle2 className="w-7 h-7 text-emerald-700" />
              </div>
              <p className="font-bold text-slate-800 text-sm">Branch Switched</p>
              <p className="text-xs text-slate-500 mt-1">Your active branch context was updated.</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs font-medium border border-red-200 rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Branch Selection */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Target Branch <span className="text-emerald-600">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building2 className="h-4 w-4 text-slate-500" />
                    </div>
                    <select
                      value={branchId}
                      onChange={(e) => setBranchId(e.target.value)}
                      className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-600 transition"
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id} className="bg-white text-slate-800">
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Password Confirmation */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Password <span className="text-emerald-600">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-slate-500" />
                    </div>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-600 transition"
                      placeholder="Enter your password to confirm"
                      autoFocus
                    />
                    <button type="button" onClick={() => setShowPw(p => !p)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-600 cursor-pointer">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!branchId || !password || isLoading}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition shadow-xs flex items-center justify-center gap-2 ${branchId && password && !isLoading ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
                >
                  {isLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Switching Branch…</>
                    : 'Switch Branch'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
