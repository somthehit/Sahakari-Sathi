/**
 * Shared Zod schemas for Groups (Member Settings).
 *
 * Single source of truth for request validation across client and server.
 * Tenant columns (organization_id, created_by, updated_by) are NEVER accepted
 * on the wire — derived server-side from the authenticated JWT.
 *
 * `code` is normalized UPPERCASE server-side; the DB unique index on
 * (organization_id, code) enforces case-insensitive uniqueness.
 *
 * Meeting schedule is recurring: meeting_day_of_month (1–31) + meeting_time.
 * max_members is a capacity cap; null/omitted = no cap.
 */
import { z } from 'zod';

export const groupPayload = z.object({
  code: z.string().min(1, 'Code is required').max(20, 'Code must be 20 characters or fewer'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
  nameNepali: z.string().max(100).nullish(),
  address: z.string().max(500).nullish(),
  chairpersonName: z.string().max(100).nullish(),
  chairpersonContact: z.string().max(50).nullish(),
  chairpersonAddress: z.string().max(500).nullish(),
  contactPersonName: z.string().max(100).nullish(),
  contactPersonPhone: z.string().max(50).nullish(),
  meetingDayOfMonth: z.coerce.number().int().min(1).max(31).nullish(),
  meetingTime: z.string().max(20).nullish(),
  meetingPlace: z.string().max(500).nullish(),
  maxMembers: z.coerce.number().int().min(1).nullish(),
  isActive: z.boolean().optional(),
});

export const createGroupSchema = z.object({ body: groupPayload });
export const updateGroupSchema = z.object({ body: groupPayload.partial() });
