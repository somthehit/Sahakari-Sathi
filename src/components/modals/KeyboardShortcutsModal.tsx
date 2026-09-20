import React, { useState } from 'react';
import { useCoop } from '../../context/CoopContext';
import { X, Keyboard, Command, Search, Users, PiggyBank, Landmark, BookOpen, Wallet, Home, Layers, Sparkles, CheckCircle2 } from 'lucide-react';

export const KeyboardShortcutsModal: React.FC = () => {
  const { isShortcutModalOpen, setIsShortcutModalOpen, setIsGlobalSearchOpen, openTab, tabs, setActiveTabId } = useCoop();
  const [filterQuery, setFilterQuery] = useState('');
  const [copiedShortcut, setCopiedShortcut] = useState<string | null>(null);

  if (!isShortcutModalOpen) return null;

  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  const shortcutGroups = [
    {
      category: 'Global & Palette',
      icon: Command,
      items: [
        {
          keys: [modKey, 'K'],
          title: 'Open Command Palette / Search',
          description: 'Search across members, savings, loans, GL vouchers and quick commands',
          action: () => {
            setIsShortcutModalOpen(false);
            setIsGlobalSearchOpen(true);
          }
        },
        {
          keys: [modKey, 'M'],
          title: 'Quick Member Directory',
          description: 'Open the Member Directory tab instantly',
          action: () => {
            setIsShortcutModalOpen(false);
            openTab('member_directory', 'Member Directory', 'Users');
          }
        },
        {
          keys: [modKey, '/'],
          title: 'Toggle Keyboard Shortcuts',
          description: 'Show or hide this keyboard cheat sheet console',
          action: () => {
            setIsShortcutModalOpen(false);
          }
        },
        {
          keys: ['Esc'],
          title: 'Dismiss / Close Dialogs',
          description: 'Close active popups, search overlays, or detail modals',
          action: () => {
            setIsShortcutModalOpen(false);
          }
        }
      ]
    },
    {
      category: 'Quick Workflows (Direct Jump)',
      icon: Sparkles,
      items: [
        {
          keys: ['Alt', 'S'],
          title: 'Savings Deposit & Withdrawal',
          description: 'Jump to teller cash deposit & withdrawal counter',
          action: () => {
            setIsShortcutModalOpen(false);
            openTab('savings_deposit', 'Savings Deposit', 'PiggyBank');
          }
        },
        {
          keys: ['Alt', 'L'],
          title: 'Loan Repayment & Appraisal',
          description: 'Open Loan Repayment & Loan Portfolio appraisal',
          action: () => {
            setIsShortcutModalOpen(false);
            openTab('loan_repayment', 'Loan Repayment', 'Landmark');
          }
        },
        {
          keys: ['Alt', 'V'],
          title: 'Accounts Vouchers',
          description: 'Open General Ledger journal vouchers & posting',
          action: () => {
            setIsShortcutModalOpen(false);
            openTab('accounts_vouchers', 'Vouchers & GL', 'BookOpen');
          }
        },
        {
          keys: ['Alt', 'C'],
          title: 'Teller Till & Denomination Counter',
          description: 'Open physical banknote & coin vault reconciliation',
          action: () => {
            setIsShortcutModalOpen(false);
            openTab('cash_denom', 'Vault & Till Counter', 'Wallet');
          }
        },
        {
          keys: ['Alt', 'H'],
          title: 'Dashboard Home',
          description: 'Return to primary Cooperative operational dashboard',
          action: () => {
            setIsShortcutModalOpen(false);
            openTab('home', 'Dashboard Home', 'Home');
          }
        }
      ]
    },
    {
      category: 'Workspace Tab Navigation',
      icon: Layers,
      items: [
        {
          keys: ['Alt', '1 ... 9'],
          title: 'Switch Active Tab (1 - 9)',
          description: 'Directly switch focus to open workspace tab by index',
          action: () => {
            if (tabs.length > 0) {
              setIsShortcutModalOpen(false);
              setActiveTabId(tabs[0].id);
            }
          }
        }
      ]
    }
  ];

  const filteredGroups = shortcutGroups.map(group => ({
    ...group,
    items: group.items.filter(item => 
      item.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(filterQuery.toLowerCase()) ||
      item.keys.join(' ').toLowerCase().includes(filterQuery.toLowerCase())
    )
  })).filter(group => group.items.length > 0);

  const handleExecute = (shortcutTitle: string, actionFn: () => void) => {
    setCopiedShortcut(shortcutTitle);
    setTimeout(() => setCopiedShortcut(null), 1200);
    actionFn();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden text-slate-800 flex flex-col max-h-[85vh] my-auto animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-200 ease-out">
        
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl border border-emerald-200">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm text-slate-900">Power User Keyboard Shortcuts</h2>
                <span className="text-[10px] bg-slate-200 text-slate-700 font-mono font-bold px-2 py-0.5 rounded-full">
                  {isMac ? 'macOS Command Key' : 'Windows / Linux'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal">Accelerate daily teller and manager workflows with instant key commands</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsShortcutModalOpen(false)}
            className="p-1.5 text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Input Bar */}
        <div className="p-3 bg-white border-b border-slate-200 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter shortcuts (e.g. member, deposit, tab, Ctrl+K)..."
            className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery('')}
              className="text-[11px] text-slate-500 hover:text-slate-600 font-medium px-2 py-0.5 rounded bg-slate-100"
            >
              Clear
            </button>
          )}
        </div>

        {/* Shortcuts List Content */}
        <div className="p-4 sm:p-5 bg-slate-50 overflow-y-auto space-y-5 flex-1">
          {filteredGroups.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Keyboard className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs font-semibold text-slate-600">No matching shortcuts found for "{filterQuery}"</p>
            </div>
          ) : (
            filteredGroups.map((group, groupIdx) => {
              const IconComp = group.icon;
              return (
                <div key={groupIdx} className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600 uppercase tracking-wider px-1">
                    <IconComp className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{group.category}</span>
                  </div>

                  <div className="bg-white border border-slate-200/90 rounded-xl divide-y divide-slate-100 shadow-2xs overflow-hidden">
                    {group.items.map((item, itemIdx) => (
                      <div
                        key={itemIdx}
                        onClick={() => handleExecute(item.title, item.action)}
                        className="p-3 hover:bg-emerald-50/40 transition cursor-pointer flex items-center justify-between gap-4 group"
                      >
                        <div className="space-y-0.5 flex-1">
                          <div className="font-semibold text-xs text-slate-900 group-hover:text-emerald-900 flex items-center gap-2">
                            <span>{item.title}</span>
                            {copiedShortcut === item.title && (
                              <span className="text-[10px] text-emerald-700 bg-emerald-100 font-medium px-2 py-0.5 rounded-full flex items-center gap-1 animate-in fade-in">
                                <CheckCircle2 className="w-3 h-3" /> Executed
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-normal">{item.description}</p>
                        </div>

                        {/* Keyboard Badge Pills */}
                        <div className="flex items-center gap-1 shrink-0">
                          {item.keys.map((k, kIdx) => (
                            <React.Fragment key={kIdx}>
                              {kIdx > 0 && <span className="text-xs text-slate-500 font-bold px-0.5">+</span>}
                              <kbd className="px-2.5 py-1 bg-slate-100 border border-slate-300 rounded-lg font-mono text-[11px] font-bold text-slate-800 shadow-2xs group-hover:border-emerald-300 group-hover:bg-emerald-50/80 transition-colors">
                                {k}
                              </kbd>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Shortcuts active globally across all modules</span>
          </div>
          <button
            type="button"
            onClick={() => setIsShortcutModalOpen(false)}
            className="px-4 py-1.5 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-semibold transition cursor-pointer shadow-2xs"
          >
            Got it
          </button>
        </div>

      </div>
    </div>
  );
};
