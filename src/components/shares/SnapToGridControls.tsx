import React, { useState } from 'react';
import { 
  Grid, 
  Move, 
  Eye, 
  EyeOff, 
  Plus, 
  Trash2, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  RotateCcw, 
  Sparkles, 
  Tag, 
  Check, 
  Crosshair,
  Sliders,
  Layers
} from 'lucide-react';
import { CertificateConfig, DraggableElement } from './ShareCertificateCanvas';
import { AVAILABLE_CERTIFICATE_TAGS } from '../../utils/certificateTagEngine';

interface SnapToGridControlsProps {
  certConfig: CertificateConfig;
  onChangeConfig: React.Dispatch<React.SetStateAction<CertificateConfig>>;
  className?: string;
}

export const SnapToGridControls: React.FC<SnapToGridControlsProps> = ({
  certConfig,
  onChangeConfig,
  className = '',
}) => {
  const [selectedTagForAdd, setSelectedTagForAdd] = useState<string>('{member_name}');
  const [customTextForAdd, setCustomTextForAdd] = useState<string>('');

  const gridSize = certConfig.gridSize || 20;
  const isSnapEnabled = certConfig.enableSnapToGrid !== false;
  const showGridLines = certConfig.showGridLines || false;
  const draggableElements = certConfig.draggableElements || [];

  // Toggle Snap-To-Grid
  const handleToggleSnap = () => {
    onChangeConfig(prev => ({
      ...prev,
      enableSnapToGrid: prev.enableSnapToGrid === false ? true : false,
    }));
  };

  // Toggle Grid Lines Visibility
  const handleToggleGridLines = () => {
    onChangeConfig(prev => ({
      ...prev,
      showGridLines: !prev.showGridLines,
    }));
  };

  // Change Grid Size
  const handleChangeGridSize = (size: number) => {
    onChangeConfig(prev => ({
      ...prev,
      gridSize: size,
    }));
  };

  // Add Custom Tag Badge to Draggable Canvas
  const handleAddTagElement = () => {
    const tagInfo = AVAILABLE_CERTIFICATE_TAGS.find(t => t.tag === selectedTagForAdd);
    const label = tagInfo ? `${tagInfo.labelNp} (${tagInfo.tag})` : selectedTagForAdd;

    const newElem: DraggableElement = {
      id: `elem_tag_${Date.now()}`,
      type: 'tag_badge',
      label: label,
      tagValue: selectedTagForAdd,
      x: 100,
      y: 100,
      fontSize: 12,
      color: '#92400e', // amber-800
    };

    onChangeConfig(prev => ({
      ...prev,
      draggableElements: [...(prev.draggableElements || []), newElem],
      showGridLines: true, // Auto show grid for editing positioning
    }));
  };

  // Add Custom Free Text Overlay
  const handleAddCustomTextElement = () => {
    if (!customTextForAdd.trim()) return;

    const newElem: DraggableElement = {
      id: `elem_text_${Date.now()}`,
      type: 'custom_text',
      label: customTextForAdd.trim(),
      tagValue: customTextForAdd.trim(),
      x: 120,
      y: 120,
      fontSize: 13,
      color: '#1e293b',
    };

    onChangeConfig(prev => ({
      ...prev,
      draggableElements: [...(prev.draggableElements || []), newElem],
      showGridLines: true,
    }));

    setCustomTextForAdd('');
  };

  // Remove a Draggable Element
  const handleRemoveElement = (id: string) => {
    onChangeConfig(prev => ({
      ...prev,
      draggableElements: (prev.draggableElements || []).filter(e => e.id !== id),
    }));
  };

  // Auto-align all elements to horizontal center
  const handleAlignCenterAll = () => {
    onChangeConfig(prev => ({
      ...prev,
      draggableElements: (prev.draggableElements || []).map(e => ({
        ...e,
        x: 200, // Center alignment approx
      })),
    }));
  };

  // Reset positions to grid origin
  const handleResetPositions = () => {
    onChangeConfig(prev => ({
      ...prev,
      draggableElements: [],
    }));
  };

  return (
    <div className={`bg-white text-slate-800 p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3.5 text-xs ${className}`}>
      
      {/* Title & Master Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg shadow-2xs">
            <Grid className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              Snap-to-Grid & Precision Alignment
            </h3>
            <p className="text-[10px] text-slate-500">
              Drag elements with magnetic snapping for pixel-perfect certificate design layout.
            </p>
          </div>
        </div>

        {/* Master Switches */}
        <div className="flex items-center gap-2">
          {/* Grid Visibility Button */}
          <button
            type="button"
            onClick={handleToggleGridLines}
            className={`px-2.5 py-1 rounded-xl font-bold text-[11px] transition flex items-center gap-1 cursor-pointer border ${ showGridLines ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' }`}
          >
            {showGridLines ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>Grid Overlay</span>
          </button>

          {/* Snap-To-Grid Toggle Switch */}
          <button
            type="button"
            onClick={handleToggleSnap}
            className={`px-2.5 py-1 rounded-xl font-bold text-[11px] transition flex items-center gap-1 cursor-pointer border ${ isSnapEnabled ? 'bg-emerald-100 text-emerald-900 border-emerald-300 shadow-2xs' : 'bg-rose-50 text-rose-800 border-rose-200' }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Snap: {isSnapEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Grid Size & Alignment Tools */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
        
        {/* Grid Step Size Selector */}
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
          <span className="text-[10px] font-bold text-slate-600 shrink-0">Grid Step:</span>
          <div className="flex items-center gap-1">
            {[10, 20, 25, 50].map(size => (
              <button
                key={size}
                type="button"
                onClick={() => handleChangeGridSize(size)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${ gridSize === size ? 'bg-amber-700 text-white shadow-2xs' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200' }`}
              >
                {size}px
              </button>
            ))}
          </div>
        </div>

        {/* Quick Layout Actions */}
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={handleAlignCenterAll}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
          >
            <AlignCenter className="w-3 h-3 text-amber-600" />
            <span>Center All</span>
          </button>

          <button
            type="button"
            onClick={handleResetPositions}
            className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 rounded-xl text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear Overlays</span>
          </button>
        </div>
      </div>

      {/* Add New Draggable Tag or Text Block */}
      <div className="space-y-2 pt-2 border-t border-slate-200">
        <label className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
          <Plus className="w-3.5 h-3.5 text-amber-700" />
          <span>Add Draggable Dynamic Element to Certificate:</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          
          {/* Add Tag Badge */}
          <div className="flex items-center gap-1.5">
            <select
              value={selectedTagForAdd}
              onChange={(e) => setSelectedTagForAdd(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-1.5 text-[11px] text-slate-800 focus:outline-none focus:border-amber-500"
            >
              {AVAILABLE_CERTIFICATE_TAGS.map(t => (
                <option key={t.tag} value={t.tag}>
                  {t.tag} - {t.labelNp}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleAddTagElement}
              className="px-2.5 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded-xl font-bold text-[10px] transition shrink-0 cursor-pointer shadow-2xs"
            >
              + Tag Badge
            </button>
          </div>

          {/* Add Custom Text */}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="e.g. विशेष प्रशंसा / Special Honor"
              value={customTextForAdd}
              onChange={(e) => setCustomTextForAdd(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-1.5 text-[11px] text-slate-800 focus:outline-none focus:border-amber-500"
            />
            <button
              type="button"
              onClick={handleAddCustomTextElement}
              className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl font-bold text-[10px] transition shrink-0 cursor-pointer shadow-2xs"
            >
              + Text
            </button>
          </div>

        </div>
      </div>

      {/* Active Draggable Elements List */}
      {draggableElements.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between text-[10px] text-slate-600 font-bold">
            <span>Active Draggable Elements ({draggableElements.length}):</span>
            <span className="text-amber-700">Click & Drag on certificate preview</span>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {draggableElements.map(elem => (
              <div
                key={elem.id}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 flex items-center gap-1.5 text-[10px] text-slate-800 shadow-2xs"
              >
                <Move className="w-3 h-3 text-amber-700" />
                <span className="font-bold truncate max-w-[120px]">{elem.label}</span>
                <span className="font-mono text-[9px] text-slate-500">
                  ({Math.round(elem.x)}, {Math.round(elem.y)})
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveElement(elem.id)}
                  className="text-rose-500 hover:text-rose-700 p-0.5 rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
