import React, { useState, useEffect } from 'react';
import { Building2, User, Lock, Eye, EyeOff, AlertCircle, Loader2, Shield, Sparkles, CheckCircle2, HelpCircle, ArrowRight, KeyRound, Globe, ShieldCheck } from 'lucide-react';

export interface LoginCredentials {
  organizationCode: string;
  username: string;
  password: string;
}

interface LoginPageProps {
  onLogin: (credentials: LoginCredentials) => Promise<void>;
  error?: string;
  isLoading?: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, error, isLoading }) => {
  const [orgCode, setOrgCode] = useState(() => {
    try {
      return localStorage.getItem('sahakari_last_org_code') || '';
    } catch {
      return '';
    }
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberOrg, setRememberOrg] = useState(true);
  const [validationError, setValidationError] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);

  useEffect(() => {
    if (rememberOrg && orgCode) {
      try {
        localStorage.setItem('sahakari_last_org_code', orgCode);
      } catch {}
    }
  }, [orgCode, rememberOrg]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    // Client-side validation
    const cleanOrg = orgCode.trim().toUpperCase();
    if (!cleanOrg || cleanOrg.length < 4 || cleanOrg.length > 12 || !/^[A-Z0-9_-]+$/.test(cleanOrg)) {
      setValidationError('Organization Code must be 4–12 characters (e.g., SOFTLAB)');
      return;
    }
    if (username.trim().length < 3) {
      setValidationError('Username must be at least 3 characters');
      return;
    }
    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters');
      return;
    }

    if (rememberOrg) {
      try {
        localStorage.setItem('sahakari_last_org_code', cleanOrg);
      } catch {}
    } else {
      try {
        localStorage.removeItem('sahakari_last_org_code');
      } catch {}
    }

    await onLogin({
      organizationCode: cleanOrg,
      username: username.trim().toLowerCase(),
      password,
    });
  };

  const displayError = validationError || error;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans selection:bg-emerald-500 selection:text-white">
      {/* Background Decorative Mesh & Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-emerald-500/15 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-teal-500/15 rounded-full blur-[140px] animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-emerald-600/5 rounded-full blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Top Header / Status bar */}
      <header className="relative z-10 w-full px-6 py-4 flex items-center justify-between border-b border-white/5 bg-slate-950/40 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 p-[1.5px] shadow-lg shadow-emerald-500/25 flex items-center justify-center transition-transform duration-300 hover:scale-105">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Building2 className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white">Sahakari Sathi</span>
              <span className="bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                ERP 2.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">नेपाल बचत तथा ऋण सहकारी प्रणाली</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full text-[11px] text-emerald-300 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Systems Online</span>
          </div>
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className="text-xs text-slate-400 hover:text-emerald-400 transition-colors duration-200 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Help</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-md animate-fade-up">

          {/* Badge & Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-4">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-300 text-[11px] font-semibold tracking-wide uppercase">Secure Saccos Cloud ERP</span>
            </div>
            <h1 className="text-[26px] sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
              Welcome back
            </h1>
            <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto leading-relaxed">
              Sign in to your cooperative workspace
            </p>
          </div>

          {/* Glassmorphism Card */}
          <div className="bg-white/[0.06] backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/40 p-6 sm:p-8 relative overflow-hidden transition-all duration-300">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Organization Code */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="organization-code" className="text-slate-300 text-[11px] font-semibold uppercase tracking-widest">
                    Organization Code
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {orgCode.length}/12
                  </span>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-emerald-400 transition-colors duration-200">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    id="organization-code"
                    type="text"
                    autoComplete="organization"
                    required
                    value={orgCode}
                    onChange={(e) => setOrgCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                    placeholder="e.g. SOFTLAB"
                    maxLength={12}
                    className="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl pl-10 pr-4 py-3 text-white font-mono font-bold text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:bg-white/[0.06] focus:ring-2 focus:ring-emerald-500/15 transition-all duration-200"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                  <span>4–12 uppercase characters</span>
                  {orgCode && (
                    <button
                      type="button"
                      onClick={() => setOrgCode('')}
                      className="text-slate-500 hover:text-slate-300 transition-colors text-[10px] cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Username */}
              <div className="space-y-1.5">
                <label htmlFor="username" className="text-slate-300 text-[11px] font-semibold uppercase tracking-widest">
                  Username
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-emerald-400 transition-colors duration-200">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                    placeholder="e.g. admin"
                    maxLength={40}
                    className="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl pl-10 pr-4 py-3 text-white font-medium text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:bg-white/[0.06] focus:ring-2 focus:ring-emerald-500/15 transition-all duration-200"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-slate-300 text-[11px] font-semibold uppercase tracking-widest">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowHelpModal(true)}
                    className="text-[11px] text-emerald-400/80 hover:text-emerald-300 transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-emerald-400 transition-colors duration-200">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-white/[0.04] border border-white/[0.1] rounded-xl pl-10 pr-11 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 focus:bg-white/[0.06] focus:ring-2 focus:ring-emerald-500/15 transition-all duration-200 tracking-wide"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Org checkbox */}
              <div className="flex items-center gap-2.5 pt-0.5">
                <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={rememberOrg}
                    onChange={(e) => setRememberOrg(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-white/[0.06] text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0 transition cursor-pointer accent-emerald-500"
                  />
                  <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">Remember organization code</span>
                </label>
              </div>

              {/* Error Message */}
              {displayError && (
                <div className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 animate-fade-up">
                  <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                  <p className="text-rose-200 text-xs leading-relaxed font-medium">{displayError}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                id="login-submit"
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:via-emerald-500 hover:to-teal-500 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2.5 text-sm shadow-lg shadow-emerald-900/50 hover:shadow-emerald-500/25 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4 opacity-70" />
                  </>
                )}
              </button>

              {isLoading && (
                <p className="text-center text-[11px] text-slate-500 -mt-1">
                  Authenticating securely...
                </p>
              )}
            </form>

            {/* Quick Demo helper banner */}
            <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400">
              <span>Super admin?</span>
              <a
                href="/super-admin"
                className="text-emerald-400/80 hover:text-emerald-300 font-medium hover:underline inline-flex items-center gap-1 transition-colors"
              >
                System Control &rarr;
              </a>
            </div>
          </div>

          {/* Footer Security Badges */}
          <div className="text-center mt-8 space-y-2">
            <div className="flex items-center justify-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-500/70" /> 256-bit TLS
              </span>
              <span className="text-slate-700">·</span>
              <span className="flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-emerald-500/70" /> SACCOS Standard
              </span>
              <span className="text-slate-700">·</span>
              <span className="flex items-center gap-1.5">
                <Globe className="w-3 h-3 text-emerald-500/70" /> Nepal Cloud
              </span>
            </div>
            <p className="text-slate-600 text-[10px]">
              Sahakari Sathi Banking ERP · v2.4.0
            </p>
          </div>
        </div>
      </main>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="modal-overlay" onClick={() => setShowHelpModal(false)}>
          <div className="modal-panel max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 rounded-xl">
                  <HelpCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Need Help?</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg px-2 py-0.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed mt-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <strong className="text-slate-800 block mb-1">Organization Code</strong>
                Your cooperative's unique code assigned during onboarding (e.g., <code className="text-emerald-700 font-mono bg-emerald-50 px-1 py-0.5 rounded">SOFTLAB</code>).
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <strong className="text-slate-800 block mb-1">Forgot Password</strong>
                Contact your IT Administrator to trigger a password reset.
              </div>
            </div>

            <div className="pt-4">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Legal footer */}
      <footer className="relative z-10 w-full py-3 px-6 text-center border-t border-white/5 bg-slate-950/40 backdrop-blur-xl">
        <p className="text-[11px] text-slate-500">
          Protected by Enterprise Defense · Unauthorized access is monitored
        </p>
      </footer>
    </div>
  );
};

export default LoginPage;
