import { describe, it, expect } from 'vitest';
import { computeDiff, buildAuditRow, splitDiffIntoSnapshots } from './audit';

describe('Settings Audit Helpers', () => {
  it('computes an old→new diff for changed fields only', () => {
    const old = { organizationName: 'ABC Coop', phone: '123', logoUrl: null };
    const next = { organizationName: 'ABC Coop', phone: '456', logoUrl: 'https://x/logo.png' };
    expect(computeDiff(old, next)).toEqual({
      phone: { old: '123', new: '456' },
      logoUrl: { old: null, new: 'https://x/logo.png' },
    });
  });

  it('normalizes undefined/empty to null so no spurious diff is emitted', () => {
    const old = { website: '', pan: undefined };
    const next = { website: null, pan: null };
    expect(computeDiff(old, next)).toEqual({});
  });

  it('handles missing before/after objects gracefully', () => {
    expect(computeDiff(undefined, { a: 1 })).toEqual({ a: { old: null, new: 1 } });
    expect(computeDiff({ a: 1 }, undefined)).toEqual({ a: { old: 1, new: null } });
  });

  it('builds a full audit row from an actor', () => {
    const row = buildAuditRow(
      { organizationId: 'org-1', userId: 'u1', username: 'admin', role: 'org_admin' },
      'Organization Setup',
      'Update Org Profile',
      '{"phone":{"old":"123","new":"456"}}',
    );
    expect(row.organizationId).toBe('org-1');
    expect(row.module).toBe('Organization Setup');
    expect(row.action).toBe('Update Org Profile');
    expect(row.details).toContain('phone');
    expect(row.userName).toBe('admin');
    expect(row.userRole).toBe('org_admin');
    expect(row.userId).toBe('u1');
    expect(row.timestampBs).toBeTruthy();
    expect(row.timestampAd).toBeTruthy();
    expect(row.ipAddress).toBe('');
  });
});
