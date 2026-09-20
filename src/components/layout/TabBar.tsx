import React, { useState } from 'react';
import { useCoop } from '../../context/CoopContext';
import { 
  Home, 
  X, 
  Maximize2, 
  Minimize2, 
  ChevronDown, 
  MoreVertical, 
  Layers, 
  XCircle,
  FileText,
  Users,
  PiggyBank,
  Landmark,
  PieChart,
  BookOpen,
  Vault,
  Truck,
  Calculator,
  Building,
  UserCheck2,
  Inbox,
  FileSpreadsheet,
  Search
} from 'lucide-react';

export const TabBar: React.FC = () => {
  const { 
    tabs, 
    activeTabId, 
    setActiveTabId, 
    closeTab, 
    closeOtherTabs, 
    isTabMaximized, 
    toggleMaximizeTab 
  } = useCoop();

  const [showOverflow, setShowOverflow] = useState(false);
  const [tabFilter, setTabFilter] = useState('');

  const renderTabIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Home': return <Home className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'Users': case 'UserPlus': return <Users className="w-3.5 h-3.5 text-teal-600 shrink-0" />;
      case 'PiggyBank': return <PiggyBank className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'Landmark': return <Landmark className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
      case 'PieChart': return <PieChart className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
      case 'BookOpen': return <BookOpen className="w-3.5 h-3.5 text-teal-400 shrink-0" />;
      case 'Vault': return <Vault className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      case 'Truck': return <Truck className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
      case 'Calculator': return <Calculator className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
      case 'Building': return <Building className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
      case 'UserCheck2': return <UserCheck2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
      case 'Inbox': return <Inbox className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
      default: return <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
    }
  };

  return (
    <div className="bg-white border-b border-slate-200 px-3 pt-1 flex items-center justify-between gap-2 select-none text-xs relative z-10">
      
      {/* Left: Scrollable Active Tabs Row */}
      <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar flex-1 py-0.5">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isHome = tab.id === 'home';

          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer max-w-[220px] shrink-0 font-semibold ${ isActive ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50' }`}
            >
              {renderTabIcon(tab.iconName)}

              <span className="truncate max-w-[130px]">{tab.title}</span>

              {/* Dirty Unsaved Dot */}
              {tab.isDirty && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" title="Unsaved changes" />
              )}

              {/* Close Button (Not on Home) */}
              {!isHome && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="p-0.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-all duration-200 cursor-pointer shrink-0 ml-auto"
                  title="Close tab"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Right: Tab Controls (Overflow dropdown, Close Active, Close Others) */}
      <div className="flex items-center gap-1.5 shrink-0 pb-1 text-slate-500">
        
        {/* Tab Dropdown Button */}
        <div className="relative">
          <button
            onClick={() => setShowOverflow(!showOverflow)}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all duration-200 cursor-pointer"
            title="Filter tabs"
          >
            <ChevronDown className="w-4 h-4" />
          </button>

          {showOverflow && (
            <div className="absolute right-0 mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-2 text-xs text-slate-800 space-y-1.5">
              {/* Search input bar */}
              <div className="relative flex items-center bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                <Search className="w-4 h-4 text-slate-500 shrink-0 mr-2" />
                <input
                  type="text"
                  value={tabFilter}
                  onChange={(e) => setTabFilter(e.target.value)}
                  placeholder="Filter tabs..."
                  className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                  autoFocus
                />
              </div>

              {/* Tabs List */}
              <div className="max-h-60 overflow-y-auto space-y-1">
                {tabs
                  .filter((t) => (t.title || '').toLowerCase().includes((tabFilter || '').toLowerCase()))
                  .map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setActiveTabId(t.id);
                        setShowOverflow(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 text-xs font-semibold cursor-pointer transition-all duration-200 ${ t.id === activeTabId ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50 text-slate-700' }`}
                    >
                      {t.id === 'home' ? (
                        <Home className="w-4 h-4 text-emerald-700 shrink-0" />
                      ) : (
                        renderTabIcon(t.iconName)
                      )}
                      <span className="truncate flex-1">{t.title}</span>
                      {t.isDirty && <span className="w-2 h-2 rounded-full bg-rose-500" />}
                    </button>
                  ))}
                {tabs.filter((t) => (t.title || '').toLowerCase().includes((tabFilter || '').toLowerCase())).length === 0 && (
                  <div className="text-center py-3 text-slate-500 text-[11px]">No tabs found</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Close Active Tab Button */}
        <button
          onClick={() => {
            if (activeTabId !== 'home') {
              closeTab(activeTabId);
            }
          }}
          className="w-7 h-7 rounded-lg border border-slate-200 bg-slate-50 hover:bg-rose-50 hover:border-rose-200 text-slate-500 hover:text-rose-500 flex items-center justify-center transition-all duration-200 cursor-pointer"
          title="Close current tab"
        >
          <svg className="w-3.5 h-3.5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="3" ry="3" />
            <path d="M9 9l6 6M15 9l-6 6" />
          </svg>
        </button>

        {/* Close Other Tabs Button */}
        <button
          onClick={() => closeOtherTabs(activeTabId)}
          className="w-7 h-7 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-all duration-200 cursor-pointer"
          title="Close other tabs"
        >
          <svg className="w-3.5 h-3.5 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="3" ry="3" />
            <path d="M9 9l6 6M15 9l-6 6" />
          </svg>
        </button>

      </div>

    </div>
  );
};
