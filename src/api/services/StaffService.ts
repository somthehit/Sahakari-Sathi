/**
 * Staff Service
 * Implements the staff-first HR model:
 *  1. staff record is the master (employees table)
 *  2. ERP login is optional — created only when Enable ERP Login = Yes
 *  3. Save is a single workflow: staff → auth.users → org_users → hashed
 *     password → welcome email → forced password change on first login
 */
import { AuthRepository } from '../repositories/AuthRepository';
import { StaffRepository } from '../repositories/StaffRepository';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { sendWelcomeEmail } from '../../lib/emailService';
import { generatePassword } from '../../utils/generatePassword';
import { employees, orgUsers } from '../../db/schema';

export interface SystemAccessInput {
  username: string;
  email: string;
  roleId: string;
  branchId?: string | null;
  dataScope?: string | null;
}

export interface CreateStaffInput {
  organizationId: string;
  staff: {
    firstName: string;
    middleName?: string | null;
    lastName: string;
    email: string;
    gender?: string | null;
    dob?: string | Date | null;
    phone?: string | null;
    employeeCode?: string | null;
    photoUrl?: string | null;
    category?: string | null;
    isFinancialStaff?: boolean;
    departmentId?: string | null;
    designationId?: string | null;
    branchId?: string | null;
    citizenshipNumber?: string | null;
    passportNumber?: string | null;
    panNumber?: string | null;
    experience?: string | null;
    joiningDate?: string | Date | null;
    employmentType?: string | null;
    basicSalary?: string | number | null;
    allowances?: string | number | null;
    pfContributionPercent?: string | number | null;
    status?: string | null;
  };
  enableErpLogin: boolean;
  systemAccess?: SystemAccessInput | null;
}

const EMPLOYEE_UPDATE_FIELDS = [
  'firstName', 'middleName', 'lastName', 'gender', 'dob', 'citizenshipNumber',
  'passportNumber', 'panNumber', 'phone', 'email', 'photoUrl', 'category',
  'isFinancialStaff', 'departmentId', 'designationId', 'experience', 'branchId',
  'joiningDate', 'employmentType', 'basicSalary', 'allowances', 'pfContributionPercent', 'status',
] as const;

export class StaffService {
  private repo: StaffRepository;
  private authRepo: AuthRepository;

  constructor() {
    this.repo = new StaffRepository();
    this.authRepo = new AuthRepository();
  }

  private syntheticEmail(username: string, orgCode: string): string {
    return `${username.toLowerCase()}@${orgCode.toLowerCase()}.sahakarisathi.internal`;
  }

  getStaffList(organizationId: string, branchIds?: string[]) {
    return this.repo.getStaffList(organizationId, branchIds);
  }

  getStaffById(organizationId: string, staffId: string, branchIds?: string[]) {
    return this.repo.getStaffById(organizationId, staffId, branchIds);
  }

  private coerceDate(v?: string | Date | null): Date | null {
    if (!v) return null;
    return v instanceof Date ? v : new Date(v);
  }

  private employeeInsert(staff: CreateStaffInput['staff'], organizationId: string): typeof employees.$inferInsert {
    return {
      organizationId,
      employeeCode: staff.employeeCode?.trim() || undefined, // assigned in create
      firstName: staff.firstName.trim(),
      middleName: staff.middleName?.trim() || null,
      lastName: staff.lastName.trim(),
      email: staff.email.trim().toLowerCase(),
      gender: staff.gender || null,
      dob: this.coerceDate(staff.dob),
      citizenshipNumber: staff.citizenshipNumber?.trim() || null,
      passportNumber: staff.passportNumber?.trim() || null,
      panNumber: staff.panNumber?.trim() || null,
      phone: staff.phone?.trim() || null,
      photoUrl: staff.photoUrl || null,
      category: staff.category || 'Non Financial Staff',
      isFinancialStaff: staff.isFinancialStaff ?? false,
      departmentId: staff.departmentId || null,
      designationId: staff.designationId || null,
      experience: staff.experience || null,
      branchId: staff.branchId || null,
      enableErpLogin: false,
      joiningDate: this.coerceDate(staff.joiningDate),
      employmentType: staff.employmentType || null,
      basicSalary: staff.basicSalary != null ? String(staff.basicSalary) : '0',
      allowances: staff.allowances != null ? String(staff.allowances) : '0',
      pfContributionPercent: staff.pfContributionPercent != null ? String(staff.pfContributionPercent) : '10',
      status: (staff.status || 'Active') as any,
    };
  }

  // =============================================
  // CREATE — single workflow: staff → auth → org_users → email
  // =============================================
  async createStaff(input: CreateStaffInput) {
    const { organizationId, staff } = input;
    const enableErpLogin = !!input.enableErpLogin;
    const systemAccess = enableErpLogin ? input.systemAccess : undefined;

    if (!staff.firstName?.trim() || !staff.lastName?.trim()) {
      throw new Error('First name and last name are required.');
    }
    if (!staff.email?.trim()) {
      throw new Error('Email is required.');
    }
    if (enableErpLogin && (!systemAccess?.username || !systemAccess.email || !systemAccess.roleId)) {
      throw new Error('Enable ERP Login requires username, email, and role.');
    }

    const employee = this.employeeInsert(staff, organizationId);
    if (!employee.employeeCode) {
      const count = await this.repo.countEmployees(organizationId);
      employee.employeeCode = `STF-${String(count + 1).padStart(3, '0')}`;
    }

    const org = await this.authRepo.getOrganizationById(organizationId);
    if (!org) throw new Error('Organization not found.');

    let temporaryPassword: string | undefined;
    let authUserId: string | undefined;

    if (enableErpLogin) {
      // 1. Generate temp password
      temporaryPassword = generatePassword();
      const username = systemAccess!.username.toLowerCase();

      // 2. Create Supabase auth user (OUTSIDE DB tx)
      const { data: authData, error } = await supabaseAdmin.auth.admin.createUser({
        email: this.syntheticEmail(username, org.organizationCode),
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { username },
      });
      if (error) {
        if (error.message.includes('already been registered')) {
          throw new Error(`User already exists for this username.`);
        }
        throw new Error(`Supabase user creation failed: ${error.message}`);
      }
      if (!authData.user) throw new Error('Supabase user creation failed: No user returned.');
      authUserId = authData.user.id;
    }

    try {
      // 3. DB transaction: staff + org_users (single atomic save)
      const result = await this.repo.createStaffWithUser({
        organizationId,
        employee,
        orgUser: enableErpLogin
          ? {
              username: systemAccess!.username,
              email: systemAccess!.email.toLowerCase(),
              roleId: systemAccess!.roleId,
              branchId: systemAccess!.branchId ?? null,
              dataScope: systemAccess!.dataScope ?? 'own',
              authUserId: authUserId!,
            }
          : undefined,
      });

      // 4. Welcome email (non-blocking)
      if (enableErpLogin) {
        this.sendWelcome(org.organizationName, org.organizationCode, {
          username: systemAccess!.username,
          temporaryPassword: temporaryPassword!,
          email: systemAccess!.email,
          fullName: [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' '),
        });
      }

      const created = await this.repo.getStaffById(organizationId, result.employee.id);
      return { staff: created, temporaryPassword: enableErpLogin ? temporaryPassword : undefined };
    } catch (err) {
      // Compensation — roll back the Supabase user if the DB save failed
      if (authUserId) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(authUserId);
        } catch { /* best-effort */ }
      }
      throw err;
    }
  }

  // =============================================
  // UPDATE — handles ERP enable/disable transitions
  // =============================================
  async updateStaff(organizationId: string, staffId: string, input: {
    staff?: CreateStaffInput['staff'];
    enableErpLogin?: boolean;
    systemAccess?: SystemAccessInput | null;
  }) {
    const current = await this.repo.getStaffById(organizationId, staffId);
    if (!current) throw new Error('Staff record not found.');

    const employeeUpdate: Partial<typeof employees.$inferInsert> = {};
    if (input.staff) {
      for (const field of EMPLOYEE_UPDATE_FIELDS) {
        const value = input.staff[field as keyof CreateStaffInput['staff']];
        if (value === undefined) continue;
        if (field === 'dob' || field === 'joiningDate') {
          (employeeUpdate as any)[field] = this.coerceDate(value as any);
        } else if (field === 'email' && value) {
          (employeeUpdate as any)[field] = (value as string).trim().toLowerCase();
        } else if (field === 'basicSalary' || field === 'allowances' || field === 'pfContributionPercent') {
          (employeeUpdate as any)[field] = value === '' || value == null ? undefined : String(value);
        } else if (value === '') {
          (employeeUpdate as any)[field] = null;
        } else {
          (employeeUpdate as any)[field] = value;
        }
      }
      if (input.staff.category !== undefined || input.staff.isFinancialStaff !== undefined) {
        employeeUpdate.category = input.staff.category || current.category;
        employeeUpdate.isFinancialStaff = input.staff.isFinancialStaff ?? current.isFinancialStaff;
      }
    }

    const enableRequested = input.enableErpLogin ?? current.enableErpLogin;
    const systemAccess = enableRequested ? input.systemAccess : undefined;

    // ── ERP transition: OFF → ON
    if (enableRequested && !current.enableErpLogin) {
      if (!systemAccess?.username || !systemAccess.email || !systemAccess.roleId) {
        throw new Error('Enable ERP Login requires username, email, and role.');
      }
      const org = await this.authRepo.getOrganizationById(organizationId);
      if (!org) throw new Error('Organization not found.');

      const temporaryPassword = generatePassword();
      const username = systemAccess.username.toLowerCase();
      const { data: authData, error } = await supabaseAdmin.auth.admin.createUser({
        email: this.syntheticEmail(username, org.organizationCode),
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { username },
      });
      if (error) throw new Error(`Supabase user creation failed: ${error.message}`);
      if (!authData.user) throw new Error('Supabase user creation failed: No user returned.');

      try {
        await this.repo.createOrgUserForStaff(organizationId, staffId, {
          username,
          email: systemAccess.email.toLowerCase(),
          roleId: systemAccess.roleId,
          branchId: systemAccess.branchId ?? null,
          dataScope: systemAccess.dataScope ?? 'own',
          authUserId: authData.user.id,
        });
        if (employeeUpdate.email) {
          await this.repo.updateOrgUserById(organizationId, staffId, { email: employeeUpdate.email as string });
        }
        this.sendWelcome(org.organizationName, org.organizationCode, {
          username,
          temporaryPassword,
          email: systemAccess.email.toLowerCase(),
          fullName: current.fullName,
        });

        await this.repo.updateEmployee(organizationId, staffId, employeeUpdate);
        const updated = await this.repo.getStaffById(organizationId, staffId);
        return { staff: updated, temporaryPassword };
      } catch (err) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        } catch { /* best-effort */ }
        throw err;
      }
    }

    // ── ERP transition: ON → OFF (deactivate account, keep employment history)
    if (!enableRequested && current.enableErpLogin && current.erp) {
      const orgUser = await this.repo.disableStaffErpLogin(organizationId, staffId);
      if (orgUser?.authUserId) {
        try {
          await supabaseAdmin.auth.admin.updateUserById(orgUser.authUserId, { ban_duration: '8760h' });
          await supabaseAdmin.auth.admin.signOut(orgUser.authUserId, 'global');
        } catch { /* best-effort */ }
      }
      await this.repo.updateEmployee(organizationId, staffId, employeeUpdate);
      const updated = await this.repo.getStaffById(organizationId, staffId);
      return { staff: updated, temporaryPassword: undefined };
    }

    // ── No ERP transition — update staff + (optionally) role/branch/scope
    await this.repo.updateEmployee(organizationId, staffId, employeeUpdate);
    if (current.erp && systemAccess) {
      const scopeUpdate: Partial<typeof orgUsers.$inferInsert> = {};
      if (systemAccess.roleId) scopeUpdate.roleId = systemAccess.roleId;
      if (systemAccess.branchId !== undefined) scopeUpdate.branchId = systemAccess.branchId || null;
      if (systemAccess.dataScope !== undefined) scopeUpdate.dataScope = systemAccess.dataScope || 'own';
      if (systemAccess.email) scopeUpdate.email = systemAccess.email.toLowerCase();
      if (Object.keys(scopeUpdate).length > 0) {
        await this.repo.updateOrgUserById(organizationId, staffId, scopeUpdate);
      }
    }

    const updated = await this.repo.getStaffById(organizationId, staffId);
    return { staff: updated, temporaryPassword: undefined };
  }

  // =============================================
  // DELETE — remove staff + linked account
  // =============================================
  async deleteStaff(organizationId: string, staffId: string) {
    const result = await this.repo.deleteStaff(organizationId, staffId);
    if (result.authUserId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(result.authUserId);
      } catch { /* best-effort */ }
    }
    return result.employee;
  }

  // =============================================
  // HELPERS
  // =============================================
  private sendWelcome(organizationName: string, organizationCode: string, d: {
    username: string;
    temporaryPassword: string;
    email: string;
    fullName: string;
  }) {
    sendWelcomeEmail({
      organizationName,
      organizationCode,
      username: d.username,
      temporaryPassword: d.temporaryPassword,
      adminEmail: d.email,
      adminFullName: d.fullName,
    }).catch(() => { /* non-blocking */ });
  }
}
