import React, { useState, useEffect } from 'react';
import { useCoop } from '../../context/CoopContext';
import { Box, Layers, Building, Plus, Save } from 'lucide-react';
import { AdminSetupSearchFilterBar } from '../common/AdminSetupSearchFilterBar';
import { CloseableSubTabs } from '../common/CloseableSubTabs';

interface Props {
  activeSubKey?: string;
}

export const SetupInventoryAssetView: React.FC<Props> = ({ activeSubKey = 'setup_product_categories' }) => {
  const { addNotification } = useCoop();
  const [subTab, setSubTab] = useState<string>(activeSubKey);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (activeSubKey) {
      setSubTab(activeSubKey);
    }
  }, [activeSubKey]);

  const categories = [
    { id: '1', name: 'Office Stationery & Printing', code: 'CAT-STAT', itemGroup: 'Consumables' },
    { id: '2', name: 'Computer Hardware & IT Equipment', code: 'CAT-IT', itemGroup: 'Fixed Asset / Capital' },
    { id: '3', name: 'Passbooks & Voucher Books', code: 'CAT-PASS', itemGroup: 'Printed Security Stock' },
  ];

  const warehouses = [
    { id: '1', name: 'Head Office Central Store', location: 'New Road, Kathmandu', manager: 'Bikash Maharjan' },
    { id: '2', name: 'Branch 1 Store Room', location: 'Kalanki, Kathmandu', manager: 'Anil Thapa' },
  ];

  const handleSave = () => {
    addNotification('Settings Saved', 'Inventory category and warehouse details saved.', 'success');
  };

  const filteredCategories = categories.filter(c =>
    (c.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (c.code || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (c.itemGroup || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  const filteredWarehouses = warehouses.filter(w =>
    (w.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (w.location || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (w.manager || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  return (
    <div className="space-y-6">

      {/* Persistent Search Bar */}
      <AdminSetupSearchFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={subTab === 'setup_product_categories' ? 'Search inventory category name or code...' : 'Search warehouse location or manager...'}
        quickStats={[
          { label: 'Count', value: subTab === 'setup_product_categories' ? filteredCategories.length : filteredWarehouses.length, color: 'text-emerald-400' }
        ]}
      />

      {/* PRODUCT CATEGORIES */}
      {subTab === 'setup_product_categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">Inventory Item Classification Categories</h3>
            <button
              onClick={() => addNotification('Add Category', 'Opening inventory category form.', 'info')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center gap-2 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" /> Add Category
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs text-xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px] uppercase">
                <tr>
                  <th className="p-3">Category Code</th>
                  <th className="p-3">Category Name</th>
                  <th className="p-3">Item Group</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredCategories.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-emerald-700 font-bold">{c.code}</td>
                    <td className="p-3 font-bold text-slate-900">{c.name}</td>
                    <td className="p-3 text-slate-600">{c.itemGroup}</td>
                    <td className="p-3 text-right">
                      <button onClick={handleSave} className="text-emerald-700 hover:underline font-bold cursor-pointer">
                        Edit Category →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WAREHOUSES */}
      {subTab === 'setup_warehouses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredWarehouses.map((w) => (
            <div key={w.id} className="bg-white p-5 rounded-xl border border-slate-200 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-900 text-sm">{w.name}</span>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                  Active Store
                </span>
              </div>
              <div className="text-slate-500 text-xs">Location: <span className="text-slate-700">{w.location}</span></div>
              <div className="text-slate-500 text-xs">Store In-charge: <span className="text-slate-900 font-bold">{w.manager}</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
