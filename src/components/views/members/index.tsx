import React, { useState, useEffect } from 'react';
import { useCoop } from '../../../context/CoopContext';
import { useMemberFilters } from './hooks/useMemberFilters';
import { MemberListTable } from './MemberListTable';
import { MemberKYCForm } from './MemberKYCForm';
import { 
  Users, 
  UserPlus, 
  Search, 
  LayoutList, 
  LayoutGrid, 
  FileSpreadsheet, 
  ShieldCheck 
} from 'lucide-react';
import { exportToExcel } from '../../../utils/exportUtils';
import { fetchMemberSettings, MemberSetting } from '../../../api/memberSettings';

interface MembersViewProps {
  activeSubKey?: string;
}

export const MembersViewOrchestrator: React.FC<MembersViewProps> = ({ activeSubKey }) => {
  const { members = [], addNewMember, setSelectedMemberForDetail } = useCoop();
  const [activeTab, setActiveTab] = useState<'list' | 'add_member' | 'kyc_queue'>('list');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const [memberTypeCatalog, setMemberTypeCatalog] = useState<MemberSetting[]>([]);
  useEffect(() => {
    fetchMemberSettings('member-types', { active: 'true' }).then(setMemberTypeCatalog);
  }, []);

  const {
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    membershipType,
    setMembershipType,
    filteredMembers,
  } = useMemberFilters(members);

  useEffect(() => {
    if (activeSubKey === 'member_new_wizard') setActiveTab('add_member');
    else if (activeSubKey === 'member_kyc_queue') setActiveTab('kyc_queue');
    else if (activeSubKey === 'member_directory') setActiveTab('list');
  }, [activeSubKey]);

  const handleExportExcel = () => {
    const headers = [
      'Member No',
      'Full Name',
      'Citizenship No',
      'Phone',
      'Address',
      'KYC Status',
      'Total Shares',
      'Savings Balance (NPR)',
      'Loan Balance (NPR)',
      'Status'
    ];

    const dataRows = filteredMembers.map(m => [
      m.memberNo,
      m.fullName,
      m.citizenshipNo,
      m.phone,
      m.address || '',
      m.kycStatus,
      m.totalShares,
      m.totalSavingsBalance,
      m.totalLoanBalance,
      m.status
    ]);

    exportToExcel('SACCOS_Members_List', 'Members', headers, dataRows);
  };

  return (
    <div className="space-y-4">
      {/* Top Action & Module Navigation Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-xs">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              Member Directory & KYC Ledger
              <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-0.5 rounded-full">
                {filteredMembers.length} Members
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Manage member identification, shareholdings, biometrics & KYC approval queue
            </p>
          </div>
        </div>

        {/* Action Controls & Navigation Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold text-slate-600">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${ activeTab === 'list' ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'hover:text-slate-900' }`}
            >
              <Users className="w-3.5 h-3.5" /> Directory
            </button>
            <button
              onClick={() => setActiveTab('add_member')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${ activeTab === 'add_member' ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'hover:text-slate-900' }`}
            >
              <UserPlus className="w-3.5 h-3.5" /> Register Member
            </button>
            <button
              onClick={() => setActiveTab('kyc_queue')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${ activeTab === 'kyc_queue' ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'hover:text-slate-900' }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" /> KYC Queue
            </button>
          </div>

          <button
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 font-semibold text-xs rounded-lg border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Export Excel
          </button>
        </div>
      </div>

      {activeTab === 'add_member' && (
        <MemberKYCForm
          onAddMember={addNewMember}
          onSuccess={() => setActiveTab('list')}
        />
      )}

      {(activeTab === 'list' || activeTab === 'kyc_queue') && (
        <>
          {/* Filter Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 w-full md:w-auto flex-1">
              <div className="relative w-full max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, member no, citizenship, or phone..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="ALL">All Member Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>

              <select
                value={membershipType}
                onChange={(e) => setMembershipType(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="ALL">All Membership Types</option>
                {memberTypeCatalog.map((mt) => (
                  <option key={mt.id} value={mt.name}>{mt.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${ viewMode === 'list' ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800' }`}
                title="List View"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${ viewMode === 'grid' ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800' }`}
                title="Grid Cards View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Member List Data Grid */}
          <MemberListTable
            members={activeTab === 'kyc_queue' ? filteredMembers.filter(m => m.kycStatus === 'Pending') : filteredMembers}
            viewMode={viewMode}
            onSelectMember={setSelectedMemberForDetail}
          />
        </>
      )}
    </div>
  );
};
