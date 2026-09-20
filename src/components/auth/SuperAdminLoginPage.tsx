import React, { useState } from 'react';
import { Shield, User, Lock, Eye, EyeOff, AlertCircle, Loader2, ArrowLeft, ShieldCheck, ArrowRight, KeyRound } from 'lucide-react';
import { superAdminApi } from '../../lib/superAdminApi';
import { useSuperAdminAuth } from '../../stores/superAdminAuthStore';

export const SuperAdminLoginPage: React.FC = () => {
  const { login } = useSuperAdminAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      const data = await superAdminApi.login(username.toLowerCase(), password);
      login(data.accessToken, data.refreshToken, data.user);
      // Redirect to super admin dashboard regardless of which sub-path triggered login
      window.location.replace('/super-admin');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans selection:bg-violet-500 selection:text-white">
      {/* Background Decorative Mesh & Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-violet-600/15 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* Top Header */}
      <header className="relative z-10 w-full px-6 py-4 flex items-center justify-between border-b border-white/5 bg-slate-950/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-xs bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Organization Portal</span>
          </a>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-[11px] text-slate-300 font-medium">Root Authority Console</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-md">

          {/* Badge & Title */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 bg-violet-500/15 border border-violet-500/30 rounded-full px-3.5 py-1 mb-3.5 shadow-inner">
              <Shield className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-violet-300 text-xs font-semibold tracking-wide">SYSTEM ADMINISTRATION</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Super Admin Console
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-1.5">
              Multi-tenant platform control and organization governance
            </p>
          </div>

          {/* Glassmorphism Card */}
          <div className="bg-slate-900/70 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/60 p-6 sm:p-8 relative overflow-hidden transition-all">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-violet-400/80 to-transparent" />

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Username */}
              <div className="space-y-1.5">
                <label htmlFor="super-admin-username" className="text-slate-300 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-violet-400" />
                  Super Admin Username
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-violet-400 transition-colors">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="super-admin-username"
                    type="text"
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                    placeholder="e.g. superadmin"
                    maxLength={30}
                    className="w-full bg-slate-950/60 border border-slate-700/70 rounded-xl pl-10 pr-4 py-2.5 sm:py-3 text-white font-mono text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label htmlFor="super-admin-password" className="text-slate-300 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-violet-400" />
                  Root Security Key / Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-violet-400 transition-colors">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    id="super-admin-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-slate-950/60 border border-slate-700/70 rounded-xl pl-10 pr-11 py-2.5 sm:py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 transition-all shadow-inner tracking-wide"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-2.5 bg-rose-500/15 border border-rose-500/30 rounded-xl p-3.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                  <p className="text-rose-200 text-xs leading-relaxed font-medium">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                id="super-admin-submit"
                type="submit"
                disabled={isLoading}
                className="w-full py-3 sm:py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm shadow-lg shadow-violet-950/60 hover:shadow-violet-500/20 cursor-pointer mt-3"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-violet-200" />
                    <span>Authorize System Access</span>
                    <ArrowRight className="w-4 h-4 ml-1 opacity-80" />
                  </>
                )}
              </button>

            </form>
          </div>

          <div className="text-center mt-6">
            <p className="text-slate-500 text-[11px]">
              Access restricted to certified multi-tenant platform engineers. All sessions are cryptographically audited.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full py-3 px-6 text-center border-t border-white/5 bg-slate-950/40 backdrop-blur-md">
        <p className="text-[11px] text-slate-500">
          Sahakari Sathi Multi-Tenant Kernel • Tier-4 Enterprise Security
        </p>
      </footer>
    </div>
  );
};

export default SuperAdminLoginPage;
