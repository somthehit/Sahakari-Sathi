import React, { useState, useCallback } from 'react';
import { Upload, X, ImageIcon } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

interface ImageUploadFieldProps {
  label: string;
  helpText: string;
  currentUrl: string;
  onUpload: (url: string) => void;
  recommendedSpec?: string;
  maxSizeMb?: number;
  aspectRatioHint?: 'square' | 'wide';
}

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  label,
  helpText,
  currentUrl,
  onUpload,
  recommendedSpec,
  maxSizeMb = 2,
  aspectRatioHint = 'square',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useAuthStore(s => s.token);

  const handleFile = useCallback(async (file: File) => {
    setError(null);

    if (!['image/png', 'image/jpeg', 'image/svg+xml', 'image/x-icon', 'image/gif'].includes(file.type)) {
      setError('Only PNG, JPG, SVG, or ICO files are accepted');
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`File size must be under ${maxSizeMb}MB`);
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/v1/uploads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
        },
        body: JSON.stringify({
          targetType: 'org_logo',
          dataUrl,
        }),
      });

      if (!res.ok) throw new Error('Upload failed');
      const result = await res.json();
      onUpload(result.url || result.storagePath || '');
    } catch (e) {
      setError('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [maxSizeMb, onUpload, token]);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-700">{label}</label>
      <p className="text-[11px] text-slate-500">{helpText}</p>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        className={`
          relative flex items-center gap-4 rounded-xl border-2 border-dashed p-4 transition-colors
          ${isDragging ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}
        `}
      >
        <div
          className={`
            flex items-center justify-center rounded-lg bg-white border border-slate-200 shrink-0 overflow-hidden
            ${aspectRatioHint === 'square' ? 'h-16 w-16' : 'h-16 w-28'}
          `}
        >
          {currentUrl ? (
            <img src={currentUrl} alt={label} className="max-h-full max-w-full object-contain p-1" />
          ) : (
            <ImageIcon className="h-6 w-6 text-slate-300" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition">
            <Upload className="h-3.5 w-3.5" />
            {isUploading ? 'Uploading...' : 'Choose File'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/x-icon,image/gif"
              className="hidden"
              disabled={isUploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </label>
          <span className="ml-2 text-[11px] text-slate-400">or drag and drop</span>
          {recommendedSpec && <p className="mt-1 text-[11px] text-slate-400">{recommendedSpec}</p>}
        </div>

        {currentUrl && (
          <button
            type="button"
            onClick={() => onUpload('')}
            className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  );
};
