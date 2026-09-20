import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, BookOpen, FileText, Filter, Search, Ban, Eye,
  Clock, Landmark, Hash, CalendarRange, Loader2, RefreshCw,
  CircleCheck, XOctagon, AlertTriangle,
} from 'lucide-react';
import { useCoop } from '../../context/CoopContext';
import {
  fetchBankAccountDetail,
  clearBankChequeLeaf,
  bounceBankChequeLeaf,
  type BankAccountDetail,
  type BankAccountDetailBook,
  type BankAccountDetailLeaf,
} from '../../api/accountingSettings';
import { formatNPR } from '../../utils/nepaliCalendar';
import { apiClient } from '../../lib/apiClient';

type LeafFilter = 'all' | 'unused' | 'issued' | 'cancelled' | 'cleared';

interface Props {
  bookId: string;
  bankAccountId: string;
  onBack: () => void;
}

export function BankChequeBookDetailView({ bookId, bankAccountId, onBack }: Props) {
  const { addNotification } = useCoop();
  const [detail, setDetail] = useState<BankAccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [leafFilter, setLeafFilter] = useState<LeafFilter>('all');
  const [leafSearch, setLeafSearch] = useState('');

  // Void/cancel modal
  const [voidLeaf, setVoidLeaf] = useState<BankAccountDetailLeaf | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // Bounce modal
  const [bounceLeaf, setBounceLeaf] = useState<BankAccountDetailLeaf | null>(null);
  const [bounceReason, setBounceReason] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchBankAccountDetail(bankAccountId);
      setDetail(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load cheque book details.');
    } finally {
      setLoading(false);
    }
  }, [bankAccountId]);

  useEffect(() => { load(); }, [load]);

  const book = detail?.chequeBooks.find((b) => b.id === bookId);
  const allLeaves = detail?.chequeLeaves ?? [];
  const bookLeaves = allLeaves.filter((l) => l.chequeBookId === bookId);

  const statusCounts = bookLeaves.reduce(
    (acc, l) => {
      if (l.status === 'unused') acc.unused++;
      else if (l.status === 'issued') acc.issued++;
      else if (l.status === 'cleared') acc.cleared++;
      else if (l.status === 'cancelled') acc.cancelled++;
      return acc;
    },
    { unused: 0, issued: 0, cancelled: 0, cleared: 0 }
  );

  const filteredLeaves = bookLeaves.filter((l) => {
    if (leafFilter !== 'all' && l.status !== leafFilter) return false;
    if (leafSearch.trim()) {
      const q = leafSearch.toLowerCase();
      return (
        l.chequeNumber.toLowerCase().includes(q) ||
        (l.payeeName ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleVoidLeaf = async () => {
    if (!voidLeaf || !voidReason.trim()) {
      addNotification('Validation Error', 'Reason is required to void a cheque.', 'alert');
      return;
    }
    try {
      await apiClient.post('/bank-cheques/void', { leafId: voidLeaf.id, reason: voidReason.trim() });
      addNotification('Cheque Voided', `Cheque ${voidLeaf.chequeNumber} has been voided.`, 'success');
      setVoidLeaf(null);
      setVoidReason('');
      await load();
    } catch (e: any) {
      addNotification('Void Failed', e.response?.data?.error || e.message || 'Failed to void cheque.', 'alert');
    }
  };

  const handleClearLeaf = async (leaf: BankAccountDetailLeaf) => {
    try {
      await clearBankChequeLeaf(leaf.id);
      addNotification('Cheque Cleared', `Cheque ${leaf.chequeNumber} marked as cleared.`, 'success');
      await load();
    } catch (e: any) {
      addNotification('Clear Failed', e.response?.data?.error || e.message || 'Failed to clear cheque.', 'alert');
    }
  };

  const handleBounceLeaf = async () => {
    if (!bounceLeaf || !bounceReason.trim()) {
      addNotification('Validation Error', 'Reason is required to bounce a cheque.', 'alert');
      return;
    }
    try {
      await bounceBankChequeLeaf(bounceLeaf.id, bounceReason.trim());
      addNotification('Cheque Bounced', `Cheque ${bounceLeaf.chequeNumber} marked as bounced.`, 'success');
      setBounceLeaf(null);
      setBounceReason('');
      await load();
    } catch (e: any) {
      addNotification('Bounce Failed', e.response?.data?.error || e.message || 'Failed to bounce cheque.', 'alert');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertTriangle className="w-10 h-10 text-amber-500" />
        <p className="text-sm text-slate-600 font-semibold">{error}</p>
        <button onClick={load} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition cursor-pointer">
          Retry
        </button>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <BookOpen className="w-10 h-10 text-slate-300" />
        <p className="text-sm text-slate-500 font-semibold">Cheque book not found.</p>
        <button onClick={onBack} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer" title="Back to bank account">
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </button>
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">{book.bookNumber}</h2>
            <p className="text-[11px] text-slate-500">
              {book.leafStartNumber} – {book.leafEndNumber} · {book.leafCount} leaves · {book.issuedDateBs}
            </p>
          </div>
        </div>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${book.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : book.status === 'exhausted' ? 'bg-slate-100 text-slate-500 border border-slate-200' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
          {book.status.toUpperCase()}
        </span>
        {book.prefix && <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">Prefix: {book.prefix}</span>}
        <button onClick={load} className="ml-auto p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer" title="Refresh">
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Book Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Hash className="w-4 h-4 text-blue-600" />
            <span className="text-[11px] font-bold text-slate-500">Total Leaves</span>
          </div>
          <p className="text-2xl font-mono font-bold text-slate-900">{book.leafCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <CircleCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-[11px] font-bold text-slate-500">Available</span>
          </div>
          <p className="text-2xl font-mono font-bold text-emerald-600">{statusCounts.unused}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <span className="text-[11px] font-bold text-slate-500">Issued</span>
          </div>
          <p className="text-2xl font-mono font-bold text-amber-600">{statusCounts.issued}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Ban className="w-4 h-4 text-rose-500" />
            <span className="text-[11px] font-bold text-slate-500">Cancelled</span>
          </div>
          <p className="text-2xl font-mono font-bold text-rose-500">{statusCounts.cancelled}</p>
        </div>
      </div>

      {/* Book Purpose */}
      {book.purpose && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span className="text-[11px] font-bold text-slate-500">Purpose</span>
          <p className="text-sm text-slate-700 mt-1">{book.purpose}</p>
        </div>
      )}

      {/* Leaf Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <div className="flex gap-1 flex-wrap">
            {(['all', 'unused', 'issued', 'cleared', 'cancelled'] as LeafFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setLeafFilter(f)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${leafFilter === f ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'}`}
              >
                {f === 'all' ? 'All' : f === 'unused' ? `Available (${statusCounts.unused})` : f === 'issued' ? `Issued (${statusCounts.issued})` : f === 'cleared' ? `Cleared (${statusCounts.cleared})` : `Cancelled (${statusCounts.cancelled})`}
              </button>
            ))}
          </div>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={leafSearch}
            onChange={(e) => setLeafSearch(e.target.value)}
            placeholder="Search cheque number…"
            className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Leaf Table */}
      {filteredLeaves.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-semibold">No cheques found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-bold text-slate-600">#</th>
                  <th className="px-4 py-2.5 text-left font-bold text-slate-600">Cheque No.</th>
                  <th className="px-4 py-2.5 text-left font-bold text-slate-600">Status</th>
                  <th className="px-4 py-2.5 text-left font-bold text-slate-600">Payee</th>
                  <th className="px-4 py-2.5 text-left font-bold text-slate-600">Amount</th>
                  <th className="px-4 py-2.5 text-left font-bold text-slate-600">Date</th>
                  <th className="px-4 py-2.5 text-left font-bold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaves.map((leaf, idx) => (
                  <tr key={leaf.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                    <td className="px-4 py-2 text-slate-500 font-mono">{idx + 1}</td>
                    <td className="px-4 py-2 font-mono font-bold text-slate-900">{leaf.chequeNumber}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        leaf.status === 'unused' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                        leaf.status === 'issued' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                        leaf.status === 'cleared' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                        'bg-rose-50 text-rose-600 border border-rose-200'
                      }`}>
                        {leaf.status === 'unused' ? 'AVAILABLE' : leaf.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-700">{leaf.payeeName ?? '—'}</td>
                    <td className="px-4 py-2 font-mono font-bold text-slate-900">{leaf.amount ? formatNPR(Number(leaf.amount)) : '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{leaf.chequeDateBs ?? '—'}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        {leaf.status === 'unused' && (
                          <button
                            onClick={() => setVoidLeaf(leaf)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                            title="Void this cheque"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {leaf.status === 'issued' && (
                          <>
                            <button
                              onClick={() => handleClearLeaf(leaf)}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition cursor-pointer"
                              title="Mark as Cleared"
                            >
                              <CircleCheck className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setBounceLeaf(leaf)}
                              className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition cursor-pointer"
                              title="Mark as Bounced"
                            >
                              <XOctagon className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Void Cheque Modal */}
      {voidLeaf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-rose-600" />
              <h3 className="text-lg font-bold text-slate-900">Void Cheque {voidLeaf.chequeNumber}</h3>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-[11px] text-rose-700">
              This action is <strong>irreversible</strong>. The cheque leaf will be marked as CANCELLED and cannot be used for any payment.
            </div>
            <div>
              <label className="block text-slate-700 font-bold text-xs mb-1">Reason for voiding <span className="text-rose-500">*</span></label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-rose-500 focus:outline-none resize-none"
                rows={3}
                placeholder="e.g. Cheque damaged, incorrect details…"
                required
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button onClick={() => { setVoidLeaf(null); setVoidReason(''); }} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer">Cancel</button>
              <button onClick={handleVoidLeaf} disabled={!voidReason.trim()} className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl flex items-center gap-2 transition cursor-pointer shadow-md disabled:opacity-60">
                <Ban className="w-4 h-4" /> Void Cheque
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bounce Reason Modal */}
      {bounceLeaf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <XOctagon className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-bold text-slate-900">Bounce Cheque {bounceLeaf.chequeNumber}</h3>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-700">
              This will mark the cheque as <strong>CANCELLED</strong> with a bounce reason.
            </div>
            <div>
              <label className="block text-slate-700 font-bold text-xs mb-1">Bounce Reason <span className="text-amber-500">*</span></label>
              <textarea
                value={bounceReason}
                onChange={(e) => setBounceReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-amber-500 focus:outline-none resize-none"
                rows={3}
                placeholder="e.g. Insufficient funds, signature mismatch…"
                required
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button onClick={() => { setBounceLeaf(null); setBounceReason(''); }} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer">Cancel</button>
              <button onClick={handleBounceLeaf} disabled={!bounceReason.trim()} className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl flex items-center gap-2 transition cursor-pointer shadow-md disabled:opacity-60">
                <XOctagon className="w-4 h-4" /> Bounce Cheque
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
