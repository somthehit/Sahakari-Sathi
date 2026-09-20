import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, RefreshCw, CalendarDays, SlidersHorizontal } from 'lucide-react';
import { 
  NEPALI_MONTHS, 
  NEPALI_MONTHS_NP, 
  getDaysInBSMonth, 
  convertBSToAD, 
  convertADToBS, 
  formatBSDate, 
  getTodayBS,
  DateConverter
} from '../../utils/nepaliCalendar';

export interface NepaliDatePickerProps {
  value?: string; // Expects YYYY-MM-DD
  onChange?: (bsDate: string, adDate: string) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minYearBS?: number;
  maxYearBS?: number;
  mode?: 'dropdowns' | 'picker' | 'both';
}

const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_NP = ['आइत', 'सोम', 'मङ्गल', 'बुध', 'बिही', 'शुक्र', 'शनि'];

export const NepaliDatePicker: React.FC<NepaliDatePickerProps> = ({
  value = getTodayBS(),
  onChange,
  label,
  required = false,
  placeholder = 'Select Date (BS / AD)',
  className = '',
  disabled = false,
  minYearBS = 2000,
  maxYearBS = 2090,
  mode = 'both',
}) => {
  const [calendarMode, setCalendarMode] = useState<'BS' | 'AD'>('BS');
  const [isOpen, setIsOpen] = useState(false);
  const [displayStyle, setDisplayStyle] = useState<'dropdowns' | 'popover'>('dropdowns');
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper to determine if a YYYY-MM-DD string is a BS date in target range
  const isBSDate = (val?: string): boolean => {
    if (!val) return false;
    const parts = val.split('-');
    if (parts.length !== 3) return false;
    const year = parseInt(parts[0], 10);
    return !isNaN(year) && year >= 2000 && year <= 2090;
  };

  // Current selected BS state
  const initialBS = isBSDate(value)
    ? value 
    : convertADToBS(value);

  const [selectedBS, setSelectedBS] = useState<string>(initialBS || getTodayBS());

  useEffect(() => {
    if (value) {
      if (isBSDate(value)) {
        setSelectedBS(value);
      } else {
        setSelectedBS(convertADToBS(value));
      }
    }
  }, [value]);

  // View state for Calendar grid (Year, Month, Day)
  const bsParts = (selectedBS || getTodayBS()).split('-').map(p => parseInt(p, 10));
  const [viewYearBS, setViewYearBS] = useState<number>(bsParts[0] || 2083);
  const [viewMonthBS, setViewMonthBS] = useState<number>(bsParts[1] || 4); // 1-12
  const [viewDayBS, setViewDayBS] = useState<number>(bsParts[2] || 17);

  // Sync calendar view when selectedBS changes
  useEffect(() => {
    if (selectedBS) {
      const parts = selectedBS.split('-').map(p => parseInt(p, 10));
      if (parts[0] && parts[1]) {
        setViewYearBS(parts[0]);
        setViewMonthBS(parts[1]);
        if (parts[2]) setViewDayBS(parts[2]);
      }
    }
  }, [selectedBS]);

  // For AD mode state
  const selectedAD = DateConverter.bsToAd(selectedBS);
  const adParts = (selectedAD || '2026-08-02').split('-').map(p => parseInt(p, 10));
  const [viewYearAD, setViewYearAD] = useState<number>(adParts[0] || 2026);
  const [viewMonthAD, setViewMonthAD] = useState<number>(adParts[1] || 8); // 1-12

  // Close calendar dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUpdateBSDate = (year: number, month: number, day: number) => {
    const maxDays = DateConverter.getDaysInMonthBS(year, month);
    const validDay = Math.min(day, maxDays);
    const mm = String(month).padStart(2, '0');
    const dd = String(validDay).padStart(2, '0');
    const newBS = `${year}-${mm}-${dd}`;
    const newAD = DateConverter.bsToAd(year, month, validDay);
    
    setSelectedBS(newBS);
    setViewYearBS(year);
    setViewMonthBS(month);
    setViewDayBS(validDay);
    if (onChange) onChange(newBS, newAD);
  };

  const handleSelectBSDay = (day: number) => {
    handleUpdateBSDate(viewYearBS, viewMonthBS, day);
    setIsOpen(false);
  };

  const handleSelectADDay = (day: number) => {
    const mm = String(viewMonthAD).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const newAD = `${viewYearAD}-${mm}-${dd}`;
    const newBS = DateConverter.adToBs(newAD);
    setSelectedBS(newBS);
    if (onChange) onChange(newBS, newAD);
    setIsOpen(false);
  };

  const handleSetToday = () => {
    const todayBS = getTodayBS();
    const todayAD = DateConverter.bsToAd(todayBS);
    setSelectedBS(todayBS);
    const parts = todayBS.split('-').map(p => parseInt(p, 10));
    setViewYearBS(parts[0]);
    setViewMonthBS(parts[1]);
    setViewDayBS(parts[2]);
    if (onChange) onChange(todayBS, todayAD);
    setIsOpen(false);
  };

  // Days count calculations
  const totalDaysInBSMonth = DateConverter.getDaysInMonthBS(viewYearBS, viewMonthBS);
  const bsYearsList = Array.from({ length: Math.max(1, maxYearBS - minYearBS + 1) }, (_, i) => minYearBS + i);
  const bsDaysList = Array.from({ length: totalDaysInBSMonth }, (_, i) => i + 1);

  // AD days calculation (1940 to 2050 AD corresponds to 2000 to 2100 BS)
  const totalDaysInADMonth = new Date(viewYearAD, viewMonthAD, 0).getDate();
  const adFirstDayOfWeek = new Date(viewYearAD, viewMonthAD - 1, 1).getDay(); // 0 = Sun
  const adYearsList = Array.from({ length: 111 }, (_, i) => 1940 + i);

  return (
    <div className={`relative inline-block w-full ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}

      {/* Direct Dropdown Controls Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1 w-full">
          {/* Calendar Icon Button */}
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen(!isOpen)}
            title="Toggle Calendar Picker"
            className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl transition cursor-pointer shrink-0 flex items-center justify-center"
          >
            <CalendarIcon className="w-3.5 h-3.5" />
          </button>

          {/* Year Dropdown */}
          <div className="flex-1 min-w-0">
            <select
              disabled={disabled}
              value={viewYearBS}
              onChange={(e) => handleUpdateBSDate(parseInt(e.target.value, 10), viewMonthBS, viewDayBS)}
              className="w-full bg-white border border-slate-300 rounded-xl px-1 py-2 text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer transition disabled:bg-slate-100 truncate"
            >
              {bsYearsList.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Month Dropdown */}
          <div className="flex-[1.2] min-w-0">
            <select
              disabled={disabled}
              value={viewMonthBS}
              onChange={(e) => handleUpdateBSDate(viewYearBS, parseInt(e.target.value, 10), viewDayBS)}
              className="w-full bg-white border border-slate-300 rounded-xl px-1 py-2 text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer transition disabled:bg-slate-100 truncate"
            >
              {NEPALI_MONTHS.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Day Dropdown */}
          <div className="flex-1 min-w-0">
            <select
              disabled={disabled}
              value={viewDayBS}
              onChange={(e) => handleUpdateBSDate(viewYearBS, viewMonthBS, parseInt(e.target.value, 10))}
              className="w-full bg-white border border-slate-300 rounded-xl px-1 py-2 text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer transition disabled:bg-slate-100 truncate"
            >
              {bsDaysList.map(d => (
                <option key={d} value={d}>
                  {d < 10 ? `0${d}` : d}
                </option>
              ))}
            </select>
          </div>

          {/* BS Badge */}
          <span className="px-1.5 py-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[10px] font-extrabold shrink-0">
            BS
          </span>
        </div>

        {/* Live AD Date Preview */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-1">
          <span>AD: <strong className="text-slate-800 font-bold">{selectedAD}</strong></span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen(!isOpen)}
            className="text-emerald-700 hover:text-emerald-800 underline text-[11px] font-semibold transition"
          >
            {isOpen ? 'Close Calendar' : 'Open Calendar'}
          </button>
        </div>
      </div>

      {/* Calendar Dropdown Popup */}
      {isOpen && (
        <div className="absolute left-0 mt-2 z-[9999] w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-800">
          
          {/* Header & Mode Switcher */}
          <div className="bg-white text-slate-800 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <CalendarDays className="w-4 h-4 text-emerald-400" />
                <span>Nepali Calendar Picker</span>
              </div>

              {/* Mode Toggle Switch (BS / AD) */}
              <div className="flex items-center bg-slate-50 p-0.5 rounded-lg border border-slate-300">
                <button
                  type="button"
                  onClick={() => setCalendarMode('BS')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${ calendarMode === 'BS' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-500 hover:text-white' }`}
                >
                  BS
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarMode('AD')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${ calendarMode === 'AD' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-500 hover:text-white' }`}
                >
                  AD
                </button>
              </div>
            </div>

            {/* Currently Selected Preview */}
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-300/60">
              <span className="text-emerald-400 font-bold">BS: {selectedBS}</span>
              <span className="text-slate-500">↔</span>
              <span className="text-emerald-300">AD: {selectedAD}</span>
            </div>
          </div>

          {/* BS Calendar Controls */}
          {calendarMode === 'BS' ? (
            <div className="p-3 space-y-3">
              {/* Month/Year Selectors */}
              <div className="flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (viewMonthBS === 1) {
                      handleUpdateBSDate(Math.max(minYearBS, viewYearBS - 1), 12, viewDayBS);
                    } else {
                      handleUpdateBSDate(viewYearBS, viewMonthBS - 1, viewDayBS);
                    }
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1">
                  <select
                    value={viewMonthBS}
                    onChange={(e) => handleUpdateBSDate(viewYearBS, parseInt(e.target.value, 10), viewDayBS)}
                    className="bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
                  >
                    {NEPALI_MONTHS.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m} ({NEPALI_MONTHS_NP[idx]})
                      </option>
                    ))}
                  </select>

                  <select
                    value={viewYearBS}
                    onChange={(e) => handleUpdateBSDate(parseInt(e.target.value, 10), viewMonthBS, viewDayBS)}
                    className="bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
                  >
                    {bsYearsList.map(y => (
                      <option key={y} value={y}>{y} BS</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (viewMonthBS === 12) {
                      handleUpdateBSDate(Math.min(maxYearBS, viewYearBS + 1), 1, viewDayBS);
                    } else {
                      handleUpdateBSDate(viewYearBS, viewMonthBS + 1, viewDayBS);
                    }
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-slate-500 uppercase">
                {WEEKDAYS_NP.map(w => (
                  <div key={w} className="py-0.5">{w}</div>
                ))}
              </div>

              {/* BS Day Buttons */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {Array.from({ length: totalDaysInBSMonth }, (_, i) => i + 1).map(day => {
                  const dayStr = day < 10 ? `0${day}` : `${day}`;
                  const monthStr = viewMonthBS < 10 ? `0${viewMonthBS}` : `${viewMonthBS}`;
                  const thisBS = `${viewYearBS}-${monthStr}-${dayStr}`;
                  const isSelected = selectedBS === thisBS;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleSelectBSDay(day)}
                      className={`h-7 w-full rounded-lg font-medium transition cursor-pointer flex items-center justify-center ${ isSelected ? 'bg-emerald-700 text-white font-bold shadow-xs' : 'hover:bg-emerald-50 hover:text-emerald-900 text-slate-700' }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* AD Calendar View */
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (viewMonthAD === 1) {
                      setViewMonthAD(12);
                      setViewYearAD(v => v - 1);
                    } else {
                      setViewMonthAD(v => v - 1);
                    }
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1">
                  <select
                    value={viewMonthAD}
                    onChange={(e) => setViewMonthAD(parseInt(e.target.value, 10))}
                    className="bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
                  >
                    {[
                      'January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'
                    ].map((m, idx) => (
                      <option key={m} value={idx + 1}>{m}</option>
                    ))}
                  </select>

                  <select
                    value={viewYearAD}
                    onChange={(e) => setViewYearAD(parseInt(e.target.value, 10))}
                    className="bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600 cursor-pointer"
                  >
                    {adYearsList.map(y => (
                      <option key={y} value={y}>{y} AD</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (viewMonthAD === 12) {
                      setViewMonthAD(1);
                      setViewYearAD(v => v + 1);
                    } else {
                      setViewMonthAD(v => v + 1);
                    }
                  }}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Weekday headers AD */}
              <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-slate-500 uppercase">
                {WEEKDAYS_EN.map(w => (
                  <div key={w} className="py-0.5">{w}</div>
                ))}
              </div>

              {/* AD Day Grid with padding for weekday offset */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {Array.from({ length: adFirstDayOfWeek }).map((_, i) => (
                  <div key={`blank-${i}`} className="h-7 w-full" />
                ))}

                {Array.from({ length: totalDaysInADMonth }, (_, i) => i + 1).map(day => {
                  const dayStr = day < 10 ? `0${day}` : `${day}`;
                  const monthStr = viewMonthAD < 10 ? `0${viewMonthAD}` : `${viewMonthAD}`;
                  const thisAD = `${viewYearAD}-${monthStr}-${dayStr}`;
                  const isSelected = selectedAD === thisAD;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleSelectADDay(day)}
                      className={`h-7 w-full rounded-lg font-medium transition cursor-pointer flex items-center justify-center ${ isSelected ? 'bg-emerald-600 text-white font-bold shadow-xs' : 'hover:bg-emerald-50 hover:text-emerald-900 text-slate-700' }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="p-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleSetToday}
              className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Today ({getTodayBS()})</span>
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-1 text-slate-500 hover:text-slate-800 font-semibold transition cursor-pointer"
            >
              Close
            </button>
          </div>

        </div>
      )}
    </div>
  );
};

