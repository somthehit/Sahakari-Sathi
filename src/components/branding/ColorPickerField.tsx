import React, { useState, useRef, useEffect } from 'react';

const PRESET_COLORS = [
  '#047857', '#059669', '#10B981', '#34D399',
  '#16A765', '#2DA2BB', '#4A86E8', '#7C3AED',
  '#A479E2', '#FB4C2F', '#FFAD47', '#666666',
  '#1E293B', '#0F172A', '#F43F5E', '#0EA5E9',
];

interface ColorPickerFieldProps {
  label: string;
  helpText: string;
  value: string;
  onChange: (hex: string) => void;
}

export const ColorPickerField: React.FC<ColorPickerFieldProps> = ({
  label,
  helpText,
  value,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localHex, setLocalHex] = useState(value);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => setLocalHex(value), [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isValidHex = /^#[0-9A-Fa-f]{6}$/.test(localHex);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-700">{label}</label>
      <p className="text-[11px] text-slate-500">{helpText}</p>

      <div className="relative flex items-center gap-2" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 cursor-pointer transition hover:scale-105"
          style={{ backgroundColor: isValidHex ? localHex : '#fff' }}
          title="Click to open color picker"
        />
        <input
          value={localHex}
          onChange={(e) => {
            const v = e.target.value;
            setLocalHex(v);
            if (/^#[0-9A-Fa-f]{6}$/.test(v)) onChange(v);
          }}
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono focus:outline-none focus:border-emerald-700 transition"
          placeholder="#047857"
        />

        {isOpen && (
          <div className="absolute top-12 left-0 z-20 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
            <input
              type="color"
              value={isValidHex ? localHex : '#000000'}
              onChange={(e) => {
                setLocalHex(e.target.value);
                onChange(e.target.value);
              }}
              className="mb-2 h-24 w-full cursor-pointer rounded-lg"
            />
            <div className="grid grid-cols-8 gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setLocalHex(c);
                    onChange(c);
                    setIsOpen(false);
                  }}
                  className={`h-6 w-6 rounded-md border cursor-pointer transition hover:scale-110 ${
                    localHex === c ? 'border-slate-800 ring-2 ring-slate-300' : 'border-slate-200'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
