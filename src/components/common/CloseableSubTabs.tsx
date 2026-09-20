import React, { useState } from 'react';
import { X, Plus, ChevronDown } from 'lucide-react';
import { useCoop } from '../../context/CoopContext';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

interface Props {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  activeColorClass?: string;
  allowClose?: boolean;
}

export const CloseableSubTabs: React.FC<Props> = ({
  tabs,
  activeTab,
  onTabChange,
  activeColorClass = 'bg-emerald-700 text-white shadow-lg shadow-emerald-700/20',
  allowClose = true,
}) => {
  const { tabs: globalTabs, openTab, closeTab, setActiveTabId } = useCoop();
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Candidates currently present in globalTabs
  let openSubTabs = tabs.filter(candidate =>
    globalTabs.some(gt => gt.id === candidate.id || gt.moduleKey === candidate.id)
  );

  // Fallback: If openSubTabs is empty, include the candidate matching activeTab or tabs[0]
  if (openSubTabs.length === 0) {
    const fallback = tabs.find(t => t.id === activeTab) || tabs[0];
    if (fallback) openSubTabs = [fallback];
  }

  // Candidates not yet opened as tabs
  const unopenedSubTabs = tabs.filter(candidate =>
    !openSubTabs.some(ot => ot.id === candidate.id)
  );

  const handleTabClick = (tabId: string) => {
    setActiveTabId(tabId);
    onTabChange(tabId);
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    closeTab(tabId);
  };

  const handleOpenMorePage = (candidate: TabItem) => {
    openTab(candidate.id, candidate.label, 'FileText');
    onTabChange(candidate.id);
    setShowAddMenu(false);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
      {/* Active & Open Subtabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        {openSubTabs?.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <div
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`group relative px-3.5 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 cursor-pointer transition select-none shrink-0 ${
                isActive
                  ? `${activeColorClass}`
                  : 'bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 shadow-xs'
              }`}
            >
              {tab.icon && <span className="shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>

              {tab.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.2 text-[10px] font-bold rounded-full ${ isActive ? 'bg-white/20 text-slate-800' : 'bg-slate-100 text-slate-600 ' }`}
                >
                  {tab.badge}
                </span>
              )}

              {/* Close 'X' Button on each tab */}
              {allowClose && globalTabs.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => handleCloseTab(e, tab.id)}
                  title={`Close ${tab.label} tab`}
                  className={`p-0.5 rounded-md transition ml-1 cursor-pointer ${ isActive ? 'hover:bg-white/20 text-slate-800/80 hover:text-slate-800' : 'opacity-60 hover:opacity-100 hover:bg-slate-100 text-slate-500 hover:text-slate-800' }`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        {/* Dropdown to open unopened pages in this group */}
        {unopenedSubTabs.length > 0 && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="px-2.5 py-2 rounded-xl font-medium text-xs flex items-center gap-1 bg-slate-100 /80 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
              title="Open additional page in this section"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-700" />
              <span>More Pages ({unopenedSubTabs.length})</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>

            {showAddMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowAddMenu(false)}
                />
                <div className="absolute left-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl p-2 z-30 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 py-1 border-b border-slate-100">
                    Open Page
                  </div>
                  {unopenedSubTabs?.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => handleOpenMorePage(candidate)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 transition cursor-pointer"
                    >
                      {candidate.icon && <span className="shrink-0">{candidate.icon}</span>}
                      <span className="truncate">{candidate.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
