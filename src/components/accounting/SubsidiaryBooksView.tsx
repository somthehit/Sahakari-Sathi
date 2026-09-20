import React, { useEffect, useState } from 'react';
import { BookOpen, Layers, RefreshCw, Download, TrendingUp, Wallet, Coins, Landmark, X, Eye, ScrollText } from 'lucide-react';
import { formatNPR } from '../../utils/nepaliCalendar';
import { exportToPdf, exportToExcel } from '../../utils/exportUtils';
import { fetchSubsidiaryBooks } from '../../api/subsidiary';
import type {
  SubsidiaryBooksPayload,
  SubsidiaryShare,
  SubsidiarySaving,
  SubsidiaryLoan,
  SubsidiaryShareAccount,
  SubsidiarySavingAccount,
  SubsidiaryLoanAccount,
} from '../../types/coop';

type BookTab = 'shares' | 'savings' | 'loans';

interface DrawerSelection {
  tab: BookTab;
  memberId: string;
  memberName: string;
  accountLabel: string;
}

const EMPTY: SubsidiaryBooksPayload = {
  shares: [],
  savings: [],
  loans: [],
  summary: [],
  shareAccounts: [],
  savingsAccounts: [],
  loanAccounts: [],
};

const statusChip = (status: string, activeClass: string) => {
  const active = status === 'Active' || status === 'Disbursed';
  return (
    <span className={`inline-flex items-center gap-1 font-semibold text-[10px] px-2 py-0.5 rounded-full border ${
      active
        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
        : 'bg-slate-100 text-slate-500 border-slate-200'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {status}
    </span>
  );
};

export const SubsidiaryBooksView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<BookTab>('shares');
  const [data, setData] = useState<SubsidiaryBooksPayload>(EMPTY);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [drawer, setDrawer] = useState<DrawerSelection | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchSubsidiaryBooks();
      setData(payload);
    } catch (e: any) {
      setError(e?.message || 'Failed to load subsidiary books.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const { shares, savings, loans, shareAccounts, savingsAccounts, loanAccounts } = data;

  const q = searchQuery.trim().toLowerCase();
  const inQ = (...vals: (string | number | undefined)[]) => !q || vals.some((v) => String(v ?? '').toLowerCase().includes(q));

  const filteredShareAccounts = shareAccounts.filter((r) => inQ(r.memberNo, r.memberName, r.accountNo));
  const filteredSavingAccounts = savingsAccounts.filter((r) => inQ(r.memberNo, r.memberName, r.accountNo, r.accountType, r.productName));
  const filteredLoanAccounts = loanAccounts.filter((r) => inQ(r.memberNo, r.memberName, r.loanAccountNo, r.productName));

  const shareTotal = shareAccounts.reduce((s, r) => s + r.totalValue, 0);
  const savingTotal = savingsAccounts.reduce((s, r) => s + r.balance, 0);
  const loanOutstanding = loanAccounts.reduce((s, r) => s + r.principalOutstanding, 0);

  const visibleCount = activeTab === 'shares' ? filteredShareAccounts.length : activeTab === 'savings' ? filteredSavingAccounts.length : filteredLoanAccounts.length;

  const tabMeta: Record<BookTab, { label: string; nepali: string; icon: any; count: number; accent: string }> = {
    shares: { label: 'Shares', nepali: 'सेयर सहायक खाता', icon: Coins, count: shareAccounts.length, accent: 'emerald' },
    savings: { label: 'Savings', nepali: 'बचत सहायक खाता', icon: Wallet, count: savingsAccounts.length, accent: 'green' },
    loans: { label: 'Loans', nepali: 'ऋण सहायक खाता', icon: Landmark, count: loanAccounts.length, accent: 'amber' },
  };

  const handleExportPdf = () => {
    const headers =
      activeTab === 'shares'
        ? ['Member ID', 'Member Name', 'Account No', 'Total Shares', 'Total Value (NPR)', 'Status']
        : activeTab === 'savings'
        ? ['Member ID', 'Member Name', 'Account No', 'Account Type', 'Current Balance (NPR)', 'Interest Earned (NPR)', 'Status']
        : ['Loan Account No', 'Member ID', 'Member Name', 'Principal Outstanding (NPR)', 'Interest Due (NPR)', 'Maturity (BS)', 'Status'];

    const rows = (activeTab === 'shares' ? filteredShareAccounts : activeTab === 'savings' ? filteredSavingAccounts : filteredLoanAccounts).map((r: any) =>
      activeTab === 'shares'
        ? [r.memberNo, r.memberName, r.accountNo, r.totalShares, formatNPR(r.totalValue), r.status]
        : activeTab === 'savings'
        ? [r.memberNo, r.memberName, r.accountNo, r.accountType, formatNPR(r.balance), formatNPR(r.interestEarned), r.status]
        : [r.loanAccountNo, r.memberNo, r.memberName, formatNPR(r.principalOutstanding), formatNPR(r.interestDue), r.maturityDateBs, r.status]
    );

    exportToPdf(
      `Subsidiary_${activeTab.toUpperCase()}_Accounts`,
      `सहायक खाता (${tabMeta[activeTab].nepali}) — Account Summary`,
      `Total Accounts: ${rows.length} | SahakariSathi Financial System`,
      headers,
      rows
    );
  };

  const handleExportExcel = () => {
    const headers =
      activeTab === 'shares'
        ? ['Member ID', 'Member Name', 'Account No', 'Total Shares', 'Total Value (NPR)', 'Status']
        : activeTab === 'savings'
        ? ['Member ID', 'Member Name', 'Account No', 'Account Type', 'Current Balance (NPR)', 'Interest Earned (NPR)', 'Status']
        : ['Loan Account No', 'Member ID', 'Member Name', 'Principal Outstanding (NPR)', 'Interest Due (NPR)', 'Maturity (BS)', 'Status'];

    const rows = (activeTab === 'shares' ? filteredShareAccounts : activeTab === 'savings' ? filteredSavingAccounts : filteredLoanAccounts).map((r: any) =>
      activeTab === 'shares'
        ? [r.memberNo, r.memberName, r.accountNo, r.totalShares, formatNPR(r.totalValue), r.status]
        : activeTab === 'savings'
        ? [r.memberNo, r.memberName, r.accountNo, r.accountType, formatNPR(r.balance), formatNPR(r.interestEarned), r.status]
        : [r.loanAccountNo, r.memberNo, r.memberName, formatNPR(r.principalOutstanding), formatNPR(r.interestDue), r.maturityDateBs, r.status]
    );

    exportToExcel(`Subsidiary_${activeTab.toUpperCase()}_Accounts`, `Subsidiary_${activeTab}`, headers, rows);
  };

  const openStatement = (tab: BookTab, memberId: string, memberName: string, accountLabel: string) =>
    setDrawer({ tab, memberId, memberName, accountLabel });

  // Drill-down transaction list (chronological, oldest → newest).
  const drawerTx: (SubsidiaryShare | SubsidiarySaving | SubsidiaryLoan)[] = drawer
    ? (drawer.tab === 'shares'
        ? shares.filter((r) => r.memberId === drawer.memberId)
        : drawer.tab === 'savings'
        ? savings.filter((r) => r.memberId === drawer.memberId && r.accountNo === drawer.accountLabel)
        : loans.filter((r) => r.memberId === drawer.memberId && r.loanAccountNo === drawer.accountLabel)
      ).slice().reverse()
    : [];

  const renderEmpty = (book: string) => (
    <div className="text-center py-10 text-slate-500">
      <Layers className="w-8 h-8 mx-auto mb-2 text-slate-600" />
      <p className="font-semibold text-xs">यस खातामा हाल कुनै खाता दर्ता भएको छैन</p>
      <p className="text-[11px] mt-1">No {book} accounts exist yet. Accounts opened from member modules will appear here.</p>
    </div>
  );

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-xl text-emerald-800">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span>तीन सहायक खाता (Three Subsidiary Books)</span>
              <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                सदस्य-गत खाता सारांश
              </span>
            </h2>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Member-wise account summaries — Shares, Savings & Loans. Click नेट [View Statement] for the full chronological ledger.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-800 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Architecture concept */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-950 flex items-start gap-3">
        <Layers className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-emerald-900">सहायक खाता वास्तुकला (Subsidiary Ledger Rule):</p>
          <p className="leading-relaxed text-slate-700 text-[11px]">
            यी <strong>सहायक खाताहरू</strong> ले प्रत्येक सदस्यको खाता-स्तरीय सारांश देखाउँछन् — सेयर मौज्दात, बचत जम्मा र बाँकी
            ऋण। प्रत्येक रोको <strong>[View Statement]</strong> बटनले सो खाताको पूर्ण कालक्रमिक (chronological) लेनदेन इतिहास
            drawer मा खोल्छ। सबै रोहरू shared <strong>भौचर नं.</strong> मार्फत General Ledger सँग लिंक हुन्छन्।
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs font-medium">
          {error} — कृपया पुनः प्रयास गर्नुहोस्।
        </div>
      )}

      {/* Book Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(tabMeta) as BookTab[]).map((key) => {
            const meta = tabMeta[key];
            const Icon = meta.icon;
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${ active ? 'bg-emerald-800 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200' }`}
              >
                <Icon className="w-4 h-4" />
                <span>{meta.nepali}</span>
                <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] ${active ? 'bg-white/20 text-slate-800' : 'bg-slate-200 text-slate-600'}`}>
                  {meta.count}
                </span>
              </button>
            );
          })}
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search member, account no, type…"
          className="w-52 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
        />
      </div>

      {/* Totals bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
          <Coins className="w-4 h-4 text-emerald-700" />
          <div>
            <div className="text-[10px] font-bold text-emerald-900 uppercase tracking-wide">कुल सेयर रकम</div>
            <div className="font-mono font-extrabold text-emerald-800 text-sm">{formatNPR(shareTotal)}</div>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-green-700" />
          <div>
            <div className="text-[10px] font-bold text-green-900 uppercase tracking-wide">कुल बचत रकम</div>
            <div className="font-mono font-extrabold text-green-800 text-sm">{formatNPR(savingTotal)}</div>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
          <Landmark className="w-4 h-4 text-amber-700" />
          <div>
            <div className="text-[10px] font-bold text-amber-900 uppercase tracking-wide">कुल बाँकी ऋण साँवा</div>
            <div className="font-mono font-extrabold text-amber-800 text-sm">{formatNPR(loanOutstanding)}</div>
          </div>
        </div>
      </div>

      {/* Account summary tables */}
      <div className="border border-slate-200 rounded-xl overflow-auto max-h-[480px] bg-white shadow-xs">
        {loading ? (
          <div className="text-center py-12 text-slate-500 flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
            <p className="text-xs font-semibold">Loading subsidiary books…</p>
          </div>
        ) : activeTab === 'shares' ? (
          filteredShareAccounts.length === 0 ? renderEmpty('share') : (
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="bg-emerald-900 text-emerald-50 border-b border-emerald-800 font-semibold text-[11px] uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="p-3">Member ID</th>
                  <th className="p-3">Member Name</th>
                  <th className="p-3">Account No.</th>
                  <th className="p-3 text-right">Total Shares (Qty)</th>
                  <th className="p-3 text-right">Total Value (NPR)</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {filteredShareAccounts.map((r: SubsidiaryShareAccount) => (
                  <tr key={r.memberId} className="hover:bg-emerald-50/40">
                    <td className="p-3 font-mono font-semibold text-emerald-700">{r.memberNo}</td>
                    <td className="p-3 font-semibold">{r.memberName}</td>
                    <td className="p-3 font-mono font-bold text-slate-900">{r.accountNo}</td>
                    <td className="p-3 text-right font-mono font-bold">{r.totalShares}</td>
                    <td className="p-3 text-right font-mono">{formatNPR(r.totalValue)}</td>
                    <td className="p-3">{statusChip(r.status, 'act')}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => openStatement('shares', r.memberId, r.memberName, r.accountNo)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition cursor-pointer"
                      >
                        <Eye className="w-3 h-3" /> View Statement
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : activeTab === 'savings' ? (
          filteredSavingAccounts.length === 0 ? renderEmpty('savings') : (
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead className="bg-emerald-900 text-emerald-50 border-b border-emerald-800 font-semibold text-[11px] uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="p-3">Member ID</th>
                  <th className="p-3">Member Name</th>
                  <th className="p-3">Account No.</th>
                  <th className="p-3">Account Type</th>
                  <th className="p-3 text-right">Current Balance (NPR)</th>
                  <th className="p-3 text-right">Interest Earned (NPR)</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {filteredSavingAccounts.map((r: SubsidiarySavingAccount) => (
                  <tr key={r.accountNo} className="hover:bg-green-50/40">
                    <td className="p-3 font-mono font-semibold text-emerald-700">{r.memberNo}</td>
                    <td className="p-3 font-semibold">{r.memberName}</td>
                    <td className="p-3 font-mono font-bold text-slate-900">{r.accountNo}</td>
                    <td className="p-3">
                      <span className="bg-green-50 text-green-800 border border-green-200 font-semibold text-[10px] px-2 py-0.5 rounded">
                        {r.accountType}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-green-800">{formatNPR(r.balance)}</td>
                    <td className="p-3 text-right font-mono text-slate-700">{formatNPR(r.interestEarned)}</td>
                    <td className="p-3">{statusChip(r.status, 'act')}</td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => openStatement('savings', r.memberId, r.memberName, r.accountNo)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition cursor-pointer"
                      >
                        <Eye className="w-3 h-3" /> View Statement
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : filteredLoanAccounts.length === 0 ? renderEmpty('loan') : (
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-emerald-900 text-emerald-50 border-b border-emerald-800 font-semibold text-[11px] uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="p-3">Loan Account No.</th>
                <th className="p-3">Member ID</th>
                <th className="p-3">Member Name</th>
                <th className="p-3 text-right">Principal Outstanding (NPR)</th>
                <th className="p-3 text-right">Interest Due (NPR)</th>
                <th className="p-3 text-right">Maturity (BS)</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {filteredLoanAccounts.map((r: SubsidiaryLoanAccount) => (
                <tr key={r.loanAccountNo} className="hover:bg-amber-50/40">
                  <td className="p-3 font-mono font-bold text-slate-900">{r.loanAccountNo}</td>
                  <td className="p-3 font-mono font-semibold text-emerald-700">{r.memberNo}</td>
                  <td className="p-3 font-semibold">{r.memberName}</td>
                  <td className="p-3 text-right font-mono font-bold text-amber-800">{formatNPR(r.principalOutstanding)}</td>
                  <td className="p-3 text-right font-mono text-rose-700">{formatNPR(r.interestDue)}</td>
                  <td className="p-3 text-right font-mono text-slate-700">{r.maturityDateBs || '—'}</td>
                  <td className="p-3">{statusChip(r.status, 'act')}</td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => openStatement('loans', r.memberId, r.memberName, r.loanAccountNo)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition cursor-pointer"
                    >
                      <Eye className="w-3 h-3" /> View Statement
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer note */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500">
        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
        <span>
          यी तीन सहायक खाताले सदस्य-गत खाता सारांश देखाउँछन्। {visibleCount} account rows visible — click [View Statement] for the running-balance ledger.
        </span>
      </div>

      {/* ── Drill-down statement drawer (chronological transaction history) ── */}
      {drawer && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/30 backdrop-blur-sm flex justify-end" onClick={() => setDrawer(null)}>
          <div
            className="w-full max-w-4xl h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
                  <ScrollText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">
                    {tabMeta[drawer.tab].nepali} — विवरण (Ledger Statement)
                  </h2>
                  <p className="text-xs text-slate-500">
                    {drawer.memberName} · <span className="font-mono">{drawer.accountLabel}</span> — chronological transaction history
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDrawer(null)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer body — transaction rows for this member/account */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {drawerTx.length === 0 ? (
                <div className="text-center py-14 text-slate-500">
                  <Layers className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  <p className="font-semibold text-xs">कुनै लेनदेन भेटिएन</p>
                  <p className="text-[11px] mt-1">No transactions recorded for this {drawer.tab === 'shares' ? 'share' : drawer.tab === 'savings' ? 'savings' : 'loan'} account yet.</p>
                </div>
              ) : drawer.tab === 'shares' ? (
                <table className="w-full text-left border-collapse min-w-[860px]">
                  <thead className="bg-emerald-900 text-emerald-50 border-b border-emerald-800 font-semibold text-[11px] uppercase tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="p-3">Date (BS)</th>
                      <th className="p-3">Voucher No</th>
                      <th className="p-3">Type</th>
                      <th className="p-3 text-right">Qty</th>
                      <th className="p-3 text-right">Debit (NPR)</th>
                      <th className="p-3 text-right">Credit (NPR)</th>
                      <th className="p-3 text-right">Balance (NPR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {drawerTx.map((r) => {
                      const t = r as SubsidiaryShare;
                      return (
                        <tr key={t.id} className="hover:bg-emerald-50/40">
                          <td className="p-3 font-mono text-slate-500">{t.transactionDateBs}</td>
                          <td className="p-3 font-mono font-bold text-emerald-700">{t.voucherNo}</td>
                          <td className="p-3">
                            <span className="bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-[10px] px-2 py-0.5 rounded">
                              {t.transactionType}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono">{t.shareQuantity}</td>
                          <td className="p-3 text-right font-mono text-rose-700">{t.debitAmount ? formatNPR(t.debitAmount) : '—'}</td>
                          <td className="p-3 text-right font-mono text-emerald-700">{t.creditAmount ? formatNPR(t.creditAmount) : '—'}</td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">{formatNPR(t.balanceAmount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : drawer.tab === 'savings' ? (
                <table className="w-full text-left border-collapse min-w-[860px]">
                  <thead className="bg-emerald-900 text-emerald-50 border-b border-emerald-800 font-semibold text-[11px] uppercase tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="p-3">Date (BS)</th>
                      <th className="p-3">Voucher No</th>
                      <th className="p-3">Type</th>
                      <th className="p-3 text-right">Debit (NPR)</th>
                      <th className="p-3 text-right">Credit (NPR)</th>
                      <th className="p-3 text-right">Balance (NPR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {drawerTx.map((r) => {
                      const t = r as SubsidiarySaving;
                      return (
                        <tr key={t.id} className="hover:bg-green-50/40">
                          <td className="p-3 font-mono text-slate-500">{t.transactionDateBs}</td>
                          <td className="p-3 font-mono font-bold text-emerald-700">{t.voucherNo}</td>
                          <td className="p-3">
                            <span className="bg-green-50 text-green-800 border border-green-200 font-semibold text-[10px] px-2 py-0.5 rounded">
                              {t.accountType}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono text-rose-700">{t.debitAmount ? formatNPR(t.debitAmount) : '—'}</td>
                          <td className="p-3 text-right font-mono text-emerald-700">{t.creditAmount ? formatNPR(t.creditAmount) : '—'}</td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">{formatNPR(t.balanceAmount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead className="bg-emerald-900 text-emerald-50 border-b border-emerald-800 font-semibold text-[11px] uppercase tracking-wider sticky top-0 z-10">
                    <tr>
                      <th className="p-3">Date (BS)</th>
                      <th className="p-3">Voucher No</th>
                      <th className="p-3 text-right">Principal Dr</th>
                      <th className="p-3 text-right">Principal Cr</th>
                      <th className="p-3 text-right">Interest</th>
                      <th className="p-3 text-right">Penalty</th>
                      <th className="p-3 text-right">Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {drawerTx.map((r) => {
                      const t = r as SubsidiaryLoan;
                      return (
                        <tr key={t.id} className="hover:bg-amber-50/40">
                          <td className="p-3 font-mono text-slate-500">{t.transactionDateBs}</td>
                          <td className="p-3 font-mono font-bold text-emerald-700">{t.voucherNo}</td>
                          <td className="p-3 text-right font-mono text-rose-700">{t.principalDebit ? formatNPR(t.principalDebit) : '—'}</td>
                          <td className="p-3 text-right font-mono text-emerald-700">{t.principalCredit ? formatNPR(t.principalCredit) : '—'}</td>
                          <td className="p-3 text-right font-mono text-slate-700">{t.interestCredit ? formatNPR(t.interestCredit) : '—'}</td>
                          <td className="p-3 text-right font-mono text-slate-700">{t.penaltyCredit ? formatNPR(t.penaltyCredit) : '—'}</td>
                          <td className="p-3 text-right font-mono font-bold text-amber-800">{formatNPR(t.remainingPrincipal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Drawer footer */}
            <div className="p-3 border-t border-slate-200 bg-slate-50 text-[10px] text-slate-500 flex items-center gap-2 shrink-0">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {drawerTx.length} transactions · Balance column is the running balance linked to GL via भौचर नं. (Voucher No).
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};