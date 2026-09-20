import React, { useState, useEffect } from 'react';
import { Shield, Search, Filter, Loader2, AlertCircle, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { useCoop } from '../../context/CoopContext';
import { formatNPR } from '../../utils/nepaliCalendar';

interface LoanInsurance {
  id: string;
  loanId: string;
  loanNo: string;
  memberName: string;
  memberNo: string;
  insuredAmount: number;
  premiumRate: number;
  premiumAmount: number;
  insurerName: string;
  policyNumber: string;
  startDateBs: string;
  endDateBs: string;
  status: 'Active' | 'Expired' | 'Pending' | 'Claimed';
}

export const LoanInsuranceView: React.FC = () => {
  const { loanAccounts = [] } = useCoop();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);

  // Mock data for demonstration
  const [insuranceRecords, setInsuranceRecords] = useState<LoanInsurance[]>([]);

  useEffect(() => {
    // Generate mock insurance records from loan accounts
    const mockRecords: LoanInsurance[] = loanAccounts.slice(0, 5).map((loan, idx) => ({
      id: `INS-${String(idx + 1).padStart(3, '0')}`,
      loanId: loan.id,
      loanNo: loan.loanNo,
      memberName: loan.memberName,
      memberNo: loan.memberNo,
      insuredAmount: Number(loan.approvedAmount) || 100000,
      premiumRate: 0.5,
      premiumAmount: Math.round((Number(loan.approvedAmount) || 100000) * 0.005),
      insurerName: idx % 2 === 0 ? 'Nepal Insurance Co. Ltd.' : 'Surya Nepal Insurance',
      policyNumber: `POL-${2083}-${String(idx + 1001).padStart(4, '0')}`,
      startDateBs: '2083-01-01',
      endDateBs: '2084-01-01',
      status: idx % 3 === 0 ? 'Active' : idx % 3 === 1 ? 'Pending' : 'Expired',
    }));
    setInsuranceRecords(mockRecords);
  }, [loanAccounts]);

  const filteredRecords = insuranceRecords.filter(record => {
    const matchesSearch = searchQuery === '' ||
      record.loanNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.memberName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.policyNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || record.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      'Active': 'bg-emerald-100 text-emerald-800 border-emerald-200',
      'Expired': 'bg-slate-100 text-slate-600 border-slate-200',
      'Pending': 'bg-amber-100 text-amber-800 border-amber-200',
      'Claimed': 'bg-blue-100 text-blue-800 border-blue-200',
    };
    return styles[status] || 'bg-slate-100 text-slate-600';
  };

  const totalInsured = insuranceRecords.reduce((sum, r) => sum + r.insuredAmount, 0);
  const totalPremium = insuranceRecords.reduce((sum, r) => sum + r.premiumAmount, 0);
  const activeCount = insuranceRecords.filter(r => r.status === 'Active').length;

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Credit Life Insurance Linkage</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <Shield className="w-3.5 h-3.5 text-slate-500" />
            <span>Manage credit life insurance policies linked to loan accounts</span>
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[10px] text-slate-500 uppercase font-semibold">Total Policies</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{insuranceRecords.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[10px] text-emerald-600 uppercase font-semibold">Active Policies</div>
          <div className="text-xl font-bold text-emerald-600 mt-1">{activeCount}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[10px] text-slate-500 uppercase font-semibold">Total Insured Amount</div>
          <div className="text-xl font-bold text-blue-600 mt-1">{formatNPR(totalInsured)}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[10px] text-slate-500 uppercase font-semibold">Total Premium Collected</div>
          <div className="text-xl font-bold text-amber-600 mt-1">{formatNPR(totalPremium)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by loan no, member, or policy number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="ALL">All Status</option>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Expired">Expired</option>
              <option value="Claimed">Claimed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Insurance Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold text-[11px] uppercase">
              <tr>
                <th className="p-3">Policy No</th>
                <th className="p-3">Loan No</th>
                <th className="p-3">Member</th>
                <th className="p-3">Insurer</th>
                <th className="p-3 text-right">Insured Amount</th>
                <th className="p-3 text-right">Premium</th>
                <th className="p-3">Period</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center">
                    <Loader2 className="w-6 h-6 text-slate-400 mx-auto mb-2 animate-spin" />
                    Loading insurance records...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    <Shield className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No insurance records found
                  </td>
                </tr>
              ) : (
                filteredRecords.map(record => (
                  <tr key={record.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 font-mono font-bold text-blue-700">{record.policyNumber}</td>
                    <td className="p-3 font-mono font-bold text-emerald-700">{record.loanNo}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{record.memberName}</div>
                      <div className="text-[10px] text-slate-500">{record.memberNo}</div>
                    </td>
                    <td className="p-3 text-slate-700">{record.insurerName}</td>
                    <td className="p-3 text-right font-mono font-bold">{formatNPR(record.insuredAmount)}</td>
                    <td className="p-3 text-right font-mono">{formatNPR(record.premiumAmount)}</td>
                    <td className="p-3">
                      <div className="text-[10px] text-slate-500">
                        {record.startDateBs} to {record.endDateBs}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getStatusBadge(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button className="text-blue-600 hover:text-blue-800 transition p-1" title="View Details">
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
