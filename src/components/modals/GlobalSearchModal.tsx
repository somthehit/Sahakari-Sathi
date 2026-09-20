import React, { useState, useEffect, useRef } from 'react';
import { useCoop } from '../../context/CoopContext';
import { Search, X, Users, PiggyBank, Landmark, BookOpen, ArrowRight, Command, Wallet, Home, Keyboard, Sparkles, Filter, Layers } from 'lucide-react';
import { ImageHoverPreview } from '../common/ImageHoverPreview';

export type SearchCategoryFilter = 'all' | 'members' | 'accounts' | 'vouchers' | 'commands';

export const GlobalSearchModal: React.FC = () => {
  const { 
    isGlobalSearchOpen, 
    setIsGlobalSearchOpen, 
    setIsShortcutModalOpen,
    members, 
    savingsAccounts, 
    loanAccounts, 
    vouchers, 
    openTab, 
    setSelectedMemberForDetail, 
    setSelectedVoucherForDetail 
  } = useCoop();

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<SearchCategoryFilter>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isGlobalSearchOpen) {
      setQuery('');
      setActiveCategory('all');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isGlobalSearchOpen]);

  if (!isGlobalSearchOpen) return null;

  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? '⌘' : 'Ctrl';

  const q = (query || '').toLowerCase().trim();

  // Quick Action Jump Commands
  const quickActions = [
    {
      id: 'qa-member-dir',
      title: 'Member Directory & KYC',
      category: 'Quick Command',
      shortcut: `${modKey}+M`,
      icon: Users,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      action: () => {
        setIsGlobalSearchOpen(false);
        openTab('member_directory', 'Member Directory', 'Users');
      }
    },
    {
      id: 'qa-deposit',
      title: 'Teller Savings Deposit & Withdrawal',
      category: 'Quick Command',
      shortcut: 'Alt+S',
      icon: PiggyBank,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      action: () => {
        setIsGlobalSearchOpen(false);
        openTab('savings_deposit', 'Savings Deposit', 'PiggyBank');
      }
    },
    {
      id: 'qa-loan',
      title: 'Loan Portfolio & Repayments',
      category: 'Quick Command',
      shortcut: 'Alt+L',
      icon: Landmark,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
      action: () => {
        setIsGlobalSearchOpen(false);
        openTab('loan_repayment', 'Loan Repayment', 'Landmark');
      }
    },
    {
      id: 'qa-vouchers',
      title: 'General Ledger Vouchers & Posting',
      category: 'Quick Command',
      shortcut: 'Alt+V',
      icon: BookOpen,
      color: 'text-teal-600 bg-teal-50 border-teal-200',
      action: () => {
        setIsGlobalSearchOpen(false);
        openTab('accounts_vouchers', 'Vouchers & GL', 'BookOpen');
      }
    },
    {
      id: 'qa-cash',
      title: 'Till Cash & Denomination Counter',
      category: 'Quick Command',
      shortcut: 'Alt+C',
      icon: Wallet,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      action: () => {
        setIsGlobalSearchOpen(false);
        openTab('cash_denom', 'Vault & Till Counter', 'Wallet');
      }
    },
    {
      id: 'qa-home',
      title: 'Return to Dashboard Home',
      category: 'Quick Command',
      shortcut: 'Alt+H',
      icon: Home,
      color: 'text-slate-600 bg-slate-100 border-slate-200',
      action: () => {
        setIsGlobalSearchOpen(false);
        openTab('home', 'Dashboard Home', 'Home');
      }
    },
    {
      id: 'qa-shortcuts',
      title: 'View Keyboard Shortcuts Cheat Sheet',
      category: 'Help',
      shortcut: `${modKey}+/`,
      icon: Keyboard,
      color: 'text-purple-600 bg-purple-50 border-purple-200',
      action: () => {
        setIsGlobalSearchOpen(false);
        setIsShortcutModalOpen(true);
      }
    }
  ];

  const matchedMembers = q ? members.filter(m => 
    (m.fullName || '').toLowerCase().includes(q) || 
    (m.memberNo || '').toLowerCase().includes(q) || 
    (m.citizenshipNo || '').toLowerCase().includes(q) || 
    (m.phone || '').includes(q)
  ) : [];

  const matchedSavings = q ? savingsAccounts.filter(s => 
    (s.accountNo || '').toLowerCase().includes(q) || 
    (s.memberName || '').toLowerCase().includes(q)
  ) : [];

  const matchedLoans = q ? loanAccounts.filter(l => 
    (l.loanNo || '').toLowerCase().includes(q) || 
    (l.memberName || '').toLowerCase().includes(q)
  ) : [];

  const matchedVouchers = q ? vouchers.filter(v => 
    (v.voucherNo || '').toLowerCase().includes(q) || 
    (v.narration || '').toLowerCase().includes(q)
  ) : [];

  const matchedCommands = quickActions.filter(qa =>
    !q || qa.title.toLowerCase().includes(q) || qa.category.toLowerCase().includes(q)
  );

  const showMembers = (activeCategory === 'all' || activeCategory === 'members') && matchedMembers.length > 0;
  const showAccounts = (activeCategory === 'all' || activeCategory === 'accounts') && (matchedSavings.length > 0 || matchedLoans.length > 0);
  const showVouchers = (activeCategory === 'all' || activeCategory === 'vouchers') && matchedVouchers.length > 0;
  const showCommands = (!q && (activeCategory === 'all' || activeCategory === 'commands')) || (q && activeCategory === 'commands' && matchedCommands.length > 0);

  // Build flattened selectable items array for arrow key navigation
  const selectableItems: { id: string; action: () => void }[] = [];

  if (!q) {
    if (activeCategory === 'all' || activeCategory === 'commands') {
      quickActions.forEach(qa => selectableItems.push({ id: qa.id, action: qa.action }));
    }
  } else {
    if (showMembers) {
      matchedMembers.forEach(m => selectableItems.push({
        id: `m-${m.id}`,
        action: () => {
          setSelectedMemberForDetail(m);
          setIsGlobalSearchOpen(false);
        }
      }));
    }
    if (showAccounts) {
      if (activeCategory === 'all' || activeCategory === 'accounts') {
        matchedSavings.forEach(s => selectableItems.push({
          id: `s-${s.id}`,
          action: () => {
            openTab('savings_deposit', `Deposit - ${s.accountNo}`, 'PiggyBank', s.id);
            setIsGlobalSearchOpen(false);
          }
        }));
        matchedLoans.forEach(l => selectableItems.push({
          id: `l-${l.id}`,
          action: () => {
            openTab('loan_detail', `Loan - ${l.loanNo}`, 'Landmark', l.id);
            setIsGlobalSearchOpen(false);
          }
        }));
      }
    }
    if (showVouchers) {
      matchedVouchers.forEach(v => selectableItems.push({
        id: `v-${v.id}`,
        action: () => {
          setSelectedVoucherForDetail(v);
          setIsGlobalSearchOpen(false);
        }
      }));
    }
    if (activeCategory === 'commands') {
      matchedCommands.forEach(qa => selectableItems.push({ id: qa.id, action: qa.action }));
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, selectableItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + selectableItems.length) % Math.max(1, selectableItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectableItems[selectedIndex]) {
        selectableItems[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      setIsGlobalSearchOpen(false);
    }
  };

  const categories = [
    { id: 'all', label: 'All Results', count: q ? (matchedMembers.length + matchedSavings.length + matchedLoans.length + matchedVouchers.length) : quickActions.length, icon: Layers },
    { id: 'members', label: 'Members', count: matchedMembers.length, icon: Users },
    { id: 'accounts', label: 'Accounts', count: matchedSavings.length + matchedLoans.length, icon: PiggyBank },
    { id: 'vouchers', label: 'Vouchers', count: matchedVouchers.length, icon: BookOpen },
    { id: 'commands', label: 'Commands', count: matchedCommands.length, icon: Command },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm flex items-start justify-center pt-14 sm:pt-16 px-3 sm:px-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-200 ease-out flex flex-col max-h-[82vh]">
        
        {/* Search Bar Input Header */}
        <div className="p-3.5 border-b border-slate-200 flex items-center gap-3 bg-slate-50">
          <div className="p-2 bg-emerald-100/80 rounded-xl text-emerald-700 shrink-0">
            <Command className="w-5 h-5" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search Member, Savings/Loan A/C, Voucher No or command..."
            className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
          />
          <kbd className="hidden sm:inline-block px-2 py-1 bg-slate-200 border border-slate-300 rounded-md text-[10px] font-mono font-bold text-slate-600">
            Esc
          </kbd>
          <button 
            onClick={() => setIsGlobalSearchOpen(false)} 
            className="p-1 text-slate-500 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter Bar */}
        <div className="px-3 py-2 bg-slate-100/80 border-b border-slate-200/80 flex items-center gap-1.5 overflow-x-auto text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 pr-1 flex items-center gap-1 shrink-0">
            <Filter className="w-3 h-3 text-emerald-700" />
            Filter:
          </span>
          {categories.map(cat => {
            const IconComp = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id as SearchCategoryFilter);
                  setSelectedIndex(0);
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer text-xs shrink-0 ${ isActive ? 'bg-emerald-700 text-white shadow-2xs font-bold' : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200/80' }`}
              >
                <IconComp className={`w-3.5 h-3.5 ${isActive ? 'text-slate-800' : 'text-slate-500'}`} />
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${ isActive ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-200 text-slate-600' }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Results / Quick Commands List */}
        <div className="max-h-96 overflow-y-auto p-3 divide-y divide-slate-100 text-xs flex-1">
          {!q ? (
            /* EMPTY QUERY: SHOW QUICK COMMANDS & SHORTCUTS */
            showCommands ? (
              <div className="space-y-3 p-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Quick Commands & Shortcuts
                  </span>
                  <span className="text-slate-500 font-mono text-[10px]">Use ↑ ↓ keys and Enter to navigate</span>
                </div>

                <div className="space-y-1">
                  {quickActions.map((qa, idx) => {
                    const IconComponent = qa.icon;
                    const isSelected = selectedIndex === idx;
                    return (
                      <div
                        key={qa.id}
                        onClick={qa.action}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`p-2.5 rounded-xl flex items-center justify-between cursor-pointer transition ${ isSelected ? 'bg-emerald-50/90 border border-emerald-200 text-slate-900 shadow-2xs' : 'hover:bg-slate-50 border border-transparent text-slate-700' }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg border ${qa.color}`}>
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-xs text-slate-900">{qa.title}</div>
                            <div className="text-[10px] text-slate-500">{qa.category}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded-md font-mono text-[11px] font-bold text-slate-700">
                            {qa.shortcut}
                          </kbd>
                          <ArrowRight className={`w-4 h-4 transition-transform ${isSelected ? 'translate-x-0.5 text-emerald-600' : 'text-slate-600'}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-slate-500 text-xs">
                Select "All Results" or "Commands" to view available quick shortcuts, or type a query above.
              </div>
            )
          ) : (
            <>
              {/* Members */}
              {showMembers && (
                <div className="py-2">
                  <div className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-700" />
                    Members ({matchedMembers.length})
                  </div>
                  <div className="space-y-1">
                    {matchedMembers.map(m => {
                      const itemIdx = selectableItems.findIndex(i => i.id === `m-${m.id}`);
                      const isSelected = selectedIndex === itemIdx;
                      return (
                        <div
                          key={m.id}
                          onClick={() => {
                            setSelectedMemberForDetail(m);
                            setIsGlobalSearchOpen(false);
                          }}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition ${ isSelected ? 'bg-emerald-50/80 border border-emerald-200' : 'hover:bg-slate-50 border border-transparent' }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <ImageHoverPreview
                              src={m.photoUrl}
                              name={m.fullName}
                              subtext={m.memberNo}
                              badge={m.kycStatus}
                              sizeClass="w-7 h-7"
                            />
                            <div>
                              <div className="font-semibold text-slate-900 flex items-center gap-2">
                                <span>{m.fullName}</span>
                                <span className="text-[10px] text-emerald-700 font-mono bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">{m.memberNo}</span>
                              </div>
                              <div className="text-[10px] text-slate-500">{m.phone} • {m.address}</div>
                            </div>
                          </div>
                          <ArrowRight className={`w-4 h-4 ${isSelected ? 'text-emerald-700' : 'text-slate-500'}`} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Savings & Loan Accounts */}
              {showAccounts && (
                <div className="py-2 space-y-3">
                  {matchedSavings.length > 0 && (
                    <div>
                      <div className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-1.5 flex items-center gap-1.5">
                        <PiggyBank className="w-3.5 h-3.5 text-amber-600" />
                        Savings Accounts ({matchedSavings.length})
                      </div>
                      <div className="space-y-1">
                        {matchedSavings.map(s => {
                          const itemIdx = selectableItems.findIndex(i => i.id === `s-${s.id}`);
                          const isSelected = selectedIndex === itemIdx;
                          return (
                            <div
                              key={s.id}
                              onClick={() => {
                                openTab('savings_deposit', `Deposit - ${s.accountNo}`, 'PiggyBank', s.id);
                                setIsGlobalSearchOpen(false);
                              }}
                              onMouseEnter={() => setSelectedIndex(itemIdx)}
                              className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition ${ isSelected ? 'bg-amber-50/80 border border-amber-200' : 'hover:bg-slate-50 border border-transparent' }`}
                            >
                              <div>
                                <div className="font-semibold text-slate-900 flex items-center gap-2">
                                  <span>{s.accountNo}</span>
                                  <span className="text-[10px] text-amber-700 font-mono">({s.productName})</span>
                                </div>
                                <div className="text-[10px] text-slate-500">Member: {s.memberName} • Balance: NPR {s.balance.toLocaleString()}</div>
                              </div>
                              <ArrowRight className={`w-4 h-4 ${isSelected ? 'text-amber-600' : 'text-slate-500'}`} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {matchedLoans.length > 0 && (
                    <div>
                      <div className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Landmark className="w-3.5 h-3.5 text-indigo-600" />
                        Loan Accounts ({matchedLoans.length})
                      </div>
                      <div className="space-y-1">
                        {matchedLoans.map(l => {
                          const itemIdx = selectableItems.findIndex(i => i.id === `l-${l.id}`);
                          const isSelected = selectedIndex === itemIdx;
                          return (
                            <div
                              key={l.id}
                              onClick={() => {
                                openTab('loan_detail', `Loan - ${l.loanNo}`, 'Landmark', l.id);
                                setIsGlobalSearchOpen(false);
                              }}
                              onMouseEnter={() => setSelectedIndex(itemIdx)}
                              className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition ${ isSelected ? 'bg-indigo-50/80 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent' }`}
                            >
                              <div>
                                <div className="font-semibold text-slate-900 flex items-center gap-2">
                                  <span>{l.loanNo}</span>
                                  <span className="text-[10px] text-indigo-700 font-mono">({l.productName})</span>
                                </div>
                                <div className="text-[10px] text-slate-500">Borrower: {l.memberName} • Principal Outstanding: NPR {l.outstandingPrincipal.toLocaleString()}</div>
                              </div>
                              <ArrowRight className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-slate-500'}`} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Vouchers */}
              {showVouchers && (
                <div className="py-2">
                  <div className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-1.5 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-teal-600" />
                    General Ledger Vouchers ({matchedVouchers.length})
                  </div>
                  <div className="space-y-1">
                    {matchedVouchers.map(v => {
                      const itemIdx = selectableItems.findIndex(i => i.id === `v-${v.id}`);
                      const isSelected = selectedIndex === itemIdx;
                      return (
                        <div
                          key={v.id}
                          onClick={() => {
                            setSelectedVoucherForDetail(v);
                            setIsGlobalSearchOpen(false);
                          }}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition ${ isSelected ? 'bg-teal-50/80 border border-teal-200' : 'hover:bg-slate-50 border border-transparent' }`}
                        >
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-2">
                              <span>{v.voucherNo}</span>
                              <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded text-teal-700 font-mono">{v.voucherType}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 truncate max-w-md">{v.narration} • NPR {v.totalAmount.toLocaleString()}</div>
                          </div>
                          <ArrowRight className={`w-4 h-4 ${isSelected ? 'text-teal-600' : 'text-slate-500'}`} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Commands when q is entered */}
              {activeCategory === 'commands' && matchedCommands.length > 0 && (
                <div className="py-2">
                  <div className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Command className="w-3.5 h-3.5 text-purple-600" />
                    Quick Commands ({matchedCommands.length})
                  </div>
                  <div className="space-y-1">
                    {matchedCommands.map((qa) => {
                      const itemIdx = selectableItems.findIndex(i => i.id === qa.id);
                      const isSelected = selectedIndex === itemIdx;
                      const IconComponent = qa.icon;
                      return (
                        <div
                          key={qa.id}
                          onClick={qa.action}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition ${ isSelected ? 'bg-purple-50/80 border border-purple-200' : 'hover:bg-slate-50 border border-transparent' }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`p-1.5 rounded-lg border ${qa.color}`}>
                              <IconComponent className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 text-xs">{qa.title}</div>
                              <div className="text-[10px] text-slate-500">{qa.category}</div>
                            </div>
                          </div>
                          <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-mono font-bold text-slate-700">
                            {qa.shortcut}
                          </kbd>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectableItems.length === 0 && (
                <div className="py-10 text-center text-slate-500 text-xs">
                  No records found in "{activeCategory === 'all' ? 'All' : activeCategory}" for "{query}"
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Hint Bar */}
        <div className="p-2.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-mono font-bold text-slate-700">↑↓</kbd> to navigate</span>
            <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-mono font-bold text-slate-700">Enter</kbd> to select</span>
            <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-mono font-bold text-slate-700">Esc</kbd> to close</span>
          </div>
          <button
            onClick={() => {
              setIsGlobalSearchOpen(false);
              setIsShortcutModalOpen(true);
            }}
            className="text-emerald-700 hover:text-emerald-800 font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Shortcuts ({modKey}+/)</span>
          </button>
        </div>

      </div>
    </div>
  );
};

