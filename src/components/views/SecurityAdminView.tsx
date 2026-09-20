import React, { useState } from 'react';
import { useCoop, MenuViewMode } from '../../context/CoopContext';
import { Shield, KeyRound, Lock, UserCheck2, CheckCircle2, List, Layers, ListTree, Sliders, Check, Settings2, Save, Sparkles } from 'lucide-react';
import { FormLabelWithHelp } from '../common/FormHelpTooltip';

export const SecurityAdminView: React.FC = () => {
  const { activeRole, branches, menuViewMode, setMenuViewMode, addNotification } = useCoop();

  // Setup form states
  const [copomisCode, setCopomisCode] = useState('COP-2080-KTM-4421');
  const [interestTaxRate, setInterestTaxRate] = useState('5.0');
  const [minCapitalReserveRatio, setMinCapitalReserveRatio] = useState('15.0');
  const [nplProvisionStandard, setNplProvisionStandard] = useState('1.0');
  const [nplProvisionSubstandard, setNplProvisionSubstandard] = useState('25.0');
  const [nplProvisionDoubtful, setNplProvisionDoubtful] = useState('50.0');
  const [nplProvisionLoss, setNplProvisionLoss] = useState('100.0');
  const [tellerDailyCashLimit, setTellerDailyCashLimit] = useState('500000');

  const handleModeChange = (mode: MenuViewMode) => {
    setMenuViewMode(mode);
    const modeLabel = mode === 'list' ? 'Simple List View' : (mode === 'split' ? '2-Pane Split View' : 'Expandable Tree View');
    addNotification('Menu Style Updated', `Navigation menu view style changed to ${modeLabel}.`, 'info');
  };

  const handleSaveParameters = (e: React.FormEvent) => {
    e.preventDefault();
    addNotification('Regulatory Parameters Saved', 'CopOMIS and PEARLS financial compliance setup parameters updated successfully.', 'success');
  };

  return (
    <div className="p-1 sm:p-2.5 space-y-4 max-w-[1800px] mx-auto text-slate-800 text-xs">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">System Setups & Security Administration</h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 font-medium">
            <Shield className="w-3.5 h-3.5 text-slate-500" />
            <span>Configure system navigation preferences, role-based access matrix, and security controls</span>
          </p>
        </div>
      </div>

      {/* Navigation View Style Setup Preference Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-emerald-700" />
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Navigation Menu View Style Setup</h2>
              <p className="text-slate-500 text-[11px]">Control how sub-menus and sub-submenus are presented across the system</p>
            </div>
          </div>
          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            Active Mode: {menuViewMode === 'list' ? 'Simple List' : (menuViewMode === 'split' ? '2-Pane Split' : 'Expandable Tree')}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Simple List View Option */}
          <button
            onClick={() => handleModeChange('list')}
            className={`p-4 rounded-xl border text-left transition flex flex-col justify-between space-y-3 cursor-pointer ${ menuViewMode === 'list' ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20' : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60' }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
                  <List className="w-5 h-5" />
                </div>
                {menuViewMode === 'list' && (
                  <span className="p-1 rounded-full bg-emerald-600 text-white font-bold">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">1. Simple List View</h3>
                <p className="text-slate-600 text-xs mt-1">
                  Clean, un-bordered simple list of sub-menus and sub-submenus with subtle hover highlights.
                </p>
              </div>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1 font-mono text-[10px] text-slate-600">
              <div className="text-emerald-800 font-bold uppercase">CATEGORY HEADER</div>
              <div className="pl-2 border-l border-slate-300 text-slate-700">• Submenu Item 1</div>
              <div className="pl-2 border-l border-slate-300 text-slate-700">• Submenu Item 2</div>
            </div>
          </button>

          {/* 2-Pane Split View Option */}
          <button
            onClick={() => handleModeChange('split')}
            className={`p-4 rounded-xl border text-left transition flex flex-col justify-between space-y-3 cursor-pointer ${ menuViewMode === 'split' ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20' : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60' }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
                  <Layers className="w-5 h-5" />
                </div>
                {menuViewMode === 'split' && (
                  <span className="p-1 rounded-full bg-emerald-600 text-white font-bold">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">2. 2-Pane Split View</h3>
                <p className="text-slate-600 text-xs mt-1">
                  Side-by-side split panel with hover category navigation on left and item choices on right.
                </p>
              </div>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex gap-2 font-mono text-[10px] text-slate-600">
              <div className="w-1/2 border-r border-slate-200 pr-1 text-emerald-800 font-bold">Submenu →</div>
              <div className="w-1/2 pl-1 text-slate-700">Item Detail</div>
            </div>
          </button>

          {/* Expandable Tree View Option */}
          <button
            onClick={() => handleModeChange('tree')}
            className={`p-4 rounded-xl border text-left transition flex flex-col justify-between space-y-3 cursor-pointer ${ menuViewMode === 'tree' ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20' : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60' }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-lg bg-amber-100 text-amber-800">
                  <ListTree className="w-5 h-5" />
                </div>
                {menuViewMode === 'tree' && (
                  <span className="p-1 rounded-full bg-emerald-600 text-white font-bold">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">3. Expandable Tree View</h3>
                <p className="text-slate-600 text-xs mt-1">
                  Hierarchical tree structure with expandable and collapsible categories.
                </p>
              </div>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1 font-mono text-[10px] text-slate-600">
              <div className="text-amber-800 font-bold">▼ Folder Category</div>
              <div className="pl-3 text-slate-700 font-sans">├ Sub item</div>
            </div>
          </button>
        </div>
      </div>

      {/* Financial & CopOMIS Setup Parameters Card with Context-Sensitive Tooltips */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-emerald-700" />
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Regulatory & Financial Parameters Setup</h2>
              <p className="text-slate-500 text-[11px]">Hover or click the "?" icons next to field labels for guidance on CopOMIS and NRB compliance</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSaveParameters}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs text-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Configuration</span>
          </button>
        </div>

        <form onSubmit={handleSaveParameters} className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div className="space-y-1">
            <FormLabelWithHelp
              label="CopOMIS Registration Code"
              required
              helpTitle="CopOMIS System Identifier"
              helpText="Official registration code issued by the Department of Cooperatives for automated CopOMIS XML export syncing."
              example="COP-2080-KTM-4421"
            />
            <input
              type="text"
              required
              value={copomisCode}
              onChange={(e) => setCopomisCode(e.target.value)}
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-300 rounded-lg p-2 font-mono text-xs text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none font-bold"
            />
          </div>

          <div className="space-y-1">
            <FormLabelWithHelp
              label="Interest Tax TDS Rate (%)"
              required
              helpTitle="Income Tax Act Requirement"
              helpText="Mandatory tax deducted at source on member savings interest payout per Nepal Inland Revenue Dept."
              example="5.0%"
            />
            <input
              type="number"
              step="0.1"
              required
              value={interestTaxRate}
              onChange={(e) => setInterestTaxRate(e.target.value)}
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-300 rounded-lg p-2 font-mono text-xs text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <FormLabelWithHelp
              label="Min. Capital Reserve Ratio (%)"
              required
              helpTitle="PEARLS Standard 'E' Ratio"
              helpText="Minimum proportion of net savings deposits that must be held in statutory reserve fund."
              example="15.0%"
            />
            <input
              type="number"
              step="0.5"
              required
              value={minCapitalReserveRatio}
              onChange={(e) => setMinCapitalReserveRatio(e.target.value)}
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-300 rounded-lg p-2 font-mono text-xs text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <FormLabelWithHelp
              label="Standard Loan Provision (%)"
              required
              helpTitle="Performing Loan Provision"
              helpText="Provision percentage for loans with overdue days 0 to 30 (Good Performing Category)."
              example="1.0%"
            />
            <input
              type="number"
              step="0.1"
              required
              value={nplProvisionStandard}
              onChange={(e) => setNplProvisionStandard(e.target.value)}
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-300 rounded-lg p-2 font-mono text-xs text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <FormLabelWithHelp
              label="Substandard Loan Provision (%)"
              required
              helpTitle="Watchlist Loan Category"
              helpText="Mandatory provision for loans overdue between 31 to 90 days per cooperative regulations."
              example="25.0%"
            />
            <input
              type="number"
              step="1"
              required
              value={nplProvisionSubstandard}
              onChange={(e) => setNplProvisionSubstandard(e.target.value)}
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-300 rounded-lg p-2 font-mono text-xs text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <FormLabelWithHelp
              label="Teller Counter Cash Limit (NPR)"
              required
              helpTitle="Vault Security Ceiling"
              helpText="Maximum cash balance allowed in a cashier vault before mandatory transfer to main branch safe."
              example="NPR 500,000"
            />
            <input
              type="number"
              required
              value={tellerDailyCashLimit}
              onChange={(e) => setTellerDailyCashLimit(e.target.value)}
              className="w-full bg-slate-50 border placeholder-slate-400 border-slate-300 rounded-lg p-2 font-mono text-xs text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none font-bold"
            />
          </div>
        </form>
      </div>

      {/* Security Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-bold text-slate-900 text-sm">Active Session Identity</span>
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-mono font-bold">
              ADMINISTRATOR
            </span>
          </div>

          <div className="space-y-1.5 text-slate-600">
            <div>User: <span className="font-bold text-slate-900">System Admin ({activeRole})</span></div>
            <div>Email: <span className="font-mono text-emerald-800 font-semibold">admin@sahakarisathi.org.np</span></div>
            <div>Assigned Branch: <span className="font-bold text-slate-800">Head Office (Main Branch)</span></div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-bold text-slate-900 text-sm">Multi-Factor Authentication (MFA)</span>
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold">
              ENFORCED
            </span>
          </div>

          <p className="text-slate-600">
            All cashier teller withdrawals exceeding NPR 100,000 require dual-control manager SMS OTP / TOTP hardware verification.
          </p>
        </div>

      </div>

      {/* Role Access Matrix */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="font-bold text-slate-900 text-base">Role-Based Access Control (RBAC) Permission Matrix</h2>

        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px]">
              <tr>
                <th className="p-3">System Role</th>
                <th className="p-3">Deposit / Withdraw Teller</th>
                <th className="p-3">Loan Appraisal</th>
                <th className="p-3">Loan Approval Sign-off</th>
                <th className="p-3">Manual GL Vouchers</th>
                <th className="p-3">PEARLS Regulatory Returns</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              <tr className="hover:bg-slate-50">
                <td className="p-3 font-bold text-emerald-800">Branch Manager</td>
                <td className="p-3 text-emerald-800 font-medium">✓ Full</td>
                <td className="p-3 text-emerald-800 font-medium">✓ Full</td>
                <td className="p-3 text-emerald-800 font-bold">✓ Authorized</td>
                <td className="p-3 text-emerald-800 font-medium">✓ Full</td>
                <td className="p-3 text-emerald-800 font-medium">✓ Full</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="p-3 font-bold text-emerald-800">Teller / Cashier</td>
                <td className="p-3 text-emerald-800 font-medium">✓ Full</td>
                <td className="p-3 text-slate-500">✗ No Access</td>
                <td className="p-3 text-slate-500">✗ No Access</td>
                <td className="p-3 text-slate-500">✗ No Access</td>
                <td className="p-3 text-slate-500">✗ No Access</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="p-3 font-bold text-purple-800">Internal Auditor</td>
                <td className="p-3 text-amber-700 font-medium">Read-only</td>
                <td className="p-3 text-amber-700 font-medium">Read-only</td>
                <td className="p-3 text-slate-500">✗ No Access</td>
                <td className="p-3 text-amber-700 font-medium">Read-only</td>
                <td className="p-3 text-emerald-800 font-medium">✓ Full</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
