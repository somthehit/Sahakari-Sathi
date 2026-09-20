import { Request, Response } from 'express';
import { storageService, MediaTargetType, TARGET_BUCKET } from '../services/StorageService';
import { MemberService } from '../services/MemberService';
import { AuthRequest } from '../middleware/authMiddleware';
import { requireOrg } from '../middleware/scope';

const memberService = new MemberService();

const VALID_TARGETS = Object.keys(TARGET_BUCKET) as MediaTargetType[];
const VALID_BUCKETS = new Set(Object.values(TARGET_BUCKET));

const TARGET_KYC_FIELD: Partial<Record<MediaTargetType, string>> = {
  photo: 'photoUrl',
  citizenshipFront: 'citizenshipFrontUrl',
  citizenshipBack: 'citizenshipBackUrl',
  signature: 'signatureUrl',
  fingerprint: 'fingerprintTemplateUrl',
};

export class StorageController {
  /**
   * POST /uploads
   * Body: { targetType, dataUrl, memberId?, fileName? }
   * Uploads a base64 data URL to the correct bucket and, when a memberId is
   * supplied, persists the resulting URL onto the member's KYC media field.
   * The memberId is only honored if it belongs to the caller's organization.
   */
  static async upload(req: AuthRequest, res: Response) {
    try {
      const organizationId = requireOrg(req, res);
      if (!organizationId) return;

      const { targetType, dataUrl, memberId, fileName } = req.body ?? {};

      if (!VALID_TARGETS.includes(targetType)) {
        return res.status(400).json({ error: `Invalid targetType. Allowed: ${VALID_TARGETS.join(', ')}` });
      }
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
        return res.status(400).json({ error: 'dataUrl must be a base64 data URL' });
      }

      const result = await storageService.uploadMedia(targetType, dataUrl, {
        organizationId,
        memberId,
      });

      // Persist onto the member KYC field so the URL survives across reloads.
      // updateMember is org-scoped — a cross-org memberId resolves to "Member not found".
      if (memberId) {
        const field = TARGET_KYC_FIELD[targetType];
        if (field) {
          try {
            await memberService.updateMember(memberId, { [field]: result.url }, organizationId);
          } catch (err: any) {
            if (err.message === 'Member not found') {
              console.warn('[StorageController] Member not found in this organization; media not persisted', memberId);
            } else {
              console.warn('[StorageController] Failed to persist media URL on member', err);
            }
          }
        }
      }

      res.status(201).json({
        url: result.url,
        storagePath: result.storagePath,
        bucket: result.bucket,
        fileName: fileName || null,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Upload failed' });
    }
  }

  /**
   * GET /uploads/:bucket/*path
   * Public (unauthenticated) proxy so <img> tags can render stored objects.
   * Only known buckets are proxied; objects resolve to a permanent public URL
   * or a short-lived signed URL — never the raw storage path.
   */
  static async serve(req: Request, res: Response) {
    try {
      const bucket = req.params.bucket as string;
      const path = (req.params[0] as string) || '';
      if (!VALID_BUCKETS.has(bucket) || !path) return res.status(404).json({ error: 'Not found' });

      const storagePath = `${bucket}/${path}`;
      const url = await storageService.createSignedUrl(storagePath, 3600);
      if (!url.startsWith('http')) return res.status(404).json({ error: 'Object not found' });
      return res.redirect(url);
    } catch (err: any) {
      res.status(404).json({ error: err.message || 'Object not found' });
    }
  }
}
