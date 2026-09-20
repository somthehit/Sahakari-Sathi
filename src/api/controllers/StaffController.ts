import { Request, Response } from 'express';
import { StaffService } from '../services/StaffService';
import { getBranchScope, resolveBranchForCreate } from '../middleware/scope';
import type { AuthRequest } from '../middleware/authMiddleware';

const staffService = new StaffService();

export class StaffController {

  // ============================================
  // GET /api/v1/staff — staff directory (with ERP badge info)
  // ============================================
  static async getStaffList(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(400).json({ error: 'Organization context missing.' });
      const scope = getBranchScope(req);
      const staff = await staffService.getStaffList(organizationId, scope.isOrgAdmin ? undefined : scope.branchIds);
      res.json(staff);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // GET /api/v1/staff/:id
  // ============================================
  static async getStaffById(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(400).json({ error: 'Organization context missing.' });
      const scope = getBranchScope(req);
      const staff = await staffService.getStaffById(organizationId, req.params.id, scope.isOrgAdmin ? undefined : scope.branchIds);
      if (!staff) return res.status(404).json({ error: 'Staff record not found.' });
      res.json(staff);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // POST /api/v1/staff — create staff (+ optional ERP account)
  // ============================================
  static async createStaff(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(400).json({ error: 'Organization context missing.' });

      const body = req.body ?? {};
      const resolvedBranchId = await resolveBranchForCreate(req, body.staff?.branchId ?? body.branchId);
      const scope = getBranchScope(req);

      const result = await staffService.createStaff({
        organizationId,
        staff: {
          ...(body.staff ?? body),
          branchId: resolvedBranchId,
        },
        enableErpLogin: !!body.enableErpLogin,
        systemAccess: body.systemAccess
          ? { ...body.systemAccess, branchId: scope.isOrgAdmin ? (body.systemAccess.branchId ?? resolvedBranchId) : resolvedBranchId }
          : null,
      });

      res.status(201).json({
        ...result,
        // Temporary password is returned ONCE so HR can copy it before sending the welcome email
        ...(result.temporaryPassword ? { temporaryPassword: result.temporaryPassword } : {}),
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // ============================================
  // PUT /api/v1/staff/:id — update staff / toggle ERP login
  // ============================================
  static async updateStaff(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(400).json({ error: 'Organization context missing.' });

      const body = req.body ?? {};
      const scope = getBranchScope(req);
      const staffPayload = body.staff ?? body;

      if (!scope.isOrgAdmin && staffPayload) {
        // Branch staff cannot move staff between branches.
        staffPayload.branchId = scope.branchId ?? staffPayload.branchId;
      }
      if (!scope.isOrgAdmin && body.systemAccess) {
        body.systemAccess.branchId = scope.branchId ?? body.systemAccess.branchId;
      }

      const result = await staffService.updateStaff(organizationId, req.params.id, {
        staff: staffPayload,
        enableErpLogin: body.enableErpLogin,
        systemAccess: body.systemAccess ?? null,
      });

      res.json({
        ...result,
        ...(result.temporaryPassword ? { temporaryPassword: result.temporaryPassword } : {}),
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // ============================================
  // DELETE /api/v1/staff/:id
  // ============================================
  static async deleteStaff(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) return res.status(400).json({ error: 'Organization context missing.' });
      const employee = await staffService.deleteStaff(organizationId, req.params.id);
      res.json({ message: 'Staff record deleted.', id: employee.id });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}
