import { Request, Response } from 'express';
import { eq, and, or, ne, count } from 'drizzle-orm';
import { getDb } from '../../db/client';
import {
  branches, employees, orgUsers, members, savingsAccounts, loanAccounts, vouchers,
} from '../../db/schema';
import { buildAuditRow, writeAuditLog } from '../utils/audit';
import { createBranchSchema, updateBranchSchema } from '../schemas/organizationSettings';

export { createBranchSchema, updateBranchSchema };

const num = (v: unknown): string | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  return String(v);
};

interface OrgUser {
  organizationId?: string;
  userId?: string;
  username?: string;
  role?: string;
}

/** Build the actor context from an authenticated request for audit trails. */
function reqActor(req: Request & { user?: OrgUser }) {
  return {
    organizationId: req.user?.organizationId || '',
    userId: req.user?.userId,
    username: req.user?.username,
    role: req.user?.role,
    ipAddress: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
}

export class BranchController {
  static async getBranches(req: any, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });
      const rows = await db.select().from(branches)
        .where(eq(branches.organizationId, organizationId))
        .orderBy(branches.code);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getBranch(req: any, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });
      const [row] = await db.select().from(branches)
        .where(and(eq(branches.id, req.params.id), eq(branches.organizationId, organizationId)))
        .limit(1);
      if (!row) return res.status(404).json({ error: 'Branch not found' });
      res.json(row);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createBranch(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(403).json({ error: 'Organization context missing.' });

      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const body = req.body;

      const [existing] = await db.select({ id: branches.id })
        .from(branches)
        .where(and(eq(branches.organizationId, organizationId), or(eq(branches.code, body.code), eq(branches.name, body.name))))
        .limit(1);
      if (existing) {
        return res.status(409).json({ error: 'Branch with this code or name already exists.' });
      }

      const [branch] = await db.insert(branches).values({
        organizationId,
        code: String(body.code).trim(),
        name: String(body.name).trim(),
        branchType: body.branchType || 'Branch',
        isHeadOffice: body.isHeadOffice ?? false,
        address: body.address || 'Head Office',
        province: body.province || null,
        district: body.district || null,
        municipality: body.municipality || null,
        ward: body.ward ? String(body.ward) : null,
        tole: body.tole || null,
        phone: body.phone || '',
        email: body.email || null,
        managerName: body.managerName || '',
        openingDateBs: body.openingDateBs || null,
        status: body.status || 'Active',
        latitude: body.latitude !== undefined ? String(body.latitude) : null,
        longitude: body.longitude !== undefined ? String(body.longitude) : null,
        googleMapLink: body.googleMapLink || null,
        logoUrl: body.logoUrl || null,
        workingDays: body.workingDays || null,
        openingTime: body.openingTime || null,
        closingTime: body.closingTime || null,
        vaultLimit: num(body.vaultLimit) ?? '0',
        currentVaultCash: num(body.currentVaultCash) ?? '0',
        remarks: body.remarks || null,
      }).returning();

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Organization Setup',
        'Create Branch',
        `Created branch ${branch.code} (${branch.name})`,
      ));

      res.status(201).json(branch);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async updateBranch(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      const body = req.body;

      const [existing] = await db.select().from(branches).where(eq(branches.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Branch not found' });
      if (organizationId && existing.organizationId !== organizationId) {
        return res.status(403).json({ error: 'Not authorized to edit this branch.' });
      }

      if (body.code || body.name) {
        const dupConditions = [];
        if (body.code) dupConditions.push(eq(branches.code, String(body.code).trim()));
        if (body.name) dupConditions.push(eq(branches.name, String(body.name).trim()));
        const [dup] = await db.select({ id: branches.id })
          .from(branches)
          .where(and(
            eq(branches.organizationId, existing.organizationId),
            or(...dupConditions),
            ne(branches.id, existing.id),
          ))
          .limit(1);
        if (dup) {
          return res.status(409).json({ error: 'Branch with this code or name already exists.' });
        }
      }

      const update: Record<string, any> = {};
      const fieldMap: Record<string, string> = {
        code: 'code', name: 'name', branchType: 'branchType', isHeadOffice: 'isHeadOffice',
        address: 'address', province: 'province', district: 'district', municipality: 'municipality',
        ward: 'ward', tole: 'tole', phone: 'phone', email: 'email', managerName: 'managerName',
        openingDateBs: 'openingDateBs', status: 'status', googleMapLink: 'googleMapLink',
        logoUrl: 'logoUrl', workingDays: 'workingDays', openingTime: 'openingTime',
        closingTime: 'closingTime', remarks: 'remarks',
      };
      for (const [key, col] of Object.entries(fieldMap)) {
        if (body[key] !== undefined) update[col] = body[key] === '' ? null : body[key];
      }
      if (body.latitude !== undefined) update.latitude = String(body.latitude);
      if (body.longitude !== undefined) update.longitude = String(body.longitude);
      if (body.vaultLimit !== undefined) update.vaultLimit = num(body.vaultLimit);
      if (body.currentVaultCash !== undefined) update.currentVaultCash = num(body.currentVaultCash);

      const [branch] = await db.update(branches).set({ ...update, updatedAt: new Date() }).where(eq(branches.id, req.params.id)).returning();

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Organization Setup',
        'Update Branch',
        `Updated branch ${branch.code} (${branch.name})${body.status ? ` → status ${body.status}` : ''}`,
      ));

      res.json(branch);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Deactivate a branch (status → Inactive). Blocks when the branch still has
   * live dependents so no orphaned records are created.
   */
  static async deactivateBranch(req: Request & { user?: OrgUser }, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const db = getDb();
      if (!db) throw new Error('Database not connected. Configure DATABASE_URL.');
      if (!organizationId) return res.status(403).json({ error: 'No organization context available.' });

      const [existing] = await db.select().from(branches)
        .where(and(eq(branches.id, req.params.id), eq(branches.organizationId, organizationId)))
        .limit(1);
      if (!existing) return res.status(404).json({ error: 'Branch not found' });
      if (existing.isHeadOffice) {
        return res.status(400).json({ error: 'The head office branch cannot be deactivated.' });
      }
      if (existing.status === 'Inactive') {
        return res.status(409).json({ error: 'Branch is already inactive.' });
      }

      const [staffCount, userCount, memberCount, savingsCount, loanCount, voucherCount] = await Promise.all([
        db.select({ value: count() }).from(employees).where(eq(employees.branchId, existing.id)),
        db.select({ value: count() }).from(orgUsers).where(eq(orgUsers.branchId, existing.id)),
        db.select({ value: count() }).from(members).where(eq(members.branchId, existing.id)),
        db.select({ value: count() }).from(savingsAccounts).where(eq(savingsAccounts.branchId, existing.id)),
        db.select({ value: count() }).from(loanAccounts).where(eq(loanAccounts.branchId, existing.id)),
        db.select({ value: count() }).from(vouchers).where(eq(vouchers.branchId, existing.id)),
      ]);

      const deps: Array<[string, number]> = [
        ['staff members', staffCount[0]?.value ?? 0],
        ['assigned users', userCount[0]?.value ?? 0],
        ['members', memberCount[0]?.value ?? 0],
        ['savings accounts', savingsCount[0]?.value ?? 0],
        ['loan accounts', loanCount[0]?.value ?? 0],
        ['accounting vouchers', voucherCount[0]?.value ?? 0],
      ];
      const blockers = deps.filter(([, n]) => n > 0);
      if (blockers.length > 0) {
        return res.status(409).json({
          error: `Branch cannot be deactivated: it still has ${blockers.map(([label, n]) => `${n} ${label}`).join(', ')}. Reassign or close these records first.`,
        });
      }

      const [branch] = await db.update(branches)
        .set({ status: 'Inactive', updatedAt: new Date() })
        .where(eq(branches.id, existing.id))
        .returning();

      await writeAuditLog(buildAuditRow(
        reqActor(req),
        'Organization Setup',
        'Deactivate Branch',
        `Deactivated branch ${branch.code} (${branch.name})`,
      ));

      res.json(branch);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
