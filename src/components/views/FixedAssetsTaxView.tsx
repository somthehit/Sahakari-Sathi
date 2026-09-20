import React, { useState } from 'react';
import { useCoop } from '../../context/CoopContext';
import { Building, Sparkles, Plus, Building2 } from 'lucide-react';
import { formatNPR, getTodayBS } from '../../utils/nepaliCalendar';
import { ExpandableFormCard } from '../common/ExpandableFormCard';
import { FormLabelWithHelp } from '../common/FormHelpTooltip';

export const FixedAssetsTaxView: React.FC = () => {
  const { fixedAssets, runDepreciation, addNotification } = useCoop();

  const [assetName, setAssetName] = useState('');
  const [category, setCategory] = useState<'Property & Land' | 'Computers & IT' | 'Furniture & Fixtures' | 'Vehicles'>('Computers & IT');
  const [cost, setCost] = useState('');
  const [depRate, setDepRate] = useState('25');

  const handleAddAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetName || !cost) return;

    addNotification('Fixed Asset Added', `${assetName} registered in Fixed Asset Ledger.`, 'success');
    setAssetName('');
    setCost('');
  };

  const totalAssetCost = fixedAssets.reduce((s, a) => s + a.originalCost, 0);
  const totalBookValue = fixedAssets.reduce((s, a) => s + a.currentBookValue, 0);

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Fixed Assets Register & Depreciation Engine</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <Building className="w-3.5 h-3.5 text-slate-500" />
            <span>Written-Down Value (WDV) depreciation calculation & tax compliance</span>
          </p>
        </div>

        <button
          onClick={runDepreciation}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-xs cursor-pointer transition text-xs"
        >
          <Sparkles className="w-4 h-4" />
          <span>Execute Monthly Depreciation Run</span>
        </button>
      </div>

      {/* Asset Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-slate-500 text-xs font-semibold">Original Asset Acquisition Cost</span>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">{formatNPR(totalAssetCost)}</div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-slate-500 text-xs font-semibold">Net Written-Down Book Value</span>
          <div className="text-2xl font-black text-emerald-700 font-mono mt-1">{formatNPR(totalBookValue)}</div>
        </div>
      </div>

      {/* Add Fixed Asset Form */}
      <ExpandableFormCard
        title="Register New Fixed Asset Item"
        subtitle="Record office computers, building, furniture, or vehicle acquisition in asset register"
        icon={<Building2 className="w-5 h-5 text-emerald-700" />}
        onSubmit={handleAddAsset}
        footerActions={
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Fixed Asset to Register</span>
          </button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <FormLabelWithHelp
              label="Asset Description / Name"
              required
              helpTitle="Asset Description"
              helpText="Specify description, brand, or model of the capital asset."
              example="HP ProDesk i7 Counter Computer"
            />
            <input
              type="text"
              required
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              placeholder="e.g. Branch Generator 15KVA"
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-300 rounded-lg p-2 font-medium text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none text-xs"
            />
          </div>

          <div>
            <FormLabelWithHelp
              label="Asset Category"
              required
              helpTitle="Tax Pool Category"
              helpText="Select tax depreciation block category according to Nepal Income Tax Act."
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-300 rounded-lg p-2 text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none text-xs"
            >
              <option value="Computers & IT">Computers & IT (25% WDV)</option>
              <option value="Furniture & Fixtures">Furniture & Fixtures (25% WDV)</option>
              <option value="Vehicles">Vehicles (20% WDV)</option>
              <option value="Property & Land">Property & Building (5% WDV)</option>
            </select>
          </div>

          <div>
            <FormLabelWithHelp
              label="Acquisition Cost (NPR)"
              required
              helpTitle="Cost Value"
              helpText="Total purchase cost including freight and installation charges."
              example="125,000"
            />
            <input
              type="number"
              required
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0.00"
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-300 rounded-lg p-2 font-mono text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none text-xs font-bold"
            />
          </div>

          <div>
            <FormLabelWithHelp
              label="Depreciation WDV Rate (%)"
              required
              helpTitle="Annual Rate"
              helpText="Percentage rate for written down value depreciation calculation."
              example="25%"
            />
            <input
              type="number"
              required
              value={depRate}
              onChange={(e) => setDepRate(e.target.value)}
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-300 rounded-lg p-2 font-mono text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none text-xs"
            />
          </div>
        </div>
      </ExpandableFormCard>

      {/* Fixed Asset Register Table */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="font-bold text-slate-900 text-base">Fixed Asset Register</h2>

        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
              <tr>
                <th className="p-3">Asset Code & Name</th>
                <th className="p-3">Category</th>
                <th className="p-3">Depreciation Method</th>
                <th className="p-3 text-right">Original Cost</th>
                <th className="p-3 text-right">Accumulated Dep.</th>
                <th className="p-3 text-right">Net Book Value (रु.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {fixedAssets.map(a => (
                <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 font-bold text-slate-900">
                    <span className="font-mono text-emerald-700 mr-2">{a.assetCode}</span>
                    <span>{a.assetName}</span>
                  </td>
                  <td className="p-3 text-slate-500">{a.category}</td>
                  <td className="p-3 text-slate-600">{a.depreciationMethod} ({a.depreciationRatePercent}%)</td>
                  <td className="p-3 text-right font-mono text-slate-700">{formatNPR(a.originalCost)}</td>
                  <td className="p-3 text-right font-mono text-rose-600 font-medium">{formatNPR(a.accumulatedDepreciation)}</td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-700">{formatNPR(a.currentBookValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
