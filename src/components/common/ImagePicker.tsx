import React, { useRef, useState } from 'react';
import { ImagePlus, Trash2, Link2 } from 'lucide-react';

interface ImagePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  dark?: boolean;
  maxDimension?: number;
}

function fileToDataUrl(file: File, maxDimension = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.onload = () => {
      const original = String(reader.result);
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(original); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  });
}

export const ImagePicker: React.FC<ImagePickerProps> = ({ label, value, onChange, dark = false, maxDimension = 512 }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (PNG, JPG, WEBP).');
      return;
    }
    setError('');
    try {
      const dataUrl = await fileToDataUrl(file, maxDimension);
      onChange(dataUrl);
    } catch (e: any) {
      setError(e.message || 'Could not process image.');
    }
  };

  const boxCls = dark
    ? 'border-slate-300 bg-white text-white'
    : 'border-slate-200 bg-slate-50 text-slate-900';
  const labelCls = dark ? 'text-slate-500' : 'text-slate-600';

  const hasImage = !!value && (value.startsWith('data:') || value.startsWith('http'));

  return (
    <div className="space-y-2">
      <label className={`block text-[11px] font-semibold uppercase tracking-wide mb-1.5 ${labelCls}`}>{label}</label>
      <div className={`border rounded-xl p-3 space-y-2.5 ${boxCls}`}>
        {/* Preview row */}
        <div className="flex items-center gap-3">
          <div className={`h-14 w-14 flex-shrink-0 rounded-lg overflow-hidden border ${dark ? 'border-slate-300 bg-slate-50' : 'border-slate-200 bg-white'} flex items-center justify-center`}>
            {hasImage ? (
              <img src={value} alt={label} className="h-full w-full object-contain" />
            ) : (
              <ImagePlus className={`w-5 h-5 ${dark ? 'text-slate-600' : 'text-slate-500'}`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] truncate ${dark ? 'text-slate-500' : 'text-slate-500'}`}>
              {hasImage
                ? value.startsWith('data:') ? 'Uploaded image' : value
                : 'No image selected'}
            </p>
          </div>
        </div>

        {/* Action row */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${ dark ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white' }`}
          >
            <ImagePlus className="w-3.5 h-3.5" /> Upload
          </button>
          {hasImage && (
            <button
              type="button"
              onClick={() => { onChange(''); setError(''); }}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1 ${ dark ? 'bg-slate-700 hover:bg-slate-600 text-slate-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-600' }`}
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </button>
          )}
        </div>

        {/* URL paste */}
        <div className={`flex items-center gap-1.5 border rounded-lg px-2 py-1 ${dark ? 'border-slate-300 bg-white' : 'border-slate-200 bg-white'}`}>
          <Link2 className={`w-3 h-3 flex-shrink-0 ${dark ? 'text-slate-500' : 'text-slate-500'}`} />
          <input
            type="text"
            value={value.startsWith('data:') ? '' : value}
            readOnly={false}
            placeholder="…or paste image URL"
            onChange={(e) => { onChange(e.target.value); setError(''); }}
            className={`w-full bg-transparent text-xs outline-none min-w-0 ${dark ? 'text-slate-600 placeholder-slate-600' : 'text-slate-700 placeholder-slate-400'}`}
          />
        </div>
      </div>
      {error && <p className={`text-[11px] ${dark ? 'text-red-400' : 'text-red-500'}`}>{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
      />
    </div>
  );
};
