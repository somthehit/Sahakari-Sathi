import React from 'react';
import { Search, Filter, SlidersHorizontal, X } from 'lucide-react';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterGroup {
  id: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (val: string) => void;
}

export interface CategoryPill {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface Props {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;
  categoryPills?: CategoryPill[];
  activeCategory?: string;
  onCategoryChange?: (id: string) => void;
  filterGroups?: FilterGroup[];
  quickStats?: { label: string; value: string | number; color?: string }[];
  actions?: React.ReactNode;
  title?: string;
  subtitle?: string;
  searchInputClass?: string;
}

export const AdminSetupSearchFilterBar: React.FC<Props> = ({
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Search configuration records, parameters, or accounts...',
  categoryPills,
  activeCategory,
  onCategoryChange,
  filterGroups,
  quickStats,
  actions,
  title,
  subtitle,
  searchInputClass
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3.5 mb-4">
      {/* Optional Top Title Bar if provided */}
      {(title || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          {title && (
            <div>
              <h2 className="text-sm font-bold text-slate-800">{title}</h2>
              {subtitle && <p className="text-slate-500 text-xs mt-0.5">{subtitle}</p>}
            </div>
          )}
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}

      {/* Category Navigation Pills */}
      {categoryPills && categoryPills.length > 0 && onCategoryChange && (
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
          {categoryPills.map((pill) => {
            const isActive = activeCategory === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => onCategoryChange(pill.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${ isActive ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 ' }`}
              >
                {pill.icon}
                <span>{pill.label}</span>
                {pill.count !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-700 '}`}>
                    {pill.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Persistent Search Input & Filter Dropdowns */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input Box */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={`w-full ${searchInputClass || 'bg-slate-50 '} border border-slate-200 rounded-xl pl-10 pr-8 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition`}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-600 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns and Quick Stats */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          {filterGroups && filterGroups.map((group) => (
            <div key={group.id} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-slate-500 font-medium">{group.label}:</span>
              <select
                value={group.value}
                onChange={(e) => group.onChange(e.target.value)}
                className="bg-transparent text-slate-800 font-bold focus:outline-none cursor-pointer"
              >
                {group.options.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-white text-slate-800">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {quickStats && quickStats.map((stat, idx) => (
            <div key={idx} className="hidden lg:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
              <span className="text-slate-500 font-medium">{stat.label}:</span>
              <span className={`font-bold font-mono ${stat.color || 'text-emerald-700 '}`}>{stat.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
