import { create } from 'zustand';
import { apiClient } from '../lib/apiClient';

interface MemberState {
  searchQuery: string;
  selectedBranch: string;
  setSearchQuery: (query: string) => void;
  setSelectedBranch: (branchId: string) => void;
}

export const useMemberStore = create<MemberState>((set) => ({
  searchQuery: '',
  selectedBranch: '',
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedBranch: (branchId) => set({ selectedBranch: branchId }),
}));
