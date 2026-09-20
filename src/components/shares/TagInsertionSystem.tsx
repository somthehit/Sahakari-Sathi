import React, { useState } from 'react';
import { 
  Tag, 
  Plus, 
  Copy, 
  Check, 
  Search, 
  Sparkles, 
  HelpCircle, 
  FileCode2, 
  RotateCcw,
  User,
  Coins,
  Calendar,
  Building
} from 'lucide-react';
import { Member } from '../../types/coop';
import { CertificateConfig } from './ShareCertificateCanvas';
import { 
  AVAILABLE_CERTIFICATE_TAGS, 
  CertificateTag, 
  resolveCertificateTags, 
  TagContext 
} from '../../utils/certificateTagEngine';

interface TagInsertionSystemProps {
  certConfig: CertificateConfig;
  onChangeConfig: React.Dispatch<React.SetStateAction<CertificateConfig>>;
  selectedMember: Member;
  certificateNo?: string;
  kittaStart?: number;
  kittaEnd?: number;
  issuedDateBS?: string;
  issuedDateAD?: string;
}

export const TagInsertionSystem: React.FC<TagInsertionSystemProps> = ({
  certConfig,
  onChangeConfig,
  selectedMember,
  certificateNo = 'SC-2083-0101',
  kittaStart = 1001,
  kittaEnd = 1050,
  issuedDateBS = '2083-04-15',
  issuedDateAD = '2026-07-31',
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [tagSearch, setTagSearch] = useState<string>('');
  const [targetField, setTargetField] = useState<'statementTemplateNp' | 'statementTemplateEn' | 'actLegislationNp' | 'certificateTitleNp'>('statementTemplateNp');
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [lastInsertedTag, setLastInsertedTag] = useState<string | null>(null);

  // Tag context for real-time interpolation preview
  const tagCtx: TagContext = {
    member: selectedMember,
    config: certConfig,
    certificateNo,
    kittaStart,
    kittaEnd,
    issuedDateBS,
    issuedDateAD,
  };

  // Filter tags based on category & search
  const filteredTags = AVAILABLE_CERTIFICATE_TAGS.filter(t => {
    const matchesCat = activeCategory === 'all' || t.category === activeCategory;
    const matchesSearch = 
      t.tag.toLowerCase().includes(tagSearch.toLowerCase()) ||
      t.labelNp.toLowerCase().includes(tagSearch.toLowerCase()) ||
      t.labelEn.toLowerCase().includes(tagSearch.toLowerCase()) ||
      t.description.toLowerCase().includes(tagSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Handle Tag Insertion into the selected template field
  const handleInsertTag = (tagString: string) => {
    onChangeConfig(prev => {
      const currentText = prev[targetField] || '';
      return {
        ...prev,
        [targetField]: currentText ? `${currentText} ${tagString}` : tagString,
      };
    });

    setLastInsertedTag(tagString);
    setTimeout(() => setLastInsertedTag(null), 2000);
  };

  // Copy tag string to clipboard
  const handleCopyTag = (tagString: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(tagString);
    setCopiedTag(tagString);
    setTimeout(() => setCopiedTag(null), 1800);
  };

  // Quick Preset Handlers
  const applyPreset = (type: 'standard_np' | 'formal_legal' | 'bilingual') => {
    if (type === 'standard_np') {
      onChangeConfig(prev => ({
        ...prev,
        statementTemplateNp: 'प्रमाणित गरिन्छ कि श्री / श्रीमती / सुश्री {member_name} (नागरिकता नं. {citizenship_no}, ठेगाना: {address}) ले यस संस्थाको चुक्ता कित्ता संख्या {share_count} कित्ता ({kitta_range}) शेयर लिनुभएको छ।',
        statementTemplateEn: '',
      }));
    } else if (type === 'formal_legal') {
      onChangeConfig(prev => ({
        ...prev,
        statementTemplateNp: '{coop_name_np}को नियम र विनियमावली अनुसार सदस्य नं. {member_no} का श्री/श्रीमती {member_name} (नागरिकता: {citizenship_no}) ले कुल {share_count} कित्ता शेयर (रकम {total_amount}) खरिद गर्नुभएको व्यहोरा प्रमाणित गरिन्छ।',
        statementTemplateEn: '',
      }));
    } else if (type === 'bilingual') {
      onChangeConfig(prev => ({
        ...prev,
        statementTemplateNp: 'प्रमाणित गरिन्छ कि श्री / श्रीमती {member_name} ले यस संस्थाको चुक्ता कित्ता संख्या {share_count} कित्ता ({kitta_range}) शेयर लिनुभएको छ।',
        statementTemplateEn: 'This certifies that {member_name} (Member No: {member_no}) holds {share_count} shares worth {total_amount} ({total_amount_words}).',
      }));
    }
  };

  // Resolved live text preview
  const resolvedActivePreview = resolveCertificateTags(certConfig[targetField] || '', tagCtx);

  return (
    <div className="space-y-4 bg-slate-50 /90 p-4 rounded-2xl border border-slate-200 text-xs">
      
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-100 /40 text-amber-800 rounded-lg">
            <Tag className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-xs">
              Tag Insertion & Dynamic Placeholder Engine
            </h3>
            <p className="text-[10px] text-slate-500">
              Insert dynamic database placeholders like <code className="bg-amber-100 text-amber-900 px-1 rounded">{'{member_name}'}</code> to auto-populate member details during certificate rendering.
            </p>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500 font-medium">Presets:</span>
          <button
            type="button"
            onClick={() => applyPreset('standard_np')}
            className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-md text-[10px] font-medium text-slate-700 transition cursor-pointer"
          >
            Standard
          </button>
          <button
            type="button"
            onClick={() => applyPreset('formal_legal')}
            className="px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded-md text-[10px] font-medium text-slate-700 transition cursor-pointer"
          >
            Legal
          </button>
          <button
            type="button"
            onClick={() => applyPreset('bilingual')}
            className="px-2 py-1 bg-amber-100 /60 border border-amber-300 rounded-md text-[10px] font-bold text-amber-900 transition cursor-pointer"
          >
            Bilingual
          </button>
        </div>
      </div>

      {/* Target Field Selector */}
      <div className="space-y-1.5">
        <label className="font-bold text-slate-700 flex items-center justify-between">
          <span>Target Field for Tag Insertion:</span>
          {lastInsertedTag && (
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 animate-pulse">
              <Check className="w-3 h-3" /> Inserted {lastInsertedTag}
            </span>
          )}
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {[
            { id: 'statementTemplateNp', label: 'Nepali Statement' },
            { id: 'statementTemplateEn', label: 'English Statement' },
            { id: 'certificateTitleNp', label: 'Certificate Title' },
            { id: 'actLegislationNp', label: 'Legislation Note' },
          ].map(field => (
            <button
              key={field.id}
              type="button"
              onClick={() => setTargetField(field.id as any)}
              className={`p-2 rounded-xl border text-center font-bold text-[11px] transition cursor-pointer ${ targetField === field.id ? 'bg-amber-600 text-white border-amber-700 shadow-xs' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100' }`}
            >
              {field.label}
            </button>
          ))}
        </div>
      </div>

      {/* Editable Template Textarea for Target Field */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-800">
            {targetField === 'statementTemplateNp' && 'Certificate Main Statement (Nepali)'}
            {targetField === 'statementTemplateEn' && 'Certificate Secondary Sub-Statement (English)'}
            {targetField === 'certificateTitleNp' && 'Main Title Heading (Nepali)'}
            {targetField === 'actLegislationNp' && 'Sub-Heading Legislation Note'}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            {certConfig[targetField]?.length || 0} chars
          </span>
        </div>

        <textarea
          rows={3}
          value={certConfig[targetField] || ''}
          onChange={(e) => onChangeConfig(prev => ({ ...prev, [targetField]: e.target.value }))}
          placeholder="Enter text or click dynamic tags below to insert placeholders..."
          className="w-full bg-white border border-amber-300 rounded-xl p-2.5 font-serif text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed shadow-inner"
        />
      </div>

      {/* Live Interpolated Text Preview */}
      <div className="p-3 bg-amber-100/60 /30 border border-amber-300 /60 rounded-xl space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold text-amber-900 uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-600" />
            Live Database Interpolation Preview ({selectedMember?.fullName || 'Selected Member'}):
          </span>
          <span className="font-mono text-[9px] bg-white px-1.5 py-0.5 rounded border border-amber-200">
            Auto-Resolved
          </span>
        </div>
        <p className="font-serif text-slate-900 text-xs italic leading-relaxed pt-1">
          {resolvedActivePreview || <span className="text-slate-500 opacity-60">(Field is empty)</span>}
        </p>
      </div>

      {/* Category Tabs & Search Bar for Tag Palette */}
      <div className="space-y-2 pt-2 border-t border-slate-200">
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: 'All Tags', icon: Tag },
              { id: 'member', label: 'Member', icon: User },
              { id: 'share', label: 'Share', icon: Coins },
              { id: 'certificate', label: 'Dates & No.', icon: Calendar },
              { id: 'institution', label: 'Coop', icon: Building },
            ].map(cat => {
              const IconComp = cat.icon;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${ activeCategory === cat.id ? 'bg-amber-700 text-white shadow-2xs' : 'bg-white text-slate-600 hover:bg-slate-200' }`}
                >
                  <IconComp className="w-3 h-3" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-44">
            <Search className="w-3 h-3 absolute left-2.5 top-2 text-slate-500" />
            <input
              type="text"
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              placeholder="Search tag..."
              className="w-full pl-7 pr-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Tag Selector Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
          {filteredTags.map(tagObj => {
            const evaluatedValue = resolveCertificateTags(tagObj.tag, tagCtx);

            return (
              <div
                key={tagObj.tag}
                onClick={() => handleInsertTag(tagObj.tag)}
                className="p-2 bg-white /90 border border-slate-200 /80 hover:border-amber-400 rounded-xl transition cursor-pointer flex items-start justify-between gap-2 group hover:shadow-2xs"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <code className="font-mono font-bold text-amber-800 text-[11px] bg-amber-50 /60 px-1.5 py-0.5 rounded border border-amber-200 /80 group-hover:bg-amber-600 group-hover:text-white transition">
                      {tagObj.tag}
                    </code>
                    <span className="font-semibold text-slate-700 text-[10px] truncate">
                      {tagObj.labelNp}
                    </span>
                  </div>

                  <p className="text-[9px] text-slate-500 truncate">
                    {tagObj.description}
                  </p>

                  <div className="text-[10px] text-emerald-700 font-mono font-medium truncate pt-0.5">
                    Value: <span className="font-bold">{evaluatedValue}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 pt-0.5">
                  <button
                    type="button"
                    title="Copy Tag"
                    onClick={(e) => handleCopyTag(tagObj.tag, e)}
                    className="p-1 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded transition cursor-pointer"
                  >
                    {copiedTag === tagObj.tag ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    title="Insert Tag into Textarea"
                    onClick={() => handleInsertTag(tagObj.tag)}
                    className="p-1 bg-amber-100 /60 text-amber-800 hover:bg-amber-600 hover:text-white rounded transition cursor-pointer flex items-center justify-center"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>

    </div>
  );
};
