import React, { useState } from 'react';
import { useCoop } from '../../context/CoopContext';
import type { Designation } from '../../types/coop';
import {
  Building2,
  UserRound,
  MapPin,
  DollarSign,
  Users,
  BadgeCheck,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Briefcase,
  AlertCircle,
  Loader2,
  ClipboardList,
  GitBranch,
  ShieldCheck,
  ListChecks,
} from 'lucide-react';

interface Props {
  departmentId?: string;
  activeSubKey?: string;
}

interface DesignationForm {
  name: string;
  code: string;
  status: 'Active' | 'Inactive';
  reportsToId: string;
  jobGrade: string;
  minSalary: string;
  maxSalary: string;
  allowanceEligible: boolean;
  approvalLimit: string;
  systemAccessRole: string;
  pearlsRole: string;
  employmentType: string;
  description: string;
}

const emptyForm: DesignationForm = {
  name: '',
  code: '',
  status: 'Active',
  reportsToId: '',
  jobGrade: '',
  minSalary: '',
  maxSalary: '',
  allowanceEligible: false,
  approvalLimit: '',
  systemAccessRole: '',
  pearlsRole: '',
  employmentType: '',
  description: '',
};

const inputCls =
  'w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500';
const labelCls = 'block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1';
const sectionTitleCls = 'flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wide mb-3';

const DESIGNATION_TYPES = ['Full-time', 'Part-time', 'Contract', 'Probation', 'Internship', 'Volunteer'];
const ACCESS_ROLES = ['', 'Maker', 'Checker', 'Approver'];
const GRADE_OPTIONS = ['Grade I', 'Grade II', 'Grade III', 'Grade IV', 'Grade V', 'Grade VI', 'Grade VII', 'Senior', 'Junior'];

export const DepartmentProfileView: React.FC<Props> = ({ departmentId, activeSubKey }) => {
  const {
    departments,
    departmentsStatus,
    designations,
    designationsStatus,
    branches,
    addDesignation,
    updateDesignation,
    deleteDesignation,
    addNotification,
  } = useCoop();

  const department = departments.find(d => d.id === departmentId);

  // Add/Edit modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingDesignation, setEditingDesignation] = useState<Designation | null>(null);
  const [form, setForm] = useState<DesignationForm>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Designation | null>(null);

  const deptDesignations = designations.filter(d => d.departmentId === departmentId);
  const branchName = department
    ? branches.find(b => b.id === department.branchId)?.name
    : undefined;

  const setField = (key: keyof DesignationForm, value: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const reportsToName = (id?: string) => (id ? deptDesignations.find(d => d.id === id)?.name : undefined);

  const openAddDesignation = () => {
    setEditingDesignation(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEditDesignation = (desig: Designation) => {
    setEditingDesignation(desig);
    setForm({
      name: desig.name,
      code: desig.code ?? '',
      status: desig.status,
      reportsToId: desig.reportsToId ?? '',
      jobGrade: desig.jobGrade ?? '',
      minSalary: desig.minSalary !== undefined && desig.minSalary !== null ? String(desig.minSalary) : '',
      maxSalary: desig.maxSalary !== undefined && desig.maxSalary !== null ? String(desig.maxSalary) : '',
      allowanceEligible: !!desig.allowanceEligible,
      approvalLimit: desig.approvalLimit !== undefined && desig.approvalLimit !== null ? String(desig.approvalLimit) : '',
      systemAccessRole: desig.systemAccessRole ?? '',
      pearlsRole: desig.pearlsRole ?? '',
      employmentType: desig.employmentType ?? '',
      description: desig.description ?? '',
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!departmentId) return;
    if (!form.name.trim()) {
      addNotification('Validation Failed', 'Please enter a designation name before saving.', 'alert');
      return;
    }
    const min = form.minSalary ? Number(form.minSalary) : null;
    const max = form.maxSalary ? Number(form.maxSalary) : null;
    if (min !== null && max !== null && min > max) {
      addNotification('Validation Failed', 'Minimum salary cannot be greater than maximum salary.', 'alert');
      return;
    }
    const payload: Omit<Designation, 'id' | 'departmentId'> = {
      name: form.name.trim(),
      code: form.code.trim() || '',
      status: form.status,
      reportsToId: form.reportsToId || '',
      jobGrade: form.jobGrade.trim() || '',
      minSalary: min ?? undefined,
      maxSalary: max ?? undefined,
      allowanceEligible: form.allowanceEligible,
      approvalLimit: form.approvalLimit ? Number(form.approvalLimit) : undefined,
      systemAccessRole: form.systemAccessRole || '',
      pearlsRole: form.pearlsRole.trim() || '',
      employmentType: form.employmentType || '',
      description: form.description.trim() || '',
    };
    setIsSubmitting(true);
    if (editingDesignation) {
      await updateDesignation(editingDesignation.id, payload);
    } else {
      await addDesignation(departmentId, payload);
    }
    setIsSubmitting(false);
    setFormOpen(false);
    setEditingDesignation(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteDesignation(deleteTarget.id);
    setDeleteTarget(null);
  };

  if (departmentsStatus === 'loading' || departmentsStatus === 'error') {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 gap-3">
        {departmentsStatus === 'loading' ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
            <span className="text-sm font-semibold">Loading department profile…</span>
          </>
        ) : (
          <>
            <AlertCircle className="w-5 h-5 text-rose-500" />
            <span className="text-sm font-semibold">Could not load department data.</span>
          </>
        )}
      </div>
    );
  }

  if (!department) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
        <h3 className="font-bold text-slate-800 text-lg">Department Not Found</h3>
        <p className="text-sm text-slate-500">This department may have been deleted or is not available.</p>
      </div>
    );
  }

  const budgetPercent = department.budgetAllocation > 0
    ? Math.min(100, Math.round((department.usedBudget / department.budgetAllocation) * 100))
    : 0;

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-slate-900">{department.name}</h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ department.status === 'Active' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200' }`}>
                  {department.status}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-mono font-bold">{department.code}</span>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-mono font-bold">{department.costCenterCode}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Detail Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-50 rounded-xl border border-slate-100 p-3.5">
            <div className="flex items-center gap-2 text-slate-500 text-[11px] font-bold uppercase">
              <UserRound className="w-3.5 h-3.5" /> Head of Department
            </div>
            <div className="text-sm font-bold text-slate-800 mt-1">{department.headOfDepartment || 'Unassigned'}</div>
          </div>
          <div className="bg-slate-50 rounded-xl border border-slate-100 p-3.5">
            <div className="flex items-center gap-2 text-slate-500 text-[11px] font-bold uppercase">
              <MapPin className="w-3.5 h-3.5" /> Branch Location
            </div>
            <div className="text-sm font-bold text-slate-800 mt-1">{branchName || 'Head Office (All)'}</div>
          </div>
          <div className="bg-slate-50 rounded-xl border border-slate-100 p-3.5">
            <div className="flex items-center gap-2 text-slate-500 text-[11px] font-bold uppercase">
              <Users className="w-3.5 h-3.5" /> Personnel Staff
            </div>
            <div className="text-sm font-bold text-slate-800 mt-1">{department.staffCount} Staff Members</div>
          </div>
          <div className="bg-slate-50 rounded-xl border border-slate-100 p-3.5">
            <div className="flex items-center gap-2 text-slate-500 text-[11px] font-bold uppercase">
              <DollarSign className="w-3.5 h-3.5" /> Annual Budget
            </div>
            <div className="text-sm font-bold text-slate-800 mt-1">NPR {department.budgetAllocation.toLocaleString()}</div>
          </div>
        </div>

        {/* Budget Usage */}
        <div className="mt-4 bg-slate-50 rounded-xl border border-slate-100 p-4">
          <div className="flex justify-between items-center text-xs mb-1.5">
            <span className="font-bold text-slate-700">Budget Utilization</span>
            <span className="font-mono text-slate-600 font-bold">
              NPR {department.usedBudget.toLocaleString()} / {department.budgetAllocation.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${budgetPercent > 90 ? 'bg-rose-500' : budgetPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${budgetPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
            <span>Utilization: {budgetPercent}%</span>
            <span>Remaining: NPR {(department.budgetAllocation - department.usedBudget).toLocaleString()}</span>
          </div>
        </div>

        {department.description && (
          <p className="mt-4 text-sm text-slate-600 bg-slate-50 rounded-xl border border-slate-100 p-4 leading-relaxed">
            {department.description}
          </p>
        )}
      </div>

      {/* Designations Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-emerald-700" />
            <h3 className="font-bold text-slate-800 text-sm">Designations</h3>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
              {deptDesignations.length}
            </span>
          </div>
          <button
            type="button"
            onClick={openAddDesignation}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Designation
          </button>
        </div>

        {/* Designation List */}
        <div className="p-4">
          {designationsStatus === 'loading' ? (
            <div className="flex items-center justify-center py-10 text-slate-500 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs font-semibold">Loading designations…</span>
            </div>
          ) : deptDesignations.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-sm">
              No designations configured for this department yet. Click "Add Designation" to create one.
            </div>
          ) : (
            <div className="space-y-2">
              {deptDesignations.map((desig) => {
                const reportTo = reportsToName(desig.reportsToId);
                return (
                  <div
                    key={desig.id}
                    className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-emerald-300 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <BadgeCheck className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-sm truncate">{desig.name}</span>
                          {desig.code && (
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-mono text-[10px] font-bold shrink-0">{desig.code}</span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${ desig.status === 'Active' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200' }`}>
                            {desig.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[10px] text-slate-500 font-mono">
                          <span>ID: {desig.id.slice(0, 8)}</span>
                          {desig.jobGrade && <span>Grade: {desig.jobGrade}</span>}
                          {reportTo && <span>Reports to: {reportTo}</span>}
                          {desig.allowanceEligible && <span className="text-emerald-600">Allowance eligible</span>}
                          {desig.approvalLimit !== undefined && desig.approvalLimit !== null && desig.approvalLimit > 0 && (
                            <span>Approval limit: NPR {desig.approvalLimit.toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditDesignation(desig)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 rounded-lg transition cursor-pointer border border-slate-200"
                        title="Edit Designation"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(desig)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-lg transition cursor-pointer border border-slate-200"
                        title="Delete Designation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Designation Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-slate-900 text-base">
                  {editingDesignation ? 'Edit Designation' : 'Add New Designation'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="px-6 py-5 space-y-6 max-h-[calc(100vh-16rem)] overflow-y-auto">
                {/* General Info */}
                <div>
                  <div className={sectionTitleCls}>
                    <ClipboardList className="w-4 h-4 text-emerald-700" />
                    General Info
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Designation Title *</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setField('name', e.target.value)}
                        placeholder="e.g. Senior Accountant, Cashier, Loan Officer"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Designation Code</label>
                      <input
                        type="text"
                        value={form.code}
                        onChange={(e) => setField('code', e.target.value)}
                        placeholder="e.g. DSG-ACC-01"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Employment Type</label>
                      <select
                        value={form.employmentType}
                        onChange={(e) => setField('employmentType', e.target.value)}
                        className={inputCls}
                      >
                        <option value="">Select employment type</option>
                        {DESIGNATION_TYPES.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Status</label>
                      <select
                        value={form.status}
                        onChange={(e) => setField('status', e.target.value as 'Active' | 'Inactive')}
                        className={inputCls}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Organizational Hierarchy */}
                <div>
                  <div className={sectionTitleCls}>
                    <GitBranch className="w-4 h-4 text-emerald-700" />
                    Organizational Hierarchy
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Reports To</label>
                      <select
                        value={form.reportsToId}
                        onChange={(e) => setField('reportsToId', e.target.value)}
                        className={inputCls}
                      >
                        <option value="">None (Top of hierarchy)</option>
                        {deptDesignations
                          .filter(d => d.id !== editingDesignation?.id)
                          .map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Job Grade</label>
                      <input
                        type="text"
                        list="job-grade-options"
                        value={form.jobGrade}
                        onChange={(e) => setField('jobGrade', e.target.value)}
                        placeholder="e.g. Grade II, Level 3"
                        className={inputCls}
                      />
                      <datalist id="job-grade-options">
                        {GRADE_OPTIONS.map(g => (
                          <option key={g} value={g} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                </div>

                {/* Financial & System Rights */}
                <div>
                  <div className={sectionTitleCls}>
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    Financial & System Rights
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Minimum Salary (NPR)</label>
                      <input
                        type="number"
                        min="0"
                        value={form.minSalary}
                        onChange={(e) => setField('minSalary', e.target.value)}
                        placeholder="e.g. 25000"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Maximum Salary (NPR)</label>
                      <input
                        type="number"
                        min="0"
                        value={form.maxSalary}
                        onChange={(e) => setField('maxSalary', e.target.value)}
                        placeholder="e.g. 45000"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Approval Limit (NPR)</label>
                      <input
                        type="number"
                        min="0"
                        value={form.approvalLimit}
                        onChange={(e) => setField('approvalLimit', e.target.value)}
                        placeholder="e.g. 100000"
                        className={inputCls}
                      />
                    </div>
                    <div className="flex items-end pb-1">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={form.allowanceEligible}
                        onClick={() => setField('allowanceEligible', !form.allowanceEligible)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${ form.allowanceEligible ? 'bg-emerald-600' : 'bg-slate-300' }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${ form.allowanceEligible ? 'translate-x-6' : 'translate-x-1' }`}
                        />
                      </button>
                      <span className="ml-3 text-xs font-bold text-slate-700">
                        {form.allowanceEligible ? 'Allowance Eligible' : 'Not Allowance Eligible'}
                      </span>
                    </div>
                    <div>
                      <label className={labelCls}>System Access Role</label>
                      <select
                        value={form.systemAccessRole}
                        onChange={(e) => setField('systemAccessRole', e.target.value)}
                        className={inputCls}
                      >
                        <option value="">No system role</option>
                        {ACCESS_ROLES.slice(1).map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>PEARLS Role</label>
                      <input
                        type="text"
                        value={form.pearlsRole}
                        onChange={(e) => setField('pearlsRole', e.target.value)}
                        placeholder="e.g. Compliance Officer"
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>

                {/* Key Responsibilities */}
                <div>
                  <div className={sectionTitleCls}>
                    <ListChecks className="w-4 h-4 text-emerald-700" />
                    Key Responsibilities
                  </div>
                  <textarea
                    value={form.description}
                    onChange={(e) => setField('description', e.target.value)}
                    placeholder="List the key responsibilities, KPIs, and accountabilities for this designation…"
                    rows={4}
                    className={`${inputCls} resize-y`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg flex items-center gap-2 transition cursor-pointer shadow-xs"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {editingDesignation ? 'Save Changes' : 'Add Designation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Delete Designation?</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Designation <span className="font-bold text-slate-700">"{deleteTarget.name}"</span> will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition cursor-pointer"
              >
                Delete Designation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
