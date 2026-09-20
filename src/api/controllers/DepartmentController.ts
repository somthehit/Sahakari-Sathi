import { Request, Response } from 'express';
import { eq, and, or, ne } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '../../db/client';
import { departments } from '../../db/schema';

export const createDepartmentSchema = z.object({
  body: z.object({
    code: z.string().min(1, 'Department code is required'),
    name: z.string().min(2, 'Department name is required'),
    headOfDepartment: z.string().optional(),
    branchId: z.string().uuid('Invalid branch').optional().or(z.literal('')),
    staffCount: z.number().optional(),
    budgetAllocation: z.number().optional(),
    usedBudget: z.number().optional(),
    description: z.string().optional(),
    costCenterCode: z.string().optional(),
    status: z.string().optional(),
  }),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

const num = (v: unknown): string | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  return String(v);
};

interface OrgUser {
  organizationId?: string;
}

export class DepartmentController {
  static async getDepartments(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });
      const rows = await db.select().from(departments)
        .where(eq(departments.organizationId, organizationId))
        .orderBy(departments.code);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getDepartment(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });
      const [row] = await db.select().from(departments)
        .where(and(eq(departments.id, req.params.id), eq(departments.organizationId, organizationId)))
        .limit(1);
      if (!row) return res.status(404).json({ error: 'Department not found' });
      res.json(row);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createDepartment(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const body = req.body;

      const [existing] = await db.select({ id: departments.id })
        .from(departments)
        .where(and(
          eq(departments.organizationId, organizationId),
          or(eq(departments.code, String(body.code).trim()), eq(departments.name, String(body.name).trim()))
        ))
        .limit(1);
      if (existing) {
        return res.status(409).json({ error: 'Department with this code or name already exists.' });
      }

      const [department] = await db.insert(departments).values({
        organizationId,
        code: String(body.code).trim(),
        name: String(body.name).trim(),
        headOfDepartment: body.headOfDepartment || null,
        branchId: body.branchId || null,
        staffCount: Number(body.staffCount) || 0,
        budgetAllocation: num(body.budgetAllocation) ?? '0',
        usedBudget: num(body.usedBudget) ?? '0',
        description: body.description || null,
        costCenterCode: body.costCenterCode || null,
        status: body.status || 'Active',
      }).returning();

      res.status(201).json(department);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateDepartment(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const body = req.body;

      const [existing] = await db.select().from(departments).where(eq(departments.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Department not found' });
      if (organizationId && existing.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Not authorized to edit this department.' });
      }

      if (body.code || body.name) {
        const dupConditions = [];
        if (body.code) dupConditions.push(eq(departments.code, String(body.code).trim()));
        if (body.name) dupConditions.push(eq(departments.name, String(body.name).trim()));
        const [dup] = await db.select({ id: departments.id })
          .from(departments)
          .where(and(
            eq(departments.organizationId, existing.organizationId),
            or(...dupConditions),
            ne(departments.id, existing.id),
          ))
          .limit(1);
        if (dup) {
          return res.status(409).json({ error: 'Department with this code or name already exists.' });
        }
      }

      const update: Record<string, any> = {};
      const fieldMap: Record<string, string> = {
        code: 'code', name: 'name', headOfDepartment: 'headOfDepartment',
        branchId: 'branchId', description: 'description', costCenterCode: 'costCenterCode',
        status: 'status',
      };
      for (const [key, col] of Object.entries(fieldMap)) {
        if (body[key] !== undefined) update[col] = body[key] === '' ? null : body[key];
      }
      if (body.staffCount !== undefined) update.staffCount = Number(body.staffCount);
      if (body.budgetAllocation !== undefined) update.budgetAllocation = num(body.budgetAllocation);
      if (body.usedBudget !== undefined) update.usedBudget = num(body.usedBudget);

      const [department] = await db.update(departments)
        .set({ ...update, updatedAt: new Date() })
        .where(eq(departments.id, req.params.id))
        .returning();
      res.json(department);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteDepartment(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');

      const [existing] = await db.select().from(departments).where(eq(departments.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Department not found' });
      if (organizationId && existing.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Not authorized to delete this department.' });
      }

      await db.delete(departments).where(eq(departments.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
