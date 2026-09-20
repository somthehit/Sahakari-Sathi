import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  Shield,
  ShieldAlert,
  Package,
  CreditCard,
  FileText,
  Settings,
  Database,
  Bell,
  Key,
  HeadphonesIcon,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { useSuperAdminAuth } from '../../stores/superAdminAuthStore';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

const NAV_ITEMS: SidebarItem[] = [
  { id: 'sa_dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'sa_organizations', label: 'Organizations', icon: Building2 },
  { id: 'sa_users', label: 'Platform Users', icon: Users },
  { id: 'sa_admin_users', label: 'Admin Users', icon: ShieldAlert },
  { id: 'sa_roles', label: 'Roles & Access', icon: Shield },
  { id: 'sa_modules', label: 'Modules', icon: Package },
  { id: 'sa_subscriptions', label: 'Subscriptions', icon: CreditCard },
  { id: 'sa_audit', label: 'Audit Logs', icon: FileText },
  { id: 'sa_system', label: 'System Settings', icon: Settings },
  { id: 'sa_database', label: 'Database Admin', icon: Database },
  { id: 'sa_notifications', label: 'Announcements', icon: Bell },
  { id: 'sa_api', label: 'API Keys', icon: Key },
  { id: 'sa_support', label: 'Support', icon: HeadphonesIcon },
];

interface Props {
  activePage: string;
  onNavigate: (id: string) => void;
}

export const SuperAdminSidebar: React.FC<Props> = ({ activePage, onNavigate }) => {
  const { user, logout } = useSuperAdminAuth();

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-white/5 flex flex-col">

      {/* Brand */}
      <div className="px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-slate-800" />
          </div>
          <div>
            <p className="text-slate-800 font-bold text-sm leading-tight">Sahakari Sathi</p>
            <p className="text-violet-400 text-[10px] font-semibold uppercase tracking-wider">Super Admin</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 group ${ isActive ? 'bg-violet-600/15 text-violet-300 border border-violet-500/20' : 'text-slate-500 hover:bg-white/4 hover:text-slate-700' }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-500'}`} />
              <span className="text-xs font-medium flex-1">{item.label}</span>
              {item.badge && (
                <span className="text-[10px] bg-rose-500 text-white rounded-full px-1.5 py-0.5 font-bold leading-none">
                  {item.badge}
                </span>
              )}
              {isActive && <ChevronRight className="w-3 h-3 text-violet-400/60" />}
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 pb-4 pt-3 border-t border-white/5">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/3 border border-white/5 mb-2">
          <div className="w-7 h-7 rounded-full bg-violet-700 flex items-center justify-center shrink-0">
            <span className="text-slate-800 text-[10px] font-bold uppercase">
              {user?.username?.charAt(0) ?? 'S'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-800 text-xs font-semibold truncate">{user?.fullName || user?.username}</p>
            <p className="text-slate-500 text-[10px] truncate">Super Admin</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/8 transition text-xs"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};
