import React from 'react';
import { Member } from '../../../types/coop';
import { Eye, Phone, MapPin, CreditCard, ShieldCheck } from 'lucide-react';
import { formatNPR } from '../../../utils/nepaliCalendar';
import { resolveMediaUrl } from '../../../api/storage';

interface MemberListTableProps {
  members: Member[];
  viewMode: 'list' | 'grid';
  onSelectMember: (member: Member) => void;
}

export const MemberListTable: React.FC<MemberListTableProps> = ({
  members,
  viewMode,
  onSelectMember,
}) => {
  if (members.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
        No member records found matching the current search/filter parameters.
      </div>
    );
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((m) => (
          <div
            key={m.id}
            className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow flex flex-col justify-between"
          >
            <div className="flex items-start gap-3">
              <img
                src={resolveMediaUrl(m.photoUrl) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                alt={m.fullName}
                className="w-12 h-12 rounded-full object-cover border border-slate-200"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 text-sm truncate">{m.fullName}</h4>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ m.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600' }`}
                  >
                    {m.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono">{m.memberNo}</p>
                <p className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                  <Phone className="w-3 h-3 text-slate-500" /> {m.phone}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">Shares</span>
                <span className="font-bold text-slate-700">{m.totalShares}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Savings</span>
                <span className="font-bold text-emerald-700">{formatNPR(m.totalSavingsBalance)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Loans</span>
                <span className="font-bold text-amber-700">{formatNPR(m.totalLoanBalance)}</span>
              </div>
            </div>

            <button
              onClick={() => onSelectMember(m)}
              className="mt-3 w-full py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-xs rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" /> View Profile & Ledger
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-3">Member Details</th>
              <th className="p-3">Citizenship / Phone</th>
              <th className="p-3">Location</th>
              <th className="p-3">KYC Status</th>
              <th className="p-3 text-right">Savings Balance</th>
              <th className="p-3 text-right">Loan Balance</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={resolveMediaUrl(m.photoUrl) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                      alt={m.fullName}
                      className="w-9 h-9 rounded-full object-cover border border-slate-200"
                    />
                    <div>
                      <div className="font-bold text-slate-800">{m.fullName}</div>
                      <div className="text-[11px] font-mono text-emerald-700">{m.memberNo}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <div className="text-slate-700 font-mono">{m.citizenshipNo}</div>
                  <div className="text-slate-500 text-[11px] flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-500" /> {m.phone}
                  </div>
                </td>
                <td className="p-3">
                  <div className="text-slate-700 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-500" /> {m.address || m.district}
                  </div>
                </td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${ m.kycStatus === 'Verified' ? 'bg-emerald-100 text-emerald-800' : m.kycStatus === 'Pending' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800' }`}
                  >
                    <ShieldCheck className="w-3 h-3" />
                    {m.kycStatus}
                  </span>
                </td>
                <td className="p-3 text-right font-bold text-emerald-700">
                  {formatNPR(m.totalSavingsBalance)}
                </td>
                <td className="p-3 text-right font-bold text-amber-700">
                  {formatNPR(m.totalLoanBalance)}
                </td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => onSelectMember(m)}
                    className="p-1.5 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 rounded-lg transition-colors cursor-pointer"
                    title="View Member Ledger"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
