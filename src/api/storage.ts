import { apiClient } from '../lib/apiClient';
import type { MediaTargetType } from '../types/coop';

export interface StoredMedia {
  url: string;
  storagePath: string;
  bucket: string;
  fileName?: string | null;
}

/** Upload a base64 data URL to the bucket mapped for the given target type. */
export const uploadMedia = async (
  targetType: MediaTargetType,
  dataUrl: string,
  opts: { memberId?: string; fileName?: string } = {}
): Promise<StoredMedia> => {
  const { data } = await apiClient.post<StoredMedia>('/uploads', {
    targetType,
    dataUrl,
    memberId: opts.memberId,
    fileName: opts.fileName,
  });
  return data;
};

/**
 * Resolve a stored media value into something an <img>/<a> can fetch.
 *  - data: URLs and full http(s) URLs are returned unchanged.
 *  - storage paths ("bucket/path/...") are rewritten to the backend media
 *    proxy, which redirects to the public or signed URL as appropriate.
 * Returns undefined for empty/unknown values.
 */
export const resolveMediaUrl = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  if (value.startsWith('data:')) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.includes('/')) return `/api/v1/uploads/${value}`;
  return undefined;
};
