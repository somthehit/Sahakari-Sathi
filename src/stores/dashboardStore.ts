import { create } from 'zustand';

interface DashboardState {
  dateRange: { start: string; end: string } | null;
  selectedBranch: string;
  setDateRange: (range: { start: string; end: string } | null) => void;
  setSelectedBranch: (branchId: string) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  dateRange: null,
  selectedBranch: 'all',
  
  setDateRange: (range) => set({ dateRange: range }),
  setSelectedBranch: (branchId) => set({ selectedBranch: branchId }),
}));
