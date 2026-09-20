import React from 'react';
import { useCoop } from '../../context/CoopContext';
import { Truck, CheckCircle2, AlertCircle, FileCheck, Phone, MapPin } from 'lucide-react';
import { formatNPR } from '../../utils/nepaliCalendar';

export const CollectionMgmtView: React.FC = () => {
  const { collectionAgents, collectionRoutes, reconcileAgentRoute } = useCoop();

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Door-to-Door Daily Collection Operations</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <Truck className="w-3.5 h-3.5 text-slate-500" />
            <span>Field agent mobile collection routes, daily deposit sheets, and cashier vault reconciliation</span>
          </p>
        </div>
      </div>

      {/* Routes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {collectionRoutes.map(r => (
          <div key={r.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-[0_4px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-teal-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 mr-2">{r.code}</span>
                <span className="font-bold text-slate-900 text-base">{r.routeName}</span>
              </div>
              <span className={`px-2.5 py-1 rounded font-bold ${ r.status === 'Reconciled' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200' }`}>
                {r.status}
              </span>
            </div>

            <div className="space-y-2 text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-500">Assigned Field Agent:</span>
                <span className="font-bold text-slate-900">{r.agentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Merchants Assigned:</span>
                <span className="font-bold text-slate-800">{r.assignedMembersCount} merchants</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Today's Target vs Collected:</span>
                <span className="font-mono font-bold text-emerald-700">{formatNPR(r.todayCollectedAmount)} / {formatNPR(r.todayTargetAmount)}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Mobile Offline Sync: Active</span>
              {r.status !== 'Reconciled' && (
                <button
                  onClick={() => reconcileAgentRoute(r.id)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition cursor-pointer text-xs flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Reconcile Cash to Vault</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
