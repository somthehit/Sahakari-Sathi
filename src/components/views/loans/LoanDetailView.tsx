import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Landmark, User, Calendar, Clock, AlertTriangle, CheckCircle2,
  TrendingDown, Wallet, FileText, Printer, Loader2, ChevronRight, Ban,
  CircleDollarSign, PieChart, History, ArrowUpRight, ArrowDownLeft,
} from 'lucide-react';
import {
  fetchLoanById,
  fetchLoanSchedule,
  fetchLoanDue,
  fetchLoanStatement,
  fetchLoanRepayments,
  type LoanDetailRecord,
  type LoanInstallment,
  type LoanDueBreakdown,
  type LoanStatement,
  type LoanRepaymentRecord,
} from '../../../api/loanServicing';
import { formatNPR } from '../../../utils/nepaliCalendar';

interface Props {
  loanId: string;
  onBack: () => void;
}

export function LoanDetailView({ loanId, onBack }: Props) {
  const [loan, setLoan] = useState<LoanDetailRecord | null>(null);
  const [schedule, setSchedule] = useState<LoanInstallment[]>([]);
  const [due, setDue] = useState<LoanDueBreakdown | null>(null);
  const [statement, setStatement] = useState<LoanStatement | null>(null);
  const [repayments, setRepayments] = useState<LoanRepaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchLoanById(loanId),
      fetchLoanSchedule(loanId),
      fetchLoanDue(loanId),
      fetchLoanStatement(loanId),
      fetchLoanRepayments(loanId),
    ])
      .then(([loanData, scheduleData, dueData, stmtData, repayData]) => {
        if (!active) return;
        setLoan(loanData);
        setSchedule(scheduleData);
        setDue(dueData);
        setStatement(stmtData);
        setRepayments(repayData);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Failed to load loan details.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [loanId]);

  // Derived data
  const lastPaid = useMemo(() => {
    const paid = schedule.filter((s) => s.status === 'Paid');
    return paid.length > 0 ? paid[paid.length - 1] : null;
  }, [schedule]);

  const nextDue = useMemo(() => {
    return schedule.find((s) => s.status === 'Due' || s.status === 'Overdue') || null;
  }, [schedule]);

  const interestRemaining = useMemo(() => {
    return schedule
      .filter((s) => s.status !== 'Paid')
      .reduce((sum, s) => sum + s.interest, 0);
  }, [schedule]);

  const principalPaid = useMemo(() => {
    return schedule
      .filter((s) => s.status === 'Paid')
      .reduce((sum, s) => sum + s.principal, 0);
  }, [schedule]);

  const interestPaid = useMemo(() => {
    return schedule
      .filter((s) => s.status === 'Paid')
      .reduce((sum, s) => sum + s.interest, 0);
  }, [schedule]);

  const totalPaid = principalPaid + interestPaid;

  const paidCount = schedule.filter((s) => s.status === 'Paid').length;
  const totalCount = schedule.length;
  const progressPct = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <span className="text-sm text-slate-500">Loading loan details…</span>
      </div>
    );
  }

  if (error || !loan) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <AlertTriangle className="w-8 h-8 text-rose-500" />
        <span className="text-sm text-rose-600 font-semibold">{error || 'Loan not found.'}</span>
        <button onClick={onBack} className="mt-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold cursor-pointer">Go Back</button>
      </div>
    );
  }

  const statusColor = (s: string) => {
    switch (s) {
      case 'Disbursed': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Closed': return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'Written_Off': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const nplColor = (s: string) => {
    switch (s) {
      case 'Pass': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Watchlist': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Substandard': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Doubtful': return 'bg-red-50 text-red-700 border-red-200';
      case 'Loss': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const installmentStatusColor = (s: string) => {
    switch (s) {
      case 'Paid': return 'bg-emerald-50 text-emerald-700';
      case 'Overdue': return 'bg-red-50 text-red-700';
      default: return 'bg-amber-50 text-amber-700';
    }
  };

  const isDisbursed = loan.status === 'Disbursed' || loan.status === 'Closed' || loan.status === 'Written_Off';
  const hasSchedule = schedule.length > 0;

  return (
    <div className="space-y-5 max-w-[1400px] mx-auto print:max-w-none print:space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3 print:hidden">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl transition cursor-pointer">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-extrabold text-slate-900">{loan.loanNo}</h1>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor(loan.status)}`}>
              {loan.status}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${nplColor(loan.nplStatus)}`}>
              {loan.nplStatus}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{loan.productName} · {loan.memberName} ({loan.memberNo})</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer border border-slate-300"
        >
          <Printer className="w-3.5 h-3.5" /> Print
        </button>
      </div>

      {/* Print Header — visible only when printing */}
      <div className="hidden print:block text-center mb-4">
        <h1 className="text-base font-extrabold">{loan.loanNo} — Loan Statement</h1>
        <p className="text-xs text-slate-600">{loan.productName} · {loan.memberName} ({loan.memberNo})</p>
        <p className="text-[10px] text-slate-400 mt-1">Printed on {new Date().toLocaleDateString()}</p>
      </div>

      {/* Top Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center">
              <Wallet className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">Outstanding</span>
          </div>
          <p className="text-xl font-mono font-extrabold text-slate-900">{formatNPR(loan.outstandingPrincipal)}</p>
          <p className="text-[10px] text-slate-400 mt-1">of {formatNPR(loan.approvedAmount)} disbursed</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
              <CircleDollarSign className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">Monthly EMI</span>
          </div>
          <p className="text-xl font-mono font-extrabold text-blue-700">{formatNPR(loan.monthlyEmi)}</p>
          <p className="text-[10px] text-slate-400 mt-1">{loan.interestMethod.replace(/_/g, ' ').toUpperCase()}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center">
              <PieChart className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">Interest Rate</span>
          </div>
          <p className="text-xl font-mono font-extrabold text-amber-700">{loan.interestRate}%</p>
          <p className="text-[10px] text-slate-400 mt-1">{loan.tenureMonths} months tenure</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-purple-50 rounded-xl flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-purple-600" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">Progress</span>
          </div>
          <p className="text-xl font-mono font-extrabold text-purple-700">{paidCount}/{totalCount}</p>
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      {/* EMI Status Row — Last Paid, Coming EMI, Interest Remaining */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Last Paid EMI */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-xs font-bold text-slate-700">Last Paid EMI</span>
          </div>
          {lastPaid ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Installment #{lastPaid.installmentNo}</span>
                <span className="text-lg font-mono font-extrabold text-emerald-700">{formatNPR(lastPaid.totalEmi)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 rounded-lg p-2">
                  <span className="text-[10px] text-slate-500 block">Principal</span>
                  <span className="font-mono font-bold text-slate-900">{formatNPR(lastPaid.principal)}</span>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <span className="text-[10px] text-slate-500 block">Interest</span>
                  <span className="font-mono font-bold text-slate-900">{formatNPR(lastPaid.interest)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>Paid on: <strong className="text-slate-700">{lastPaid.paidDateBs || '—'}</strong></span>
                <span>Balance: <strong className="text-slate-700">{formatNPR(lastPaid.balancePrincipal)}</strong></span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No payments recorded yet.</p>
          )}
        </div>

        {/* Coming EMI */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-xs font-bold text-slate-700">Coming EMI</span>
          </div>
          {nextDue ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Installment #{nextDue.installmentNo}</span>
                <span className="text-lg font-mono font-extrabold text-amber-700">{formatNPR(nextDue.totalEmi)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 rounded-lg p-2">
                  <span className="text-[10px] text-slate-500 block">Principal</span>
                  <span className="font-mono font-bold text-slate-900">{formatNPR(nextDue.principal)}</span>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <span className="text-[10px] text-slate-500 block">Interest</span>
                  <span className="font-mono font-bold text-slate-900">{formatNPR(nextDue.interest)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500">Due: <strong className="text-slate-700">{nextDue.dueDateBs}</strong></span>
                {nextDue.status === 'Overdue' && (
                  <span className="flex items-center gap-1 text-red-600 font-bold">
                    <AlertTriangle className="w-3 h-3" /> {nextDue.daysLate} days overdue
                  </span>
                )}
              </div>
            </div>
          ) : !isDisbursed ? (
            <div className="flex flex-col items-center justify-center py-4">
              <Clock className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-500">Loan not yet disbursed</p>
              <p className="text-[10px] text-slate-400 mt-1">Schedule will appear after disbursement</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
              <p className="text-xs font-bold text-emerald-700">All installments paid!</p>
            </div>
          )}
        </div>

        {/* Interest Remaining */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 bg-rose-50 rounded-xl flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-rose-600" />
            </div>
            <span className="text-xs font-bold text-slate-700">Interest Remaining</span>
          </div>
          <div className="space-y-3">
            <p className="text-2xl font-mono font-extrabold text-rose-700">{formatNPR(interestRemaining)}</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Principal Paid</span>
                <span className="font-mono font-bold text-emerald-700">{formatNPR(principalPaid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Interest Paid</span>
                <span className="font-mono font-bold text-emerald-700">{formatNPR(interestPaid)}</span>
              </div>
              <div className="border-t border-slate-100 pt-1.5 flex justify-between">
                <span className="text-slate-700 font-semibold">Total Paid</span>
                <span className="font-mono font-extrabold text-slate-900">{formatNPR(totalPaid)}</span>
              </div>
            </div>
            {due && due.penaltyDue > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-[10px] text-red-700 font-semibold">
                Penalties Due: {formatNPR(due.penaltyDue)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loan Info Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Borrower</span>
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold text-slate-900">{loan.memberName}</span>
            </div>
            <span className="text-[10px] text-slate-400">{loan.memberNo}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Disbursed</span>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold text-slate-900">{loan.disbursedDateBs || '—'}</span>
            </div>
            <span className="text-[10px] text-slate-400">{loan.disbursementPaymentMethod || 'N/A'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Maturity</span>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold text-slate-900">{loan.maturityDateBs || '—'}</span>
            </div>
            <span className="text-[10px] text-slate-400">{loan.tenureMonths} months</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Last Payment</span>
            <div className="flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold text-slate-900">{loan.lastRepaymentDateBs || '—'}</span>
            </div>
            <span className="text-[10px] text-slate-400">{formatNPR(totalPaid)} total</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Overdue</span>
            <div className="flex items-center gap-1.5">
              {loan.daysOverdue > 0 ? (
                <Ban className="w-3.5 h-3.5 text-red-500" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              )}
              <span className={`font-bold ${loan.daysOverdue > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {loan.daysOverdue > 0 ? `${loan.daysOverdue} days` : 'Current'}
              </span>
            </div>
            {loan.overdueAmount > 0 && (
              <span className="text-[10px] text-red-500">{formatNPR(loan.overdueAmount)} overdue</span>
            )}
          </div>
        </div>
      </div>

      {/* Full EMI Schedule Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border print:rounded-none">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-bold text-slate-700">Full EMI Schedule ({totalCount} installments)</span>
        </div>
        {hasSchedule ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 print:bg-slate-50">
                  <th className="px-4 py-2.5 text-left font-bold text-slate-600">#</th>
                  <th className="px-4 py-2.5 text-left font-bold text-slate-600">Due Date</th>
                  <th className="px-4 py-2.5 text-right font-bold text-slate-600">Principal</th>
                  <th className="px-4 py-2.5 text-right font-bold text-slate-600">Interest</th>
                  <th className="px-4 py-2.5 text-right font-bold text-slate-600">EMI</th>
                  <th className="px-4 py-2.5 text-right font-bold text-slate-600">Balance</th>
                  <th className="px-4 py-2.5 text-center font-bold text-slate-600">Status</th>
                  <th className="px-4 py-2.5 text-left font-bold text-slate-600">Paid On</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition print:hover:bg-transparent">
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{row.installmentNo}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-700">{row.dueDateBs}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-900">{formatNPR(row.principal)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-900">{formatNPR(row.interest)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">{formatNPR(row.totalEmi)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-600">{formatNPR(row.balancePrincipal)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${installmentStatusColor(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">{row.paidDateBs || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-8 text-center">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            {!isDisbursed ? (
              <p className="text-xs text-slate-500 italic">EMI schedule will be generated once the loan is disbursed.</p>
            ) : (
              <p className="text-xs text-slate-400 italic">No schedule data available.</p>
            )}
          </div>
        )}
      </div>

      {/* EMI Transactions */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border print:rounded-none">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
          <CircleDollarSign className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-bold text-slate-700">EMI Transactions ({repayments.length})</span>
        </div>
        {repayments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 print:bg-slate-50">
                  <th className="px-4 py-2.5 text-left font-bold text-slate-600">Date</th>
                  <th className="px-4 py-2.5 text-left font-bold text-slate-600">Receipt</th>
                  <th className="px-4 py-2.5 text-left font-bold text-slate-600">Voucher</th>
                  <th className="px-4 py-2.5 text-right font-bold text-slate-600">Principal</th>
                  <th className="px-4 py-2.5 text-right font-bold text-slate-600">Interest</th>
                  <th className="px-4 py-2.5 text-right font-bold text-slate-600">Penalty</th>
                  <th className="px-4 py-2.5 text-right font-bold text-slate-600">Total Paid</th>
                  <th className="px-4 py-2.5 text-right font-bold text-slate-600">Outstanding</th>
                  <th className="px-4 py-2.5 text-center font-bold text-slate-600">Mode</th>
                  <th className="px-4 py-2.5 text-left font-bold text-slate-600">Collected By</th>
                </tr>
              </thead>
              <tbody>
                {repayments.map((txn) => (
                  <tr key={txn.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition print:hover:bg-transparent">
                    <td className="px-4 py-2.5 font-mono text-slate-700">{txn.dateBs}</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{txn.receiptNo}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">{txn.voucherNo || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700">{formatNPR(txn.principalPaid)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-blue-700">{formatNPR(txn.interestPaid)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {txn.penaltyPaid > 0 ? (
                        <span className="font-bold text-red-600">{formatNPR(txn.penaltyPaid)}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-extrabold text-slate-900">{formatNPR(txn.totalPaid)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-600">{formatNPR(txn.outstandingAfter)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        txn.paymentMode === 'Cash' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {txn.paymentMode === 'Bank_Transfer' ? 'Bank' : txn.paymentMode}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{txn.collectedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-8 text-center">
            <CircleDollarSign className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            {!isDisbursed ? (
              <p className="text-xs text-slate-500 italic">No transactions yet — loan is not disbursed.</p>
            ) : (
              <p className="text-xs text-slate-400 italic">No EMI payments recorded yet.</p>
            )}
          </div>
        )}
      </div>

      {/* Repayment History */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border print:rounded-none">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-bold text-slate-700">Repayment History ({statement?.entries.length || 0} entries)</span>
        </div>
        {statement && statement.entries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 print:bg-slate-50">
                  <th className="px-4 py-2.5 text-left font-bold text-slate-600">Date</th>
                  <th className="px-4 py-2.5 text-left font-bold text-slate-600">Voucher</th>
                  <th className="px-4 py-2.5 text-right font-bold text-slate-600">Principal</th>
                  <th className="px-4 py-2.5 text-right font-bold text-slate-600">Interest</th>
                  <th className="px-4 py-2.5 text-right font-bold text-slate-600">Penalty</th>
                  <th className="px-4 py-2.5 text-right font-bold text-slate-600">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {statement.entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition print:hover:bg-transparent">
                    <td className="px-4 py-2.5 font-mono text-slate-700">{entry.transactionDateBs}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">{entry.voucherNo || '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      {entry.principalCredit > 0 ? (
                        <span className="font-mono font-bold text-emerald-700 flex items-center justify-end gap-1">
                          <ArrowDownLeft className="w-3 h-3" />{formatNPR(entry.principalCredit)}
                        </span>
                      ) : entry.principalDebit > 0 ? (
                        <span className="font-mono font-bold text-blue-700 flex items-center justify-end gap-1">
                          <ArrowUpRight className="w-3 h-3" />{formatNPR(entry.principalDebit)}
                        </span>
                      ) : (
                        <span className="font-mono text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {entry.interestCredit > 0 ? (
                        <span className="font-mono font-bold text-emerald-700">{formatNPR(entry.interestCredit)}</span>
                      ) : (
                        <span className="font-mono text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {entry.penaltyCredit > 0 ? (
                        <span className="font-mono font-bold text-red-600">{formatNPR(entry.penaltyCredit)}</span>
                      ) : (
                        <span className="font-mono text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-600">{formatNPR(entry.remainingPrincipal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-8 text-center">
            <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            {!isDisbursed ? (
              <p className="text-xs text-slate-500 italic">No repayment history — loan is not disbursed.</p>
            ) : (
              <p className="text-xs text-slate-400 italic">No repayment entries yet.</p>
            )}
          </div>
        )}
      </div>

      {/* Print-only footer */}
      <div className="hidden print:block text-center text-[10px] text-slate-400 mt-6 border-t border-slate-200 pt-3">
        This is a computer-generated statement. · Sahakari Sathi · {new Date().toLocaleDateString()}
      </div>
    </div>
  );
}
