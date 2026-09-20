import React, { useState, useEffect } from 'react';
import { useCoop } from '../../context/CoopContext';
import { PiggyBank, Landmark, Plus, Save, Percent } from 'lucide-react';
import { AdminSetupSearchFilterBar } from '../common/AdminSetupSearchFilterBar';
import { CloseableSubTabs } from '../common/CloseableSubTabs';

interface Props {
  activeSubKey?: string;
}

export const SetupDepositLoanView: React.FC<Props> = ({ activeSubKey = 'setup_deposit_products' }) => {
  const { addNotification } = useCoop();
  const [subTab, setSubTab] = useState<string>(activeSubKey);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    if (activeSubKey) {
      setSubTab(activeSubKey);
    }
  }, [activeSubKey]);

  const [depositProducts] = useState([
    { id: 'dp1', code: 'SAV-REG', name: 'Regular Ordinary Savings', interestRate: 6.5, minBal: 1000, type: 'Savings' },
    { id: 'dp2', code: 'SAV-FD1', name: '1-Year Term Fixed Deposit', interestRate: 10.5, minBal: 10000, type: 'Term Deposit' },
    { id: 'dp3', code: 'SAV-RD', name: 'Monthly Recurring Deposit Plan', interestRate: 8.5, minBal: 500, type: 'Recurring' },
    { id: 'dp4', code: 'SAV-MIC', name: 'Daily Micro-finance Savings', interestRate: 5.0, minBal: 100, type: 'Daily Collection' },
  ]);

  const [loanProducts] = useState([
    { id: 'lp1', code: 'LN-BUS', name: 'Business Expansion Loan', interestRate: 13.5, method: 'Declining Balance', maxTenure: 60 },
    { id: 'lp2', code: 'LN-AGR', name: 'Agriculture & Farm Produce Loan', interestRate: 11.0, method: 'Declining Balance', maxTenure: 36 },
    { id: 'lp3', code: 'LN-HOM', name: 'Personal Home Housing Loan', interestRate: 14.0, method: 'Declining Balance', maxTenure: 180 },
    { id: 'lp4', code: 'LN-EMG', name: 'Instant Emergency Micro Loan', interestRate: 15.0, method: 'Flat Rate', maxTenure: 12 },
  ]);

  const handleSave = () => {
    addNotification('Product Configuration Saved', 'Product rates and terms updated successfully.', 'success');
  };

  const filteredDeposits = depositProducts.filter(p => {
    const matchesSearch = (p.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || (p.code || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    const matchesType = typeFilter === 'all' || (p.type || '').toLowerCase().includes((typeFilter || '').toLowerCase());
    return matchesSearch && matchesType;
  });

  const filteredLoans = loanProducts.filter(lp => {
    const matchesSearch = (lp.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || (lp.code || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    const matchesMethod = typeFilter === 'all' || (lp.method || '').toLowerCase().includes((typeFilter || '').toLowerCase());
    return matchesSearch && matchesMethod;
  });

  return (
    <div className="space-y-6">

      {/* Persistent Search and Filter Bar */}
      <AdminSetupSearchFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={subTab === 'setup_deposit_products' ? 'Search deposit schemes by name or code...' : 'Search credit/loan schemes by name or code...'}
        filterGroups={[
          {
            id: 'typeFilter',
            label: subTab === 'setup_deposit_products' ? 'Scheme Type' : 'Calculation Method',
            value: typeFilter,
            options: subTab === 'setup_deposit_products' ? [
              { label: 'All Types', value: 'all' },
              { label: 'Savings', value: 'savings' },
              { label: 'Term Deposit', value: 'term' },
              { label: 'Recurring', value: 'recurring' },
              { label: 'Daily Collection', value: 'daily' },
            ] : [
              { label: 'All Methods', value: 'all' },
              { label: 'Declining Balance', value: 'declining' },
              { label: 'Flat Rate', value: 'flat' },
            ],
            onChange: setTypeFilter,
          }
        ]}
        quickStats={[
          { label: 'Active Schemes', value: subTab === 'setup_deposit_products' ? filteredDeposits.length : filteredLoans.length, color: 'text-emerald-400' }
        ]}
      />

      {/* DEPOSIT PRODUCTS */}
      {subTab === 'setup_deposit_products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Savings & Term Deposit Products Catalog</h3>
            <button
              onClick={() => addNotification('New Deposit Product', 'Opening product setup form.', 'info')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center gap-2 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" /> Create Deposit Product
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredDeposits.map((p) => (
              <div key={p.id} className="bg-white p-5 rounded-xl border border-slate-200 space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-900 text-sm">{p.name}</span>
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                    {p.code}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Annual Interest Rate:</span>
                  <span className="text-emerald-700 font-mono font-bold">{p.interestRate}% p.a.</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Minimum Balance:</span>
                  <span className="text-slate-900 font-mono font-bold">NPR {p.minBal.toLocaleString()}</span>
                </div>
                <div className="pt-2 text-right">
                  <button onClick={handleSave} className="text-emerald-600 hover:underline text-xs font-bold cursor-pointer">
                    Configure Rates & Penalty →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LOAN PRODUCTS */}
      {subTab === 'setup_loan_products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Credit & Loan Products Portfolio Scheme</h3>
            <button
              onClick={() => addNotification('New Loan Product', 'Opening credit scheme setup form.', 'info')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center gap-2 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" /> Create Loan Product
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredLoans.map((lp) => (
              <div key={lp.id} className="bg-white p-5 rounded-xl border border-slate-200 space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-900 text-sm">{lp.name}</span>
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                    {lp.code}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Interest Method:</span>
                  <span className="text-slate-800 font-bold">{lp.method}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Interest Rate:</span>
                  <span className="text-emerald-700 font-mono font-bold">{lp.interestRate}% p.a.</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Max Tenure:</span>
                  <span className="text-slate-900 font-mono font-bold">{lp.maxTenure} Months</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
