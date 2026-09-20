import { MemberRepository, MemberFilter } from '../repositories/MemberRepository';
import { ShareProvisioningService } from './ShareProvisioningService';
import { SavingsProvisioningService } from './SavingsProvisioningService';
import { getTodayBS } from '../../utils/nepaliCalendar';

export class MemberService {
  private repository: MemberRepository;
  private shareProvisioning: ShareProvisioningService;
  private savingsProvisioning: SavingsProvisioningService;

  constructor() {
    this.repository = new MemberRepository();
    this.shareProvisioning = new ShareProvisioningService();
    this.savingsProvisioning = new SavingsProvisioningService();
  }

  /**
   * Resolve classification catalogs (Member Settings / Module 3) onto the
   * payload before persist:
   *   - memberTypeId / memberCategoryId are REQUIRED (NOT NULL) — prefer the
   *     incoming id, accept a legacy label (membershipType/memberCategory),
   *     else keep the existing value (update) or fall back to the org default.
   *   - KYC/family refs (occupationId, educationLevelId, nomineeRelationId,
   *     nomineeTypeId) are optional and only touched when the client sends them.
   *   - groupId may only be set when the member type is flagged is_group_type,
   *     and the group must not be at its max_members cap.
   */
  private async resolveClassifications(
    data: Record<string, any>,
    organizationId: string,
    existing?: Record<string, any> | null,
  ) {
    data.memberTypeId = await this.repository.resolveMemberTypeId(
      organizationId,
      data.memberTypeId ?? data.membershipType ?? existing?.memberTypeId,
    );
    data.memberCategoryId = await this.repository.resolveMemberCategoryId(
      organizationId,
      data.memberCategoryId ?? data.memberCategory ?? existing?.memberCategoryId,
    );
    delete data.membershipType;
    delete data.memberCategory;

    if ('occupationId' in data || 'occupation' in data) {
      data.occupationId = (await this.repository.resolveOccupationId(organizationId, data.occupationId ?? data.occupation)) ?? null;
    }
    delete data.occupation;
    if ('educationLevelId' in data || 'educationLevel' in data) {
      data.educationLevelId = (await this.repository.resolveEducationLevelId(organizationId, data.educationLevelId ?? data.educationLevel)) ?? null;
    }
    delete data.educationLevel;
    if ('nomineeRelationId' in data || 'nomineeRelation' in data) {
      data.nomineeRelationId = (await this.repository.resolveNomineeRelationId(organizationId, data.nomineeRelationId ?? data.nomineeRelation)) ?? null;
    }
    delete data.nomineeRelation;
    if ('nomineeTypeId' in data || 'nomineeType' in data) {
      data.nomineeTypeId = (await this.repository.resolveNomineeTypeId(organizationId, data.nomineeTypeId ?? data.nomineeType)) ?? null;
    }
    delete data.nomineeType;

    const effectiveGroupId = data.groupId !== undefined ? (data.groupId || null) : (existing?.groupId ?? null);
    if (effectiveGroupId) {
      const type = await this.repository.findMemberTypeById(organizationId, data.memberTypeId);
      if (type && !type.isGroupType) {
        const error = new Error('Group assignment requires a Member Type flagged as a group type.');
        (error as any).status = 400;
        throw error;
      }
      if (data.groupId !== undefined) {
        await this.repository.assertGroupCapacity(organizationId, effectiveGroupId, existing?.id);
      }
    }
    if (data.groupId !== undefined) data.groupId = effectiveGroupId;
  }

  async getMembers(filter: MemberFilter) {
    if (!filter.organizationId) throw new Error('Organization context is required.');
    return this.repository.findAll(filter);
  }

  async getMemberById(id: string, organizationId?: string, branchIds?: string[]) {
    const member = await this.repository.findById(id, organizationId, branchIds);
    if (!member) throw new Error('Member not found');
    return member;
  }

  async createMember(data: Record<string, any>, branchCode: string, organizationId?: string) {
    if (!organizationId) throw new Error('organizationId is required');

    // 1. Business Logic: Auto-generate Member Number
    if (!data.memberNo) {
      data.memberNo = await this.repository.getNextMemberNo(branchCode, organizationId);
    }

    // 2. Business Logic: search index + initial status
    data.searchName = (data.fullName || '').toLowerCase();
    data.status = data.status || 'Active';
    data.kycStatus = data.kycStatus || 'Pending';
    data.organizationId = organizationId;

    // 3. Defensive defaults for NOT NULL columns (members table has no DB defaults).
    //    A stale draft or a partial client payload must not trip the DB constraint.
    data.gender = data.gender || 'Male';
    data.dobBs = data.dobBs || getTodayBS();
    data.membershipDateBs = data.membershipDateBs || getTodayBS();

    // 4. Fall back to the org's first branch when none was supplied (or was empty).
    if (!data.branchId) {
      const fallbackBranchId = await this.repository.getFirstBranchId(organizationId);
      if (fallbackBranchId) data.branchId = fallbackBranchId;
    }

    // 5. Resolve classification catalogs + group assignment (capacity).
    await this.resolveClassifications(data, organizationId);

    // 6. Persist
    const member = await this.repository.create(data);

    // 7. Auto-open the member's share account from the org default share
    //    scheme (canonical pricing config). Non-fatal: failures are queued,
    //    never propagated — a failed provisioning must not roll back the
    //    member registration.
    try {
      await this.shareProvisioning.provisionForMember(organizationId, {
        id: member.id,
        memberNo: member.memberNo,
        fullName: member.fullName,
        branchId: member.branchId ?? null,
      });
    } catch {
      // provisionForMember already swallows errors; this is belt-and-suspenders.
    }

    // 8. Auto-open the member's savings account from the org default savings
    //    product. Non-fatal, idempotent: failures are queued in
    //    savings_provisioning_queue, never propagated.
    try {
      await this.savingsProvisioning.provisionForMember(organizationId, {
        id: member.id,
        memberNo: member.memberNo,
        fullName: member.fullName,
        branchId: member.branchId ?? null,
      });
    } catch {
      // provisionForMember already swallows errors; this is belt-and-suspenders.
    }

    return member;
  }

  async updateMember(id: string, data: Record<string, any>, organizationId?: string, branchIds?: string[]) {
    const member = await this.repository.findById(id, organizationId, branchIds);
    if (!member) throw new Error('Member not found');

    if (data.fullName && data.fullName !== member.fullName) {
      data.searchName = data.fullName.toLowerCase();
    }

    // Never let a client move a member across organizations.
    delete data.organizationId;

    // Resolve classification catalogs + group assignment (capacity) against
    // the existing row so untouched fields stay stable.
    await this.resolveClassifications(data, organizationId!, member);

    return this.repository.update(id, data, organizationId);
  }

  async deleteMember(id: string, organizationId?: string): Promise<boolean> {
    const member = await this.repository.findById(id, organizationId);
    if (!member) throw new Error('Member not found');
    return this.repository.delete(id, organizationId);
  }
}
