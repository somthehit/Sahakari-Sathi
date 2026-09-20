import { useMemo, useState } from 'react';
import { Member } from '../../../../types/coop';

export const useMemberFilters = (members: Member[]) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [membershipType, setMembershipType] = useState<string>('ALL');

  const filteredMembers = useMemo(() => {
    return (members || []).filter((member) => {
      const matchesSearch =
        member.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.memberNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.citizenshipNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.phone?.includes(searchTerm);

      const matchesStatus = statusFilter === 'ALL' || member.status === statusFilter;
      const matchesType = membershipType === 'ALL' || member.membershipType === membershipType;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [members, searchTerm, statusFilter, membershipType]);

  return {
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    membershipType,
    setMembershipType,
    filteredMembers,
  };
};
