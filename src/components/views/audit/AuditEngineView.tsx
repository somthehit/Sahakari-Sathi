import React, { useState, useEffect, useCallback } from 'react';
import { useCoop } from '../../../context/CoopContext';
import { Shield, Play, AlertTriangle, CheckCircle2, XCircle, Eye, Settings,
  FileText, History, Loader2, ChevronRight, Filter, RefreshCw,
  Download, MessageSquare, UserCheck, Lock, Unlock, BarChart3,
  AlertCircle, Clock, TrendingUp, ClipboardCheck, Scale, Send, Link,
} from 'lucide-react';
import {
  fetchAuditDashboard, fetchAuditRules, createAuditRule, updateAuditRule,
  deleteAuditRule, seedAuditRules, fetchAuditRuns, fetchAuditRun,
  triggerAuditRun, fetchAuditFindings, resolveAuditFinding,
  fetchAuditOpinion, updateAuditOpinion, fetchAuditSignoffs, addAuditSignoff,
  type AuditDashboardStats, type AuditRule, type AuditRun, type AuditFinding,
  type AuditOpinionDraft, type AuditSignoff,
} from '../../../api/auditEngine';
import { exportAuditOpinionPdf, exportWorkpaperPackagePdf, exportConsolidatedAuditReportPdf } from '../../../utils/financialReportExport';
import { exportBalanceSheetPdf, exportProfitLossPdf, exportTrialBalancePdf, exportCashFlowPdf } from '../../../utils/financialReportExport';
import { fetchCoa } from '../../../api/accountingSettings';
import { fetchVouchers } from '../../../api/accounting';
import { useCoop as useCoopContext } from '../../../context/CoopContext';

type Tab = 'dashboard' | 'run' | 'findings' | 'rules' | 'opinion' | 'history';

// ─── Helper: Transform raw accounts + vouchers into export-ready data ───
function buildFinancialData(accounts: any[], vouchers: any[]) {
  const pctChange = (cur: number, pri: number) => pri > 0 ? ((cur - pri) / pri * 100) : (cur > 0 ? 100 : 0);
  const num = (v: any) => Number(v) || 0;
  const toBs = (a: any) => ({
    code: a.code || '', name: a.name || '', balance: num(a.balance),
    priorBalance: num(a.priorBalance),
    varAmount: num(a.balance) - num(a.priorBalance),
    varPercent: pctChange(num(a.balance), num(a.priorBalance)),
  });
  const toPl = (a: any) => ({
    code: a.code || '', name: a.name || '', periodAmount: num(a.balance),
    priorBalance: num(a.priorBalance),
    varAmount: num(a.balance) - num(a.priorBalance),
    varPercent: pctChange(num(a.balance), num(a.priorBalance)),
  });

  const safeAccounts = Array.isArray(accounts) ? accounts : [];
  const assetAccs = safeAccounts.filter(a => a.type === 'Asset').map(toBs);
  const liabAccs = safeAccounts.filter(a => a.type === 'Liability').map(toBs);
  const eqAccs = safeAccounts.filter(a => a.type === 'Equity').map(toBs);
  const incAccs = safeAccounts.filter(a => a.type === 'Income').map(toPl);
  const expAccs = safeAccounts.filter(a => a.type === 'Expense').map(toPl);

  const totalAssets = assetAccs.reduce((s, a) => s + a.balance, 0);
  const priorAssets = assetAccs.reduce((s, a) => s + a.priorBalance, 0);
  const totalLiab = liabAccs.reduce((s, a) => s + a.balance, 0);
  const priorLiab = liabAccs.reduce((s, a) => s + a.priorBalance, 0);
  const totalEq = eqAccs.reduce((s, a) => s + a.balance, 0);
  const priorEq = eqAccs.reduce((s, a) => s + a.priorBalance, 0);
  const totalInc = incAccs.reduce((s, a) => s + a.periodAmount, 0);
  const priorInc = incAccs.reduce((s, a) => s + a.priorBalance, 0);
  const totalExp = expAccs.reduce((s, a) => s + a.periodAmount, 0);
  const priorExp = expAccs.reduce((s, a) => s + a.priorBalance, 0);
  const netSurplus = totalInc - totalExp;

  // Trial Balance
  const tbAccs = safeAccounts.map(a => ({
    code: a.code || '', name: a.name || '', category: a.type || 'Asset',
    openingBalance: num(a.priorBalance),
    debitMovement: num(a.debit),
    creditMovement: num(a.credit),
    closingBalance: num(a.balance),
    variance: num(a.balance) - num(a.priorBalance),
  }));
  const tbTotals = {
    opening: tbAccs.reduce((s, a) => s + a.openingBalance, 0),
    debit: tbAccs.reduce((s, a) => s + a.debitMovement, 0),
    credit: tbAccs.reduce((s, a) => s + a.creditMovement, 0),
    closing: tbAccs.reduce((s, a) => s + a.closingBalance, 0),
    variance: tbAccs.reduce((s, a) => s + a.variance, 0),
  };

  // Cash Flow
  const cashCodes = ['101', '102'];
  const isCash = (code: string) => cashCodes.some(c => code?.startsWith(c));
  const receipts: any[] = [];
  const payments: any[] = [];
  (Array.isArray(vouchers) ? vouchers : []).forEach((v: any) => {
    if (v.status === 'Cancelled') return;
    (v.entries || []).forEach((e: any) => {
      if (isCash(e.accountCode)) {
        const amt = num(e.debit) || num(e.credit);
        const entry = { voucherNo: v.voucherNo || v.id?.slice(0, 8) || '', dateBs: v.dateBS || v.dateBs || '', particulars: e.accountName || e.accountCode || '', amount: amt };
        if (num(e.debit) > 0) receipts.push(entry);
        else if (num(e.credit) > 0) payments.push(entry);
      }
    });
  });
  const totalReceipts = receipts.reduce((s, r) => s + r.amount, 0);
  const totalPayments = payments.reduce((s, p) => s + p.amount, 0);

  return { assetAccs, totalAssets, priorAssets, liabAccs, totalLiab, priorLiab, eqAccs, totalEq, priorEq,
    incAccs, totalInc, priorInc, expAccs, totalExp, priorExp, netSurplus,
    tbAccs, tbTotals, receipts, totalReceipts, payments, totalPayments };
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  critical: { color: 'text-red-700', bg: 'bg-red-100 border-red-200', icon: XCircle },
  high: { color: 'text-orange-700', bg: 'bg-orange-100 border-orange-200', icon: AlertTriangle },
  medium: { color: 'text-amber-700', bg: 'bg-amber-100 border-amber-200', icon: AlertCircle },
  low: { color: 'text-sky-700', bg: 'bg-sky-100 border-sky-200', icon: Eye },
  advisory: { color: 'text-slate-600', bg: 'bg-slate-100 border-slate-200', icon: Eye },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  open: { color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  in_review: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  resolved: { color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  waived: { color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
};

const OPINION_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  unqualified: { color: 'text-green-700', bg: 'bg-green-100', label: 'Unqualified (Clean)' },
  qualified: { color: 'text-amber-700', bg: 'bg-amber-100', label: 'Qualified' },
  adverse: { color: 'text-red-700', bg: 'bg-red-100', label: 'Adverse' },
  disclaimer: { color: 'text-slate-700', bg: 'bg-slate-200', label: 'Disclaimer' },
};

const SIGNOFF_STAGES = [
  { key: 'preparer', label: 'Preparer', icon: FileText },
  { key: 'internal_auditor', label: 'Internal Auditor', icon: Shield },
  { key: 'external_auditor', label: 'External Auditor', icon: UserCheck },
  { key: 'board', label: 'Board Sign-off', icon: Scale },
  { key: 'doc_submission', label: 'DoC Submission', icon: Lock },
];

const CATEGORY_LABELS: Record<string, string> = {
  integrity: 'Data Integrity',
  statutory: 'Statutory Compliance',
  analytical: 'Analytical Review',
};

const RULE_TYPES = [
  { value: 'tie_out', label: 'Tie-out (Equality)', description: 'Field A must equal Field B within tolerance' },
  { value: 'threshold', label: 'Threshold Check', description: 'Field A must satisfy operator + value' },
  { value: 'percentage_of_base', label: 'Percentage of Base', description: '(Field A / Base Field) × 100 must satisfy operator + %' },
  { value: 'classification_match', label: 'Classification Match', description: 'Loan ageing bucket vs classification bucket' },
];

const FIELD_OPTIONS = [
  { value: 'total_assets', label: 'Total Assets (सम्पत्ति)' },
  { value: 'total_liabilities', label: 'Total Liabilities (दायित्व)' },
  { value: 'total_equity', label: 'Total Equity (पुँजी)' },
  { value: 'liabilities_plus_equity', label: 'Liabilities + Equity' },
  { value: 'total_debits', label: 'Total Debits (जम्मा डेबिट)' },
  { value: 'total_credits', label: 'Total Credits (जम्मा क्रेडिट)' },
  { value: 'cash_bank_balance', label: 'Cash & Bank Balance' },
  { value: 'total_income', label: 'Total Income (जम्मा आम्दानि)' },
  { value: 'total_expense', label: 'Total Expense (जम्मा खर्च)' },
  { value: 'net_surplus', label: 'Net Surplus (शुद्ध नाफा)' },
  { value: 'reserve_fund', label: 'Reserve Fund (सञ्चिति कोष)' },
  { value: 'dividend', label: 'Dividend (लाभांश)' },
  { value: 'loan_receivable', label: 'Loan Receivable (ऋण प्राप्त)' },
  { value: 'fixed_assets', label: 'Fixed Assets (स्थायी सम्पत्ति)' },
  { value: 'prior_total_assets', label: 'Prior Year Total Assets' },
  { value: 'prior_net_surplus', label: 'Prior Year Net Surplus' },
];

const OPERATORS = [
  { value: '=', label: '= (equals)' },
  { value: '!=', label: '≠ (not equal)' },
  { value: '>=', label: '≥ (greater or equal)' },
  { value: '<=', label: '≤ (less or equal)' },
  { value: '>', label: '> (greater than)' },
  { value: '<', label: '< (less than)' },
];

export const AuditEngineView: React.FC = () => {
  const { addNotification } = useCoopContext();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  // Dashboard
  const [stats, setStats] = useState<AuditDashboardStats | null>(null);

  // Rules
  const [rules, setRules] = useState<AuditRule[]>([]);
  const [ruleCategoryFilter, setRuleCategoryFilter] = useState<string>('');
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AuditRule | null>(null);
  const [ruleForm, setRuleForm] = useState({
    ruleCode: '', name: '', nameNepali: '', description: '', category: 'integrity' as string,
    layer: 1, ruleType: 'tie_out', fieldA: '', fieldB: '', operator: '=', tolerance: '0',
    baseField: '', thresholdValue: '', sourceStatement: '', severity: 'medium',
    isBlocking: false, active: true,
  });

  // Runs
  const [runs, setRuns] = useState<AuditRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AuditRun | null>(null);

  // Findings
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [findingFilter, setFindingFilter] = useState({ status: '', severity: '', category: '' });
  const [selectedFinding, setSelectedFinding] = useState<AuditFinding | null>(null);
  const [resolveModal, setResolveModal] = useState(false);
  const [resolveForm, setResolveForm] = useState({ status: 'resolved', resolutionNote: '', waivedJustification: '' });

  // Statement Detail modal (from finding)
  const [statementModal, setStatementModal] = useState(false);
  const [statementAccounts, setStatementAccounts] = useState<any[]>([]);
  const [statementTitle, setStatementTitle] = useState('');
  const [statementHighlightedCodes, setStatementHighlightedCodes] = useState<Set<string>>(new Set());

  // Share with Auditor modal
  const [shareModal, setShareModal] = useState(false);
  const [shareForm, setShareForm] = useState({ recipient: 'internal_auditor', message: '', includeEvidence: true });

  // Opinion
  const [opinion, setOpinion] = useState<AuditOpinionDraft | null>(null);
  const [signoffs, setSignoffs] = useState<AuditSignoff[]>([]);
  const [signoffModal, setSignoffModal] = useState(false);
  const [signoffForm, setSignoffForm] = useState({
    stage: 'preparer', decision: 'approved', comments: '',
    // External Auditor fields
    externalAuditorName: '', externalAuditorFirm: '', opinionPdfUrl: '', opinionPdfName: '',
    // Board fields
    resolutionNumber: '', resolutionDate: '', resolutionTitle: '',
    // DoC fields
    docSubmissionDate: '', docReferenceNumber: '', docPortalUrl: '',
  });

  // ─── Data Loading ──────────────────────────────────────────────────

  const loadDashboard = useCallback(async () => {
    try {
      const data = await fetchAuditDashboard();
      setStats(data);
    } catch (e: any) {
      console.error('Failed to load audit dashboard:', e);
    }
  }, []);

  const loadRules = useCallback(async () => {
    try {
      const data = await fetchAuditRules(ruleCategoryFilter || undefined);
      setRules(data);
    } catch (e: any) {
      console.error('Failed to load rules:', e);
    }
  }, [ruleCategoryFilter]);

  const loadStatementAccounts = useCallback(async (finding: AuditFinding) => {
    try {
      const coa = await fetchCoa();
      const allAccounts = coa.accounts || [];
      const stmt = finding.evidenceRef?.statement || finding.sourceStatement || '';
      const acctCode = finding.evidenceRef?.accountCode || '';
      let filtered: any[] = [];
      const stmtLower = stmt.toLowerCase();
      if (acctCode) {
        filtered = allAccounts.filter((a: any) => a.code === acctCode || a.code?.startsWith(acctCode));
      } else if (stmtLower.includes('balance sheet') || stmtLower.includes('सम्पत्ति')) {
        filtered = allAccounts.filter((a: any) => ['Asset', 'Liability', 'Equity'].includes(a.type));
      } else if (stmtLower.includes('income') || stmtLower.includes('profit') || stmtLower.includes('loss') || stmtLower.includes('आम्दानि') || stmtLower.includes('expense')) {
        filtered = allAccounts.filter((a: any) => ['Income', 'Expense'].includes(a.type));
      } else if (stmtLower.includes('trial balance') || stmtLower.includes('खाता जाँच')) {
        filtered = allAccounts.filter((a: any) => a.allowPosting !== false);
      } else {
        filtered = allAccounts.filter((a: any) => a.allowPosting !== false);
      }

      const highlighted = new Set<string>();
      const findingCodes = new Set<string>();
      if (acctCode) findingCodes.add(acctCode);
      if (selectedFinding?.evidenceRef?.accountCode) findingCodes.add(selectedFinding.evidenceRef.accountCode);

      filtered.forEach((a: any) => {
        const bal = Math.abs(Number(a.balance || 0));
        if (findingCodes.has(a.code) || findingCodes.has(a.code?.slice(0, 3))) highlighted.add(a.code);
        if (bal > 0 && a.type === 'Asset' && a.normalBalance === 'credit') highlighted.add(a.code);
        if (bal > 0 && a.type === 'Liability' && a.normalBalance === 'debit') highlighted.add(a.code);
        if (bal > 0 && a.type === 'Income' && a.normalBalance === 'debit') highlighted.add(a.code);
        if (bal > 0 && a.type === 'Expense' && a.normalBalance === 'credit') highlighted.add(a.code);
      });

      setStatementAccounts(filtered);
      setStatementHighlightedCodes(highlighted);
      setStatementTitle(stmt || 'All Accounts');
      setStatementModal(true);
    } catch (e: any) { console.error('Failed to load accounts:', e); }
  }, [selectedFinding]);

  const handleShareFinding = useCallback(async () => {
    if (!selectedFinding) return;
    try {
      await resolveAuditFinding(selectedFinding.id, {
        status: 'in_review',
        resolutionNote: shareForm.message || `Shared with ${shareForm.recipient === 'internal_auditor' ? 'Internal' : 'External'} Auditor`,
      });
      addNotification('Finding Shared', `Finding sent to ${shareForm.recipient === 'internal_auditor' ? 'Internal Auditor' : 'External Auditor'} for review.`, 'success');
      setShareModal(false);
      setShareForm({ recipient: 'internal_auditor', message: '', includeEvidence: true });
      if (selectedRun) { const data = await fetchAuditFindings({ runId: selectedRun.id }); setFindings(data); }
    } catch (e: any) {
      addNotification('Share Failed', e.message, 'error');
    }
  }, [selectedFinding, shareForm, selectedRun, addNotification]);

  const loadRuns = useCallback(async () => {
    try {
      const data = await fetchAuditRuns();
      setRuns(data);
      return data;
    } catch (e: any) {
      console.error('Failed to load runs:', e);
      return [];
    }
  }, []);

  const loadFindings = useCallback(async () => {
    try {
      const params: any = {};
      if (selectedRun) params.runId = selectedRun.id;
      if (findingFilter.status) params.status = findingFilter.status;
      if (findingFilter.severity) params.severity = findingFilter.severity;
      if (findingFilter.category) params.category = findingFilter.category;
      const data = await fetchAuditFindings(Object.keys(params).length ? params : undefined);
      setFindings(data);
    } catch (e: any) {
      console.error('Failed to load findings:', e);
    }
  }, [selectedRun, findingFilter]);

  const loadOpinion = useCallback(async (runId: string) => {
    try {
      const data = await fetchAuditOpinion(runId);
      setOpinion(data);
    } catch {
      setOpinion(null);
    }
  }, []);

  const loadSignoffs = useCallback(async (runId: string) => {
    try {
      const data = await fetchAuditSignoffs(runId);
      setSignoffs(data);
    } catch {
      setSignoffs([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadDashboard(), loadRules(), loadRuns(), loadFindings()])
      .then(([, , fetchedRuns]) => {
        if (!selectedRun && fetchedRuns && fetchedRuns.length > 0) setSelectedRun(fetchedRuns[0]);
      })
      .finally(() => setLoading(false));
  }, [loadDashboard, loadRules, loadRuns, loadFindings]);

  useEffect(() => {
    if (selectedRun) {
      loadOpinion(selectedRun.id);
      loadSignoffs(selectedRun.id);
    }
  }, [selectedRun, loadOpinion, loadSignoffs]);

  // ─── Handlers ──────────────────────────────────────────────────────

  const handleTriggerRun = async () => {
    setRunning(true);
    try {
      const result = await triggerAuditRun();
      addNotification('Audit Run Complete', `${result.totalRules} rules evaluated, ${result.findingsCount} findings.`, 'success');
      await Promise.all([loadDashboard(), loadRuns(), loadFindings()]);
      setSelectedRun(result as any);
      setTab('findings');
    } catch (e: any) {
      addNotification('Audit Run Failed', e.message, 'error');
    } finally {
      setRunning(false);
    }
  };

  const handleSeedRules = async () => {
    try {
      const result = await seedAuditRules();
      addNotification('Rules Seeded', `${result.seeded} new rules added out of ${result.total} total.`, 'success');
      await loadRules();
    } catch (e: any) {
      addNotification('Seed Failed', e.message, 'error');
    }
  };

  const handleSaveRule = async () => {
    try {
      if (editingRule) {
        await updateAuditRule(editingRule.id, ruleForm as any);
        addNotification('Rule Updated', ruleForm.name, 'success');
      } else {
        await createAuditRule(ruleForm as any);
        addNotification('Rule Created', ruleForm.name, 'success');
      }
      setShowRuleModal(false);
      setEditingRule(null);
      setRuleForm({ ruleCode: '', name: '', nameNepali: '', description: '', category: 'integrity', layer: 1, ruleType: 'tie_out', fieldA: '', fieldB: '', operator: '=', tolerance: '0', baseField: '', thresholdValue: '', sourceStatement: '', severity: 'medium', isBlocking: false, active: true });
      await loadRules();
    } catch (e: any) {
      addNotification('Save Failed', e.message, 'error');
    }
  };

  const handleResolveFinding = async () => {
    if (!selectedFinding) return;
    try {
      await resolveAuditFinding(selectedFinding.id, resolveForm as any);
      addNotification('Finding Updated', `Status: ${resolveForm.status}`, 'success');
      setResolveModal(false);
      setSelectedFinding(null);
      await loadFindings();
    } catch (e: any) {
      addNotification('Update Failed', e.message, 'error');
    }
  };

  const handleSignoff = async () => {
    if (!selectedRun) return;
    try {
      const payload: any = {
        runId: selectedRun.id,
        stage: signoffForm.stage,
        decision: signoffForm.decision,
        comments: signoffForm.comments,
      };
      // Pass stage-specific fields
      if (signoffForm.stage === 'external_auditor') {
        payload.externalAuditorName = signoffForm.externalAuditorName;
        payload.externalAuditorFirm = signoffForm.externalAuditorFirm;
        payload.opinionPdfUrl = signoffForm.opinionPdfUrl;
        payload.opinionPdfName = signoffForm.opinionPdfName;
      } else if (signoffForm.stage === 'board') {
        payload.resolutionNumber = signoffForm.resolutionNumber;
        payload.resolutionDate = signoffForm.resolutionDate;
        payload.resolutionTitle = signoffForm.resolutionTitle;
      } else if (signoffForm.stage === 'doc_submission') {
        payload.docSubmissionDate = signoffForm.docSubmissionDate;
        payload.docReferenceNumber = signoffForm.docReferenceNumber;
        payload.docPortalUrl = signoffForm.docPortalUrl;
      }
      await addAuditSignoff(payload);
      addNotification('Sign-off Recorded', `${signoffForm.stage}: ${signoffForm.decision}`, 'success');
      setSignoffModal(false);
      setSignoffForm({ stage: 'preparer', decision: 'approved', comments: '', externalAuditorName: '', externalAuditorFirm: '', opinionPdfUrl: '', opinionPdfName: '', resolutionNumber: '', resolutionDate: '', resolutionTitle: '', docSubmissionDate: '', docReferenceNumber: '', docPortalUrl: '' });
      await loadSignoffs(selectedRun.id);
    } catch (e: any) {
      addNotification('Sign-off Failed', e.message, 'error');
    }
  };

  // ─── Render Helpers ────────────────────────────────────────────────

  const sevIcon = (s: string) => { const cfg = SEVERITY_CONFIG[s] || SEVERITY_CONFIG.advisory; const Icon = cfg.icon; return <Icon className={`w-4 h-4 ${cfg.color}`} />; };

  // ═══════════════════════════════════════════════════════════════════
  // DASHBOARD TAB
  // ═══════════════════════════════════════════════════════════════════

  const renderDashboard = () => {
    if (!stats) return <div className="text-center py-12 text-slate-400">No audit data yet. Run your first audit to see the dashboard.</div>;
    const totalFindings = Object.values(stats.findingsBySeverity).reduce((s, n) => s + n, 0);
    const openFindings = stats.findingsByStatus.open || 0;
    const criticalFindings = stats.findingsBySeverity.critical || 0;
    const highFindings = stats.findingsBySeverity.high || 0;

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500 mb-1">Active Rules</div>
            <div className="text-2xl font-bold text-emerald-700">{stats.activeRules}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500 mb-1">Total Runs</div>
            <div className="text-2xl font-bold text-slate-800">{stats.totalRuns}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500 mb-1">Total Findings</div>
            <div className="text-2xl font-bold text-slate-800">{totalFindings}</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500 mb-1">Open Findings</div>
            <div className={`text-2xl font-bold ${openFindings > 0 ? 'text-red-600' : 'text-green-600'}`}>{openFindings}</div>
          </div>
        </div>

        {/* Latest Run */}
        {stats.latestRun && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-3">Latest Audit Run</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div><span className="text-slate-500">FY:</span> <span className="font-medium">{stats.latestRun.fiscalYearLabel || 'All'}</span></div>
              <div><span className="text-slate-500">Rules:</span> <span className="font-medium">{stats.latestRun.totalRules}</span></div>
              <div><span className="text-green-600">Passed:</span> <span className="font-medium">{stats.latestRun.rulesPassed}</span></div>
              <div><span className="text-red-600">Failed:</span> <span className="font-medium">{stats.latestRun.rulesFailed}</span></div>
              <div><span className="text-slate-500">Date:</span> <span className="font-medium">{new Date(stats.latestRun.completedAt || stats.latestRun.createdAt).toLocaleDateString()}</span></div>
            </div>
          </div>
        )}

        {/* Findings by Severity */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-3">Findings by Severity</h3>
          <div className="space-y-2">
            {['critical', 'high', 'medium', 'low', 'advisory'].map(sev => {
              const count = stats.findingsBySeverity[sev] || 0;
              if (count === 0) return null;
              const cfg = SEVERITY_CONFIG[sev];
              return (
                <div key={sev} className="flex items-center gap-3">
                  {sevIcon(sev)}
                  <span className={`text-sm font-medium ${cfg.color} capitalize w-20`}>{sev}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${Math.min(100, (count / totalFindings) * 100)}%` }} />
                  </div>
                  <span className="text-sm font-bold text-slate-700 w-10 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Run Audit Button */}
        <button
          onClick={() => { setTab('run'); }}
          className="w-full bg-emerald-700 text-white rounded-xl py-3 font-semibold hover:bg-emerald-800 transition flex items-center justify-center gap-2"
        >
          <Play className="w-5 h-5" /> Run New Audit
        </button>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════
  // RUN TAB
  // ═══════════════════════════════════════════════════════════════════

  const renderRun = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
        <Shield className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800 mb-2">Run Audit Engine</h3>
        <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
          Execute all active audit rules against the current fiscal year data. This will evaluate data integrity, statutory compliance, and analytical review checks.
        </p>
        <button
          onClick={handleTriggerRun}
          disabled={running}
          className="bg-emerald-700 text-white px-8 py-3 rounded-xl font-semibold hover:bg-emerald-800 transition disabled:opacity-50 flex items-center gap-2 mx-auto"
        >
          {running ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
          {running ? 'Running Audit...' : 'Start Audit Run'}
        </button>
      </div>

      {/* Recent Runs */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-3">Recent Runs</h3>
        {runs.length === 0 ? (
          <p className="text-sm text-slate-400">No runs yet.</p>
        ) : (
          <div className="space-y-2">
            {runs.slice(0, 5).map(run => (
              <div
                key={run.id}
                onClick={() => { setSelectedRun(run); setTab('findings'); }}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition"
              >
                <div className="flex items-center gap-3">
                  {run.status === 'completed' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : run.status === 'failed' ? <XCircle className="w-5 h-5 text-red-500" /> : <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />}
                  <div>
                    <div className="text-sm font-medium">{run.fiscalYearLabel || 'All Data'}</div>
                    <div className="text-xs text-slate-400">{new Date(run.createdAt).toLocaleString()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-green-600">{run.rulesPassed} passed</span>
                  <span className="text-red-600">{run.rulesFailed} failed</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // FINDINGS TAB
  // ═══════════════════════════════════════════════════════════════════

  const renderFindings = () => (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={findingFilter.status} onChange={e => setFindingFilter(f => ({ ...f, status: e.target.value }))} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm">
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="in_review">In Review</option>
          <option value="resolved">Resolved</option>
          <option value="waived">Waived</option>
        </select>
        <select value={findingFilter.severity} onChange={e => setFindingFilter(f => ({ ...f, severity: e.target.value }))} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm">
          <option value="">All Severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="advisory">Advisory</option>
        </select>
        <select value={findingFilter.category} onChange={e => setFindingFilter(f => ({ ...f, category: e.target.value }))} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm">
          <option value="">All Categories</option>
          <option value="integrity">Integrity</option>
          <option value="statutory">Statutory</option>
          <option value="analytical">Analytical</option>
        </select>
      </div>

      {/* Findings List */}
      {findings.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No findings match the current filters.</div>
      ) : (
        <div className="space-y-2">
          {findings.map(f => {
            const sevCfg = SEVERITY_CONFIG[f.severity] || SEVERITY_CONFIG.advisory;
            const statCfg = STATUS_CONFIG[f.status] || STATUS_CONFIG.open;
            return (
              <div
                key={f.id}
                className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition"
              >
                <div
                  onClick={() => {
                    setSelectedFinding(f);
                    if (f.runId) {
                      const matchRun = runs.find(r => r.id === f.runId);
                      if (matchRun) setSelectedRun(matchRun);
                    }
                    setResolveModal(true);
                    setResolveForm({ status: f.status, resolutionNote: f.resolutionNote || '', waivedJustification: f.waivedJustification || '' });
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {sevIcon(f.severity)}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-800 truncate">{f.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{f.description}</div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${sevCfg.bg} ${sevCfg.color} font-medium capitalize`}>{f.severity}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${statCfg.bg} ${statCfg.color} font-medium capitalize`}>{f.status.replace('_', ' ')}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{CATEGORY_LABELS[f.category] || f.category}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-mono">{f.runId?.slice(0, 8)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {f.evidenceRef && f.evidenceRef.variance !== undefined && (
                    <div className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-2">
                      Expected: NPR {(f.evidenceRef.expectedAmount || 0).toLocaleString('en-IN')} | Actual: NPR {(f.evidenceRef.amount || 0).toLocaleString('en-IN')} | Variance: NPR {(f.evidenceRef.variance || 0).toLocaleString('en-IN')}
                    </div>
                  )}
                  {/* Statement reference */}
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                    <FileText className="w-3 h-3" />
                    <span>Statement: {f.evidenceRef?.statement || f.sourceStatement || 'N/A'}</span>
                    {f.evidenceRef?.accountCode && <span className="font-mono text-indigo-600">Account: {f.evidenceRef.accountCode}</span>}
                    {f.evidenceRef?.accountName && <span className="text-slate-500">— {f.evidenceRef.accountName}</span>}
                  </div>
                </div>
                {/* Action buttons */}
                <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); loadStatementAccounts(f); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium hover:bg-indigo-100 transition"
                  >
                    <Eye className="w-3.5 h-3.5" /> View Statement
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFinding(f);
                      setShareForm({ recipient: 'internal_auditor', message: `Please review finding: ${f.title}`, includeEvidence: true });
                      setShareModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100 transition"
                  >
                    <Send className="w-3.5 h-3.5" /> Share with Auditor
                  </button>
                  {f.evidenceRef?.variance !== undefined && f.evidenceRef.variance !== 0 && (
                    <span className={`text-xs font-medium ml-auto ${Math.abs(f.evidenceRef.variance) > 100000 ? 'text-red-600' : 'text-amber-600'}`}>
                      Variance: NPR {f.evidenceRef.variance.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Statement Detail Modal */}
      {statementModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">Trial Balance — {statementTitle || 'All Accounts'}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{statementAccounts.length} posting accounts — Dr/Cr view with differences highlighted</p>
              </div>
              <button onClick={() => setStatementModal(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {selectedFinding && (
                <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-indigo-700 mb-1">Finding Reference</div>
                  <div className="text-sm font-medium text-slate-800">{selectedFinding.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{selectedFinding.description}</div>
                  {selectedFinding.evidenceRef && (
                    <div className="mt-2 text-xs text-slate-600">
                      {selectedFinding.evidenceRef.accountCode && <span>Account: <span className="font-mono font-semibold">{selectedFinding.evidenceRef.accountCode}</span> {selectedFinding.evidenceRef.accountName || ''} | </span>}
                      Expected: NPR {(selectedFinding.evidenceRef.expectedAmount || 0).toLocaleString('en-IN')} | Actual: NPR {(selectedFinding.evidenceRef.amount || 0).toLocaleString('en-IN')} | Variance: NPR {(selectedFinding.evidenceRef.variance || 0).toLocaleString('en-IN')}
                    </div>
                  )}
                </div>
              )}
              {statementAccounts.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No accounts found for this statement.</div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <div className="text-xs text-blue-600 font-medium">Total Debit</div>
                      <div className="text-lg font-bold text-blue-800 font-mono">NPR {statementAccounts.reduce((s: number, a: any) => s + (a.normalBalance === 'debit' ? Math.abs(Number(a.balance || 0)) : 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <div className="text-xs text-green-600 font-medium">Total Credit</div>
                      <div className="text-lg font-bold text-green-800 font-mono">NPR {statementAccounts.reduce((s: number, a: any) => s + (a.normalBalance === 'credit' ? Math.abs(Number(a.balance || 0)) : 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${Math.abs(statementAccounts.reduce((s: number, a: any) => s + (a.normalBalance === 'debit' ? Math.abs(Number(a.balance || 0)) : -Math.abs(Number(a.balance || 0))), 0)) > 0.01 ? 'bg-red-50' : 'bg-green-50'}`}>
                      <div className={`text-xs font-medium ${Math.abs(statementAccounts.reduce((s: number, a: any) => s + (a.normalBalance === 'debit' ? Math.abs(Number(a.balance || 0)) : -Math.abs(Number(a.balance || 0))), 0)) > 0.01 ? 'text-red-600' : 'text-green-600'}`}>Difference</div>
                      <div className={`text-lg font-bold font-mono ${Math.abs(statementAccounts.reduce((s: number, a: any) => s + (a.normalBalance === 'debit' ? Math.abs(Number(a.balance || 0)) : -Math.abs(Number(a.balance || 0))), 0)) > 0.01 ? 'text-red-800' : 'text-green-800'}`}>
                        NPR {Math.abs(statementAccounts.reduce((s: number, a: any) => s + (a.normalBalance === 'debit' ? Math.abs(Number(a.balance || 0)) : -Math.abs(Number(a.balance || 0))), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 text-center">
                      <div className="text-xs text-slate-600 font-medium">Accounts</div>
                      <div className="text-lg font-bold text-slate-800">{statementAccounts.length}</div>
                    </div>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 border-b-2 border-slate-200">
                        <th className="text-left px-3 py-2 font-medium">Code</th>
                        <th className="text-left px-3 py-2 font-medium">Account Name</th>
                        <th className="text-center px-3 py-2 font-medium">Type</th>
                        <th className="text-right px-3 py-2 font-medium w-28">Debit (Dr)</th>
                        <th className="text-right px-3 py-2 font-medium w-28">Credit (Cr)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statementAccounts.map((a: any, idx: number) => {
                        const bal = Math.abs(Number(a.balance || 0));
                        const isDr = a.normalBalance === 'debit';
                        const isHl = statementHighlightedCodes.has(a.code);
                        return (
                          <tr key={a.id || idx} className={`border-b border-slate-100 ${isHl ? 'bg-amber-50 border-l-2 border-l-amber-400' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                            <td className="px-3 py-1.5 font-mono text-slate-700">{a.code}</td>
                            <td className="px-3 py-1.5 text-slate-800">{a.name}</td>
                            <td className="px-3 py-1.5 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${a.type === 'Asset' ? 'bg-blue-100 text-blue-700' : a.type === 'Liability' ? 'bg-red-100 text-red-700' : a.type === 'Income' ? 'bg-green-100 text-green-700' : a.type === 'Expense' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'}`}>{a.type}</span>
                            </td>
                            <td className={`px-3 py-1.5 text-right font-mono ${isDr && bal > 0 ? 'text-slate-800 font-semibold' : 'text-slate-300'}`}>
                              {isDr && bal > 0 ? bal.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                            </td>
                            <td className={`px-3 py-1.5 text-right font-mono ${!isDr && bal > 0 ? 'text-slate-800 font-semibold' : 'text-slate-300'}`}>
                              {!isDr && bal > 0 ? bal.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-800 text-white font-semibold">
                        <td colSpan={3} className="px-3 py-2">TOTAL</td>
                        <td className="px-3 py-2 text-right font-mono">NPR {statementAccounts.reduce((s: number, a: any) => s + (a.normalBalance === 'debit' ? Math.abs(Number(a.balance || 0)) : 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right font-mono">NPR {statementAccounts.reduce((s: number, a: any) => s + (a.normalBalance === 'credit' ? Math.abs(Number(a.balance || 0)) : 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 flex items-center justify-between">
              <button onClick={() => setStatementModal(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Close</button>
              {selectedFinding && (
                <button
                  onClick={() => { setStatementModal(false); setShareForm({ recipient: 'internal_auditor', message: `Please review finding: ${selectedFinding.title} — Statement: ${statementTitle}`, includeEvidence: true }); setShareModal(true); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
                >
                  <Send className="w-4 h-4" /> Share with Auditor
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share with Auditor Modal */}
      {shareModal && selectedFinding && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Share Finding with Auditor</h3>
              <button onClick={() => setShareModal(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-sm font-semibold">{selectedFinding.title}</div>
                <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{selectedFinding.description}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Share With</label>
                <select value={shareForm.recipient} onChange={e => setShareForm(f => ({ ...f, recipient: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                  <option value="internal_auditor">Internal Auditor</option>
                  <option value="external_auditor">External Auditor</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                <textarea value={shareForm.message} onChange={e => setShareForm(f => ({ ...f, message: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Add a note for the auditor..." />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={shareForm.includeEvidence} onChange={e => setShareForm(f => ({ ...f, includeEvidence: e.target.checked }))} className="rounded border-slate-300" />
                Include evidence (expected/actual/variance)
              </label>
            </div>
            <div className="p-5 border-t border-slate-200 flex items-center justify-end gap-2">
              <button onClick={() => setShareModal(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={handleShareFinding} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">
                <Send className="w-4 h-4" /> Share
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {resolveModal && selectedFinding && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Resolve Finding</h3>
              <button onClick={() => setResolveModal(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-sm font-semibold">{selectedFinding.title}</div>
                <div className="text-xs text-slate-500 mt-1">{selectedFinding.description}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select value={resolveForm.status} onChange={e => setResolveForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                  <option value="open">Open</option>
                  <option value="in_review">In Review</option>
                  <option value="resolved">Resolved</option>
                  <option value="waived">Waived</option>
                </select>
              </div>
              {resolveForm.status === 'resolved' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Resolution Note</label>
                  <textarea value={resolveForm.resolutionNote} onChange={e => setResolveForm(f => ({ ...f, resolutionNote: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" rows={3} placeholder="Describe how this finding was resolved..." />
                </div>
              )}
              {resolveForm.status === 'waived' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Waiver Justification</label>
                  <textarea value={resolveForm.waivedJustification} onChange={e => setResolveForm(f => ({ ...f, waivedJustification: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" rows={3} placeholder="Provide justification for waiving this finding..." />
                </div>
              )}
            </div>
            <div className="p-5 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setResolveModal(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={handleResolveFinding} className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // RULES TAB
  // ═══════════════════════════════════════════════════════════════════

  const renderRules = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <select value={ruleCategoryFilter} onChange={e => setRuleCategoryFilter(e.target.value)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm">
            <option value="">All Categories</option>
            <option value="integrity">Integrity</option>
            <option value="statutory">Statutory</option>
            <option value="analytical">Analytical</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSeedRules} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> Seed Defaults
          </button>
          <button onClick={() => { setEditingRule(null); setRuleForm({ ruleCode: '', name: '', nameNepali: '', description: '', category: 'integrity', layer: 1, ruleType: 'tie_out', fieldA: '', fieldB: '', operator: '=', tolerance: '0', baseField: '', thresholdValue: '', sourceStatement: '', severity: 'medium', isBlocking: false, active: true }); setShowRuleModal(true); }} className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 flex items-center gap-1">
            <Settings className="w-4 h-4" /> Add Rule
          </button>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Settings className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No audit rules configured yet.</p>
          <p className="text-sm mt-1">Click "Seed Defaults" to load the standard rule set, or add custom rules.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => {
            const sevCfg = SEVERITY_CONFIG[rule.severity] || SEVERITY_CONFIG.advisory;
            return (
              <div key={rule.id} className={`bg-white rounded-xl border p-4 ${rule.active ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">{rule.ruleCode}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${sevCfg.bg} ${sevCfg.color} font-medium capitalize`}>{rule.severity}</span>
                      {rule.isBlocking && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Blocking</span>}
                      {!rule.active && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Inactive</span>}
                    </div>
                    <div className="text-sm font-semibold text-slate-800 mt-1">{rule.name}</div>
                    {rule.nameNepali && <div className="text-xs text-slate-500">{rule.nameNepali}</div>}
                    <div className="text-xs text-slate-500 mt-1">{rule.description}</div>
                    <div className="flex gap-3 mt-2 text-xs text-slate-400">
                      <span>Layer {rule.layer}</span>
                      <span>{CATEGORY_LABELS[rule.category] || rule.category}</span>
                      <span>{rule.sourceStatement}</span>
                    </div>
                    {/* Rule Expression */}
                    <div className="mt-2 text-xs font-mono bg-slate-50 rounded-lg px-2 py-1 text-slate-600 border border-slate-100">
                      {rule.ruleType === 'tie_out' && rule.fieldA && rule.fieldB && (
                        <span>{rule.fieldA} = {rule.fieldB} (tol: {rule.tolerance || '0'})</span>
                      )}
                      {rule.ruleType === 'threshold' && rule.fieldA && (
                        <span>{rule.fieldA} {rule.operator || '>='} {rule.thresholdValue || '0'}</span>
                      )}
                      {rule.ruleType === 'percentage_of_base' && rule.fieldA && rule.baseField && (
                        <span>({rule.fieldA} / {rule.baseField}) × 100 {rule.operator || '>='} {rule.thresholdValue || '?'}%</span>
                      )}
                      {rule.ruleType === 'classification_match' && <span>Classification match (manual review)</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingRule(rule); setRuleForm({ ruleCode: rule.ruleCode, name: rule.name, nameNepali: rule.nameNepali, description: rule.description, category: rule.category, layer: rule.layer, ruleType: rule.ruleType || 'tie_out', fieldA: rule.fieldA || '', fieldB: rule.fieldB || '', operator: rule.operator || '=', tolerance: rule.tolerance || '0', baseField: rule.baseField || '', thresholdValue: rule.thresholdValue || '', sourceStatement: rule.sourceStatement, severity: rule.severity, isBlocking: rule.isBlocking, active: rule.active }); setShowRuleModal(true); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Settings className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rule Modal */}
      {showRuleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{editingRule ? 'Edit Rule' : 'Add Rule'}</h3>
              <button onClick={() => setShowRuleModal(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Row 1: Code + Category + Layer */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Rule Code</label>
                  <input value={ruleForm.ruleCode} onChange={e => setRuleForm(f => ({ ...f, ruleCode: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="INT-001" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                  <select value={ruleForm.category} onChange={e => setRuleForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                    <option value="integrity">Integrity</option>
                    <option value="statutory">Statutory</option>
                    <option value="analytical">Analytical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Layer</label>
                  <select value={ruleForm.layer} onChange={e => setRuleForm(f => ({ ...f, layer: parseInt(e.target.value), isBlocking: parseInt(e.target.value) === 1 ? true : f.isBlocking }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                    <option value={1}>1 - Integrity</option>
                    <option value={2}>2 - Statutory</option>
                    <option value={3}>3 - Analytical</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                  <input value={ruleForm.name} onChange={e => setRuleForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Name (Nepali)</label>
                  <input value={ruleForm.nameNepali} onChange={e => setRuleForm(f => ({ ...f, nameNepali: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                </div>
              </div>

              {/* Row 3: Description */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <textarea value={ruleForm.description} onChange={e => setRuleForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" rows={2} />
              </div>

              {/* ── EXECUTABLE RULE DEFINITION ──────────────────────────── */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">Rule Definition</div>

                {/* Rule Type */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Rule Type</label>
                  <select value={ruleForm.ruleType} onChange={e => setRuleForm(f => ({ ...f, ruleType: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                    {RULE_TYPES.map(rt => <option key={rt.value} value={rt.value}>{rt.label} — {rt.description}</option>)}
                  </select>
                </div>

                {/* Tie-out fields */}
                {ruleForm.ruleType === 'tie_out' && (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Field A</label>
                      <select value={ruleForm.fieldA} onChange={e => setRuleForm(f => ({ ...f, fieldA: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                        <option value="">Select field...</option>
                        {FIELD_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Field B</label>
                      <select value={ruleForm.fieldB} onChange={e => setRuleForm(f => ({ ...f, fieldB: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                        <option value="">Select field...</option>
                        {FIELD_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Tolerance (NPR)</label>
                      <input type="number" value={ruleForm.tolerance} onChange={e => setRuleForm(f => ({ ...f, tolerance: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="0" />
                    </div>
                  </div>
                )}

                {/* Threshold fields */}
                {ruleForm.ruleType === 'threshold' && (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Field</label>
                      <select value={ruleForm.fieldA} onChange={e => setRuleForm(f => ({ ...f, fieldA: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                        <option value="">Select field...</option>
                        {FIELD_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Operator</label>
                      <select value={ruleForm.operator} onChange={e => setRuleForm(f => ({ ...f, operator: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                        {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Value (NPR)</label>
                      <input type="number" value={ruleForm.thresholdValue} onChange={e => setRuleForm(f => ({ ...f, thresholdValue: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="0" />
                    </div>
                  </div>
                )}

                {/* Percentage of Base fields */}
                {ruleForm.ruleType === 'percentage_of_base' && (
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Field (Numerator)</label>
                      <select value={ruleForm.fieldA} onChange={e => setRuleForm(f => ({ ...f, fieldA: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                        <option value="">Select field...</option>
                        {FIELD_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Base Field (Denominator)</label>
                      <select value={ruleForm.baseField} onChange={e => setRuleForm(f => ({ ...f, baseField: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                        <option value="">Select field...</option>
                        {FIELD_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Operator</label>
                      <select value={ruleForm.operator} onChange={e => setRuleForm(f => ({ ...f, operator: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                        {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Required %</label>
                      <input type="number" value={ruleForm.thresholdValue} onChange={e => setRuleForm(f => ({ ...f, thresholdValue: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="15" />
                    </div>
                  </div>
                )}

                {/* Classification Match placeholder */}
                {ruleForm.ruleType === 'classification_match' && (
                  <div className="text-sm text-slate-500 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    Classification match requires loan-level data. This rule type will compare loan ageing buckets against assigned classification buckets when loan data is available.
                  </div>
                )}

                {/* Live preview */}
                <div className="text-xs text-slate-500 bg-white rounded-lg p-2 border border-slate-100 font-mono">
                  {ruleForm.ruleType === 'tie_out' && ruleForm.fieldA && ruleForm.fieldB && (
                    <span>CHECK: {ruleForm.fieldA} = {ruleForm.fieldB} (tolerance: NPR {ruleForm.tolerance || '0'})</span>
                  )}
                  {ruleForm.ruleType === 'threshold' && ruleForm.fieldA && (
                    <span>CHECK: {ruleForm.fieldA} {ruleForm.operator} {ruleForm.thresholdValue || '?'}</span>
                  )}
                  {ruleForm.ruleType === 'percentage_of_base' && ruleForm.fieldA && ruleForm.baseField && (
                    <span>CHECK: ({ruleForm.fieldA} / {ruleForm.baseField}) × 100 {ruleForm.operator} {ruleForm.thresholdValue || '?'}%</span>
                  )}
                  {!ruleForm.fieldA && <span className="text-slate-400">Select fields to see the rule expression...</span>}
                </div>
              </div>

              {/* Row 5: Severity + Source + Blocking */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Severity</label>
                  <select value={ruleForm.severity} onChange={e => setRuleForm(f => ({ ...f, severity: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="advisory">Advisory</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Source Statement</label>
                  <input value={ruleForm.sourceStatement} onChange={e => setRuleForm(f => ({ ...f, sourceStatement: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Balance Sheet" />
                </div>
                <div className="flex items-end gap-4 pb-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={ruleForm.layer === 1 ? true : ruleForm.isBlocking} onChange={e => { if (ruleForm.layer !== 1) setRuleForm(f => ({ ...f, isBlocking: e.target.checked })); }} disabled={ruleForm.layer === 1} className="rounded" />
                    Blocking {ruleForm.layer === 1 && <span className="text-xs text-slate-400">(auto for Layer 1)</span>}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={ruleForm.active} onChange={e => setRuleForm(f => ({ ...f, active: e.target.checked }))} className="rounded" />
                    Active
                  </label>
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setShowRuleModal(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={handleSaveRule} className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // OPINION & SIGNOFF TAB
  // ═══════════════════════════════════════════════════════════════════

  const renderOpinion = () => {
    if (!selectedRun) return <div className="text-center py-12 text-slate-400">Select a run from the Findings or History tab first.</div>;
    const opinionCfg = opinion ? OPINION_CONFIG[opinion.finalClassification || opinion.suggestedClassification] : null;

    return (
      <div className="space-y-6">
        {/* Opinion Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Scale className="w-5 h-5 text-emerald-600" /> Audit Opinion</h3>
            {opinion && (
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      const [coa, voucherRes] = await Promise.all([fetchCoa(), fetchVouchers({ status: 'posted', limit: 1000 })]);
                      const accounts = coa.accounts || [];
                      const vRaw = voucherRes?.vouchers || voucherRes?.data || voucherRes || [];
                      const vList = Array.isArray(vRaw) ? vRaw : [];
                      const fd = buildFinancialData(accounts, vList);
                      const findingsData = findings.map((f: any) => ({
                        title: f.title, description: f.description, severity: f.severity, status: f.status,
                        category: f.category, expectedValue: f.expectedValue || f.evidenceRef?.expectedValue || '-', actualValue: f.actualValue || f.evidenceRef?.actualValue || '-',
                        variance: f.variance || f.evidenceRef?.variance || '-', resolutionNote: f.resolutionNote || '',
                      }));
                      const signoffsData = signoffs.map(s => ({
                        stage: s.stage, decision: s.decision, userName: s.userName,
                        timestamp: s.timestamp, comments: s.comments,
                      }));
                      const rn = selectedRun?.id.slice(0, 8) || 'Report';
                      const ps = '', pe = '';
                      exportBalanceSheetPdf(`BS_${rn}`, '', '', ps, pe, fd.assetAccs, fd.totalAssets, fd.priorAssets, fd.liabAccs, fd.totalLiab, fd.priorLiab, fd.eqAccs, fd.totalEq, fd.priorEq, fd.netSurplus);
                      exportProfitLossPdf(`PL_${rn}`, '', '', ps, pe, fd.incAccs, fd.totalInc, fd.priorInc, fd.expAccs, fd.totalExp, fd.priorExp);
                      exportTrialBalancePdf(`TB_${rn}`, '', '', ps, pe, fd.tbAccs, fd.tbTotals);
                      exportCashFlowPdf(`CF_${rn}`, '', '', ps, pe, fd.receipts, fd.totalReceipts, fd.payments, fd.totalPayments, 0);
                      exportAuditOpinionPdf(`Opinion_${rn}`, '', '',
                        { runId: selectedRun?.id || '', runDate: (selectedRun as any)?.triggeredAt || (selectedRun as any)?.createdAt || '', ...opinion! },
                        findingsData, signoffsData);
                      addNotification('Exported', 'All 5 PDFs downloaded.', 'success');
                    } catch (e: any) {
                      console.error('Export error:', e);
                      addNotification('Export Failed', e.message, 'error');
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800 flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Export All Statements
                </button>
                <button
                  onClick={async () => {
                    try {
                      const [coa, voucherRes, rulesData] = await Promise.all([fetchCoa(), fetchVouchers({ status: 'posted', limit: 1000 }), fetchAuditRules()]);
                      const accounts = coa.accounts || [];
                      const vRaw = voucherRes?.vouchers || voucherRes?.data || voucherRes || [];
                      const vList = Array.isArray(vRaw) ? vRaw : [];
                      const fd = buildFinancialData(accounts, vList);
                      const findingsData = findings.map((f: any) => ({
                        title: f.title, description: f.description, severity: f.severity, status: f.status,
                        category: f.category, expectedValue: f.expectedValue || f.evidenceRef?.expectedValue || '-', actualValue: f.actualValue || f.evidenceRef?.actualValue || '-',
                        variance: f.variance || f.evidenceRef?.variance || '-', resolutionNote: f.resolutionNote || f.resolutionComments || '',
                      }));
                      const rulesForExport = rulesData.map(r => ({
                        name: r.name, ruleType: r.ruleType, category: r.category,
                        passed: !findings.some(f => f.ruleId === r.id),
                      }));
                      const rn = selectedRun?.id.slice(0, 8) || 'Package';
                      const ps = '', pe = '';
                      exportWorkpaperPackagePdf(`Workpapers_${rn}`, '', '',
                        selectedRun?.id || '', (selectedRun as any)?.createdAt || '',
                        findingsData, [], rulesForExport);
                      exportBalanceSheetPdf(`WP_BS_${rn}`, '', '', ps, pe, fd.assetAccs, fd.totalAssets, fd.priorAssets, fd.liabAccs, fd.totalLiab, fd.priorLiab, fd.eqAccs, fd.totalEq, fd.priorEq, fd.netSurplus);
                      exportProfitLossPdf(`WP_PL_${rn}`, '', '', ps, pe, fd.incAccs, fd.totalInc, fd.priorInc, fd.expAccs, fd.totalExp, fd.priorExp);
                      exportTrialBalancePdf(`WP_TB_${rn}`, '', '', ps, pe, fd.tbAccs, fd.tbTotals);
                      exportCashFlowPdf(`WP_CF_${rn}`, '', '', ps, pe, fd.receipts, fd.totalReceipts, fd.payments, fd.totalPayments, 0);
                      addNotification('Exported', 'Workpapers + all financial statements downloaded.', 'success');
                    } catch (e: any) {
                      console.error('Export error:', e);
                      addNotification('Export Failed', e.message, 'error');
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-sky-700 text-white text-xs font-medium hover:bg-sky-800 flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Export Workpapers
                </button>
              </div>
            )}
          </div>
          {opinion ? (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border-2 ${opinionCfg?.bg || 'bg-slate-100'}`}>
                <div className="text-sm text-slate-500 mb-1">Suggested Classification</div>
                <div className={`text-xl font-bold ${opinionCfg?.color || 'text-slate-800'}`}>
                  {opinionCfg?.label || opinion.suggestedClassification}
                </div>
              </div>
              <div className="text-sm text-slate-600">{opinion.basisSummary}</div>
              {opinion.finalClassification && opinion.finalClassification !== opinion.suggestedClassification && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="text-xs text-amber-600 font-medium">Auditor Override</div>
                  <div className="text-sm">{opinion.finalClassification} — {opinion.overrideReason}</div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No opinion draft available for this run.</p>
          )}
        </div>

        {/* Sign-off Chain */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Lock className="w-5 h-5 text-emerald-600" /> Sign-off Chain</h3>
            <div className="text-xs text-slate-500">{signoffs.filter(s => s.decision === 'approved').length}/5 Complete</div>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full mb-4 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all" style={{ width: `${(signoffs.filter(s => s.decision === 'approved').length / 5) * 100}%` }} />
          </div>
          <div className="space-y-3">
            {SIGNOFF_STAGES.map((stage, i) => {
              const stageSignoff = signoffs.find(s => s.stage === stage.key);
              const StageIcon = stage.icon;
              const isCompleted = stageSignoff?.decision === 'approved';
              const STAGE_ORDER: ('preparer' | 'internal_auditor' | 'external_auditor' | 'board' | 'doc_submission')[] = ['preparer', 'internal_auditor', 'external_auditor', 'board', 'doc_submission'];
              const completedStages = new Set(signoffs.filter(s => s.decision === 'approved').map(s => s.stage));
              const isNextAvailable = !isCompleted && STAGE_ORDER.indexOf(stage.key as any) === STAGE_ORDER.findIndex(s => !completedStages.has(s));
              return (
                <div key={stage.key} className={`flex items-center gap-3 p-3 rounded-xl ${isNextAvailable ? 'bg-emerald-50 border border-emerald-200' : ''}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCompleted ? 'bg-green-100 text-green-600' : stageSignoff?.decision === 'rejected' ? 'bg-red-100 text-red-600' : isNextAvailable ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    <StageIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-800">{stage.label}</div>
                    {stageSignoff ? (
                      <div className="text-xs text-slate-500">
                        {stageSignoff.userName} — {stageSignoff.decision} — {new Date(stageSignoff.timestamp).toLocaleDateString()}
                        {stage.key === 'external_auditor' && stageSignoff.externalAuditorName && (
                          <div className="text-sky-600 mt-0.5">{stageSignoff.externalAuditorName} {stageSignoff.externalAuditorFirm && `(${stageSignoff.externalAuditorFirm})`}</div>
                        )}
                        {stage.key === 'board' && stageSignoff.resolutionNumber && (
                          <div className="text-amber-600 mt-0.5">Resolution #{stageSignoff.resolutionNumber} — {stageSignoff.resolutionDate}</div>
                        )}
                        {stage.key === 'doc_submission' && stageSignoff.docReferenceNumber && (
                          <div className="text-emerald-600 mt-0.5">DoC Ref: {stageSignoff.docReferenceNumber} — {stageSignoff.docSubmissionDate}</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">
                        {isNextAvailable ? 'Ready to approve — click Approve' : 'Waiting for previous stage'}
                      </div>
                    )}
                  </div>
                  {isCompleted ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Approved</span>
                  ) : stageSignoff?.decision === 'rejected' ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Rejected</span>
                  ) : isNextAvailable ? (
                    <button
                      onClick={() => {
                        setSignoffForm(f => ({ ...f, stage: stage.key }));
                        setSignoffModal(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800"
                    >
                      Approve
                    </button>
                  ) : (
                    <span className="text-xs text-slate-300">Locked</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Final Audit Report — only when all 5 stages approved */}
        {signoffs.filter(s => s.decision === 'approved').length === 5 && (
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border-2 border-emerald-300 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-emerald-800 text-lg flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6" /> Audit Complete — All 5 Stages Approved
                </h3>
                <p className="text-sm text-emerald-600 mt-1">Download the final consolidated audit report with all financial statements.</p>
              </div>
              <button
                onClick={async () => {
                  try {
                    const [coa, voucherRes, rulesData] = await Promise.all([fetchCoa(), fetchVouchers({ status: 'posted', limit: 1000 }), fetchAuditRules()]);
                    const accounts = coa.accounts || [];
                    const vRaw = voucherRes?.data || voucherRes?.vouchers || voucherRes || [];
                    const vList = Array.isArray(vRaw) ? vRaw : [];
                    const fd = buildFinancialData(accounts, vList);
                    const findingsData = findings.map((f: any) => ({
                      title: f.title, description: f.description, severity: f.severity, status: f.status,
                      category: f.category, expectedValue: f.expectedValue || f.evidenceRef?.expectedValue || '-', actualValue: f.actualValue || f.evidenceRef?.actualValue || '-',
                      variance: f.variance || f.evidenceRef?.variance || '-', resolutionNote: f.resolutionNote || f.resolutionComments || '',
                    }));
                    const signoffsData = signoffs.map(s => ({
                      stage: s.stage, decision: s.decision, userName: s.userName,
                      timestamp: s.timestamp, comments: s.comments,
                    }));
                    const rulesForExport = rulesData.map(r => ({
                      name: r.name, ruleType: r.ruleType, category: r.category,
                      passed: !findings.some(f => f.ruleId === r.id),
                    }));
                    const rn = selectedRun?.id.slice(0, 8) || 'Final';
                    const opinionData = opinion ? {
                      runId: selectedRun?.id || '', runDate: (selectedRun as any)?.createdAt || '',
                      suggestedClassification: opinion.suggestedClassification || 'disclaimer',
                      finalClassification: opinion.finalClassification,
                      overrideReason: opinion.overrideReason,
                      basisSummary: opinion.basisSummary || '',
                    } : {
                      runId: selectedRun?.id || '', runDate: (selectedRun as any)?.createdAt || '',
                      suggestedClassification: 'disclaimer', basisSummary: 'No opinion draft available.',
                    };
                    exportConsolidatedAuditReportPdf(
                      `Audit_Report_${rn}`, '', '',
                      opinionData, findingsData, signoffsData, rulesForExport,
                      { assetAccs: fd.assetAccs, totalAssets: fd.totalAssets, priorAssets: fd.priorAssets, liabAccs: fd.liabAccs, totalLiab: fd.totalLiab, priorLiab: fd.priorLiab, eqAccs: fd.eqAccs, totalEq: fd.totalEq, priorEq: fd.priorEq, netSurplus: fd.netSurplus },
                      { incAccs: fd.incAccs, totalInc: fd.totalInc, priorInc: fd.priorInc, expAccs: fd.expAccs, totalExp: fd.totalExp, priorExp: fd.priorExp },
                      { tbAccs: fd.tbAccs, tbTotals: fd.tbTotals },
                    );
                    addNotification('Final Report Exported', 'Consolidated audit report downloaded.', 'success');
                  } catch (e: any) {
                    console.error('Final export error:', e);
                    addNotification('Export Failed', e.message, 'error');
                  }
                }}
                className="px-6 py-3 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-800 flex items-center gap-2 shadow-lg"
              >
                <Download className="w-5 h-5" /> Download Final Audit Report
              </button>
            </div>
          </div>
        )}

        {/* Signoff Modal */}
        {signoffModal && selectedRun && (() => {
          const STAGE_ORDER = ['preparer', 'internal_auditor', 'external_auditor', 'board', 'doc_submission'];
          const completedStages = new Set(signoffs.filter(s => s.decision === 'approved').map(s => s.stage));
          const nextStageIdx = STAGE_ORDER.findIndex(s => !completedStages.has(s as any));
          const nextStage = nextStageIdx >= 0 ? STAGE_ORDER[nextStageIdx] : null;
          const availableStages = STAGE_ORDER.filter((s, i) => i >= nextStageIdx && !completedStages.has(s as any));

          return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">
                    {signoffForm.stage ? `Approve: ${SIGNOFF_STAGES.find(s => s.key === signoffForm.stage)?.label || signoffForm.stage}` : 'Record Sign-off'}
                  </h3>
                  <button onClick={() => setSignoffModal(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-5 h-5" /></button>
                </div>
                <div className="p-5 space-y-4">
                  {/* Stage selector — only show next available stage */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Stage</label>
                    {availableStages.length === 0 ? (
                      <div className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg p-3">All stages completed.</div>
                    ) : (
                      <select value={signoffForm.stage} onChange={e => setSignoffForm(f => ({ ...f, stage: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                        {availableStages.map(s => {
                          const stage = SIGNOFF_STAGES.find(st => st.key === s);
                          return <option key={s} value={s}>{stage?.label || s}</option>;
                        })}
                      </select>
                    )}
                    {completedStages.size > 0 && (
                      <div className="text-xs text-slate-400 mt-1">Completed: {Array.from(completedStages).join(', ')}</div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Decision</label>
                    <select value={signoffForm.decision} onChange={e => setSignoffForm(f => ({ ...f, decision: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm">
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="needs_revision">Needs Revision</option>
                    </select>
                  </div>

                  {/* ── External Auditor Fields ──────────────────────── */}
                  {signoffForm.stage === 'external_auditor' && (
                    <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 space-y-3">
                      <div className="text-xs font-bold text-sky-700 uppercase tracking-wide">External Auditor Details</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Auditor Name</label>
                          <input value={signoffForm.externalAuditorName} onChange={e => setSignoffForm(f => ({ ...f, externalAuditorName: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="e.g. Ram Sharma" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Firm Name</label>
                          <input value={signoffForm.externalAuditorFirm} onChange={e => setSignoffForm(f => ({ ...f, externalAuditorFirm: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="e.g. Sharma & Associates" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Signed Opinion PDF (upload or paste URL)</label>
                        <input value={signoffForm.opinionPdfUrl} onChange={e => setSignoffForm(f => ({ ...f, opinionPdfUrl: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="https://... or file path" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">File Name</label>
                        <input value={signoffForm.opinionPdfName} onChange={e => setSignoffForm(f => ({ ...f, opinionPdfName: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Signed_Opinion_2083.pdf" />
                      </div>
                    </div>
                  )}

                  {/* ── Board Fields ────────────────────────────────── */}
                  {signoffForm.stage === 'board' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                      <div className="text-xs font-bold text-amber-700 uppercase tracking-wide">Board Approval — Reference AGM Resolution</div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Resolution Number</label>
                        <input value={signoffForm.resolutionNumber} onChange={e => setSignoffForm(f => ({ ...f, resolutionNumber: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="e.g. RES-2083-012" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Resolution Date (BS)</label>
                          <input value={signoffForm.resolutionDate} onChange={e => setSignoffForm(f => ({ ...f, resolutionDate: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="2083-12-15" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Resolution Title</label>
                          <input value={signoffForm.resolutionTitle} onChange={e => setSignoffForm(f => ({ ...f, resolutionTitle: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="Audit Report Approval" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── DoC Submission Fields ──────────────────────── */}
                  {signoffForm.stage === 'doc_submission' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                      <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide">DoC Portal Submission</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Submission Date (BS)</label>
                          <input value={signoffForm.docSubmissionDate} onChange={e => setSignoffForm(f => ({ ...f, docSubmissionDate: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="2084-01-15" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Reference Number</label>
                          <input value={signoffForm.docReferenceNumber} onChange={e => setSignoffForm(f => ({ ...f, docReferenceNumber: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="DoC-2084-XXXX" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">DoC Portal URL (optional)</label>
                        <input value={signoffForm.docPortalUrl} onChange={e => setSignoffForm(f => ({ ...f, docPortalUrl: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" placeholder="https://..." />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Comments</label>
                    <textarea value={signoffForm.comments} onChange={e => setSignoffForm(f => ({ ...f, comments: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" rows={3} />
                  </div>
                </div>
                <div className="p-5 border-t border-slate-200 flex justify-end gap-2">
                  <button onClick={() => setSignoffModal(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button onClick={handleSignoff} disabled={availableStages.length === 0} className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 disabled:opacity-50">Save</button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════
  // HISTORY TAB
  // ═══════════════════════════════════════════════════════════════════

  const renderHistory = () => (
    <div className="space-y-3">
      {runs.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No audit runs yet.</p>
        </div>
      ) : (
        runs.map(run => (
          <div
            key={run.id}
            onClick={() => { setSelectedRun(run); setTab('opinion'); }}
            className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md cursor-pointer transition"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {run.status === 'completed' ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : run.status === 'failed' ? <XCircle className="w-6 h-6 text-red-500" /> : <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />}
                <div>
                  <div className="font-semibold text-slate-800">{run.fiscalYearLabel || 'All Data'}</div>
                  <div className="text-xs text-slate-400">Run #{run.id.slice(0, 8)} — {new Date(run.createdAt).toLocaleString()}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex gap-3 text-sm">
                  <span className="text-green-600">{run.rulesPassed} passed</span>
                  <span className="text-red-600">{run.rulesFailed} failed</span>
                  <span className="text-slate-400">{run.rulesSkipped} skipped</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">Triggered by: {run.triggeredBy}</div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { key: 'run', label: 'Run Audit', icon: Play },
    { key: 'findings', label: 'Findings', icon: AlertTriangle },
    { key: 'rules', label: 'Rules', icon: Settings },
    { key: 'opinion', label: 'Opinion & Sign-off', icon: Scale },
    { key: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Audit Engine</h1>
            <p className="text-sm text-slate-500">लेखापरीक्षण इन्जिन — Data Integrity, Statutory Compliance & Analytical Review</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-1">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                tab === t.key
                  ? 'bg-emerald-700 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        </div>
      ) : (
        <div>
          {tab === 'dashboard' && renderDashboard()}
          {tab === 'run' && renderRun()}
          {tab === 'findings' && renderFindings()}
          {tab === 'rules' && renderRules()}
          {tab === 'opinion' && renderOpinion()}
          {tab === 'history' && renderHistory()}
        </div>
      )}
    </div>
  );
};
