import React, { useState, useRef } from 'react';
import { resolveMediaUrl } from '../../api/storage';

interface ImageHoverPreviewProps {
  src?: string;
  alt?: string;
  name?: string;
  subtext?: string;
  badge?: string;
  fallbackInitials?: string;
  sizeClass?: string;
  className?: string;
  avatarBg?: string;
  ringColor?: string;
}

export const ImageHoverPreview: React.FC<ImageHoverPreviewProps> = ({
  src,
  alt = '',
  name,
  subtext,
  badge,
  fallbackInitials,
  sizeClass = 'w-9 h-9',
  className = '',
  avatarBg = 'bg-white',
  ringColor = 'ring-emerald-500'
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const resolvedSrc = resolveMediaUrl(src);

  const handleMouseEnter = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const popupWidth = 220;
      const popupHeight = 240;

      let top = rect.top - 10;
      let left = rect.right + 12;

      // Ensure it doesn't overflow right edge of viewport
      if (left + popupWidth > window.innerWidth - 12) {
        left = rect.left - popupWidth - 12;
      }
      // Fallback if left is negative
      if (left < 12) {
        left = 12;
      }

      // Ensure it doesn't overflow bottom edge
      if (top + popupHeight > window.innerHeight - 12) {
        top = window.innerHeight - popupHeight - 12;
      }
      // Ensure it doesn't overflow top edge
      if (top < 12) {
        top = 12;
      }

      setCoords({ top, left });
    }
    setIsHovered(true);
  };

  const displayInitials = fallbackInitials || (name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U');

  return (
    <div 
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative inline-block cursor-pointer group shrink-0 ${className}`}
    >
      {resolvedSrc ? (
        <img 
          src={resolvedSrc} 
          alt={alt || name || ''} 
          className={`${sizeClass} rounded-full object-cover transition-transform duration-200 group-hover:scale-110 group-hover:ring-2 ${ringColor} shadow-xs shrink-0`}
        />
      ) : (
        <div className={`${sizeClass} rounded-full ${avatarBg} text-slate-800 font-extrabold flex items-center justify-center text-xs shadow-xs transition-transform duration-200 group-hover:scale-110 group-hover:ring-2 ${ringColor} shrink-0`}>
          {displayInitials}
        </div>
      )}

      {/* Floating Popup Preview */}
      {isHovered && (
        <div 
          style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
          className="fixed z-[99999] pointer-events-none animate-in fade-in zoom-in-95 duration-150 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3.5 flex flex-col items-center text-center w-52 space-y-2 text-slate-800"
        >
          {resolvedSrc ? (
            <img 
              src={resolvedSrc} 
              alt={name || ''} 
              className="w-36 h-36 rounded-xl object-cover border-2 border-emerald-600 shadow-md"
            />
          ) : (
            <div className={`w-36 h-36 rounded-xl ${avatarBg} text-slate-800 font-extrabold flex items-center justify-center text-3xl shadow-md border-2 border-slate-200`}>
              {displayInitials}
            </div>
          )}

          {name && (
            <div className="w-full space-y-0.5">
              <div className="font-extrabold text-slate-900 text-xs truncate">{name}</div>
              {subtext && <div className="text-[11px] text-emerald-700 font-mono font-bold truncate">{subtext}</div>}
              {badge && (
                <span className="mt-1 inline-block text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                  {badge}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
