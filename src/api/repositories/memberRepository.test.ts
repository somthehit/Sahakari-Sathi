/**
 * MemberRepository classification/group tests (Module 3 wiring).
 *
 * The Member Service resolves the seven Member Settings catalogs onto the
 * members payload via org-scoped FK lookups, and enforces the group-only
 * invariant + capacity cap before persist. These tests drive the repository
 * against the fake in-memory DB to prove:
 *   1. Lookups resolve by UUID id first, else by name/code, within the org.
 *   2. Unknown non-empty labels are rejected with 400 (no silent fallback).
 *   3. Cross-org rows are invisible (id and label lookups stay scoped).
 *   4. Required classifications fall back to the org default ('General' /
 *      'Regular') or the first active row when no label is supplied.
 *   5. assertGroupCapacity rejects cross-org groups (400) and full groups (409).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeDb, type FakeScenario } from '../test/fakeDb';
import { MemberRepository } from '../repositories/MemberRepository';

const holder = vi.hoisted(() => ({ db: null as any }));

vi.mock('../../db/client', () => ({
  getDb: () => holder.db,
  closeDb: () => {},
  checkDbHealth: () => false,
}));

const ORG_A = '11111111-1111-1111-1111-111111111111';
const ORG_B = '22222222-2222-2222-2222-222222222222';

const repo = new MemberRepository();

function catalogRow(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'c-gen', organizationId: ORG_A, code: 'GENERAL', name: 'General', nameNepali: null,
    description: null, isActive: true, sortOrder: 0, isSystem: true,
    minShareUnits: 10, entranceFee: '500.00', shareValuePerUnit: '100.00',
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  holder.db = makeFakeDb();
});

describe('MemberRepository.resolveMemberTypeId', () => {
  it('resolves by label name within the org', async () => {
    holder.db = makeFakeDb({ memberTypes: [catalogRow(), catalogRow({ id: 't-f', code: 'FOUNDER', name: 'Founder' })] });
    const id = await repo.resolveMemberTypeId(ORG_A, 'Founder');
    expect(id).toBe('t-f');
  });

  it('resolves by UUID id (preferred over a same-org name match)', async () => {
    const uuid = 'a1b2c3d4-1111-1111-1111-111111111111';
    holder.db = makeFakeDb({ memberTypes: [catalogRow({ id: uuid, name: 'General' })] });
    const id = await repo.resolveMemberTypeId(ORG_A, uuid);
    expect(id).toBe(uuid);
  });

  it('rejects an unknown non-empty label with 400 (no silent default)', async () => {
    holder.db = makeFakeDb({ memberTypes: [catalogRow()] });
    await expect(repo.resolveMemberTypeId(ORG_A, 'Quantum Member')).rejects.toMatchObject({ status: 400 });
  });

  it('falls back to the org default when no label is supplied', async () => {
    holder.db = makeFakeDb({ memberTypes: [catalogRow({ id: 't-a', code: 'AA', name: 'AAA' }), catalogRow()] });
    const id = await repo.resolveMemberTypeId(ORG_A, undefined);
    expect(id).toBe('c-gen'); // 'General' default
  });

  it('falls back to the first active row when the default is absent', async () => {
    holder.db = makeFakeDb({ memberTypes: [catalogRow({ id: 't-a', code: 'AA', name: 'AAA' })] });
    const id = await repo.resolveMemberTypeId(ORG_A, undefined);
    expect(id).toBe('t-a');
  });

  it('never resolves another org’s row by label', async () => {
    holder.db = makeFakeDb({ memberTypes: [catalogRow({ id: 't-other', organizationId: ORG_B, code: 'GENERAL', name: 'General' })] });
    await expect(repo.resolveMemberTypeId(ORG_A, 'General')).rejects.toMatchObject({ status: 400 });
  });
});

describe('MemberRepository.resolveMemberCategoryId', () => {
  it('resolves the Regular default when no label is supplied', async () => {
    holder.db = makeFakeDb({
      memberCategories: [
        { id: 'c-other', organizationId: ORG_A, code: 'VIP', name: 'VIP', isActive: true, sortOrder: 0 },
        { id: 'c-reg', organizationId: ORG_A, code: 'REGULAR', name: 'Regular', isActive: true, sortOrder: 0 },
      ],
    });
    const id = await repo.resolveMemberCategoryId(ORG_A, undefined);
    expect(id).toBe('c-reg');
  });
});

describe('MemberRepository optional lookup resolvers', () => {
  it('resolveOccupationId returns null for an empty label', async () => {
    holder.db = makeFakeDb({ occupations: [] });
    expect(await repo.resolveOccupationId(ORG_A, undefined)).toBeNull();
  });

  it('resolveOccupationId resolves by label (code matches normalized label)', async () => {
    holder.db = makeFakeDb({ occupations: [{ id: 'o1', organizationId: ORG_A, code: 'FARMING', name: 'Farming' }] });
    expect(await repo.resolveOccupationId(ORG_A, 'Farming')).toBe('o1');
  });

  it('resolveNomineeRelationId stays org-scoped', async () => {
    holder.db = makeFakeDb({
      relationshipTypes: [
        { id: 'r-own', organizationId: ORG_A, code: 'SPOUSE', name: 'Spouse' },
        { id: 'r-other', organizationId: ORG_B, code: 'SPOUSE', name: 'Spouse' },
      ],
    });
    expect(await repo.resolveNomineeRelationId(ORG_A, 'Spouse')).toBe('r-own');
  });
});

describe('MemberRepository.assertGroupCapacity', () => {
  const group = (overrides: Partial<Record<string, any>> = {}) => ({
    id: 'g1', organizationId: ORG_A, code: 'GRP-A', name: 'Savings Group A',
    maxMembers: 10, isActive: true, ...overrides,
  });

  it('passes when the group is below capacity', async () => {
    holder.db = makeFakeDb({ groups: [group()], dependentCounts: { members: 5 } });
    await expect(repo.assertGroupCapacity(ORG_A, 'g1')).resolves.toBeUndefined();
  });

  it('rejects a full group with 409', async () => {
    holder.db = makeFakeDb({ groups: [group()], dependentCounts: { members: 10 } });
    await expect(repo.assertGroupCapacity(ORG_A, 'g1')).rejects.toMatchObject({ status: 409 });
  });

  it('excludes the current member when counting (self-exclusion on update)', async () => {
    holder.db = makeFakeDb({ groups: [group()], dependentCounts: { members: 10 } });
    await expect(repo.assertGroupCapacity(ORG_A, 'g1', 'm-same')).rejects.toMatchObject({ status: 409 });
    const wheres = holder.db.recordedWheres.filter((w) => w.sql.includes('group_id'));
    expect(wheres.some((w) => w.sql.includes('<>') || w.sql.includes('!='))).toBe(true);
  });

  it('ignores the cap when the group has no max_members', async () => {
    holder.db = makeFakeDb({ groups: [group({ maxMembers: null })], dependentCounts: { members: 500 } });
    await expect(repo.assertGroupCapacity(ORG_A, 'g1')).resolves.toBeUndefined();
  });

  it('rejects a cross-org group with 400', async () => {
    holder.db = makeFakeDb({ groups: [group({ id: 'g-other', organizationId: ORG_B })] });
    await expect(repo.assertGroupCapacity(ORG_A, 'g-other')).rejects.toMatchObject({ status: 400 });
  });
});
