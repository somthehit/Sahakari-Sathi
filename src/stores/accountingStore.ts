import { create } from 'zustand';

interface AccountingState {
  voucherSearch: string;
  selectedFiscalYear: string;
  filterType: string;
  setVoucherSearch: (query: string) => void;
  setSelectedFiscalYear: (fy: string) => void;
  setFilterType: (type: string) => void;
}

export const useAccountingStore = create<AccountingState>((set) => ({
  voucherSearch: '',
  selectedFiscalYear: '',
  filterType: 'all',
  
  setVoucherSearch: (query) => set({ voucherSearch: query }),
  setSelectedFiscalYear: (fy) => set({ selectedFiscalYear: fy }),
  setFilterType: (type) => set({ filterType: type }),
}));
