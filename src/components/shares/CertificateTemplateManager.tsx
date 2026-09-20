import React, { useState, useEffect } from 'react';
import { 
  FolderOpen, 
  BookmarkPlus, 
  Save, 
  Trash2, 
  Copy, 
  Download, 
  Upload, 
  Sparkles, 
  Check, 
  Layout, 
  FileText, 
  Clock, 
  Star, 
  X, 
  ChevronDown, 
  Plus, 
  ShieldCheck, 
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { CertificateConfig, CertificateTheme, DEFAULT_CERT_CONFIG } from './ShareCertificateCanvas';

export interface CertificateTemplate {
  id: string;
  name: string;
  nameNp?: string;
  description: string;
  category: 'builtin' | 'custom' | 'agm' | 'executive';
  isBuiltIn?: boolean;
  createdAt?: string;
  updatedAt?: string;
  config: CertificateConfig;
}

// Default Pre-built Certificate Design Templates
export const PREBUILT_TEMPLATES: CertificateTemplate[] = [
  {
    id: 'tpl_royal_gold',
    name: 'Royal Heritage Gold',
    nameNp: 'राजकीय स्वर्ण शृङ्खला',
    description: 'Traditional ornate gold design with seal watermark, perfect for annual share distribution.',
    category: 'builtin',
    isBuiltIn: true,
    config: {
      ...DEFAULT_CERT_CONFIG,
      theme: 'royal_gold',
      watermarkType: 'seal',
      showQrCode: true,
      showHologram: true,
    },
  },
  {
    id: 'tpl_emerald_heritage',
    name: 'Emerald Executive',
    nameNp: 'सदाबहार हरियो - आधुनिक',
    description: 'Modern executive emerald layout with intricate mandala background watermark.',
    category: 'builtin',
    isBuiltIn: true,
    config: {
      ...DEFAULT_CERT_CONFIG,
      theme: 'emerald_heritage',
      watermarkType: 'mandala',
      certificateTitleNp: 'शेयर स्वामित्व प्रमाण-पत्र',
      statementTemplateNp: 'प्रमाणित गरिन्छ कि श्री / श्रीमती {member_name} (नागरिकता नं. {citizenship_no}, ठेगाना: {address}) ले संस्थाको कुल {share_count} कित्ता ({kitta_range}) शेयर सुरक्षित गर्नुभएको छ।',
      showQrCode: true,
      showHologram: true,
    },
  },
  {
    id: 'tpl_crimson_prestige',
    name: 'Crimson Sovereign',
    nameNp: 'रक्त रञ्जित प्रिमियम',
    description: 'Vibrant crimson theme with shield security watermark and full member demographic tags.',
    category: 'builtin',
    isBuiltIn: true,
    config: {
      ...DEFAULT_CERT_CONFIG,
      theme: 'crimson_prestige',
      watermarkType: 'shield',
      certificateTitleNp: 'विशेष शेयर प्रमाण-पत्र',
      statementTemplateNp: '{coop_name_np}को नियमानुसार सदस्य नं. {member_no} का {member_name} ले जम्मा {share_count} कित्ता शेयर (रकम रु. {total_amount}) धारण गर्नुभएको व्यहोरा प्रमाणित गरिन्छ।',
      showQrCode: true,
      showHologram: true,
    },
  },
  {
    id: 'tpl_executive_navy',
    name: 'Executive Navy Bilingual',
    nameNp: 'प्रशासनिक नेभी - द्वैभाषिक',
    description: 'Clean dual-language layout for modern institutional look with high readability.',
    category: 'builtin',
    isBuiltIn: true,
    config: {
      ...DEFAULT_CERT_CONFIG,
      theme: 'executive_navy',
      watermarkType: 'seal',
      certificateTitleNp: 'शेयर प्रमाण-पत्र',
      certificateTitleEn: 'OFFICIAL SHARE CERTIFICATE',
      statementTemplateNp: 'प्रमाणित गरिन्छ कि श्री / श्रीमती {member_name} ले यस संस्थाको चुक्ता कित्ता संख्या {share_count} कित्ता ({kitta_range}) शेयर लिनुभएको छ।',
      statementTemplateEn: 'This certifies that {member_name} (Member No: {member_no}) holds {share_count} shares worth {total_amount}.',
      showQrCode: true,
      showHologram: true,
    },
  },
  {
    id: 'tpl_agm_special_2083',
    name: 'AGM Special 2083',
    nameNp: 'साधारण सभा विशेष २०८३',
    description: 'Specially formatted for General Assembly with full spelled out amount in Nepali.',
    category: 'agm',
    isBuiltIn: true,
    config: {
      ...DEFAULT_CERT_CONFIG,
      theme: 'royal_gold',
      watermarkType: 'mandala',
      certificateTitleNp: 'शेयर प्रमाण-पत्र (वार्षिक सभा)',
      statementTemplateNp: 'संस्थाको वार्षिक साधारण सभाको निर्णयानुसार श्री / श्रीमती {member_name} (सदस्य नं. {member_no}) ले कुल {share_count} कित्ता शेयर बापत अक्षरेपी {total_amount_words} चुक्ता गर्नुभएकोले यो प्रमाण-पत्र प्रदान गरिएको छ।',
      showQrCode: true,
      showHologram: true,
    },
  },
];

const LOCAL_STORAGE_KEY = 'sahakari_share_cert_templates';

interface CertificateTemplateManagerProps {
  currentConfig: CertificateConfig;
  onApplyConfig: (config: CertificateConfig) => void;
  className?: string;
}

export const CertificateTemplateManager: React.FC<CertificateTemplateManagerProps> = ({
  currentConfig,
  onApplyConfig,
  className = '',
}) => {
  const [customTemplates, setCustomTemplates] = useState<CertificateTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string>('tpl_royal_gold');
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [newTplName, setNewTplName] = useState<string>('');
  const [newTplDescription, setNewTplDescription] = useState<string>('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Load custom templates from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCustomTemplates(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to parse stored certificate templates', e);
    }
  }, []);

  // Save custom templates to localStorage
  const saveCustomTemplatesToStorage = (templates: CertificateTemplate[]) => {
    setCustomTemplates(templates);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(templates));
    } catch (e) {
      console.error('Failed to save certificate templates to storage', e);
    }
  };

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // Combine built-in + custom
  const allTemplates = [...PREBUILT_TEMPLATES, ...customTemplates];

  // Load a template
  const handleSelectTemplate = (template: CertificateTemplate) => {
    onApplyConfig(template.config);
    setActiveTemplateId(template.id);
    setIsLibraryOpen(false);
    showToast('success', `Loaded "${template.name}" template successfully.`);
  };

  // Save Current Design as New Template
  const handleSaveAsNewTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTplName.trim()) {
      showToast('error', 'Please provide a template name.');
      return;
    }

    const newTpl: CertificateTemplate = {
      id: `custom_tpl_${Date.now()}`,
      name: newTplName.trim(),
      description: newTplDescription.trim() || 'Custom user created certificate design.',
      category: 'custom',
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      config: { ...currentConfig },
    };

    const updated = [newTpl, ...customTemplates];
    saveCustomTemplatesToStorage(updated);
    setActiveTemplateId(newTpl.id);
    setIsSaveModalOpen(false);
    setNewTplName('');
    setNewTplDescription('');
    showToast('success', `Template "${newTpl.name}" saved to your custom designs!`);
  };

  // Delete a Custom Template
  const handleDeleteTemplate = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete template "${name}"?`)) {
      const filtered = customTemplates.filter(t => t.id !== id);
      saveCustomTemplatesToStorage(filtered);
      if (activeTemplateId === id) {
        setActiveTemplateId('tpl_royal_gold');
      }
      showToast('info', `Template "${name}" removed.`);
    }
  };

  // Export templates to JSON file
  const handleExportTemplates = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allTemplates, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `certificate_templates_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('success', 'Exported all certificate templates to JSON.');
  };

  // Import templates from JSON file
  const handleImportTemplates = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            // Filter non-builtin custom ones
            const importedCustoms = parsed.filter(t => !t.isBuiltIn && t.config && t.name);
            if (importedCustoms.length === 0) {
              showToast('error', 'No valid custom templates found in file.');
              return;
            }
            const merged = [...importedCustoms, ...customTemplates];
            saveCustomTemplatesToStorage(merged);
            showToast('success', `Imported ${importedCustoms.length} template(s) successfully!`);
          }
        } catch (err) {
          showToast('error', 'Invalid JSON file format.');
        }
      };
    }
  };

  const currentActiveTemplate = allTemplates.find(t => t.id === activeTemplateId);

  return (
    <div className={`space-y-3 ${className}`}>
      
      {/* Toast Notification */}
      {notification && (
        <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-semibold shadow-md animate-fade-in ${ notification.type === 'success' ? 'bg-emerald-50 /80 border-emerald-300 text-emerald-900 ' : notification.type === 'error' ? 'bg-rose-50 /80 border-rose-300 text-rose-900 ' : 'bg-amber-50 /80 border-amber-300 text-amber-900 ' }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-500 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Template Control Bar */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 /40 p-3 rounded-2xl border border-amber-300/80 /60 shadow-xs space-y-2">
        
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-600 text-white rounded-lg shadow-2xs">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900 text-xs">
                  Template Manager
                </span>
                <span className="text-[10px] bg-amber-100 /60 text-amber-900 px-1.5 py-0.5 rounded-full font-bold">
                  {allTemplates.length} Designs
                </span>
              </div>
              <p className="text-[10px] text-slate-500 truncate max-w-xs">
                Active: <strong className="text-amber-800">{currentActiveTemplate?.name || 'Custom Design'}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Quick Library Toggle Button */}
            <button
              type="button"
              onClick={() => setIsLibraryOpen(true)}
              className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Layout className="w-3.5 h-3.5" />
              <span>Browse Designs</span>
            </button>

            {/* Save Current Config as New Template */}
            <button
              type="button"
              onClick={() => setIsSaveModalOpen(true)}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-amber-600" />
              <span>Save As...</span>
            </button>
          </div>
        </div>

        {/* Quick Horizontal Presets Switcher Ribbon */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 scrollbar-none">
          <span className="text-[10px] text-slate-500 font-medium shrink-0">Quick Switch:</span>
          {allTemplates.slice(0, 6).map(tpl => {
            const isActive = activeTemplateId === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleSelectTemplate(tpl)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition shrink-0 flex items-center gap-1 cursor-pointer border ${ isActive ? 'bg-amber-700 text-white border-amber-800 shadow-2xs' : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400' }`}
              >
                {tpl.isBuiltIn ? (
                  <Star className={`w-3 h-3 ${isActive ? 'text-amber-200 fill-amber-200' : 'text-amber-500'}`} />
                ) : (
                  <Sparkles className="w-3 h-3 text-emerald-500" />
                )}
                <span>{tpl.nameNp || tpl.name}</span>
              </button>
            );
          })}
        </div>

      </div>

      {/* Full Template Library Modal */}
      {isLibraryOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-4 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <Layout className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Certificate Design Template Library
                  </h3>
                  <p className="text-xs text-slate-500">
                    Select a pre-built professional design or restore your saved custom templates.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsLibraryOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Import / Export Utility Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 /50 p-2.5 rounded-xl border border-slate-200 /60 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">
                  Manage Custom Templates:
                </span>
                <span className="text-[10px] text-slate-500">
                  ({customTemplates.length} custom saved)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <label className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1 transition">
                  <Upload className="w-3.5 h-3.5 text-amber-600" />
                  <span>Import JSON</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportTemplates}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleExportTemplates}
                  className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export All</span>
                </button>
              </div>
            </div>

            {/* Template Gallery Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto pr-1 flex-1 py-1">
              {allTemplates.map(tpl => {
                const isSelected = activeTemplateId === tpl.id;

                const themeColors: Record<CertificateTheme, string> = {
                  royal_gold: 'border-amber-400 bg-amber-50/50 text-amber-900',
                  emerald_heritage: 'border-emerald-500 bg-emerald-50/50 text-emerald-900',
                  crimson_prestige: 'border-rose-500 bg-rose-50/50 text-rose-900',
                  executive_navy: 'border-blue-600 bg-blue-50/50 text-blue-900',
                };

                return (
                  <div
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl)}
                    className={`p-3.5 rounded-2xl border-2 transition cursor-pointer space-y-2 flex flex-col justify-between group relative ${ isSelected ? 'border-amber-600 bg-amber-50/40 /30 shadow-md' : 'border-slate-200 hover:border-amber-400 bg-white /80 hover:shadow-xs' }`}
                  >
                    {/* Top Row */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${themeColors[tpl.config.theme] || 'bg-slate-100'}`}>
                            {tpl.config.theme.replace('_', ' ').toUpperCase()}
                          </span>
                          {tpl.isBuiltIn ? (
                            <span className="text-[10px] text-amber-600 bg-amber-100 /60 px-1.5 py-0.5 rounded font-bold">
                              Official
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-600 bg-emerald-100 /60 px-1.5 py-0.5 rounded font-bold">
                              Custom Saved
                            </span>
                          )}
                        </div>

                        {isSelected && (
                          <span className="text-xs text-amber-700 font-bold flex items-center gap-1 bg-amber-100 /80 px-2 py-0.5 rounded-full">
                            <Check className="w-3.5 h-3.5" /> Active
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-slate-900 text-sm pt-1">
                        {tpl.name} {tpl.nameNp && <span className="text-slate-500 text-xs font-serif font-normal">({tpl.nameNp})</span>}
                      </h4>

                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                        {tpl.description}
                      </p>
                    </div>

                    {/* Features Preview Badges */}
                    <div className="pt-2 border-t border-slate-100 /60 flex items-center justify-between text-[10px] text-slate-500">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>Watermark: <strong className="text-slate-800 capitalize">{tpl.config.watermarkType}</strong></span>
                        <span>Logo: <strong className="text-slate-800">{tpl.config.showCompanyLogo !== false ? (tpl.config.companyLogoUrl ? 'Uploaded' : 'Default') : 'Hidden'}</strong></span>
                        <span>Sigs: <strong className="text-slate-800">{tpl.config.showAuthorizedSignatures !== false ? 'Enabled' : 'Hidden'}</strong></span>
                      </div>

                      <div className="flex items-center gap-1">
                        {!tpl.isBuiltIn && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteTemplate(tpl.id, tpl.name, e)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="Delete custom template"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleSelectTemplate(tpl)}
                          className={`px-3 py-1 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer ${ isSelected ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-800 group-hover:bg-amber-600 group-hover:text-white' }`}
                        >
                          <span>Apply</span>
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-500">
                You can save custom layouts at any time using "Save As..."
              </span>
              <button
                onClick={() => setIsLibraryOpen(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close Library
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Save Template Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSaveAsNewTemplate} className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-4 animate-scale-up">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <BookmarkPlus className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Save Certificate Design Template
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="text-slate-500 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  Template Name <span className="text-emerald-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AGM 2083 Golden Special"
                  value={newTplName}
                  onChange={(e) => setNewTplName(e.target.value)}
                  className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  Description / Note
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief description of this design or when to use it..."
                  value={newTplDescription}
                  onChange={(e) => setNewTplDescription(e.target.value)}
                  className="w-full bg-slate-50 border placeholder-slate-400 border-slate-200 rounded-xl p-2.5 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="p-2.5 bg-amber-50 /50 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  What will be saved:
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[10px] opacity-90">
                  <li>Theme: <strong className="capitalize">{currentConfig.theme.replace('_', ' ')}</strong></li>
                  <li>Watermark & Security: <strong className="capitalize">{currentConfig.watermarkType}</strong></li>
                  <li>Company Logo: <strong>{currentConfig.showCompanyLogo !== false ? (currentConfig.companyLogoUrl ? 'Custom Image Uploaded' : 'Default Crest') : 'Disabled'}</strong></li>
                  <li>Authorized Signatures: <strong>{currentConfig.showAuthorizedSignatures !== false ? 'Enabled' : 'Disabled'}</strong></li>
                  <li>Snap-to-Grid Layout: <strong>{currentConfig.enableSnapToGrid !== false ? `Active (${currentConfig.gridSize || 20}px step)` : 'Disabled'}</strong> ({currentConfig.draggableElements?.length || 0} overlay elements)</li>
                  <li>Custom Title & Dynamic Statement Templates (with tags)</li>
                  <li>Signatories information & face value rates</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Save Template</span>
              </button>
            </div>

          </form>
        </div>
      )}

    </div>
  );
};
