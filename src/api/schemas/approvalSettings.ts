/**
 * Shared Zod schemas for the SETUPS → Workflow & Approvals domain (Module 2).
 *
 * Single source of truth for request validation. Both the Express controllers
 * (server-side) and the React forms (client-side) import these schemas so
 * validation can never drift into two hand-maintained copies.
 *
 * Conventions:
 *  - Every schema is a `z.object({ body: ... })` wrapper that plugs directly
 *    into the `validateRequest` middleware.
 *  - `XxxPayload` exports are the plain `body` schema so the frontend can
 *    `safeParse` form state before submitting.
 *  - Tenant columns (organization_id, role_id) are NEVER accepted on the wire —
 *    they are always derived server-side from the authenticated JWT / URL.
 */
import { z } from 'zod';

// =============================================
// Approval Levels
// =============================================
export const createApprovalLevelPayload = z.object({
  levelNo: z.number().int().min(1, 'Level number must be at least 1'),
  roleKey: z.string().min(1, 'Role key is required').max(50),
  roleLabel: z.string().min(1, 'Role label is required').max(200),
  minAmount: z.number().min(0).default(0),
  maxAmount: z.number().min(0).nullable().optional(),
  scope: z.string().max(300).optional(),
  active: z.boolean().optional(),
});
export const createApprovalLevelSchema = z.object({ body: createApprovalLevelPayload });

export const updateApprovalLevelPayload = createApprovalLevelPayload.partial();
export const updateApprovalLevelSchema = z.object({ body: updateApprovalLevelPayload });

// =============================================
// Approval Matrix
// =============================================
export const approvalRequestTypes = ['Loan_Approval', 'Expense_Claim', 'Voucher_Post', 'Share_Transfer', 'Member_Exit'] as const;

export const createApprovalMatrixPayload = z.object({
  requestType: z.enum(approvalRequestTypes),
  thresholdMin: z.number().min(0).default(0),
  thresholdMax: z.number().min(0).nullable().optional(),
  signatory1Role: z.string().min(1, 'First signatory is required').max(100),
  signatory2Role: z.string().max(100).nullable().optional(),
  smsNotify: z.boolean().optional(),
  active: z.boolean().optional(),
  description: z.string().max(500).optional(),
});
export const createApprovalMatrixSchema = z.object({ body: createApprovalMatrixPayload });

export const updateApprovalMatrixPayload = createApprovalMatrixPayload.partial();
export const updateApprovalMatrixSchema = z.object({ body: updateApprovalMatrixPayload });

// =============================================
// Approval Request Decision
// =============================================
export const approvalDecisionPayload = z.object({
  status: z.enum(['Approved', 'Rejected']),
  remarks: z.string().max(1000).optional(),
});
export const approvalDecisionSchema = z.object({ body: approvalDecisionPayload });

// =============================================
// Role Approval Limits (per-role, per-module)
// =============================================
export const roleApprovalLimitRowPayload = z.object({
  moduleKey: z.string().min(1).max(100),
  min: z.number().min(0).nullable().optional(),
  max: z.number().min(0).nullable().optional(),
});
export const putRoleApprovalLimitsPayload = z.array(roleApprovalLimitRowPayload).max(200);
export const putRoleApprovalLimitsSchema = z.object({ body: putRoleApprovalLimitsPayload });
