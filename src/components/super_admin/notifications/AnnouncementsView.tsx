import React from 'react';
import { BellRing, Mail, Smartphone, Send, Plus } from 'lucide-react';

export const AnnouncementsView: React.FC = () => {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
              <BellRing className="w-6 h-6 text-emerald-700" />
              <span>Platform Announcements</span>
            </h1>
            <p className="text-slate-500 text-xs mt-1">Broadcast messages, release notes, and alerts to all tenant organizations.</p>
          </div>
          <button className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-xs cursor-pointer">
            <Send className="w-4 h-4" /> New Broadcast
          </button>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center py-12 text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Send className="w-8 h-8 text-slate-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">No active announcements</h2>
          <p className="text-sm text-slate-500 mt-2">
            Use broadcasts to notify all users across all cooperatives about system maintenance, new features, or critical updates.
          </p>
          <button className="mt-6 px-5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-xl transition cursor-pointer">
            View Past Broadcasts
          </button>
        </div>
      </div>
    </div>
  );
};
