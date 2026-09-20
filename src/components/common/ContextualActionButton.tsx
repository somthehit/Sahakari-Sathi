import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Users,
  PiggyBank,
  Landmark,
  BookOpen,
  PieChart,
  Wallet,
  DollarSign,
  Building,
  ShoppingBag,
  Briefcase,
  Smartphone,
  UserPlus,
  ChevronDown,
  Sparkles,
  X,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { useCoop } from '../../context/CoopContext';

interface ContextualActionConfig {
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  primaryAction: () => void;
  subActions?: {
    label: string;
    icon: React.ReactNode;
    action: () => void;
  }[];
}

interface Props {
  variant?: 'header' | 'fab';
}

export const ContextualActionButton: React.FC<Props> = ({ variant = 'header' }) => {
  const { tabs, activeTabId, openTab, openBranchForm, openStaffForm } = useCoop();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const moduleKey = ((activeTab && activeTab.moduleKey) || 'home_dashboard').toLowerCase();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine contextual config based on active tab moduleKey
  const getContextualConfig = (): ContextualActionConfig => {
    if (moduleKey.includes('member')) {
      return {
        label: 'Add New Member',
        shortLabel: 'Add Member',
        icon: <UserPlus className="w-4 h-4" />,
        primaryAction: () => openTab('members', 'Member Registry', 'Users'),
        subActions: [
          { label: 'Register New Member', icon: <UserPlus className="w-3.5 h-3.5 text-emerald-600" />, action: () => openTab('members', 'Member Registry', 'Users') },
          { label: 'Setup Share Account', icon: <PieChart className="w-3.5 h-3.5 text-blue-600" />, action: () => openTab('shares_issue', 'Share Issuance', 'PieChart') },
        ]
      };
    }

    if (moduleKey.includes('saving') || moduleKey.includes('deposit') || moduleKey.includes('withdraw')) {
      return {
        label: 'New Savings Deposit',
        shortLabel: 'Add Deposit',
        icon: <PiggyBank className="w-4 h-4" />,
        primaryAction: () => openTab('savings_deposit', 'Deposit Entry', 'PiggyBank'),
        subActions: [
          { label: 'New Deposit Voucher', icon: <PiggyBank className="w-3.5 h-3.5 text-emerald-600" />, action: () => openTab('savings_deposit', 'Deposit Entry', 'PiggyBank') },
          { label: 'Withdrawal Voucher', icon: <PiggyBank className="w-3.5 h-3.5 text-rose-600" />, action: () => openTab('savings_withdraw', 'Withdrawal Entry', 'PiggyBank') },
          { label: 'Open Savings Account', icon: <Plus className="w-3.5 h-3.5 text-indigo-600" />, action: () => openTab('savings_accounts', 'Savings Accounts', 'PiggyBank') },
        ]
      };
    }

    if (moduleKey.includes('loan')) {
      return {
        label: 'New Loan Application',
        shortLabel: 'Add Loan',
        icon: <Landmark className="w-4 h-4" />,
        primaryAction: () => openTab('loans_origination', 'Loan Origination', 'Landmark'),
        subActions: [
          { label: 'Apply for New Loan', icon: <Landmark className="w-3.5 h-3.5 text-blue-600" />, action: () => openTab('loans_origination', 'Loan Origination', 'Landmark') },
          { label: 'Process Loan Repayment', icon: <DollarSign className="w-3.5 h-3.5 text-emerald-600" />, action: () => openTab('loans_repayment', 'Loan Repayments', 'Landmark') },
        ]
      };
    }

    if (moduleKey.includes('share')) {
      return {
        label: 'Issue Member Shares',
        shortLabel: 'Issue Shares',
        icon: <PieChart className="w-4 h-4" />,
        primaryAction: () => openTab('shares_issue', 'Share Issuance', 'PieChart'),
        subActions: [
          { label: 'Issue Share Certificates', icon: <PieChart className="w-3.5 h-3.5 text-emerald-600" />, action: () => openTab('shares_issue', 'Share Issuance', 'PieChart') },
          { label: 'Share Register', icon: <Users className="w-3.5 h-3.5 text-slate-600" />, action: () => openTab('shares', 'Share Ledger', 'PieChart') },
        ]
      };
    }

    if (moduleKey.includes('account') || moduleKey.includes('voucher') || moduleKey.includes('ledger')) {
      return {
        label: 'Create Journal Voucher',
        shortLabel: 'Add Voucher',
        icon: <BookOpen className="w-4 h-4" />,
        primaryAction: () => openTab('accounts_vouchers', 'Accounting Vouchers', 'BookOpen'),
        subActions: [
          { label: 'General Journal Voucher', icon: <BookOpen className="w-3.5 h-3.5 text-indigo-600" />, action: () => openTab('accounts_vouchers', 'Accounting Vouchers', 'BookOpen') },
          { label: 'Chart of Accounts Head', icon: <Layers className="w-3.5 h-3.5 text-slate-600" />, action: () => openTab('accounts_coa', 'Chart of Accounts', 'BookOpen') },
        ]
      };
    }

    if (moduleKey.includes('cash') || moduleKey.includes('vault') || moduleKey.includes('bank')) {
      return {
        label: 'Vault Cash Transfer',
        shortLabel: 'Vault Transfer',
        icon: <Wallet className="w-4 h-4" />,
        primaryAction: () => openTab('cash_vault', 'Cash & Vault Mgmt', 'Wallet'),
        subActions: [
          { label: 'Vault Cash Transfer', icon: <Wallet className="w-3.5 h-3.5 text-amber-600" />, action: () => openTab('cash_vault', 'Cash & Vault Mgmt', 'Wallet') },
          { label: 'Bank Cheque Entry', icon: <BookOpen className="w-3.5 h-3.5 text-blue-600" />, action: () => openTab('cash_bank', 'Bank Reconciliation', 'Wallet') },
        ]
      };
    }

    if (moduleKey.includes('collection')) {
      return {
        label: 'New Field Collection',
        shortLabel: 'Add Collection',
        icon: <Smartphone className="w-4 h-4" />,
        primaryAction: () => openTab('collection_field', 'Field Collection', 'Smartphone'),
        subActions: [
          { label: 'Log Agent Collection', icon: <Smartphone className="w-3.5 h-3.5 text-teal-600" />, action: () => openTab('collection_field', 'Field Collection', 'Smartphone') },
          { label: 'Reconcile Route Sheet', icon: <BookOpen className="w-3.5 h-3.5 text-[#006130]" />, action: () => openTab('collection_reconcile', 'Collection Reconciliation', 'Smartphone') },
        ]
      };
    }

    if (moduleKey.includes('budget') || moduleKey.includes('expense')) {
      return {
        label: 'Add Expense Claim',
        shortLabel: 'Add Expense',
        icon: <DollarSign className="w-4 h-4" />,
        primaryAction: () => openTab('budget_expense', 'Budget & Expense Mgmt', 'DollarSign'),
        subActions: [
          { label: 'Submit Expense Claim', icon: <DollarSign className="w-3.5 h-3.5 text-rose-600" />, action: () => openTab('budget_expense', 'Budget & Expense Mgmt', 'DollarSign') },
        ]
      };
    }

    if (moduleKey.includes('fixed') || moduleKey.includes('asset')) {
      return {
        label: 'Register Fixed Asset',
        shortLabel: 'Add Asset',
        icon: <Building className="w-4 h-4" />,
        primaryAction: () => openTab('fixed_assets', 'Fixed Assets & Tax Register', 'Building'),
        subActions: [
          { label: 'Add Capital Fixed Asset', icon: <Building className="w-3.5 h-3.5 text-emerald-600" />, action: () => openTab('fixed_assets', 'Fixed Assets & Tax Register', 'Building') },
        ]
      };
    }

    if (moduleKey.includes('inventory') || moduleKey.includes('stock')) {
      return {
        label: 'Add Inventory Product',
        shortLabel: 'Add Product',
        icon: <ShoppingBag className="w-4 h-4" />,
        primaryAction: () => openTab('inventory_stock', 'Inventory & Store Goods', 'ShoppingBag'),
        subActions: [
          { label: 'Register Store Item', icon: <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />, action: () => openTab('inventory_stock', 'Inventory & Store Goods', 'ShoppingBag') },
        ]
      };
    }

    if (moduleKey.includes('hr') || moduleKey.includes('payroll') || moduleKey.includes('staff')) {
      return {
        label: 'Add Staff Employee',
        shortLabel: 'Add Employee',
        icon: <Briefcase className="w-4 h-4" />,
        primaryAction: () => openStaffForm('add'),
        subActions: [
          { label: 'Add Employee Profile', icon: <Briefcase className="w-3.5 h-3.5 text-blue-600" />, action: () => openStaffForm('add') },
          { label: 'Staff Directory', icon: <Users className="w-3.5 h-3.5 text-slate-600" />, action: () => openTab('hr_staff', 'Staff Directory', 'Briefcase') },
        ]
      };
    }

    if (moduleKey.includes('admin') || moduleKey.includes('user') || moduleKey.includes('security')) {
      return {
        label: 'Add System User',
        shortLabel: 'Add User',
        icon: <Users className="w-4 h-4" />,
        primaryAction: () => openTab('admin_users', 'User Administration', 'Users'),
        subActions: [
          { label: 'Create System User', icon: <Users className="w-3.5 h-3.5 text-purple-600" />, action: () => openTab('admin_users', 'User Administration', 'Users') },
        ]
      };
    }

    // Default / Home Dashboard context
    return {
      label: 'Quick Add / Transaction',
      shortLabel: 'Quick Add',
      icon: <Plus className="w-4 h-4" />,
      primaryAction: () => openTab('savings_deposit', 'Deposit Entry', 'PiggyBank'),
      subActions: [
        { label: 'Add New Member', icon: <UserPlus className="w-3.5 h-3.5 text-emerald-600" />, action: () => openTab('members', 'Member Registry', 'Users') },
        { label: 'Deposit Transaction', icon: <PiggyBank className="w-3.5 h-3.5 text-blue-600" />, action: () => openTab('savings_deposit', 'Deposit Entry', 'PiggyBank') },
        { label: 'Create Journal Voucher', icon: <BookOpen className="w-3.5 h-3.5 text-indigo-600" />, action: () => openTab('accounts_vouchers', 'Accounting Vouchers', 'BookOpen') },
        { label: 'Apply for Loan', icon: <Landmark className="w-3.5 h-3.5 text-amber-600" />, action: () => openTab('loans_origination', 'Loan Origination', 'Landmark') },
        { label: 'Add Expense Claim', icon: <DollarSign className="w-3.5 h-3.5 text-rose-600" />, action: () => openTab('budget_expense', 'Budget & Expense Mgmt', 'DollarSign') },
        { label: 'Add Inventory Product', icon: <ShoppingBag className="w-3.5 h-3.5 text-teal-600" />, action: () => openTab('inventory_stock', 'Inventory & Store Goods', 'ShoppingBag') },
        { label: 'Register Branch', icon: <Building className="w-3.5 h-3.5 text-purple-600" />, action: () => openBranchForm('add') },
      ]
    };
  };

  const config = getContextualConfig();

  // VARIANT 1: HEADER PERSISTENT BUTTON
  if (variant === 'header') {
    return (
      <div className="relative" ref={containerRef}>
        <div className="flex items-center">
          <button
            onClick={() => {
              config.primaryAction();
            }}
            className="flex items-center gap-1.5 bg-white hover:bg-white active:scale-95 text-slate-800 px-3 py-1 rounded-l-md transition cursor-pointer text-xs font-bold shadow-xs border border-emerald-700"
            title={`Perform contextual action for active tab: ${config.label}`}
          >
            {config.icon}
            <span className="hidden xl:inline">{config.label}</span>
            <span className="xl:hidden">{config.shortLabel}</span>
          </button>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="bg-white hover:bg-white active:scale-95 text-emerald-100 px-1.5 py-1 rounded-r-md transition cursor-pointer text-xs font-bold border-y border-r border-emerald-700 flex items-center justify-center"
            title="More quick creation options"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {isOpen && (
          <div className="absolute right-0 mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-2xl z-[10000] overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-100">
            <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#006130]" />
                Contextual Options
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Active Tab</span>
            </div>

            <div className="p-1.5 space-y-0.5">
              <button
                onClick={() => {
                  config.primaryAction();
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100/80 rounded-lg transition flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  {config.icon}
                  <span>{config.label}</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 opacity-60 group-hover:opacity-100" />
              </button>

              {config.subActions && config.subActions.length > 0 && (
                <div className="pt-1 border-t border-slate-100 space-y-0.5">
                  {config.subActions.map((sub, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        sub.action();
                        setIsOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        {sub.icon}
                        <span>{sub.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // VARIANT 2: FLOATING ACTION BUTTON (FAB)
  return (
    <div className="fixed bottom-12 right-6 sm:bottom-10 sm:right-8 z-40 flex flex-col items-end" ref={containerRef}>
      {/* FAB Radial / Speed-dial Popover Menu */}
      {isOpen && (
        <div className="mb-3 space-y-2 bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-slate-200 shadow-2xl animate-in slide-in-from-bottom-4 duration-200 w-56 text-slate-800">
          <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#006130]" />
              Quick Actions ({config.shortLabel})
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-500 hover:text-slate-600 p-0.5 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => {
                config.primaryAction();
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs font-bold bg-white text-slate-800 hover:bg-white rounded-xl transition flex items-center justify-between shadow-xs"
            >
              <div className="flex items-center gap-2">
                {config.icon}
                <span>{config.label}</span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-800/80" />
            </button>

            {config.subActions && config.subActions.map((sub, idx) => (
              <button
                key={idx}
                onClick={() => {
                  sub.action();
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition flex items-center gap-2"
              >
                {sub.icon}
                <span>{sub.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center gap-0 bg-white hover:bg-white active:scale-95 text-slate-800 pl-3 pr-3 hover:pr-4 py-3 rounded-full shadow-2xl border-2 border-emerald-400/30 transition-all duration-300 cursor-pointer overflow-hidden"
        title={`Contextual Action: ${config.label}`}
      >
        {/* + icon always visible */}
        <div className="p-1 rounded-full bg-emerald-600 text-white transition-transform group-hover:rotate-90 shrink-0">
          {isOpen ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
        </div>

        {/* Label — hidden by default, slides in on hover */}
        <div className="flex flex-col text-left overflow-hidden max-w-0 group-hover:max-w-[140px] transition-all duration-300 ease-in-out pl-0 group-hover:pl-2 pr-0 group-hover:pr-1">
          <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-200 leading-none whitespace-nowrap">
            {activeTab?.title || 'Context Action'}
          </span>
          <span className="text-xs font-bold tracking-tight text-slate-800 leading-tight whitespace-nowrap">
            {config.shortLabel}
          </span>
        </div>

        {/* Pulse Indicator */}
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white animate-ping opacity-75" />
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white" />
      </button>
    </div>
  );
};
