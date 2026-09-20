/**
 * Staff Repository
 * Staff-first HR model: `employees` is the master record; ERP user accounts
 * (org_users → auth.users) are optional 0..1 per staff, created only when
 * Enable ERP Login = Yes.
 */
import { eq, and, asc, count, inArray } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { employees, orgUsers, roles, departments, designations } from '../../db/schema';
import { branches } from '../../db/schema/branches';

const USERNAME_RE = /^[a-z][a-z0-9_.]{2,29}$/;

const STAFF_SELECT = {
  id: employees.id,
  organizationId: employees.organizationId,
  employeeCode: employees.employeeCode,
  firstName: employees.firstName,
  middleName: employees.middleName,
  lastName: employees.lastName,
  gender: employees.gender,
  dob: employees.dob,
  citizenshipNumber: employees.citizenshipNumber,
  passportNumber: employees.passportNumber,
  panNumber: employees.panNumber,
  phone: employees.phone,
  email: employees.email,
  photoUrl: employees.photoUrl,
  category: employees.category,
  isFinancialStaff: employees.isFinancialStaff,
  departmentId: employees.departmentId,
  designationId: employees.designationId,
  experience: employees.experience,
  branchId: employees.branchId,
  enableErpLogin: employees.enableErpLogin,
  joiningDate: employees.joiningDate,
  employmentType: employees.employmentType,
  basicSalary: employees.basicSalary,
  allowances: employees.allowances,
  pfContributionPercent: employees.pfContributionPercent,
  status: employees.status,
  createdAt: employees.createdAt,
  updatedAt: employees.updatedAt,
  // ERP account (0..1) — null when NO LOGIN
  orgUserId: orgUsers.id,
  username: orgUsers.username,
  userEmail: orgUsers.email,
  authUserId: orgUsers.authUserId,
  roleId: orgUsers.roleId,
  role: roles.name,
  userStatus: orgUsers.status,
  requiresPasswordChange: orgUsers.requiresPasswordChange,
  securityScore: orgUsers.securityScore,
  lastLoginAt: orgUsers.lastLoginAt,
  lastActivityAt: orgUsers.lastActivityAt,
  userBranchId: orgUsers.branchId,
  dataScope: orgUsers.dataScope,
  // Joined reference data
  department: departments.name,
  designation: designations.name,
  branchName: branches.name,
  branchCode: branches.code,
} as const;

export class StaffRepository {
  private get db() {
    const db = getDb();
    if (!db) throw new Error('Database not connected.');
    return db;
  }

  private toStaff(row: Record<string, any>) {
    const fullName = [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' ');
    return {
      id: row.id,
      organizationId: row.organizationId,
      employeeCode: row.employeeCode,
      firstName: row.firstName,
      middleName: row.middleName,
      lastName: row.lastName,
      fullName,
      gender: row.gender,
      dob: row.dob,
      citizenshipNumber: row.citizenshipNumber,
      passportNumber: row.passportNumber,
      panNumber: row.panNumber,
      phone: row.phone,
      email: row.email,
      photoUrl: row.photoUrl,
      category: row.category,
      isFinancialStaff: row.isFinancialStaff,
      departmentId: row.departmentId,
      designationId: row.designationId,
      experience: row.experience,
      branchId: row.branchId,
      enableErpLogin: row.enableErpLogin,
      joiningDate: row.joiningDate,
      employmentType: row.employmentType,
      basicSalary: row.basicSalary,
      allowances: row.allowances,
      pfContributionPercent: row.pfContributionPercent,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      department: row.department,
      designation: row.designation,
      branchName: row.branchName,
      branchCode: row.branchCode,
      // ERP account (null = NO LOGIN)
      erp: row.orgUserId
        ? {
            id: row.orgUserId,
            username: row.username,
            email: row.userEmail,
            authUserId: row.authUserId,
            roleId: row.roleId,
            role: row.role,
            status: row.userStatus,
            requiresPasswordChange: row.requiresPasswordChange,
            securityScore: row.securityScore,
            lastLoginAt: row.lastLoginAt,
            lastActivityAt: row.lastActivityAt,
            branchId: row.userBranchId,
            dataScope: row.dataScope,
          }
        : null,
    };
  }

  private staffBaseQuery() {
    return this.db.select(STAFF_SELECT)
      .from(employees)
      .leftJoin(orgUsers, eq(orgUsers.employeeId, employees.id))
      .leftJoin(roles, eq(orgUsers.roleId, roles.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(designations, eq(employees.designationId, designations.id))
      .leftJoin(branches, eq(employees.branchId, branches.id));
  }

  // =============================================
  // QUERIES
  // =============================================
  async getStaffList(organizationId: string, branchIds?: string[]) {
    const rows = await this.staffBaseQuery()
      .where(and(
        eq(employees.organizationId, organizationId),
        ...(branchIds !== undefined ? [inArray(employees.branchId, branchIds)] : [])
      ))
      .orderBy(asc(employees.firstName));
    return rows.map((r) => this.toStaff(r as any));
  }

  async getStaffById(organizationId: string, id: string, branchIds?: string[]) {
    const rows = await this.staffBaseQuery()
      .where(and(
        eq(employees.organizationId, organizationId),
        eq(employees.id, id),
        ...(branchIds !== undefined ? [inArray(employees.branchId, branchIds)] : [])
      ))
      .limit(1);
    return rows.length > 0 ? this.toStaff(rows[0] as any) : null;
  }

  async countEmployees(organizationId: string): Promise<number> {
    const rows = await this.db.select({ n: count() })
      .from(employees)
      .where(eq(employees.organizationId, organizationId));
    return Number(rows[0]?.n ?? 0);
  }

  // =============================================
  // MUTATIONS
  // =============================================
  /**
   * Single transaction: insert the staff record and — when an ERP account is
   * requested — the org_users row. The Supabase auth user must be created by
   * the service BEFORE calling this (outside the DB tx).
   */
  async createStaffWithUser(payload: {
    organizationId: string;
    employee: typeof employees.$inferInsert;
    orgUser?: {
      username: string;
      email: string;
      roleId: string;
      branchId?: string | null;
      dataScope?: string | null;
      authUserId: string;
    };
  }) {
    return this.db.transaction(async (tx) => {
      const [employee] = await tx.insert(employees).values(payload.employee).returning();

      let orgUser = null;
      if (payload.orgUser) {
        const username = payload.orgUser.username.toLowerCase();
        if (!USERNAME_RE.test(username)) {
          throw new Error('Username must be 3-30 lowercase alphanumeric characters (letters, numbers, underscores, dots).');
        }
        const [existing] = await tx.select({ id: orgUsers.id })
          .from(orgUsers)
          .where(and(eq(orgUsers.organizationId, payload.organizationId), eq(orgUsers.username, username)))
          .limit(1);
        if (existing) throw new Error(`Username '${payload.orgUser.username}' is already taken in this organization.`);

        [orgUser] = await tx.insert(orgUsers).values({
          organizationId: payload.organizationId,
          employeeId: employee.id,
          username,
          email: payload.orgUser.email,
          emailVerified: false,
          authUserId: payload.orgUser.authUserId,
          roleId: payload.orgUser.roleId,
          branchId: payload.orgUser.branchId ?? null,
          dataScope: payload.orgUser.dataScope ?? 'own',
          requiresPasswordChange: true,
          isTemporaryPassword: true,
          temporaryPassword: true,
          passwordChanged: false,
          passwordCreatedAt: new Date(),
          securityScore: 0,
          status: 'Active',
          createdBy: null,
        }).returning();
      }

      return { employee, orgUser };
    });
  }

  /** Enable ERP login on an existing staff record (promotes staff → user). */
  async createOrgUserForStaff(organizationId: string, employeeId: string, data: {
    username: string;
    email: string;
    roleId: string;
    branchId?: string | null;
    dataScope?: string | null;
    authUserId: string;
  }) {
    return this.db.transaction(async (tx) => {
      const username = data.username.toLowerCase();
      if (!USERNAME_RE.test(username)) {
        throw new Error('Username must be 3-30 lowercase alphanumeric characters (letters, numbers, underscores, dots).');
      }
      const [emp] = await tx.select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.id, employeeId), eq(employees.organizationId, organizationId)))
        .limit(1);
      if (!emp) throw new Error('Staff record not found.');

      const [existingUser] = await tx.select({ id: orgUsers.id })
        .from(orgUsers)
        .where(and(eq(orgUsers.organizationId, organizationId), eq(orgUsers.employeeId, employeeId)))
        .limit(1);
      if (existingUser) throw new Error('This staff member already has an ERP login account.');

      const [existing] = await tx.select({ id: orgUsers.id })
        .from(orgUsers)
        .where(and(eq(orgUsers.organizationId, organizationId), eq(orgUsers.username, username)))
        .limit(1);
      if (existing) throw new Error(`Username '${data.username}' is already taken in this organization.`);

      const [orgUser] = await tx.insert(orgUsers).values({
        organizationId,
        employeeId,
        username,
        email: data.email,
        emailVerified: false,
        authUserId: data.authUserId,
        roleId: data.roleId,
        branchId: data.branchId ?? null,
        dataScope: data.dataScope ?? 'own',
        requiresPasswordChange: true,
        isTemporaryPassword: true,
        temporaryPassword: true,
        passwordChanged: false,
        passwordCreatedAt: new Date(),
        securityScore: 0,
        status: 'Active',
      }).returning();

      await tx.update(employees)
        .set({ enableErpLogin: true, updatedAt: new Date() })
        .where(eq(employees.id, employeeId));

      return orgUser;
    });
  }

  /** Disable ERP login: deactivate the org_user (employment history untouched). */
  async disableStaffErpLogin(organizationId: string, employeeId: string) {
    return this.db.transaction(async (tx) => {
      const [orgUser] = await tx.update(orgUsers)
        .set({ status: 'Suspended', updatedAt: new Date() })
        .where(and(eq(orgUsers.organizationId, organizationId), eq(orgUsers.employeeId, employeeId)))
        .returning();

      await tx.update(employees)
        .set({ enableErpLogin: false, updatedAt: new Date() })
        .where(and(eq(employees.id, employeeId), eq(employees.organizationId, organizationId)));

      return orgUser ?? null;
    });
  }

  async updateEmployee(organizationId: string, id: string, data: Partial<typeof employees.$inferInsert>) {
    const rows = await this.db.update(employees)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(employees.id, id), eq(employees.organizationId, organizationId)))
      .returning();
    return rows[0] ?? null;
  }

  async updateOrgUserById(organizationId: string, employeeId: string, data: Partial<typeof orgUsers.$inferInsert>) {
    const rows = await this.db.update(orgUsers)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(orgUsers.organizationId, organizationId), eq(orgUsers.employeeId, employeeId)))
      .returning();
    return rows[0] ?? null;
  }

  /** Delete staff + linked org_user. Returns authUserId so the service can deactivate Supabase auth. */
  async deleteStaff(organizationId: string, employeeId: string) {
    return this.db.transaction(async (tx) => {
      const [orgUser] = await tx.select({ id: orgUsers.id, authUserId: orgUsers.authUserId })
        .from(orgUsers)
        .where(and(eq(orgUsers.organizationId, organizationId), eq(orgUsers.employeeId, employeeId)))
        .limit(1);

      if (orgUser) {
        await tx.delete(orgUsers).where(eq(orgUsers.id, orgUser.id));
      }

      const rows = await tx.delete(employees)
        .where(and(eq(employees.id, employeeId), eq(employees.organizationId, organizationId)))
        .returning();

      if (rows.length === 0) throw new Error('Staff record not found.');
      return { employee: rows[0], authUserId: orgUser?.authUserId ?? null };
    });
  }
}
