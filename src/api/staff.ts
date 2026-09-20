import { apiClient } from '../lib/apiClient';

export interface StaffErp {
  id: string;
  username: string;
  email: string | null;
  authUserId: string | null;
  roleId: string | null;
  role: string | null;
  status: string | null;
  requiresPasswordChange: boolean;
  securityScore: number;
  lastLoginAt: string | null;
  lastActivityAt: string | null;
  branchId: string | null;
  dataScope: string | null;
}

export interface Staff {
  id: string;
  organizationId: string;
  employeeCode: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  gender: string | null;
  dob: string | null;
  citizenshipNumber: string | null;
  passportNumber: string | null;
  panNumber: string | null;
  phone: string | null;
  email: string;
  photoUrl: string | null;
  category: string | null;
  isFinancialStaff: boolean;
  departmentId: string | null;
  designationId: string | null;
  experience: string | null;
  branchId: string | null;
  enableErpLogin: boolean;
  joiningDate: string | null;
  employmentType: string | null;
  basicSalary: string;
  allowances: string;
  pfContributionPercent: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  department: string | null;
  designation: string | null;
  branchName: string | null;
  branchCode: string | null;
  erp: StaffErp | null;
}

export interface SystemAccessInput {
  username: string;
  email: string;
  roleId: string;
  branchId?: string | null;
  dataScope?: string | null;
}

export interface StaffPayload {
  staff: Partial<Staff>;
  enableErpLogin: boolean;
  systemAccess?: SystemAccessInput | null;
}

export interface StaffCreateResult {
  staff: Staff;
  temporaryPassword?: string;
}

export const fetchStaffList = async (): Promise<Staff[]> => {
  const response = await apiClient.get('/staff');
  const data = response.data;
  // Guard: API might return HTML (e.g. if backend isn't running)
  if (typeof data === 'string') {
    console.error('[fetchStaffList] Expected JSON but got string response. Is the backend server running?');
    return [];
  }
  return Array.isArray(data) ? data : (data?.staff ?? data?.data ?? data?.items ?? []);
};

export const fetchStaffById = async (id: string): Promise<Staff> => {
  const { data } = await apiClient.get<Staff>(`/staff/${id}`);
  return data;
};

export const createStaff = async (payload: StaffPayload): Promise<StaffCreateResult> => {
  const { data } = await apiClient.post<StaffCreateResult>('/staff', payload);
  return data;
};

export const updateStaff = async (id: string, payload: StaffPayload): Promise<StaffCreateResult> => {
  const { data } = await apiClient.put<StaffCreateResult>(`/staff/${id}`, payload);
  return data;
};

export const deleteStaff = async (id: string): Promise<{ message: string; id: string }> => {
  const { data } = await apiClient.delete<{ message: string; id: string }>(`/staff/${id}`);
  return data;
};

// ============================================
// Org reference data (staff form dropdowns)
// ============================================
export interface RefDepartment {
  id: string;
  name: string;
}

export interface RefDesignation {
  id: string;
  departmentId: string;
  name: string;
}

export interface RefRole {
  id: string;
  name: string;
  isSystem: boolean;
  status: string;
}

export interface RefBranch {
  id: string;
  code: string;
  name: string;
}

export interface OrgReference {
  departments: RefDepartment[];
  designations: RefDesignation[];
  roles: RefRole[];
  branches: RefBranch[];
}

export const fetchOrgReference = async (): Promise<OrgReference> => {
  const response = await apiClient.get('/org/reference');
  const data = response.data;
  if (typeof data === 'string' || !data || typeof data !== 'object') {
    return { departments: [], designations: [], roles: [], branches: [] };
  }
  return {
    departments: Array.isArray(data.departments) ? data.departments : [],
    designations: Array.isArray(data.designations) ? data.designations : [],
    roles: Array.isArray(data.roles) ? data.roles : [],
    branches: Array.isArray(data.branches) ? data.branches : [],
  };
};
