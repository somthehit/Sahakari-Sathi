import React, { useState, useEffect } from 'react';
import { useCoop } from '../../context/CoopContext';
import { useToast } from '../../context/ToastContext';
import { CalendarDays, Clock, Save, RotateCcw, Loader2, AlertCircle, Sun, Moon, Briefcase } from 'lucide-react';
import { fetchWorkingDays, saveWorkingDays } from '../../api/workingDays';
import type { WorkingDay } from '../../types/coop';

interface Props {
  activeSubKey?: string;
}

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NEPALI = ['आइतबार', 'सोमबार', 'मङ्गलबार', 'बुधबार', 'बिहिबार', 'शुक्रबार', 'शनिबार'];

const DEFAULT_OPEN = '10:00';
const DEFAULT_CLOSE = '17:00';

const makeDefaultDays = (): WorkingDay[] =>
  DAY_LABELS.map((_, i) => ({
    dayOfWeek: i,
    isWorkingDay: i !== 6, // Saturday off by default
    openTime: i === 6 ? null : DEFAULT_OPEN,
    closeTime: i === 6 ? null : DEFAULT_CLOSE,
    halfDay: false,
  }));

const minutesOf = (t: string | null): number => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const fmt = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const SetupWorkingDaysView: React.FC<Props> = ({ activeSubKey }) => {
  const { addNotification } = useCoop();
  const toast = useToast();

  const [days, setDays] = useState<WorkingDay[]>(makeDefaultDays);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const reload = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const rows = await fetchWorkingDays();
      if (rows.length === 7) {
        setDays(rows);
      } else if (rows.length > 0) {
        const merged = makeDefaultDays().map((d) => rows.find(r => r.dayOfWeek === d.dayOfWeek) ?? d);
        setDays(merged);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubKey]);

  const updateDay = (dayOfWeek: number, patch: Partial<WorkingDay>) =>
    setDays(prev => prev.map(d => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)));

  const toggleWorking = (dayOfWeek: number, isWorkingDay: boolean) =>
    updateDay(dayOfWeek, {
      isWorkingDay,
      openTime: isWorkingDay ? DEFAULT_OPEN : null,
      closeTime: isWorkingDay ? DEFAULT_CLOSE : null,
      halfDay: false,
    });

  const workingDaysCount = days.filter(d => d.isWorkingDay).length;
  const weeklyMinutes = days
    .filter(d => d.isWorkingDay)
    .reduce((sum, d) => sum + Math.max(0, minutesOf(d.closeTime) - minutesOf(d.openTime)), 0);
  const weeklyHours = weeklyMinutes / 60;

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await saveWorkingDays(days);
      if (result.length === 7) {
        setDays(result);
        addNotification('Working Days Saved', 'The working day schedule was updated successfully.', 'success');
        toast.showSuccess('Working days and hours have been updated.', 'Working Days Saved');
      } else {
        addNotification('Save Failed', 'Could not save the working day schedule. Please try again.', 'alert');
      }
    } catch (error: any) {
      const detail = error?.response?.data?.error || error?.message || 'Unknown error';
      addNotification('Save Failed', `Could not save the schedule: ${detail}`, 'alert');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDays(makeDefaultDays());
    addNotification('Defaults Restored', 'Working days reset to Sunday–Friday (Saturday off), 10:00–17:00.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Working Days & Hours Setup</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Configure the cooperative's weekly working schedule and service hours.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer border border-slate-200"
            >
              <RotateCcw className="w-4 h-4" /> Reset to Defaults
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl flex items-center gap-2 transition cursor-pointer shadow-xs"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save Schedule'}
            </button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-slate-50 rounded-xl border border-slate-100 p-3.5">
            <div className="flex items-center gap-2 text-slate-500 text-[11px] font-bold uppercase">
              <Briefcase className="w-3.5 h-3.5" /> Working Days
            </div>
            <div className="text-sm font-bold text-slate-800 mt-1">{workingDaysCount} of 7 days</div>
          </div>
          <div className="bg-slate-50 rounded-xl border border-slate-100 p-3.5">
            <div className="flex items-center gap-2 text-slate-500 text-[11px] font-bold uppercase">
              <Moon className="w-3.5 h-3.5" /> Weekly Off
            </div>
            <div className="text-sm font-bold text-slate-800 mt-1">
              {DAY_LABELS.filter((_, i) => !days[i]?.isWorkingDay).join(', ') || 'None'}
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl border border-slate-100 p-3.5 col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 text-slate-500 text-[11px] font-bold uppercase">
              <Clock className="w-3.5 h-3.5" /> Weekly Hours
            </div>
            <div className="text-sm font-bold text-slate-800 mt-1">{weeklyHours.toFixed(1)} hours</div>
          </div>
        </div>
      </div>

      {/* Schedule Editor */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-700" />
          <h3 className="font-bold text-slate-800 text-sm">Weekly Schedule</h3>
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">Sunday → Saturday</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs font-semibold">Loading working day schedule…</span>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center py-16 text-rose-500 gap-3">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs font-semibold">Could not load the working day schedule.</span>
            <button
              type="button"
              onClick={() => void reload()}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-lg transition cursor-pointer border border-slate-200 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {days.map((d) => {
              const openMinutes = minutesOf(d.openTime);
              const closeMinutes = minutesOf(d.closeTime);
              const invalid = d.isWorkingDay && openMinutes >= closeMinutes;
              return (
                <div
                  key={d.dayOfWeek}
                  className={`flex flex-col md:flex-row md:items-center gap-3 px-6 py-3.5 transition-colors ${d.isWorkingDay ? 'bg-white' : 'bg-slate-50/70'}`}
                >
                  {/* Day identity */}
                  <div className="flex items-center gap-3 md:w-52 shrink-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${ d.isWorkingDay ? 'bg-emerald-50 border border-emerald-100 text-emerald-700' : 'bg-slate-100 border border-slate-200 text-slate-500' }`}>
                      {d.isWorkingDay ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-sm">{DAY_LABELS[d.dayOfWeek]}</div>
                      <div className="text-[10px] text-slate-500">{DAY_NEPALI[d.dayOfWeek]} · {DAY_SHORT[d.dayOfWeek]}</div>
                    </div>
                  </div>

                  {/* Working toggle */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={d.isWorkingDay}
                      onClick={() => toggleWorking(d.dayOfWeek, !d.isWorkingDay)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${ d.isWorkingDay ? 'bg-emerald-600' : 'bg-slate-300' }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${ d.isWorkingDay ? 'translate-x-6' : 'translate-x-1' }`} />
                    </button>
                    <span className="text-xs font-bold text-slate-600 w-20">
                      {d.isWorkingDay ? 'Working' : 'Day Off'}
                    </span>
                  </div>

                  {/* Hours */}
                  {d.isWorkingDay ? (
                    <div className="flex items-center gap-2 flex-1 flex-wrap">
                      <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Open</label>
                      <input
                        type="time"
                        value={d.openTime ?? ''}
                        onChange={(e) => updateDay(d.dayOfWeek, { openTime: e.target.value })}
                        className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                      <span className="text-slate-600">—</span>
                      <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Close</label>
                      <input
                        type="time"
                        value={d.closeTime ?? ''}
                        onChange={(e) => updateDay(d.dayOfWeek, { closeTime: e.target.value })}
                        className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        role="switch"
                        aria-checked={d.halfDay}
                        onClick={() => updateDay(d.dayOfWeek, { halfDay: !d.halfDay })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${ d.halfDay ? 'bg-amber-500' : 'bg-slate-200' }`}
                        title="Half Day"
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${ d.halfDay ? 'translate-x-6' : 'translate-x-1' }`} />
                      </button>
                      <span className={`text-xs font-bold ${d.halfDay ? 'text-amber-600' : 'text-slate-500'}`}>
                        {d.halfDay ? 'Half Day' : 'Full Day'}
                      </span>
                      {invalid && (
                        <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Close must be after open
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold uppercase tracking-wide">
                        Weekly Off
                      </span>
                    </div>
                  )}

                  {/* Daily total */}
                  <div className="md:w-24 text-right shrink-0">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Total</div>
                    <div className={`text-sm font-bold font-mono ${invalid ? 'text-rose-500' : 'text-slate-800'}`}>
                      {d.isWorkingDay && !invalid ? `${((closeMinutes - openMinutes) / 60).toFixed(1)}h` : '—'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
