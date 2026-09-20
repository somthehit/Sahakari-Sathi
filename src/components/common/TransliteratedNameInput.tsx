import React, { useRef } from 'react';
import { Languages, Sparkles } from 'lucide-react';
import { useLocalization } from '../../context/LocalizationContext';
import { transliterateToNepali } from '../../utils/transliterate';

interface TransliteratedNameInputProps {
  /** Label shown above the English input. */
  englishLabel: string;
  /** English (romanized) name value. */
  englishValue: string;
  /** Devanagari name value. */
  nepaliValue: string;
  onEnglishChange: (value: string) => void;
  onNepaliChange: (value: string) => void;
  englishPlaceholder?: string;
  nepaliPlaceholder?: string;
  required?: boolean;
  /** Compact styling used for smaller nested fields. */
  compact?: boolean;
}

/**
 * English + Nepali name input pair with automatic Roman → Devanagari
 * transliteration. When the organization has "Enable Automatic Nepali Name
 * Transliteration" turned on, typing the English name live-fills the Nepali
 * field. The Nepali field stays editable — once the user types in it manually,
 * auto-fill stops overriding it.
 */
export const TransliteratedNameInput: React.FC<TransliteratedNameInputProps> = ({
  englishLabel,
  englishValue,
  nepaliValue,
  onEnglishChange,
  onNepaliChange,
  englishPlaceholder = 'e.g. Ram Prasad Sharma',
  nepaliPlaceholder = 'e.g. राम प्रसाद शर्मा',
  required = false,
  compact = false,
}) => {
  const { settings } = useLocalization();
  const autoEnabled = settings.enableAutoTransliteration;
  const manualEdit = useRef(false);

  const handleEnglish = (value: string) => {
    onEnglishChange(value);
    if (autoEnabled && !manualEdit.current) {
      onNepaliChange(transliterateToNepali(value));
    }
  };

  const handleNepali = (value: string) => {
    manualEdit.current = value.trim() !== '';
    onNepaliChange(value);
  };

  const autoFilled = autoEnabled && englishValue.trim() !== '' && !manualEdit.current && nepaliValue === transliterateToNepali(englishValue);

  const fieldCls = compact
    ? 'w-full bg-white border border-slate-300 rounded-lg p-1.5 text-slate-800 focus:border-emerald-600 focus:outline-none'
    : 'w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:border-emerald-600 focus:outline-none';

  const labelCls = compact ? 'text-slate-700 font-semibold text-[11px]' : 'text-slate-700 font-semibold';

  return (
    <div className="space-y-1">
      <label className={labelCls}>
        {englishLabel}
        {required && <span className="text-rose-600"> *</span>}
        {autoEnabled && (
          <span
            className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full"
            title="Automatic Nepali transliteration is enabled"
          >
            <Sparkles className="w-2.5 h-2.5" />
            auto
          </span>
        )}
      </label>

      <input
        type="text"
        required={required}
        value={englishValue}
        onChange={(e) => handleEnglish(e.target.value)}
        placeholder={englishPlaceholder}
        className={fieldCls}
      />

      <div className="relative">
        <Languages className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-500" />
        <input
          type="text"
          value={nepaliValue}
          onChange={(e) => handleNepali(e.target.value)}
          placeholder={nepaliPlaceholder}
          className={`${fieldCls} pl-7`}
        />
      </div>

      {autoFilled && (
        <p className="flex items-center gap-1 text-[10px] text-emerald-700 font-medium">
          <Sparkles className="w-3 h-3" />
          Auto-transliterated from English name
        </p>
      )}
    </div>
  );
};
