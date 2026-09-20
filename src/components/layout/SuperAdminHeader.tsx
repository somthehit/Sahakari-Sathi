import React from 'react';
import { Bell, Search, Shield } from 'lucide-react';
import { useSuperAdminAuth } from '../../stores/superAdminAuthStore';

interface Props {
  pageTitle: string;
  pageSubtitle?: string;
}

export const SuperAdminHeader: React.FC<Props> = ({ pageTitle, pageSubtitle }) => {
  const { user } = useSuperAdminAuth();

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-5 gap-4 shrink-0 shadow-sm">

      {/* Page title */}
      <div className="flex-1">
        <h1 className="text-slate-900 font-bold text-sm leading-tight">{pageTitle}</h1>
        {pageSubtitle && (
          <p className="text-slate-500 text-[10px]">{pageSubtitle}</p>
        )}
      </div>

      {/* Search */}
      <div className="relative hidden md:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Quick search..."
          className="w-52 bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-slate-700 text-xs placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400/20 transition"
        />
      </div>

      {/* Notifications */}
      <button className="relative w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition">
        <Bell className="w-3.5 h-3.5" />
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-violet-500" />
      </button>

      {/* User */}
      <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
        <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center">
          <span className="text-slate-800 text-[10px] font-bold uppercase">
            {user?.username?.charAt(0) ?? 'S'}
          </span>
        </div>
        <div className="hidden sm:block">
          <p className="text-slate-800 text-xs font-semibold leading-tight">{user?.username}</p>
          <div className="flex items-center gap-1">
            <Shield className="w-2.5 h-2.5 text-violet-500" />
            <span className="text-violet-500 text-[10px]">Super Admin</span>
          </div>
        </div>
      </div>
    </header>
  );
};
