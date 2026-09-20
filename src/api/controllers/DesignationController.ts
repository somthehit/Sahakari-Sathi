import { Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../db/client';
import { departments, designations } from '../../db/schema';

export const createDesignationSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Designation name is required'),
    code: z.string().optional().or(z.literal('')),
    reportsToId: z.string().uuid('Invalid reporting designation').optional().or(z.literal('')),
    jobGrade: z.string().optional().or(z.literal('')),
    minSalary: z.number().optional(),
    maxSalary: z.number().optional(),
    allowanceEligible: z.boolean().optional(),
    approvalLimit: z.number().optional(),
    systemAccessRole: z.string().optional().or(z.literal('')),
    pearlsRole: z.string().optional().or(z.literal('')),
    employmentType: z.string().optional().or(z.literal('')),
    description: z.string().optional().or(z.literal('')),
    status: z.string().optional(),
  }),
});

export const updateDesignationSchema = z.object({
  body: createDesignationSchema.shape.body.partial(),
});

interface OrgUser {
  organizationId?: string;
}

const num = (v: unknown): string | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : String(n);
};

const designationSelect = {
  id: designations.id,
  departmentId: designations.departmentId,
  name: designations.name,
  code: designations.code,
  reportsToId: designations.reportsToId,
  jobGrade: designations.jobGrade,
  minSalary: designations.minSalary,
  maxSalary: designations.maxSalary,
  allowanceEligible: designations.allowanceEligible,
  approvalLimit: designations.approvalLimit,
  systemAccessRole: designations.systemAccessRole,
  pearlsRole: designations.pearlsRole,
  employmentType: designations.employmentType,
  description: designations.description,
  status: designations.status,
};

export class DesignationController {
  /** All designations belonging to the caller's organization (joined via departments). */
  static async getDesignations(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });

      const rows = await db.select(designationSelect).from(designations)
        .innerJoin(departments, eq(departments.id, designations.departmentId))
        .where(eq(departments.organizationId, organizationId));

      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** Designations for a single department (org-scoped). */
  static async getDesignationsByDepartment(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const departmentId = req.params.id;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const [department] = await db.select().from(departments).where(eq(departments.id, departmentId)).limit(1);
      if (!department) return res.status(404).json({ error: 'Department not found' });
      if (organizationId && department.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Not authorized to view this department.' });
      }

      const rows = await db.select(designationSelect).from(designations)
        .where(eq(designations.departmentId, departmentId))
        .orderBy(designations.name);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** Create a designation under a department. */
  static async createDesignation(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const departmentId = req.params.id;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const [department] = await db.select().from(departments).where(eq(departments.id, departmentId)).limit(1);
      if (!department) return res.status(404).json({ error: 'Department not found' });
      if (organizationId && department.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Not authorized to add designations to this department.' });
      }

      const body = req.body;
      const [existing] = await db.select({ id: designations.id })
        .from(designations)
        .where(and(
          eq(designations.departmentId, departmentId),
          eq(designations.name, String(body.name).trim()),
        ))
        .limit(1);
      if (existing) {
        return res.status(409).json({ error: 'A designation with this name already exists in the department.' });
      }

      const [designation] = await db.insert(designations).values({
        departmentId,
        name: String(body.name).trim(),
        code: body.code || null,
        reportsToId: body.reportsToId || null,
        jobGrade: body.jobGrade || null,
        minSalary: num(body.minSalary) ?? '0',
        maxSalary: num(body.maxSalary) ?? '0',
        allowanceEligible: !!body.allowanceEligible,
        approvalLimit: num(body.approvalLimit) ?? '0',
        systemAccessRole: body.systemAccessRole || null,
        pearlsRole: body.pearlsRole || null,
        employmentType: body.employmentType || null,
        description: body.description || null,
        status: body.status || 'Active',
      }).returning();

      res.status(201).json(designation);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** Update a designation's fields. */
  static async updateDesignation(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const [designation] = await db.select().from(designations).where(eq(designations.id, req.params.id)).limit(1);
      if (!designation) return res.status(404).json({ error: 'Designation not found' });

      const [department] = await db.select().from(departments).where(eq(departments.id, designation.departmentId)).limit(1);
      if (organizationId && (!department || department.organizationId !== organizationId)) {
        return res.status(403).json({ error: 'Not authorized to edit this designation.' });
      }

      const body = req.body;
      if (body.name) {
        const [dup] = await db.select({ id: designations.id })
          .from(designations)
          .where(and(
            eq(designations.departmentId, designation.departmentId),
            eq(designations.name, String(body.name).trim()),
          ))
          .limit(1);
        if (dup && dup.id !== designation.id) {
          return res.status(409).json({ error: 'A designation with this name already exists in the department.' });
        }
      }

      const update: Record<string, any> = {};
      if (body.name !== undefined) update.name = String(body.name).trim();
      if (body.code !== undefined) update.code = body.code === '' ? null : body.code;
      if (body.reportsToId !== undefined) update.reportsToId = body.reportsToId === '' ? null : body.reportsToId;
      if (body.jobGrade !== undefined) update.jobGrade = body.jobGrade === '' ? null : body.jobGrade;
      if (body.minSalary !== undefined) update.minSalary = num(body.minSalary) ?? '0';
      if (body.maxSalary !== undefined) update.maxSalary = num(body.maxSalary) ?? '0';
      if (body.allowanceEligible !== undefined) update.allowanceEligible = !!body.allowanceEligible;
      if (body.approvalLimit !== undefined) update.approvalLimit = num(body.approvalLimit) ?? '0';
      if (body.systemAccessRole !== undefined) update.systemAccessRole = body.systemAccessRole === '' ? null : body.systemAccessRole;
      if (body.pearlsRole !== undefined) update.pearlsRole = body.pearlsRole === '' ? null : body.pearlsRole;
      if (body.employmentType !== undefined) update.employmentType = body.employmentType === '' ? null : body.employmentType;
      if (body.description !== undefined) update.description = body.description === '' ? null : body.description;
      if (body.status !== undefined) update.status = body.status;

      const [updated] = await db.update(designations)
        .set(update)
        .where(eq(designations.id, req.params.id))
        .returning();
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** Delete a designation (org-scoped). */
  static async deleteDesignation(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const [designation] = await db.select().from(designations).where(eq(designations.id, req.params.id)).limit(1);
      if (!designation) return res.status(404).json({ error: 'Designation not found' });

      const [department] = await db.select().from(departments).where(eq(departments.id, designation.departmentId)).limit(1);
      if (organizationId && (!department || department.organizationId !== organizationId)) {
        return res.status(403).json({ error: 'Not authorized to delete this designation.' });
      }

      await db.delete(designations).where(eq(designations.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
