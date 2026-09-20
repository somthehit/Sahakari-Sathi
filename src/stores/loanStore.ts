import { create } from 'zustand';

interface LoanState {
  searchQuery: string;
  selectedBranch: string;
  filterStatus: string;
  setSearchQuery: (query: string) => void;
  setSelectedBranch: (branchId: string) => void;
  setFilterStatus: (status: string) => void;
}

export const useLoanStore = create<LoanState>((set) => ({
  searchQuery: '',
  selectedBranch: '',
  filterStatus: 'all',
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedBranch: (branchId) => set({ selectedBranch: branchId }),
  setFilterStatus: (status) => set({ filterStatus: status }),
}));
