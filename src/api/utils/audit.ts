/**
 * Settings audit helper (Module 1: Organization Settings).
 *
 * Every settings write (org profile, working days, fiscal years, currency,
 * localization, branches) must be traceable. This helper records who changed
 * what, for which organization, at what time, and the field-level diff
 * (old → new) for accounting-relevant settings.
 */
import { getDb } from '../../db/client';
import { auditLogs } from '../../db/schema';
import { getTodayBSFormatted } from '../../utils/nepaliCalendar';

export interface SettingsActor {
  organizationId: string;
  userId?: string;
  username?: string;
  role?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditRowInput {
  organizationId: string;
  timestampBs: string;
  timestampAd: string;
  userName: string;
  userRole: string;
  userId?: string;
  module: string;
  action: string;
  details: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress: string;
  userAgent?: string;
}

/**
 * Compute a compact field-level diff of `old → new` for a settings write.
 * Only keys present in both (or explicitly changed) are emitted.
 */
export function computeDiff(
  oldValue: Record<string, any> | null | undefined,
  newValue: Record<string, any> | null | undefined,
): Record<string, { old: unknown; new: unknown }> {
  const oldObj = oldValue ?? {};
  const newObj = newValue ?? {};
  const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
  const diff: Record<string, { old: unknown; new: unknown }> = {};
  for (const key of keys) {
    const before = oldObj[key];
    const after = newObj[key];
    const normalizedBefore = before === undefined || before === null || before === '' ? null : before;
    const normalizedAfter = after === undefined || after === null || after === '' ? null : after;
    if (String(normalizedBefore ?? '') !== String(normalizedAfter ?? '')) {
      diff[key] = { old: normalizedBefore, new: normalizedAfter };
    }
  }
  return diff;
}

/**
 * Split a field-level diff into two jsonb snapshots — one of the "old" values,
 * one of the "new" — so audit_logs can store structured old_value/new_value
 * columns in addition to the human-readable `details` string.
 */
export function splitDiffIntoSnapshots(
  diff: Record<string, { old: unknown; new: unknown }>,
): { oldValue: Record<string, unknown>; newValue: Record<string, unknown> } {
  const oldValue: Record<string, unknown> = {};
  const newValue: Record<string, unknown> = {};
  for (const [key, change] of Object.entries(diff)) {
    oldValue[key] = change.old;
    newValue[key] = change.new;
  }
  return { oldValue, newValue };
}

/** Persist an audit log row for an org-scoped settings change. */export async function writeAuditLog(row: AuditRowInput): Promise<void> {
  const db = getDb();
  if (!db) {
    // Prototype/mock mode — no persistence available.
    console.warn('[audit] DB not connected; audit row skipped:', row.action);
    return;
  }
  try {
    await db.insert(auditLogs).values({
      organizationId: row.organizationId,
      timestampBs: row.timestampBs,
      timestampAd: row.timestampAd,
      userName: row.userName,
      userRole: row.userRole,
      userId: row.userId || null,
      module: row.module,
      action: row.action,
      details: row.details,
      oldValue: row.oldValue ?? null,
      newValue: row.newValue ?? null,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent || null,
    });
  } catch (error) {
    // Never fail the primary settings write because auditing failed.
    console.error('[audit] Failed to write audit log:', error);
  }
}

/** Build a full AuditRowInput from a controller request + change details. */
export function buildAuditRow(
  actor: SettingsActor,
  module: string,
  action: string,
  details: string,
  snapshots?: { oldValue?: Record<string, unknown> | null; newValue?: Record<string, unknown> | null },
): AuditRowInput {
  return {
    organizationId: actor.organizationId,
    timestampBs: getTodayBSFormatted(),
    timestampAd: new Date().toISOString(),
    userName: actor.username || actor.userId || 'System',
    userRole: actor.role || 'org_user',
    userId: actor.userId,
    module,
    action,
    details,
    oldValue: snapshots?.oldValue ?? null,
    newValue: snapshots?.newValue ?? null,
    ipAddress: actor.ipAddress || '',
    userAgent: actor.userAgent,
  };
}
