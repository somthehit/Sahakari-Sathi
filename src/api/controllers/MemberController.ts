import { Request, Response } from 'express';
import { MemberService } from '../services/MemberService';
import { MemberRepository } from '../repositories/MemberRepository';
import { requireOrg, assertBranchInOrg, getBranchScope, resolveBranchForCreate, ScopeError } from '../middleware/scope';
import type { AuthRequest } from '../middleware/authMiddleware';
import { z } from 'zod';
import { getDb } from '../../db/client';
import { memberDocuments } from '../../db/schema/members';
import { eq, and } from 'drizzle-orm';

const memberService = new MemberService();
const memberRepo = new MemberRepository();

export class MemberController {
  
  static async getMembers(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const { search, branchId, kycStatus, status, page, limit } = req.query;
      if (branchId) await assertBranchInOrg(organizationId, branchId as string);

      const scope = getBranchScope(req);
      const result = await memberService.getMembers({
        organizationId,
        search: search as string,
        branchId: branchId as string,
        branchIds: scope.isOrgAdmin ? undefined : scope.branchIds,
        kycStatus: kycStatus as string,
        status: status as string,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });

      res.json(result);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  static async getMember(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const scope = getBranchScope(req);
      const member = await memberService.getMemberById(
        req.params.id,
        organizationId,
        scope.isOrgAdmin ? undefined : scope.branchIds
      );
      res.json(member);
    } catch (error: any) {
      if (error.message === 'Member not found') return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  static async createMember(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      // Branch is derived server-side: branch staff are forced onto their
      // assigned branch; org admins default to the active branch context.
      req.body.branchId = await resolveBranchForCreate(req, req.body.branchId);
      // In a real app, branchCode would be inferred from the logged-in user's branch
      const branchCode = req.body.branchCode || 'BR-01';
      const member = await memberService.createMember(req.body, branchCode, organizationId);
      res.status(201).json(member);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  static async updateMember(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const scope = getBranchScope(req);
      if (scope.isOrgAdmin) {
        if (req.body.branchId) await assertBranchInOrg(organizationId, req.body.branchId);
      } else {
        // Branch staff cannot move a member to another branch.
        req.body.branchId = scope.branchId ?? req.body.branchId;
      }
      const member = await memberService.updateMember(
        req.params.id,
        req.body,
        organizationId,
        scope.isOrgAdmin ? undefined : scope.branchIds
      );
      res.json(member);
    } catch (error: any) {
      if (error instanceof ScopeError) return res.status(403).json({ error: error.message });
      if (error.message === 'Member not found') return res.status(404).json({ error: error.message });
      res.status(400).json({ error: error.message });
    }
  }

  static async deleteMember(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const deleted = await memberService.deleteMember(req.params.id, organizationId);
      if (!deleted) return res.status(404).json({ error: 'Member not found' });
      res.json({ success: true, message: 'Member deleted successfully' });
    } catch (error: any) {
      if (error.message === 'Member not found') return res.status(404).json({ error: error.message });
      res.status(500).json({ error: error.message });
    }
  }

  static async getMemberDocuments(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const docs = await memberRepo.getDocuments(req.params.id, organizationId);
      res.json(docs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async addMemberDocument(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const { documentType, fileUrl, fileName, fileSize, mimeType } = req.body;
      const doc = await memberRepo.addDocument({
        memberId: req.params.id,
        documentType,
        fileUrl,
        fileName,
        fileSize: fileSize || null,
        mimeType: mimeType || null,
        uploadedBy: req.user?.username || null,
      }, organizationId);
      res.status(201).json(doc);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  static async deleteMemberDocument(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;
      const db = getDb();
      await db.delete(memberDocuments)
        .where(and(eq(memberDocuments.id, req.params.docId), eq(memberDocuments.memberId, req.params.id)));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

// Zod schemas for validation
export const createMemberSchema = z.object({
  body: z.object({
    fullName: z.string().min(2),
    citizenshipNo: z.string().min(5),
    phone: z.string().min(10),
    district: z.string(),
    // Optional — MemberService falls back to the org's first branch when absent/empty.
    branchId: z.union([z.string().uuid(), z.literal('')]).optional(),
  })
});
