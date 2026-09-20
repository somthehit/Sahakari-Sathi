import React, { useState, useEffect, useMemo } from 'react';
import { useCoop } from '../../context/CoopContext';
import { ChartOfAccount } from '../../types/coop';
import { 
  FolderTree, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Lock, 
  Layers, 
  Building2, 
  DollarSign, 
  Search, 
  Filter, 
  Edit3, 
  Save, 
  X, 
  Tag, 
  Info,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import { AdminSetupSearchFilterBar } from '../common/AdminSetupSearchFilterBar';
import { formatNPR } from '../../utils/nepaliCalendar';

interface Props {
  activeSubKey?: string;
}

// COA Tree Node Interface
interface TreeNode extends ChartOfAccount {
  children: TreeNode[];
  level: number;
}

export const SetupAccountingCashView: React.FC<Props> = ({ activeSubKey = 'setup_coa' }) => {
  const { chartOfAccounts, addChartOfAccount, addNotification } = useCoop();
  const [subTab, setSubTab] = useState<string>(activeSubKey);
  const [searchTerm, setSearchTerm] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState<'all' | 'groups' | 'ledgers'>('all');

  // Expanded Tree Nodes State (Keys are account codes)
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Modal State for Adding New Ledger Account / Group
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedParentCode, setSelectedParentCode] = useState<string>('');
  
  // Form Fields
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    nameNepali: '',
    type: 'Asset' as 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense',
    parentCode: '',
    isGroup: false,
    openingBalance: 0,
    description: '',
  });

  // Modal State for Editing Non-System Account
  const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null);

  // Bank Accounts Local State
  const [banks, setBanks] = useState([
    { id: 'b1', name: 'Nabil Bank Ltd.', accNo: '0101017500012', type: 'Current Account', branch: 'New Road Branch', glCode: '04-90', balance: 5200000 },
    { id: 'b2', name: 'Rastriya Banijya Bank', accNo: '1090001284001', type: 'Current Account', branch: 'Bishal Bazaar', glCode: '04-90', balance: 4800000 },
    { id: 'b3', name: 'Nepal Investment Mega Bank', accNo: '0280105000492', type: 'Call Deposit Account', branch: 'Durbar Marg', glCode: '04-90', balance: 2500000 },
  ]);

  const [isAddBankModalOpen, setIsAddBankModalOpen] = useState(false);
  const [newBankData, setNewBankData] = useState({
    name: '',
    accNo: '',
    type: 'Current Account',
    branch: '',
    openingBalance: 0,
  });

  useEffect(() => {
    if (activeSubKey) {
      setSubTab(activeSubKey);
    }
  }, [activeSubKey]);

  // Initially expand top-level major headings (e.g., "01", "02", "03", "04", "05")
  useEffect(() => {
    const initialExpanded: Record<string, boolean> = {};
    (chartOfAccounts || []).forEach(acc => {
      if (!acc.parentCode || acc.code.length <= 2) {
        initialExpanded[acc.code] = true;
      }
    });
    setExpandedNodes(initialExpanded);
  }, [chartOfAccounts]);

  // Helper function to build COA Hierarchy Tree from flat list
  const coaTree = useMemo(() => {
    const safeAccounts = chartOfAccounts || [];
    const accountMap: Record<string, TreeNode> = {};

    // First pass: create TreeNode objects
    safeAccounts.forEach(acc => {
      accountMap[acc.code] = {
        ...acc,
        children: [],
        level: 0,
      };
    });

    const rootNodes: TreeNode[] = [];

    // Second pass: link parents and children
    safeAccounts.forEach(acc => {
      const node = accountMap[acc.code];
      if (acc.parentCode && accountMap[acc.parentCode]) {
        const parentNode = accountMap[acc.parentCode];
        node.level = parentNode.level + 1;
        parentNode.children.push(node);
      } else {
        node.level = 1;
        rootNodes.push(node);
      }
    });

    // Helper to calculate depth and sort by code
    const sortNodes = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));
      nodes.forEach(n => {
        if (n.children.length > 0) {
          sortNodes(n.children);
        }
      });
    };

    sortNodes(rootNodes);
    return rootNodes;
  }, [chartOfAccounts]);

  // Flatten tree for rendering with search/filter evaluation
  const flattenedNodes = useMemo(() => {
    const result: TreeNode[] = [];
    const term = (searchTerm || '').toLowerCase().trim();

    // Check if node or any of its descendants matches search
    const matchesNode = (node: TreeNode): boolean => {
      const matchesSearch = !term || 
        node.code.toLowerCase().includes(term) || 
        node.name.toLowerCase().includes(term) ||
        (node.parentCode && node.parentCode.toLowerCase().includes(term));
      
      const matchesType = accountTypeFilter === 'all' || 
        node.type.toLowerCase() === accountTypeFilter.toLowerCase();

      const isGroupNode = node.children.length > 0 || !node.parentCode || node.code.split('-').length <= 2;
      const matchesLevel = levelFilter === 'all' || 
        (levelFilter === 'groups' && isGroupNode) ||
        (levelFilter === 'ledgers' && !isGroupNode);

      return matchesSearch && matchesType && matchesLevel;
    };

    const hasMatchingDescendant = (node: TreeNode): boolean => {
      if (matchesNode(node)) return true;
      return node.children.some(child => hasMatchingDescendant(child));
    };

    const traverse = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        const directMatch = matchesNode(node);
        const descendantMatch = hasMatchingDescendant(node);

        if (directMatch || descendantMatch) {
          result.push(node);
          // If searching or node is expanded, traverse children
          if (term || expandedNodes[node.code]) {
            traverse(node.children);
          }
        }
      });
    };

    traverse(coaTree);
    return result;
  }, [coaTree, searchTerm, accountTypeFilter, levelFilter, expandedNodes]);

  // Handle Toggle Node Expand / Collapse
  const toggleExpand = (code: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [code]: !prev[code]
    }));
  };

  const handleExpandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    (chartOfAccounts || []).forEach(acc => {
      allExpanded[acc.code] = true;
    });
    setExpandedNodes(allExpanded);
  };

  const handleCollapseAll = () => {
    setExpandedNodes({});
  };

  // Open Modal to Add Child Ledger Group or Account
  const handleOpenAddModal = (parentCode?: string) => {
    const pCode = parentCode || '';
    setSelectedParentCode(pCode);

    // Auto find parent account to infer type & suggest code
    const parentAcc = (chartOfAccounts || []).find(a => a.code === pCode);
    const parentType = parentAcc ? (parentAcc.type as any) : 'Asset';

    // Generate suggested code
    let suggestedCode = '';
    if (pCode) {
      const siblings = (chartOfAccounts || []).filter(a => a.parentCode === pCode);
      const siblingIndex = siblings.length + 1;
      const suffix = siblingIndex < 10 ? `00${siblingIndex}` : siblingIndex < 100 ? `0${siblingIndex}` : `${siblingIndex}`;
      suggestedCode = `${pCode}-${suffix}`;
    } else {
      suggestedCode = `0${(chartOfAccounts || []).filter(a => !a.parentCode).length + 1}`;
    }

    setFormData({
      code: suggestedCode,
      name: '',
      nameNepali: '',
      type: parentType,
      parentCode: pCode,
      isGroup: false,
      openingBalance: 0,
      description: '',
    });

    setIsAddModalOpen(true);
  };

  // Auto-update form values when parent changes in modal
  const handleParentSelectChange = (newParentCode: string) => {
    setSelectedParentCode(newParentCode);
    const parentAcc = (chartOfAccounts || []).find(a => a.code === newParentCode);
    const parentType = parentAcc ? (parentAcc.type as any) : formData.type;

    let suggestedCode = '';
    if (newParentCode) {
      const siblings = (chartOfAccounts || []).filter(a => a.parentCode === newParentCode);
      const siblingIndex = siblings.length + 1;
      const suffix = siblingIndex < 10 ? `00${siblingIndex}` : siblingIndex < 100 ? `0${siblingIndex}` : `${siblingIndex}`;
      suggestedCode = `${newParentCode}-${suffix}`;
    }

    setFormData(prev => ({
      ...prev,
      parentCode: newParentCode,
      type: parentType,
      code: suggestedCode || prev.code,
    }));
  };

  // Submit New Ledger Group / Account
  const handleSaveNewAccount = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code.trim()) {
      addNotification('Validation Error', 'Please enter a valid GL Account Code.', 'warning');
      return;
    }

    if (!formData.name.trim()) {
      addNotification('Validation Error', 'Please enter an Account Name.', 'warning');
      return;
    }

    // Check code uniqueness
    const exists = (chartOfAccounts || []).some(a => a.code.toLowerCase() === formData.code.trim().toLowerCase());
    if (exists) {
      addNotification('Duplicate Code', `GL Account Code "${formData.code}" already exists. Please choose a unique code.`, 'warning');
      return;
    }

    const nameCombined = formData.nameNepali ? `${formData.name.trim()} (${formData.nameNepali.trim()})` : formData.name.trim();

    addChartOfAccount({
      code: formData.code.trim(),
      name: nameCombined,
      type: formData.type,
      parentCode: formData.parentCode || undefined,
      balance: formData.openingBalance || 0,
      isSystemAccount: false,
    });

    // Auto-expand parent node to reveal newly created child
    if (formData.parentCode) {
      setExpandedNodes(prev => ({ ...prev, [formData.parentCode]: true }));
    }

    setIsAddModalOpen(false);
  };

  // Save Bank Account
  const handleSaveBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankData.name || !newBankData.accNo) {
      addNotification('Validation Error', 'Bank name and account number are required.', 'warning');
      return;
    }

    const bankObj = {
      id: `bank_${Date.now()}`,
      name: newBankData.name,
      accNo: newBankData.accNo,
      type: newBankData.type,
      branch: newBankData.branch || 'Head Office',
      glCode: '04-90',
      balance: newBankData.openingBalance || 0,
    };

    setBanks(prev => [bankObj, ...prev]);
    addNotification('Bank Account Added', `${bankObj.name} linked to GL Code 04-90.`, 'success');
    setIsAddBankModalOpen(false);
    setNewBankData({ name: '', accNo: '', type: 'Current Account', branch: '', openingBalance: 0 });
  };

  const filteredBanks = banks.filter(b => 
    (b.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
    (b.accNo || '').includes(searchTerm || '') || 
    (b.branch || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  // Stats calculation
  const totalAccountsCount = (chartOfAccounts || []).length;
  const majorHeadingsCount = (chartOfAccounts || []).filter(a => !a.parentCode || a.code.split('-').length === 1).length;
  const groupsCount = (chartOfAccounts || []).filter(a => a.parentCode && a.code.split('-').length <= 3).length;
  const transactionalLedgersCount = totalAccountsCount - majorHeadingsCount - groupsCount;

  return (
    <div className="space-y-6">

      {/* Search and Filter Bar */}
      <AdminSetupSearchFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={subTab === 'setup_coa' ? 'Search by GL code, account name (English or Nepali)...' : 'Search bank name, account no, or branch...'}
        filterGroups={subTab === 'setup_coa' ? [
          {
            id: 'accountType',
            label: 'Classification',
            value: accountTypeFilter,
            options: [
              { label: 'All Classifications', value: 'all' },
              { label: 'Asset (सम्पत्ती)', value: 'asset' },
              { label: 'Liability (दायित्व)', value: 'liability' },
              { label: 'Equity (इक्विटी/कोष)', value: 'equity' },
              { label: 'Income (आम्दानी)', value: 'income' },
              { label: 'Expense (खर्च)', value: 'expense' },
            ],
            onChange: setAccountTypeFilter,
          },
          {
            id: 'levelType',
            label: 'Hierarchy Level',
            value: levelFilter,
            options: [
              { label: 'All Levels', value: 'all' },
              { label: 'Groups & Headings Only', value: 'groups' },
              { label: 'Transactional Ledgers Only', value: 'ledgers' },
            ],
            onChange: (val: any) => setLevelFilter(val),
          }
        ] : undefined}
        quickStats={[
          { label: 'Total GL Heads', value: totalAccountsCount, color: 'text-emerald-400' },
          { label: 'Major Headings', value: majorHeadingsCount, color: 'text-purple-400' },
          { label: 'Sub-Groups', value: groupsCount, color: 'text-amber-400' },
          { label: 'Ledgers', value: transactionalLedgersCount, color: 'text-teal-400' },
        ]}
      />

      {/* COA HIERARCHY TREE SETUP */}
      {subTab === 'setup_coa' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Chart of Accounts Hierarchy Tree</h3>
                <p className="text-[11px] text-slate-500">
                  Structured multi-tier ledger classification system (Level 1 Major Headings → Groups → Sub-Groups → Transactional Ledgers)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExpandAll}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition cursor-pointer"
              >
                Expand All
              </button>
              <button
                onClick={handleCollapseAll}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition cursor-pointer"
              >
                Collapse All
              </button>
              <button
                onClick={() => handleOpenAddModal('')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" /> Add Root / Ledger Group
              </button>
            </div>
          </div>

          {/* HIERARCHICAL TREE TABLE */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xl text-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-white text-slate-500 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5 w-[360px]">GL Code & Account Hierarchy</th>
                    <th className="p-3.5">Nepali / English Classification</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Node Tier</th>
                    <th className="p-3.5 text-right">Current GL Balance</th>
                    <th className="p-3.5 text-center w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700 font-mono">
                  {flattenedNodes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 font-sans">
                        No accounts match your current filter criteria or search query.
                      </td>
                    </tr>
                  ) : (
                    flattenedNodes.map((node) => {
                      const hasChildren = (chartOfAccounts || []).some(a => a.parentCode === node.code);
                      const isExpanded = !!expandedNodes[node.code];
                      const levelPadding = (node.level - 1) * 20;

                      // Determine node tier label & style
                      const isMajorHead = !node.parentCode || node.code.split('-').length === 1;
                      const isGroupNode = hasChildren || node.code.split('-').length <= 3;

                      return (
                        <tr 
                          key={node.code} 
                          className={`transition ${ isMajorHead ? 'bg-white font-bold border-t border-slate-200 text-slate-800' : isGroupNode ? 'bg-white hover:bg-slate-50' : 'hover:bg-slate-50 text-slate-600' }`}
                        >
                          {/* GL Code & Tree Expand Toggle */}
                          <td className="p-3 font-sans">
                            <div className="flex items-center gap-1.5" style={{ paddingLeft: `${levelPadding}px` }}>
                              {hasChildren ? (
                                <button
                                  onClick={() => toggleExpand(node.code)}
                                  className="p-1 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded transition cursor-pointer"
                                  title={isExpanded ? "Collapse" : "Expand"}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                                  )}
                                </button>
                              ) : (
                                <span className="w-5 text-slate-600 text-center font-mono">└</span>
                              )}

                              <span className={`font-mono font-extrabold text-xs px-2 py-0.5 rounded border ${ isMajorHead ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : isGroupNode ? 'bg-slate-50 text-slate-700 border-slate-300' : 'bg-white text-teal-300 border-slate-200' }`}>
                                {node.code}
                              </span>

                              {node.isSystemAccount && (
                                <span title="System Account (Protected)" className="text-slate-500">
                                  <Lock className="w-3 h-3 text-slate-500" />
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Account Name */}
                          <td className="p-3 font-sans font-semibold">
                            <span className={isMajorHead ? 'text-emerald-300 font-bold text-sm' : isGroupNode ? 'text-slate-800 font-bold' : 'text-slate-700'}>
                              {node.name}
                            </span>
                          </td>

                          {/* Classification Type Badge */}
                          <td className="p-3 font-sans">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block border ${ node.type === 'Asset' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : node.type === 'Liability' ? 'bg-teal-500/10 text-teal-400 border-teal-500/30' : node.type === 'Equity' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : node.type === 'Income' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30' }`}>
                              {node.type}
                            </span>
                          </td>

                          {/* Node Tier Badge */}
                          <td className="p-3 font-sans">
                            <span className="text-[10px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-300">
                              {isMajorHead ? 'Major Heading' : isGroupNode ? 'Sub-Group' : 'Transactional Ledger'}
                            </span>
                          </td>

                          {/* Current Balance */}
                          <td className="p-3 text-right font-mono font-bold text-slate-800">
                            {formatNPR(node.balance)}
                          </td>

                          {/* Action Buttons */}
                          <td className="p-3 text-center font-sans">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenAddModal(node.code)}
                                className="p-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-400 hover:text-emerald-300 border border-emerald-800/80 rounded-lg transition cursor-pointer"
                                title={`Add sub-account under ${node.code}`}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* BANKS SETUP SUBTAB */}
      {subTab === 'setup_bank_accounts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Commercial & Cooperative Bank Accounts</h3>
              <p className="text-xs text-slate-500">
                Bank accounts linked directly to GL Asset Account <code className="text-emerald-400">04-90 (Bank A/c)</code> for real-time double-entry reconciliation.
              </p>
            </div>
            <button
              onClick={() => setIsAddBankModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4" /> Link New Bank Account
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredBanks.map((b) => (
              <div key={b.id} className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3.5 shadow-xl hover:border-slate-300 transition">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-slate-800 text-sm">{b.name}</span>
                  </div>
                  <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold">
                    {b.type}
                  </span>
                </div>
                
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Account No:</span>
                    <span className="font-mono text-emerald-300 font-bold">{b.accNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Branch Location:</span>
                    <span className="text-slate-700">{b.branch}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mapped GL Code:</span>
                    <span className="font-mono bg-slate-50 px-1.5 py-0.5 rounded text-emerald-400 font-bold">{b.glCode}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                  <span className="text-slate-500 text-xs">Current Balance:</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">{formatNPR(b.balance)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW LEDGER GROUP / ACCOUNT */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl p-6 text-slate-800 space-y-5 animate-in fade-in duration-200">
            
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-slate-800">Add Chart of Accounts Ledger / Group</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-500 hover:text-slate-800 p-1 rounded-lg hover:bg-slate-50 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewAccount} className="space-y-4 text-xs">
              
              {/* Parent Account Selection */}
              <div>
                <label className="block text-slate-600 font-bold mb-1">
                  Parent Account / Group Heading <span className="text-emerald-400">*</span>
                </label>
                <select
                  value={selectedParentCode}
                  onChange={(e) => handleParentSelectChange(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 font-mono focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">-- [None] Create Level 1 Major Heading --</option>
                  {(chartOfAccounts || []).map(acc => (
                    <option key={acc.code} value={acc.code}>
                      {acc.code} - {acc.name} ({acc.type})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Sub-accounts inherit classification type from their parent group.
                </p>
              </div>

              {/* GL Code and Classification Type Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">
                    GL Account Code <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                    placeholder="e.g. 01-20-008"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-emerald-400 font-mono font-bold focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">
                    Account Classification Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                    disabled={!!selectedParentCode}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 font-semibold focus:border-emerald-500 focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    <option value="Asset">Asset (सम्पत्ती)</option>
                    <option value="Liability">Liability (दायित्व)</option>
                    <option value="Equity">Equity (इक्विटी/कोष)</option>
                    <option value="Income">Income (आम्दानी)</option>
                    <option value="Expense">Expense (खर्च)</option>
                  </select>
                </div>
              </div>

              {/* Account Name English */}
              <div>
                <label className="block text-slate-600 font-bold mb-1">
                  Account Name (English) <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Disaster Relief Reserve Fund / Field Transport Expense"
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              {/* Account Name Nepali */}
              <div>
                <label className="block text-slate-600 font-bold mb-1">
                  Nepali Name / Unicode Description (Optional)
                </label>
                <input
                  type="text"
                  value={formData.nameNepali}
                  onChange={(e) => setFormData(prev => ({ ...prev, nameNepali: e.target.value }))}
                  placeholder="उदा: विपत् राहत कोष / यातायात खर्च"
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Opening Balance */}
              <div>
                <label className="block text-slate-600 font-bold mb-1">
                  Initial Opening Balance (NPR)
                </label>
                <input
                  type="number"
                  value={formData.openingBalance}
                  onChange={(e) => setFormData(prev => ({ ...prev, openingBalance: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 font-mono font-bold focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Create Ledger Group
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: LINK NEW BANK ACCOUNT */}
      {isAddBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl p-6 text-slate-800 space-y-4 animate-in fade-in duration-200">
            
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-slate-800">Link New Commercial Bank Account</h3>
              </div>
              <button
                onClick={() => setIsAddBankModalOpen(false)}
                className="text-slate-500 hover:text-slate-800 p-1 rounded-lg hover:bg-slate-50 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBank} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">Bank Name</label>
                <input
                  type="text"
                  value={newBankData.name}
                  onChange={(e) => setNewBankData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Sanima Bank Ltd. / Global IME Bank"
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Account Number</label>
                  <input
                    type="text"
                    value={newBankData.accNo}
                    onChange={(e) => setNewBankData(prev => ({ ...prev, accNo: e.target.value }))}
                    placeholder="e.g. 001002930491"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-emerald-400 font-mono font-bold focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Account Type</label>
                  <select
                    value={newBankData.type}
                    onChange={(e) => setNewBankData(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="Current Account">Current Account</option>
                    <option value="Call Deposit Account">Call Deposit Account</option>
                    <option value="Fixed Deposit Account">Fixed Deposit Account</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Branch Location</label>
                <input
                  type="text"
                  value={newBankData.branch}
                  onChange={(e) => setNewBankData(prev => ({ ...prev, branch: e.target.value }))}
                  placeholder="e.g. Dhangadhi Branch / Attariya"
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Opening Balance (NPR)</label>
                <input
                  type="number"
                  value={newBankData.openingBalance}
                  onChange={(e) => setNewBankData(prev => ({ ...prev, openingBalance: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-800 font-mono font-bold focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddBankModalOpen(false)}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Link Bank Account
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
