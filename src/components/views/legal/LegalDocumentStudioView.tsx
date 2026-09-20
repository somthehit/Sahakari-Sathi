/**
 * Legal Document Generator Studio
 * Three-panel layout: Templates sidebar | Editor/Preview | Properties
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, Folder, FolderOpen, Plus, Save, Send, Eye, Printer, ChevronDown, ChevronRight,
  CheckCircle2, Clock, Edit3, Archive, AlertTriangle, Trash2, Copy, History, Search,
  Download, Settings, Type, Layout, Tag, X, Check, Minus, BookOpen, Scale, Stamp,
} from 'lucide-react';
import { useCoop } from '../../../context/CoopContext';
import {
  fetchLegalCategories, fetchLegalTemplates, fetchLegalTemplate, createLegalTemplate, updateLegalTemplate,
  fetchLegalVersions, fetchLegalVersion, createLegalVersion, updateLegalVersion, approveLegalVersion,
  fetchLegalClauses, createLegalClause, createLegalCategory,
  generateLegalDocument, fetchLegalDocuments, fetchLegalDocument, markLegalDocumentPrinted,
  fetchLegalAuditTrail,
  type LegalTemplateCategory, type LegalTemplate, type LegalTemplateVersion, type LegalTemplateClause,
  type LegalDocument, type LegalAuditEntry,
} from '../../../api/legalDocuments';

// ── Helpers ───────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-300',
  under_review: 'bg-amber-50 text-amber-700 border-amber-300',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  published: 'bg-blue-50 text-blue-700 border-blue-300',
  archived: 'bg-rose-50 text-rose-700 border-rose-300',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft: <Edit3 className="w-3 h-3" />,
  under_review: <Clock className="w-3 h-3" />,
  approved: <CheckCircle2 className="w-3 h-3" />,
  published: <Stamp className="w-3 h-3" />,
  archived: <Archive className="w-3 h-3" />,
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  loan: <Scale className="w-4 h-4 text-emerald-600" />,
  savings: <BookOpen className="w-4 h-4 text-blue-600" />,
  shares: <Tag className="w-4 h-4 text-purple-600" />,
  general: <FileText className="w-4 h-4 text-slate-600" />,
};

const VARIABLE_LIST = [
  { group: 'Member', vars: [
    { key: 'member.name', label: 'Member Name' },
    { key: 'member.fatherName', label: "Father's Name" },
    { key: 'member.citizenshipNo', label: 'Citizenship No' },
    { key: 'member.address', label: 'Address' },
    { key: 'member.phone', label: 'Phone' },
    { key: 'member.memberNo', label: 'Member No' },
    { key: 'member.age', label: 'Age' },
  ]},
  { group: 'Loan', vars: [
    { key: 'loan.loanNo', label: 'Loan No' },
    { key: 'loan.principalAmount', label: 'Loan Amount' },
    { key: 'loan.interestRate', label: 'Interest Rate' },
    { key: 'loan.tenureMonths', label: 'Tenure (Months)' },
    { key: 'loan.emiAmount', label: 'EMI Amount' },
    { key: 'loan.purpose', label: 'Purpose' },
    { key: 'loanProductName', label: 'Product Name' },
  ]},
  { group: 'Guarantor', vars: [
    { key: 'guarantorName', label: 'Guarantor Name' },
    { key: 'guarantorCitizenship', label: 'Guarantor Citizenship' },
    { key: 'guarantorAddress', label: 'Guarantor Address' },
    { key: 'guarantorRelationship', label: 'Relationship' },
  ]},
  { group: 'Organization', vars: [
    { key: 'organization.name', label: 'Organization Name' },
    { key: 'organization.registrationNo', label: 'Registration No' },
    { key: 'organization.address', label: 'Organization Address' },
  ]},
  { group: 'System', vars: [
    { key: 'documentNo', label: 'Document No' },
    { key: 'generatedDateBs', label: 'Date (BS)' },
    { key: 'generatedDateAd', label: 'Date (AD)' },
  ]},
];

// ── Sub-Components ────────────────────────────────────────────────────────

/** Status badge */
const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'}`}>
    {STATUS_ICONS[status]} {status.replace('_', ' ')}
  </span>
);

/** Template sidebar tree item */
const TemplateTreeItem: React.FC<{
  template: LegalTemplate;
  isActive: boolean;
  onClick: () => void;
}> = ({ template, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center gap-2 transition-all ${
      isActive
        ? 'bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold'
        : 'hover:bg-slate-50 text-slate-700 border border-transparent'
    }`}
  >
    <FileText className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
    <span className="truncate flex-1">{template.name}</span>
    <StatusBadge status={template.status} />
  </button>
);

/** Variable chip for insertion */
const VariableChip: React.FC<{ variable: { key: string; label: string }; onInsert: (key: string) => void }> = ({ variable, onInsert }) => (
  <button
    onClick={() => onInsert(variable.key)}
    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-mono cursor-pointer transition"
    title={`Insert {{${variable.key}}}`}
  >
    {'{{'}{variable.label}{'}}'}
  </button>
);

/** Version history row */
const VersionRow: React.FC<{
  version: LegalTemplateVersion;
  isActive: boolean;
  onSelect: () => void;
  onApprove: () => void;
}> = ({ version, isActive, onSelect, onApprove }) => (
  <div
    onClick={onSelect}
    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer transition ${
      isActive ? 'bg-indigo-50 border border-indigo-300' : 'hover:bg-slate-50 border border-transparent'
    }`}
  >
    <span className="font-mono font-bold text-slate-500">v{version.versionNumber}</span>
    <StatusBadge status={version.status} />
    <span className="text-slate-400 text-[10px] ml-auto">
      {new Date(version.createdAt).toLocaleDateString()}
    </span>
    {version.status === 'under_review' && (
      <button
        onClick={(e) => { e.stopPropagation(); onApprove(); }}
        className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold cursor-pointer"
      >
        Approve
      </button>
    )}
  </div>
);

// ── Main Studio ───────────────────────────────────────────────────────────

export const LegalDocumentStudioView: React.FC = () => {
  const { loanAccounts = [], members = [] } = useCoop();

  // State
  const [categories, setCategories] = useState<LegalTemplateCategory[]>([]);
  const [templates, setTemplates] = useState<LegalTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<(LegalTemplate & { legal_template_categories?: LegalTemplateCategory }) | null>(null);
  const [versions, setVersions] = useState<LegalTemplateVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<LegalTemplateVersion | null>(null);
  const [clauses, setClauses] = useState<LegalTemplateClause[]>([]);
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [auditTrail, setAuditTrail] = useState<LegalAuditEntry[]>([]);

  // Editor state
  const [editorContent, setEditorContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Generate modal
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateLoanId, setGenerateLoanId] = useState('');
  const [generateCustomVars, setGenerateCustomVars] = useState<Record<string, string>>({});
  const [generatedDoc, setGeneratedDoc] = useState<LegalDocument | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // New template/category modals
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [showNewVersion, setShowNewVersion] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatCode, setNewCatCode] = useState('');
  const [newTplName, setNewTplName] = useState('');
  const [newTplCategoryId, setNewTplCategoryId] = useState('');
  const [newVersionNotes, setNewVersionNotes] = useState('');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activePanel, setActivePanel] = useState<'editor' | 'preview' | 'versions' | 'documents' | 'clauses'>('editor');

  // Loading
  const [loading, setLoading] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // ── Data Loading ──────────────────────────────────────────────────────
  const loadCategories = useCallback(async () => {
    try {
      const cats = await fetchLegalCategories();
      setCategories(cats);
    } catch (e) { console.error(e); }
  }, []);

  const loadTemplates = useCallback(async (categoryId?: string) => {
    try {
      const tpls = await fetchLegalTemplates(categoryId);
      setTemplates(tpls);
    } catch (e) { console.error(e); }
  }, []);

  const loadTemplate = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const result = await fetchLegalTemplate(id);
      setSelectedTemplate(result.legal_templates);
      setSelectedTemplateId(id);
      const vrs = await fetchLegalVersions(id);
      setVersions(vrs);
      const current = vrs.find(v => v.isCurrent);
      if (current) {
        const full = await fetchLegalVersion(current.id);
        setSelectedVersion(full);
        setSelectedVersionId(current.id);
        setEditorContent(full.content);
        setHasChanges(false);
      } else if (vrs.length > 0) {
        const full = await fetchLegalVersion(vrs[0].id);
        setSelectedVersion(full);
        setSelectedVersionId(vrs[0].id);
        setEditorContent(full.content);
        setHasChanges(false);
      } else {
        setSelectedVersion(null);
        setSelectedVersionId(null);
        setEditorContent('');
      }
      const cls = await fetchLegalClauses();
      setClauses(cls);
      const docs = await fetchLegalDocuments({ templateId: id });
      setDocuments(docs);
      if (vrs.length > 0) {
        const audit = await fetchLegalAuditTrail('template', id);
        setAuditTrail(audit);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCategories(); loadTemplates(); }, [loadCategories, loadTemplates]);

  useEffect(() => {
    if (selectedTemplateId) loadTemplate(selectedTemplateId);
  }, [selectedTemplateId, loadTemplate]);

  // ── Template CRUD ─────────────────────────────────────────────────────
  const handleCreateCategory = async () => {
    if (!newCatName || !newCatCode) return;
    try {
      await createLegalCategory({ name: newCatName, code: newCatCode.toUpperCase() });
      setShowNewCategory(false);
      setNewCatName('');
      setNewCatCode('');
      loadCategories();
    } catch (e: any) { alert(e?.response?.data?.error || 'Failed'); }
  };

  const handleCreateTemplate = async () => {
    if (!newTplName || !newTplCategoryId) return;
    try {
      const tpl = await createLegalTemplate({ categoryId: newTplCategoryId, name: newTplName });
      setShowNewTemplate(false);
      setNewTplName('');
      setNewTplCategoryId('');
      loadTemplates();
      setSelectedTemplateId(tpl.id);
    } catch (e: any) { alert(e?.response?.data?.error || 'Failed'); }
  };

  const handleCreateVersion = async () => {
    if (!selectedTemplateId) return;
    try {
      const ver = await createLegalVersion(selectedTemplateId, {
        content: editorContent || '<p>New template content...</p>',
        changeNotes: newVersionNotes || undefined,
      });
      setShowNewVersion(false);
      setNewVersionNotes('');
      loadTemplate(selectedTemplateId);
      setSelectedVersionId(ver.id);
      setSelectedVersion(ver);
    } catch (e: any) { alert(e?.response?.data?.error || 'Failed'); }
  };

  const handleSaveVersion = async () => {
    if (!selectedVersionId) return;
    try {
      await updateLegalVersion(selectedVersionId, { content: editorContent });
      setHasChanges(false);
      if (selectedTemplateId) loadTemplate(selectedTemplateId);
    } catch (e: any) { alert(e?.response?.data?.error || 'Failed'); }
  };

  const handleApproveVersion = async (versionId: string) => {
    if (!confirm('Approve this version? It will become the active template version.')) return;
    try {
      await approveLegalVersion(versionId);
      if (selectedTemplateId) loadTemplate(selectedTemplateId);
    } catch (e: any) { alert(e?.response?.data?.error || 'Failed'); }
  };

  const handleSubmitForReview = async () => {
    if (!selectedVersionId) return;
    try {
      await updateLegalVersion(selectedVersionId, { status: 'under_review' });
      if (selectedTemplateId) loadTemplate(selectedTemplateId);
    } catch (e: any) { alert(e?.response?.data?.error || 'Failed'); }
  };

  // ── Document Generation ───────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedTemplateId) return;
    try {
      setLoading(true);
      const doc = await generateLegalDocument({
        templateId: selectedTemplateId,
        loanId: generateLoanId || undefined,
        variables: Object.keys(generateCustomVars).length > 0 ? generateCustomVars : undefined,
      });
      setGeneratedDoc(doc);
      setShowGenerateModal(false);
      setShowPreview(true);
      if (selectedTemplateId) loadTemplate(selectedTemplateId);
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Generation failed');
    } finally { setLoading(false); }
  };

  const handlePrint = async (docId: string) => {
    try {
      await markLegalDocumentPrinted(docId);
      const doc = await fetchLegalDocument(docId);
      setGeneratedDoc(doc);
      // Open print window
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`
          <html><head><title>${doc.documentNo}</title>
          <style>
            body { font-family: 'Times New Roman', serif; margin: 40px; line-height: 1.8; }
            @media print { body { margin: 20mm; } }
          </style></head>
          <body>${doc.generatedContent}</body></html>
        `);
        win.document.close();
        win.print();
      }
      if (selectedTemplateId) loadTemplate(selectedTemplateId);
    } catch (e: any) { alert('Print failed'); }
  };

  // ── Variable Insertion ────────────────────────────────────────────────
  const insertVariable = (varKey: string) => {
    if (!editorRef.current) return;
    const textarea = editorRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = editorContent;
    const insertion = `{{${varKey}}}`;
    const newText = text.substring(0, start) + insertion + text.substring(end);
    setEditorContent(newText);
    setHasChanges(true);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + insertion.length, start + insertion.length);
    }, 0);
  };

  // ── Filtered templates ────────────────────────────────────────────────
  const filteredTemplates = templates.filter(t =>
    !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group templates by category
  const groupedTemplates = categories.map(cat => ({
    category: cat,
    templates: filteredTemplates.filter(t => t.categoryId === cat.id),
  }));

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-emerald-50/30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-xl">
            <Scale className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-800">Legal Document Generator Studio</h1>
            <p className="text-[10px] text-slate-500">Template Management — Version Control — Document Generation</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewCategory(true)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Category
          </button>
          <button
            onClick={() => { setShowNewTemplate(true); }}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> New Template
          </button>
          {selectedTemplateId && (
            <button
              onClick={() => setShowGenerateModal(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" /> Generate Document
            </button>
          )}
        </div>
      </div>

      {/* Main Content — 3-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel — Template Tree */}
        <div className="w-64 border-r border-slate-200 flex flex-col bg-slate-50/50">
          <div className="px-3 py-2 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-7 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {groupedTemplates.map(({ category, templates: catTemplates }) => (
              <div key={category.id}>
                <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {CATEGORY_ICONS[category.code?.split('_')[0]?.toLowerCase()] || <FileText className="w-3.5 h-3.5" />}
                  {category.name}
                  <span className="ml-auto text-slate-400 font-normal">{catTemplates.length}</span>
                </div>
                <div className="space-y-0.5">
                  {catTemplates.map(tpl => (
                    <TemplateTreeItem
                      key={tpl.id}
                      template={tpl}
                      isActive={tpl.id === selectedTemplateId}
                      onClick={() => setSelectedTemplateId(tpl.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
            {groupedTemplates.length === 0 && (
              <div className="text-center text-xs text-slate-400 py-8">
                <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                No templates yet. Create your first template.
              </div>
            )}
          </div>
        </div>

        {/* Center Panel — Editor / Preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedTemplateId ? (
            <>
              {/* Tab bar */}
              <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-200 bg-slate-50/50">
                {(['editor', 'preview', 'versions', 'documents', 'clauses'] as const).map(panel => (
                  <button
                    key={panel}
                    onClick={() => setActivePanel(panel)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer capitalize ${
                      activePanel === panel
                        ? 'bg-white border border-slate-300 text-slate-800 shadow-xs'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {panel === 'editor' && <Edit3 className="w-3 h-3 inline mr-1" />}
                    {panel === 'preview' && <Eye className="w-3 h-3 inline mr-1" />}
                    {panel === 'versions' && <History className="w-3 h-3 inline mr-1" />}
                    {panel === 'documents' && <FileText className="w-3 h-3 inline mr-1" />}
                    {panel === 'clauses' && <BookOpen className="w-3 h-3 inline mr-1" />}
                    {panel}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  {hasChanges && (
                    <span className="text-[10px] text-amber-600 font-bold">Unsaved changes</span>
                  )}
                  {selectedVersion && (
                    <StatusBadge status={selectedVersion.status} />
                  )}
                </div>
              </div>

              {/* Editor Panel */}
              {activePanel === 'editor' && (
                <div className="flex-1 flex overflow-hidden">
                  <div className="flex-1 flex flex-col">
                    <textarea
                      ref={editorRef}
                      value={editorContent}
                      onChange={e => { setEditorContent(e.target.value); setHasChanges(true); }}
                      className="flex-1 p-4 font-mono text-sm leading-relaxed resize-none focus:outline-none"
                      placeholder="Write your template content here. Use {{variable}} for dynamic data insertion..."
                      spellCheck={false}
                    />
                    <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 bg-slate-50">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSaveVersion}
                          disabled={!hasChanges || !selectedVersionId}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                        >
                          <Save className="w-3.5 h-3.5" /> Save
                        </button>
                        <button
                          onClick={handleSubmitForReview}
                          disabled={!selectedVersionId || selectedVersion?.status === 'approved'}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                        >
                          <Send className="w-3.5 h-3.5" /> Submit for Review
                        </button>
                      </div>
                      <button
                        onClick={() => setShowNewVersion(true)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" /> New Version
                      </button>
                    </div>
                  </div>
                  {/* Variable sidebar */}
                  <div className="w-56 border-l border-slate-200 overflow-y-auto bg-slate-50/50 p-3">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Template Variables</div>
                    <div className="space-y-3">
                      {VARIABLE_LIST.map(group => (
                        <div key={group.group}>
                          <div className="text-[10px] font-bold text-slate-400 mb-1">{group.group}</div>
                          <div className="flex flex-wrap gap-1">
                            {group.vars.map(v => (
                              <VariableChip key={v.key} variable={v} onInsert={insertVariable} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Reusable Clauses</div>
                      <div className="space-y-1">
                        {clauses.slice(0, 5).map(clause => (
                          <button
                            key={clause.id}
                            onClick={() => insertVariable(`CLAUSE_${clause.id.slice(0, 8)}`)}
                            className="w-full text-left px-2 py-1.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded text-[10px] text-slate-600 hover:text-indigo-700 transition cursor-pointer truncate"
                            title={clause.content}
                          >
                            {clause.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview Panel */}
              {activePanel === 'preview' && (
                <div className="flex-1 overflow-y-auto p-6 bg-slate-200">
                  <div className="max-w-[210mm] mx-auto bg-white shadow-lg p-[25mm] min-h-[297mm]">
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: editorContent || '<p class="text-slate-400 italic">No content to preview</p>' }}
                    />
                  </div>
                </div>
              )}

              {/* Versions Panel */}
              {activePanel === 'versions' && (
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="max-w-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-slate-800">Version History</h3>
                      <button
                        onClick={() => setShowNewVersion(true)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> New Version
                      </button>
                    </div>
                    <div className="space-y-2">
                      {versions.map(v => (
                        <VersionRow
                          key={v.id}
                          version={v}
                          isActive={v.id === selectedVersionId}
                          onSelect={() => {
                            setSelectedVersionId(v.id);
                            setSelectedVersion(v);
                            setEditorContent(v.content);
                            setActivePanel('editor');
                          }}
                          onApprove={() => handleApproveVersion(v.id)}
                        />
                      ))}
                      {versions.length === 0 && (
                        <div className="text-center text-xs text-slate-400 py-8">
                          No versions yet. Create the first version of this template.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Documents Panel */}
              {activePanel === 'documents' && (
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="max-w-4xl">
                    <h3 className="text-sm font-bold text-slate-800 mb-4">Generated Documents</h3>
                    <div className="space-y-2">
                      {documents.map(doc => (
                        <div key={doc.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-slate-800">{doc.documentNo}</div>
                            <div className="text-[10px] text-slate-500">
                              {new Date(doc.createdAt).toLocaleString()} · {doc.printCount || 0} prints
                            </div>
                          </div>
                          <StatusBadge status={doc.status} />
                          <button
                            onClick={() => {
                              setGeneratedDoc(doc);
                              setShowPreview(true);
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold cursor-pointer"
                          >
                            <Eye className="w-3 h-3 inline" /> View
                          </button>
                          <button
                            onClick={() => handlePrint(doc.id)}
                            className="px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded text-[10px] font-bold cursor-pointer"
                          >
                            <Printer className="w-3 h-3 inline" /> Print
                          </button>
                        </div>
                      ))}
                      {documents.length === 0 && (
                        <div className="text-center text-xs text-slate-400 py-8">
                          No documents generated yet. Use "Generate Document" to create one.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Clauses Panel */}
              {activePanel === 'clauses' && (
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="max-w-4xl">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-slate-800">Clause Library</h3>
                      <button
                        onClick={() => {
                          const name = prompt('Clause name:');
                          const content = prompt('Clause content (use {{variables}}):');
                          if (name && content) {
                            createLegalClause({ name, clauseType: 'required', content }).then(() => {
                              if (selectedTemplateId) loadTemplate(selectedTemplateId);
                            });
                          }
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Clause
                      </button>
                    </div>
                    <div className="space-y-2">
                      {clauses.map(clause => (
                        <div key={clause.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-slate-800">{clause.name}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              clause.clauseType === 'required' ? 'bg-red-100 text-red-700' :
                              clause.clauseType === 'conditional' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {clause.clauseType}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-2">{clause.content}</p>
                        </div>
                      ))}
                      {clauses.length === 0 && (
                        <div className="text-center text-xs text-slate-400 py-8">
                          No clauses in the library. Add reusable clauses for your templates.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* No Template Selected */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Scale className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h2 className="text-lg font-black text-slate-600 mb-2">Legal Document Generator Studio</h2>
                <p className="text-sm text-slate-400 mb-6 max-w-md">
                  Select a template from the sidebar or create a new one to get started.
                  Generate legal documents for loans, agreements, certificates, and more.
                </p>
                <button
                  onClick={() => setShowNewTemplate(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition cursor-pointer"
                >
                  <Plus className="w-4 h-4 inline mr-1" /> Create First Template
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Generate Document Modal ────────────────────────────────────── */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-[600px] max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <h3 className="text-sm font-black text-slate-800">Generate Document</h3>
              <button onClick={() => setShowGenerateModal(false)} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Loan (optional)</label>
                <select
                  value={generateLoanId}
                  onChange={e => setGenerateLoanId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="">— Manual entry —</option>
                  {loanAccounts.filter(l => l.status === 'Disbursed').map((l: any) => (
                    <option key={l.id} value={l.id}>{l.loanNo} — {l.memberName || l.memberId}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">Select a loan to auto-populate member, amount, guarantor, and collateral data.</p>
              </div>
              <div className="border-t border-slate-200 pt-3">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Custom Variables (override)</div>
                <div className="grid grid-cols-2 gap-2">
                  {['cooperativeName', 'branchName', 'dateBs', 'dateAd'].map(key => (
                    <div key={key}>
                      <label className="block text-[10px] text-slate-500 mb-0.5">{key}</label>
                      <input
                        type="text"
                        value={generateCustomVars[key] || ''}
                        onChange={e => setGenerateCustomVars(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                        placeholder={`Override ${key}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
              >
                <FileText className="w-3.5 h-3.5" /> {loading ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview Modal ──────────────────────────────────────────────── */}
      {showPreview && generatedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-black text-slate-800">{generatedDoc.documentNo}</h3>
                <StatusBadge status={generatedDoc.status} />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrint(generatedDoc.id)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button onClick={() => { setShowPreview(false); setGeneratedDoc(null); }} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-slate-200">
              <div className="max-w-[210mm] mx-auto bg-white shadow-lg p-[25mm] min-h-[297mm]">
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: generatedDoc.generatedContent }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── New Category Modal ─────────────────────────────────────────── */}
      {showNewCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-[400px] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <h3 className="text-sm font-black text-slate-800">New Template Category</h3>
              <button onClick={() => setShowNewCategory(false)} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Name</label>
                <input
                  type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  placeholder="e.g. Loan Documents"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Code</label>
                <input
                  type="text" value={newCatCode} onChange={e => setNewCatCode(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  placeholder="e.g. LOAN_DOCS"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50">
              <button onClick={() => setShowNewCategory(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer">Cancel</button>
              <button onClick={handleCreateCategory} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Template Modal ─────────────────────────────────────────── */}
      {showNewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-[450px] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <h3 className="text-sm font-black text-slate-800">New Template</h3>
              <button onClick={() => setShowNewTemplate(false)} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Template Name</label>
                <input
                  type="text" value={newTplName} onChange={e => setNewTplName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  placeholder="e.g. Loan Tamsuk Template"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={newTplCategoryId} onChange={e => setNewTplCategoryId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="">— Select category —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {categories.length === 0 && (
                <p className="text-[10px] text-amber-600">
                  No categories yet. Create a category first.
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50">
              <button onClick={() => setShowNewTemplate(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer">Cancel</button>
              <button onClick={handleCreateTemplate} disabled={!newTplName || !newTplCategoryId} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold cursor-pointer">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Version Modal ──────────────────────────────────────────── */}
      {showNewVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-[450px] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <h3 className="text-sm font-black text-slate-800">Create New Version</h3>
              <button onClick={() => setShowNewVersion(false)} className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Change Notes</label>
                <textarea
                  value={newVersionNotes} onChange={e => setNewVersionNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  rows={3}
                  placeholder="What changed in this version?"
                />
              </div>
              <p className="text-[10px] text-slate-400">
                Current editor content will be saved as version {versions.length + 1}.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50">
              <button onClick={() => setShowNewVersion(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer">Cancel</button>
              <button onClick={handleCreateVersion} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer">Create Version</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
