import React, { useState } from 'react';
import { useCoop } from '../../context/CoopContext';
import { 
  Building2, 
  Calendar, 
  Clock, 
  Bell, 
  Search, 
  ShieldCheck, 
  ChevronDown, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  Sparkles,
  Keyboard,
  User,
  KeyRound,
  LogOut,
  MapPin,
  Loader2,
  Building as BuildingIcon
} from 'lucide-react';
import { UserRole } from '../../types/coop';
import { useLocalization } from '../../context/LocalizationContext';
import { ImageHoverPreview } from '../common/ImageHoverPreview';
import { useAuthStore } from '../../stores/authStore';
import { apiClient } from '../../lib/apiClient';
import { ChangePasswordModal } from '../modals/ChangePasswordModal';
import { MyProfileModal } from '../modals/MyProfileModal';
import { BranchSwitchModal } from '../modals/BranchSwitchModal';


import { AddFiscalYearModal } from '../modals/AddFiscalYearModal';

interface TopHeaderProps {
  onOpenGlobalSearch?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ onOpenGlobalSearch }) => {
  const { 
    activeRole, 
    setActiveRole, 
    activeBranchId, 
    setActiveBranchId, 
    branches, 
    activeBranch,
    activeFiscalYearCode, 
    setActiveFiscalYearCode, 
    fiscalYears,
    setIsFiscalYearModalOpen,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    clearAllNotifications,
    openTab,
    setIsGlobalSearchOpen,
    setIsShortcutModalOpen
  } = useCoop();
  const { t, lang, setLanguage, formatDate } = useLocalization();
  const { user: authUser, clearSession, setActiveBranch } = useAuthStore();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showBranchSwitch, setShowBranchSwitch] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Role switch password verification
  const [roleSwitchModal, setRoleSwitchModal] = useState(false);
  const [roleSwitchTarget, setRoleSwitchTarget] = useState<UserRole | null>(null);
  const [roleSwitchPassword, setRoleSwitchPassword] = useState('');
  const [roleSwitchError, setRoleSwitchError] = useState('');
  const [roleSwitchLoading, setRoleSwitchLoading] = useState(false);

  const isOrgAdmin = authUser?.isOrgAdmin === true;

  const handleBranchSwitched = (branchId: string) => {
    setActiveBranchId(branchId);
    setActiveBranch(branchId);
  };

  const handleRoleSwitchVerify = async () => {
    if (!roleSwitchTarget || !roleSwitchPassword) return;
    setRoleSwitchLoading(true);
    setRoleSwitchError('');
    try {
      await apiClient.post('/auth/verify-password', { password: roleSwitchPassword });
      setActiveRole(roleSwitchTarget);
      setRoleSwitchModal(false);
      setShowRoleMenu(false);
      setRoleSwitchTarget(null);
      setRoleSwitchPassword('');
    } catch (err: any) {
      setRoleSwitchError(err?.response?.data?.error || 'Invalid password. Please try again.');
    } finally {
      setRoleSwitchLoading(false);
    }
  };

  const roleLabels: Record<UserRole, { title: string; color: string }> = {
    admin: { title: 'System Administrator', color: 'bg-purple-100 text-purple-800 /40 ' },
    branch_manager: { title: 'Branch Manager', color: 'bg-emerald-100 text-emerald-800 /40 ' },
    teller: { title: 'Senior Cashier / Teller', color: 'bg-teal-100 text-teal-800 /40 ' },
    loan_officer: { title: 'Credit & Loan Officer', color: 'bg-amber-100 text-amber-800 /40 ' },
    accountant: { title: 'Chief Accountant', color: 'bg-slate-100 text-slate-800 ' },
    collection_agent: { title: 'Door-to-Door Agent', color: 'bg-teal-100 text-teal-800 /40 ' },
  };

  // Real authenticated user (falls back gracefully if profile not loaded)
  const userFullName = authUser?.fullName || authUser?.username || 'User';
  const userUsername = authUser?.username || 'user';
  const organizationName = authUser?.organizationName || authUser?.organizationCode || '—';
  const userRoleTitle = roleLabels[activeRole]?.title || 'User';

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Logout is best-effort for the audit hook; local session clear is what matters.
    } finally {
      clearSession();
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="relative z-50 bg-white text-slate-800 border-b border-slate-200 shadow-sm select-none">
      <div className="max-w-[1920px] mx-auto px-4 h-14 flex items-center justify-between gap-4 text-xs">
        
        {/* Left: Brand Identity & Context Badges */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => openTab('home', 'Dashboard Home', 'Home')}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
              <Building2 className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-slate-800">Sahakari Sathi</span>
              <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full border border-slate-200 font-mono font-medium">V 2.1.0</span>
            </div>
          </div>

          {/* System Badges */}
          <div className="hidden md:flex items-center gap-2.5">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              <span>FY</span>
              <select
                value={activeFiscalYearCode}
                onChange={(e) => setActiveFiscalYearCode(e.target.value)}
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer text-xs"
              >
                {fiscalYears.map((fy) => (
                  <option key={fy.id} value={fy.code} className="bg-white text-slate-800">
                    {fy.code}
                  </option>
                ))}
              </select>
            </div>



            <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-bold text-slate-800">{formatDate()}</span>
            </div>

            {/* Branch Selector Badge */}
            {isOrgAdmin ? (
              <button
                type="button"
                onClick={() => setShowBranchSwitch(true)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-xs text-slate-600 font-medium hover:border-emerald-300 hover:bg-emerald-50 transition-all duration-200 cursor-pointer"
                title="Switch branch context (org admin)"
              >
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-slate-800 font-bold">{activeBranch?.name || '—'}</span>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-slate-800 font-bold">{activeBranch?.name || '—'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Payment Pending Pill, Search, Notifications, User Profile */}
        <div className="flex items-center gap-3">

          {/* NP / EN Language Switcher */}
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 text-[10px] font-bold" title="Switch Interface Language">
            <button
              onClick={() => setLanguage('ne')}
              className={`px-2 py-1 rounded-md transition-all duration-200 cursor-pointer ${ lang === 'ne' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800' }`}
            >
              नेपाली
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-2 py-1 rounded-md transition-all duration-200 cursor-pointer ${ lang === 'en' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800' }`}
            >
              EN
            </button>
          </div>

          {/* Payment Pending Pill */}
          <div className="hidden lg:flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 px-3.5 py-1 rounded-full text-xs font-semibold">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            <span>{t('Payment Pending')}</span>
          </div>

          {/* AI Copilot Button */}
          <button
            onClick={() => openTab('ai_copilot', 'Gemini AI Copilot', 'Bot')}
            className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer text-xs font-bold shadow-sm border border-emerald-500/30"
            title="Open Gemini AI Assistant & Regulations Copilot"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span className="hidden sm:inline">AI Copilot</span>
          </button>

          {/* Global Search Button */}
          <button
            onClick={() => {
              if (onOpenGlobalSearch) onOpenGlobalSearch();
              setIsGlobalSearchOpen(true);
            }}
            className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-lg transition-all duration-200 cursor-pointer text-xs font-medium hover:border-emerald-300"
            title="Command Palette & Search (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Global Keyboard Shortcuts Console Button */}
          <button
            onClick={() => setIsShortcutModalOpen(true)}
            className="hidden md:flex items-center gap-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 px-2.5 py-1 rounded-lg transition-all duration-200 cursor-pointer text-xs font-semibold"
            title="View Keyboard Shortcuts Cheat Sheet (Ctrl+/)"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>



          {/* Notification Bell */}
          <div className="relative z-[10000]">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-1.5 text-slate-600 hover:text-slate-800 transition cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                  {unreadNotificationCount}
                </span>
              )}
            </button>

            {/* Notifications Popover */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white border border-slate-200 rounded-xl shadow-lg z-[10000] overflow-hidden text-slate-800">
                <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-800">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    Instant Notifications ({notifications.length})
                  </div>
                  {notifications.length > 0 && (
                    <button 
                      onClick={clearAllNotifications}
                      className="text-[11px] text-slate-500 hover:text-rose-600 transition cursor-pointer font-medium"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs">
                      No recent notifications.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div 
                        key={n.id}
                        onClick={() => markNotificationRead(n.id)}
                        className={`p-3 text-xs hover:bg-slate-50 transition cursor-pointer flex gap-2.5 ${n.isRead ? 'opacity-60' : 'bg-emerald-50/30'}`}
                      >
                        {n.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
                        {n.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
                        {n.type === 'alert' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
                        {n.type === 'info' && <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
                        <div className="flex-1">
                          <div className="font-bold text-slate-800 flex items-center justify-between">
                            <span>{n.title}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{n.timestampBS}</span>
                          </div>
                          <div className="text-slate-600 mt-1 leading-relaxed text-[11px] font-medium">{n.message}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-slate-200" />

          {/* User Profile Dropdown */}
          <div className="relative z-[10000]">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2.5 py-1 rounded-md transition cursor-pointer"
            >
              <ImageHoverPreview
                src={authUser?.avatarUrl}
                name={userFullName}
                subtext={`@${userUsername}`}
                badge={userRoleTitle}
                sizeClass="w-6 h-6 text-[10px]"
                avatarBg="bg-white"
              />
              <div className="text-left hidden sm:block">
                <div className="font-bold text-slate-800 leading-tight">{userFullName}</div>
                <div className="text-[10px] text-[#006130] font-bold leading-none">
                  {userRoleTitle}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {/* Profile Menu Dropdown */}
            {showRoleMenu && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-[10000] text-slate-800 overflow-hidden">
                {/* Header: identity */}
                <div className="p-3 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center gap-3">
                  <ImageHoverPreview
                    src={authUser?.avatarUrl}
                    name={userFullName}
                    subtext={`@${userUsername}`}
                    sizeClass="w-10 h-10 text-sm"
                    avatarBg="bg-white/20"
                    ringColor="ring-white"
                  />
                  <div className="min-w-0">
                    <div className="font-extrabold text-sm leading-tight truncate">{userFullName}</div>
                    <div className="text-[11px] text-emerald-100 font-mono truncate">@{userUsername}</div>
                    <div className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/15 border border-white/20">
                      <ShieldCheck className="w-3 h-3 text-amber-300" /> {userRoleTitle}
                    </div>
                  </div>
                </div>

                {/* Organization & Branch context */}
                <div className="px-3 pt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-500 font-semibold">
                      <BuildingIcon className="w-3.5 h-3.5 text-emerald-600" /> Organization
                    </div>
                    <div className="text-right min-w-0">
                      <div className="font-bold text-slate-800 truncate max-w-[170px]">{organizationName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{authUser?.organizationCode}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-500 font-semibold">
                      <MapPin className="w-3.5 h-3.5 text-blue-500" /> Branch
                    </div>
                    <div className="font-bold text-slate-800 text-right truncate max-w-[190px]">
                      {activeBranch?.name || '—'}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-3 space-y-1 mt-2 border-t border-slate-100">
                  <button
                    onClick={() => { setShowRoleMenu(false); setShowProfileModal(true); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs hover:bg-emerald-50 text-slate-700 transition-colors duration-200 cursor-pointer"
                  >
                    <User className="w-4 h-4 text-emerald-600" /> My Profile
                  </button>
                  <button
                    onClick={() => { setShowRoleMenu(false); setShowChangePassword(true); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs hover:bg-emerald-50 text-slate-700 transition-colors duration-200 cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4 text-amber-500" /> Change Password
                  </button>
                </div>

                {/* Role switching */}
                <div className="px-3 pb-3 border-t border-slate-100">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-3 mb-1.5">
                    Switch Active System Role
                  </div>
                  <div className="space-y-1">
                    {(Object.keys(roleLabels) as UserRole[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => {
                          if (r === activeRole) return;
                          setRoleSwitchTarget(r);
                          setRoleSwitchPassword('');
                          setRoleSwitchError('');
                          setRoleSwitchModal(true);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all duration-200 cursor-pointer ${ activeRole === r ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200' : 'hover:bg-slate-50 text-slate-700' }`}
                      >
                        <span>{roleLabels[r].title}</span>
                        {activeRole === r && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logout */}
                <div className="border-t border-slate-100 p-3">
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition cursor-pointer disabled:opacity-60"
                  >
                    {isLoggingOut
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Signing Out…</>
                      : <><LogOut className="w-3.5 h-3.5" /> Logout</>}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
      <AddFiscalYearModal />
      <ChangePasswordModal
        open={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        username={userUsername}
      />
      <MyProfileModal
        open={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
      <BranchSwitchModal
        open={showBranchSwitch}
        onClose={() => setShowBranchSwitch(false)}
        branches={branches}
        currentBranchId={activeBranchId}
        onSwitched={handleBranchSwitched}
      />

      {/* Role Switch Password Verification Modal */}
      {roleSwitchModal && roleSwitchTarget && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setRoleSwitchModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 text-center border-b border-slate-100">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">Verify Identity</h3>
              <p className="text-sm text-slate-500 mt-1">
                Enter your password to switch to <span className="font-semibold text-emerald-700">{roleLabels[roleSwitchTarget]?.title}</span>
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={roleSwitchPassword}
                  onChange={e => { setRoleSwitchPassword(e.target.value); setRoleSwitchError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter' && roleSwitchPassword) handleRoleSwitchVerify(); }}
                  placeholder="Enter your password"
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                {roleSwitchError && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {roleSwitchError}
                  </p>
                )}
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex items-center gap-2">
              <button
                onClick={() => setRoleSwitchModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRoleSwitchVerify}
                disabled={!roleSwitchPassword || roleSwitchLoading}
                className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {roleSwitchLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</> : 'Confirm Switch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
