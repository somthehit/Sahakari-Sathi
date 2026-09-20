import React, { useState, useEffect } from 'react';
import { useCoop } from '../../context/CoopContext';
import { Department } from '../../types/coop';
import {
  Briefcase,
  Receipt,
  Plus,
  Save,
  Users,
  FolderKanban,
  Edit3,
  Trash2,
  X,
  FileText,
  FileSpreadsheet,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { AdminSetupSearchFilterBar } from '../common/AdminSetupSearchFilterBar';
import { exportToPdf, exportToExcel } from '../../utils/exportUtils';

interface Props {
  activeSubKey?: string;
}

export const SetupHrBillingView: React.FC<Props> = ({ activeSubKey = 'setup_hr_designations' }) => {
  const { departments, addDepartment, updateDepartment, deleteDepartment, branches, openTab, addNotification } = useCoop();
  const [subTab, setSubTab] = useState<string>(activeSubKey);
  const [searchTerm, setSearchTerm] = useState('');

  // Department Modal State
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deleteDeptId, setDeleteDeptId] = useState<string | null>(null);

  // Department Form Data State
  const [deptFormData, setDeptFormData] = useState({
    code: '',
    name: '',
    headOfDepartment: '',
    branchId: 'b1',
    costCenterCode: '',
    budgetAllocation: 2000000,
    usedBudget: 0,
    staffCount: 1,
    status: 'Active' as 'Active' | 'Inactive',
    description: ''
  });

  useEffect(() => {
    if (activeSubKey) {
      setSubTab(activeSubKey);
    }
  }, [activeSubKey]);

  const designations = [
    { id: '1', title: 'Chief Executive Officer (CEO)', grade: 'Level 10 Managerial', minSalary: 85000 },
    { id: '2', title: 'Branch Manager', grade: 'Level 8 Officer', minSalary: 55000 },
    { id: '3', title: 'Senior Accountant', grade: 'Level 6 Officer', minSalary: 42000 },
    { id: '4', title: 'Loan Officer / Appraisal', grade: 'Level 5 Assistant', minSalary: 35000 },
    { id: '5', title: 'Teller Cashier', grade: 'Level 4 Assistant', minSalary: 28000 },
    { id: '6', title: 'Field Micro Collector', grade: 'Level 3 Field Staff', minSalary: 22000 },
  ];

  const serviceCharges = [
    { id: '1', name: 'Loan Processing Service Charge', rate: '1.0% of Loan Amount', glCode: '4002' },
    { id: '2', name: 'New Membership Entrance Fee', rate: 'NPR 500 flat', glCode: '4003' },
    { id: '3', name: 'Passbook Duplicate Reissuance Fee', rate: 'NPR 200 flat', glCode: '4003' },
    { id: '4', name: 'Cheque Book Reissuance Fee', rate: 'NPR 300 flat', glCode: '4003' },
  ];

  const handleSave = () => {
    addNotification('Configuration Saved', 'HR Designation and Billing Fee structures updated.', 'success');
  };

  const filteredDesignations = designations.filter(d =>
    (d.title || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (d.grade || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  const filteredServiceCharges = serviceCharges.filter(sc =>
    (sc.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (sc.glCode || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  const handleOpenAddDeptModal = () => {
    const nextCode = `DEP-${String(departments.length + 1).padStart(2, '0')}`;
    setEditingDept(null);
    setDeptFormData({
      code: nextCode,
      name: '',
      headOfDepartment: '',
      branchId: branches[0]?.id || 'b1',
      costCenterCode: `CC-${nextCode}-101`,
      budgetAllocation: 2000000,
      usedBudget: 0,
      staffCount: 1,
      status: 'Active',
      description: ''
    });
    setIsDeptModalOpen(true);
  };

  const handleOpenEditDeptModal = (dept: Department) => {
    setEditingDept(dept);
    setDeptFormData({
      code: dept.code,
      name: dept.name,
      headOfDepartment: dept.headOfDepartment,
      branchId: dept.branchId,
      costCenterCode: dept.costCenterCode,
      budgetAllocation: dept.budgetAllocation,
      usedBudget: dept.usedBudget,
      staffCount: dept.staffCount,
      status: dept.status,
      description: dept.description
    });
    setIsDeptModalOpen(true);
  };

  const handleSaveDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptFormData.name.trim() || !deptFormData.code.trim()) {
      addNotification('Validation Failed', 'Please enter a valid Department Code and Name.', 'alert');
      return;
    }

    if (editingDept) {
      updateDepartment(editingDept.id, {
        code: deptFormData.code,
        name: deptFormData.name,
        headOfDepartment: deptFormData.headOfDepartment,
        branchId: deptFormData.branchId,
        costCenterCode: deptFormData.costCenterCode,
        budgetAllocation: Number(deptFormData.budgetAllocation),
        usedBudget: Number(deptFormData.usedBudget),
        staffCount: Number(deptFormData.staffCount),
        status: deptFormData.status,
        description: deptFormData.description
      });
    } else {
      addDepartment({
        code: deptFormData.code,
        name: deptFormData.name,
        headOfDepartment: deptFormData.headOfDepartment,
        branchId: deptFormData.branchId,
        costCenterCode: deptFormData.costCenterCode,
        budgetAllocation: Number(deptFormData.budgetAllocation),
        usedBudget: Number(deptFormData.usedBudget),
        staffCount: Number(deptFormData.staffCount),
        status: deptFormData.status,
        description: deptFormData.description
      });
    }

    setIsDeptModalOpen(false);
  };

  const handleDeleteConfirm = () => {
    if (deleteDeptId) {
      deleteDepartment(deleteDeptId);
      setDeleteDeptId(null);
    }
  };

  // Export handlers
  const handleExportDepartmentsPdf = () => {
    const headers = ['Dept Code', 'Department Name', 'HOD', 'Cost Center', 'Staff', 'Allocated Budget (NPR)', 'Status'];
    const rows = filteredDepartments.map(d => [
      d.code,
      d.name,
      d.headOfDepartment || 'N/A',
      d.costCenterCode,
      d.staffCount,
      d.budgetAllocation.toLocaleString(),
      d.status
    ]);
    exportToPdf('Department_Registry_Report', 'Cooperative Departmental Registry', 'Sahakari Sathi Head Office & Branch Organizational Structure', headers, rows);
  };

  const handleExportDepartmentsExcel = () => {
    const headers = ['Dept Code', 'Department Name', 'HOD', 'Cost Center', 'Staff Count', 'Allocated Budget', 'Used Budget', 'Status', 'Description'];
    const rows = filteredDepartments.map(d => [
      d.code,
      d.name,
      d.headOfDepartment,
      d.costCenterCode,
      d.staffCount,
      d.budgetAllocation,
      d.usedBudget,
      d.status,
      d.description
    ]);
    exportToExcel('Department_Registry_Report', 'Departments', headers, rows);
  };

  const filteredDepartments = departments.filter(d =>
    (d.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (d.code || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (d.headOfDepartment || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (d.costCenterCode || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  // Department Summaries
  const totalAllocatedBudget = departments.reduce((acc, d) => acc + (d.budgetAllocation || 0), 0);
  const totalUsedBudget = departments.reduce((acc, d) => acc + (d.usedBudget || 0), 0);
  const totalDeptStaff = departments.reduce((acc, d) => acc + (d.staffCount || 0), 0);

  return (
    <div className="space-y-6">

      {/* Persistent Search and Filter Bar */}
      <AdminSetupSearchFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={
          subTab === 'setup_departments' ? 'Search department name, code, HOD, cost center...' :
          subTab === 'setup_hr_designations' ? 'Search job designation title or grade...' :
          'Search fee schedule name or GL code...'
        }
        quickStats={[
          {
            label: subTab === 'setup_departments' ? 'Total Departments' : subTab === 'setup_hr_designations' ? 'Total Records' : 'Fee Schedule Records',
            value: subTab === 'setup_departments' ? filteredDepartments.length : subTab === 'setup_hr_designations' ? filteredDesignations.length : filteredServiceCharges.length,
            color: 'text-emerald-400'
          }
        ]}
      />

      {/* DEPARTMENT MANAGEMENT SETUP */}
      {subTab === 'setup_departments' && (
        <div className="space-y-6">
          {/* Top Overview & Actions Bar */}
          <div className="bg-white text-slate-900 p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl">
                  <FolderKanban className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    <span>Organizational Department Functions</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-mono rounded-full font-bold">
                      {departments.length} Configured
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Define cost centers, assign HOD leadership, allocate annual budgets, and manage staff mappings.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportDepartmentsPdf}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                  title="Export Department List PDF"
                >
                  <FileText className="w-4 h-4 text-emerald-700" />
                  <span className="hidden md:inline">PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportDepartmentsExcel}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                  title="Export Department Excel Sheet"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span className="hidden md:inline">Excel</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenAddDeptModal}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" /> Add Department
                </button>
              </div>
            </div>

            {/* Department Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-200">
              <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Total Allocated Budget</span>
                <span className="text-sm font-bold font-mono text-emerald-800">
                  NPR {totalAllocatedBudget.toLocaleString()}
                </span>
              </div>

              <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Budget Utilized</span>
                <span className="text-sm font-bold font-mono text-amber-800">
                  NPR {totalUsedBudget.toLocaleString()} ({totalAllocatedBudget ? Math.round((totalUsedBudget/totalAllocatedBudget)*100) : 0}%)
                </span>
              </div>

              <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Total Assigned Staff</span>
                <span className="text-sm font-bold font-mono text-cyan-800 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {totalDeptStaff} Personnel
                </span>
              </div>

              <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Active Department Ratio</span>
                <span className="text-sm font-bold font-mono text-emerald-800">
                  {departments.filter(d => d.status === 'Active').length} / {departments.length} Active
                </span>
              </div>
            </div>
          </div>

          {/* Department Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDepartments.map((dept) => {
              const budgetPercent = dept.budgetAllocation > 0
                ? Math.min(100, Math.round((dept.usedBudget / dept.budgetAllocation) * 100))
                : 0;

              return (
                <div
                  key={dept.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs hover:border-emerald-300 transition group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header line */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md text-[10px] font-mono font-bold">
                            {dept.code}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-mono font-semibold">
                            {dept.costCenterCode}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-900 text-base mt-1 group-hover:text-emerald-700 transition">
                          {dept.name}
                        </h3>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${ dept.status === 'Active' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200' }`}>
                        {dept.status}
                      </span>
                    </div>

                    {/* HOD & Details */}
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-500 font-medium">Head of Department:</span>
                        <span className="font-semibold text-slate-800 text-right truncate max-w-[180px]" title={dept.headOfDepartment}>
                          {dept.headOfDepartment || 'Unassigned'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-500 font-medium">Branch Location:</span>
                        <span className="font-semibold text-slate-700">
                          {branches.find(b => b.id === dept.branchId)?.name || 'Head Office (All)'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-slate-500 font-medium">Personnel Staff:</span>
                        <span className="font-bold text-slate-800 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-emerald-600" />
                          {dept.staffCount} Staff Members
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100 line-clamp-2 mt-2">
                        {dept.description || 'No detailed scope responsibilities recorded.'}
                      </p>
                    </div>

                    {/* Budget Progress Bar */}
                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-bold text-slate-700">Annual Budget Usage</span>
                        <span className="font-mono text-slate-600 font-bold">
                          NPR {dept.usedBudget.toLocaleString()} / {dept.budgetAllocation.toLocaleString()}
                        </span>
                      </div>

                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${ budgetPercent > 90 ? 'bg-rose-500' : budgetPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500' }`}
                          style={{ width: `${budgetPercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>Utilization: {budgetPercent}%</span>
                        <span>Remaining: NPR {(dept.budgetAllocation - dept.usedBudget).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => openTab('setup_department_profile', `${dept.name} - Profile`, 'Building', dept.id)}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-xs"
                    >
                      <Building2 className="w-3.5 h-3.5" /> View Profile
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEditDeptModal(dept)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 border border-slate-200"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteDeptId(dept.id)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg text-xs font-bold transition cursor-pointer border border-slate-200"
                      title="Delete Department"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DESIGNATIONS */}
      {subTab === 'setup_hr_designations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Employee Designations & Pay Scale Grades</h3>
            <button
              onClick={() => addNotification('Add Designation', 'Opening designation form.', 'info')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center gap-2 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" /> Add Designation
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs text-xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px] uppercase">
                <tr>
                  <th className="p-3">Job Title Designation</th>
                  <th className="p-3">Grade Classification</th>
                  <th className="p-3">Min Basic Salary (NPR)</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                {filteredDesignations.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-sans font-bold text-slate-900">{d.title}</td>
                    <td className="p-3 font-sans text-slate-600">{d.grade}</td>
                    <td className="p-3 text-emerald-700 font-bold">NPR {d.minSalary.toLocaleString()}</td>
                    <td className="p-3 text-right">
                      <button onClick={handleSave} className="text-emerald-600 hover:underline font-bold cursor-pointer font-sans">
                        Edit Scale →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SERVICE CHARGES */}
      {subTab === 'setup_service_charges' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm font-sans">Service Charge & Administrative Fee Schedule</h3>
            <button
              onClick={() => addNotification('Add Fee Rule', 'Opening fee schedule form.', 'info')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center gap-2 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" /> Add Fee Rule
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs text-xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px] uppercase">
                <tr>
                  <th className="p-3">Fee / Charge Name</th>
                  <th className="p-3">Standard Rate</th>
                  <th className="p-3">Linked GL Income Account Code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredServiceCharges.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-bold text-slate-900">{s.name}</td>
                    <td className="p-3 font-mono text-emerald-700 font-bold">{s.rate}</td>
                    <td className="p-3 font-mono text-slate-500">GL {s.glCode} (Other Operating Income)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT DEPARTMENT MODAL */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-white border-b border-slate-200 text-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    {editingDept ? 'Edit Department Configuration' : 'Configure New Department Function'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Set up department code, cost center, HOD, and budget allowance
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDeptModalOpen(false)}
                className="text-slate-500 hover:text-slate-700 p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDepartment} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 text-xs font-bold mb-1">
                    Department Code <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={deptFormData.code}
                    onChange={(e) => setDeptFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="e.g. DEP-FIN"
                    className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 text-xs font-bold mb-1">
                    Cost Center GL Code <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={deptFormData.costCenterCode}
                    onChange={(e) => setDeptFormData(prev => ({ ...prev, costCenterCode: e.target.value }))}
                    placeholder="e.g. CC-FIN-101"
                    className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-700 text-xs font-bold mb-1">
                    Department Name <span className="text-emerald-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={deptFormData.name}
                    onChange={(e) => setDeptFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Credit & Loan Appraisal"
                    className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 text-xs font-bold mb-1">
                    Head of Department (HOD)
                  </label>
                  <input
                    type="text"
                    value={deptFormData.headOfDepartment}
                    onChange={(e) => setDeptFormData(prev => ({ ...prev, headOfDepartment: e.target.value }))}
                    placeholder="e.g. Sunita Sharma (CFO)"
                    className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 text-xs font-bold mb-1">
                    Branch Assignment
                  </label>
                  <select
                    value={deptFormData.branchId}
                    onChange={(e) => setDeptFormData(prev => ({ ...prev, branchId: e.target.value }))}
                    className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 text-xs font-bold mb-1">
                    Allocated Budget (NPR)
                  </label>
                  <input
                    type="number"
                    value={deptFormData.budgetAllocation}
                    onChange={(e) => setDeptFormData(prev => ({ ...prev, budgetAllocation: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 text-xs font-bold mb-1">
                    Used Budget (NPR)
                  </label>
                  <input
                    type="number"
                    value={deptFormData.usedBudget}
                    onChange={(e) => setDeptFormData(prev => ({ ...prev, usedBudget: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 text-xs font-bold mb-1">
                    Staff Personnel Count
                  </label>
                  <input
                    type="number"
                    value={deptFormData.staffCount}
                    onChange={(e) => setDeptFormData(prev => ({ ...prev, staffCount: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 text-xs font-bold mb-1">
                    Status
                  </label>
                  <select
                    value={deptFormData.status}
                    onChange={(e) => setDeptFormData(prev => ({ ...prev, status: e.target.value as 'Active' | 'Inactive' }))}
                    className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-700 text-xs font-bold mb-1">
                    Scope & Core Responsibilities
                  </label>
                  <textarea
                    rows={3}
                    value={deptFormData.description}
                    onChange={(e) => setDeptFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe primary functions, PEARLS compliance responsibilities, and operational scope..."
                    className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingDept ? 'Save Changes' : 'Create Department'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteDeptId && (
        <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Delete Department?</h3>
                <p className="text-xs text-slate-500">This action will remove the department record.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
              Are you sure you want to delete this department function? Assigned staff members may need to be reallocated.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteDeptId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
