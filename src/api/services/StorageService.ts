import { supabaseAdmin } from '../../lib/supabaseAdmin';

export type MediaTargetType =
  | 'photo'
  | 'citizenshipFront'
  | 'citizenshipBack'
  | 'signature'
  | 'fingerprint'
  | 'kyc_document'
  | 'certificate'
  | 'invoice_bill'
  | 'payroll_document'
  | 'org_logo'
  | 'org_favicon'
  | 'deposit_voucher'
  | 'cheque_image'
  | 'agm_document'
  | 'user_avatar';

/** Maps each media target to the bucket it should live in. */
export const TARGET_BUCKET: Record<MediaTargetType, string> = {
  photo: 'member-photos',
  citizenshipFront: 'member-documents',
  citizenshipBack: 'member-documents',
  signature: 'member-documents',
  fingerprint: 'member-documents',
  kyc_document: 'member-documents',
  certificate: 'certificates',
  invoice_bill: 'invoices-bills',
  payroll_document: 'payroll',
  org_logo: 'org-branding',
  org_favicon: 'org-branding',
  deposit_voucher: 'member-documents',
  cheque_image: 'member-documents',
  agm_document: 'member-documents',
  user_avatar: 'org-branding',
};

/** Buckets whose objects are publicly readable (no signed URL needed). */
const PUBLIC_BUCKETS = new Set(['member-photos', 'certificates', 'org-branding']);

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
  'text/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
};

export interface StoredMedia {
  url: string;
  storagePath: string;
  bucket: string;
}

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error('Invalid data URL');
  const mime = match[1];
  const base64 = match[3];
  if (base64.length % 4 !== 0) throw new Error('Invalid base64 payload');
  return { mime, buffer: Buffer.from(base64, 'base64') };
}

function safeExtension(mime: string): string {
  return MIME_TO_EXT[mime] || 'bin';
}

function buildStoragePath(opts: {
  bucket: string;
  organizationId?: string;
  memberId?: string;
  mime: string;
}): string {
  const ext = safeExtension(opts.mime);
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const parts = [
    opts.organizationId || 'org',
    opts.memberId || 'unassigned',
    `${ts}_${rand}.${ext}`,
  ];
  return parts.join('/');
}

export class StorageService {
  /** Upload a base64 data URL to the bucket mapped for targetType. */
  async uploadMedia(
    targetType: MediaTargetType,
    dataUrl: string,
    opts: { organizationId?: string; memberId?: string } = {}
  ): Promise<StoredMedia> {
    const bucket = TARGET_BUCKET[targetType];
    const { mime, buffer } = parseDataUrl(dataUrl);
    const storagePath = buildStoragePath({ bucket, ...opts, mime });

    if (buffer.length === 0) throw new Error('Empty file payload');

    const { error } = await supabaseAdmin.storage.from(bucket).upload(storagePath, buffer, {
      contentType: mime,
      cacheControl: '3600',
      upsert: true,
    });

    if (error) {
      console.error('[StorageService] Upload failed', error);
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    return {
      url: this.buildPublicUrl(bucket, storagePath),
      storagePath,
      bucket,
    };
  }

  /** Upload a file (multipart) to the bucket mapped for targetType. */
  async uploadFile(
    targetType: MediaTargetType,
    file: { buffer: Buffer; mimetype: string },
    opts: { organizationId?: string; memberId?: string } = {}
  ): Promise<StoredMedia> {
    const bucket = TARGET_BUCKET[targetType];
    const mime = file.mimetype || 'application/octet-stream';
    const storagePath = buildStoragePath({ bucket, ...opts, mime });

    const { error } = await supabaseAdmin.storage.from(bucket).upload(storagePath, file.buffer, {
      contentType: mime,
      cacheControl: '3600',
      upsert: true,
    });

    if (error) {
      console.error('[StorageService] Upload failed', error);
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    return {
      url: this.buildPublicUrl(bucket, storagePath),
      storagePath,
      bucket,
    };
  }

  /**
   * Produce a fetchable URL for a stored object.
   * Public buckets return the permanent public URL; private buckets return a
   * short-lived signed URL.
   */
  buildPublicUrl(bucket: string, storagePath: string): string {
    if (PUBLIC_BUCKETS.has(bucket)) {
      const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath);
      return data.publicUrl;
    }
    return `${bucket}/${storagePath}`;
  }

  /**
   * Generate a fetchable URL for an object, given its full storage path
   * (`bucket/path/to/object`). Public buckets resolve to their permanent
   * public URL; private buckets get a short-lived signed URL.
   */
  async createSignedUrl(storagePath: string, expiresIn = 3600): Promise<string> {
    const [bucket, ...pathParts] = storagePath.split('/');
    if (!bucket || pathParts.length === 0) return storagePath;
    const objectPath = pathParts.join('/');

    if (PUBLIC_BUCKETS.has(bucket)) {
      const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(objectPath);
      return data.publicUrl;
    }

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(objectPath, expiresIn);
    if (error || !data?.signedUrl) {
      console.error('[StorageService] createSignedUrl failed', error);
      return storagePath;
    }
    return data.signedUrl;
  }
}

export const storageService = new StorageService();
