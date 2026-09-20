import React from 'react';
import { LifeBuoy, MessageSquare, CheckCircle2 } from 'lucide-react';

export const SupportView: React.FC = () => {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
              <LifeBuoy className="w-6 h-6 text-emerald-700" />
              <span>Support & Version Info</span>
            </h1>
            <p className="text-slate-500 text-xs mt-1">Platform documentation, tenant support tickets, and system versioning.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
          {/* System Information */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
            <h2 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
              <LifeBuoy className="w-5 h-5 text-indigo-600" /> System Information
            </h2>
            <div className="flex flex-col items-center justify-center py-8 text-center bg-white rounded-lg border border-slate-200">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
              <p className="text-sm font-bold text-slate-700">Version information unavailable</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">Build version and release metadata will appear here once configured.</p>
            </div>
          </div>

          {/* Support Tickets */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
            <h2 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-emerald-600" /> Tenant Support Tickets
            </h2>
            <div className="flex flex-col items-center justify-center py-8 text-center bg-white rounded-lg border border-slate-200 h-48">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
              <p className="text-sm font-bold text-slate-700">No open support tickets</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">Support tickets from tenant organizations will appear here.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
