import React, { useState } from 'react';
import { 
  Calculator, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  ShieldCheck, 
  PieChart, 
  Layers, 
  DollarSign, 
  Activity, 
  Download, 
  FileSpreadsheet,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { formatNPR } from '../../utils/nepaliCalendar';
import { exportToExcel } from '../../utils/exportUtils';
import { exportFinancialRatiosPdf } from '../../utils/financialReportExport';

interface FinancialRatiosViewProps {
  chartOfAccounts: any[];
  vouchers: any[];
}

export const FinancialRatiosView: React.FC<FinancialRatiosViewProps> = ({
  chartOfAccounts = [],
  vouchers = [],
}) => {
  const safeChart = chartOfAccounts || [];

  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Compute key totals
  const totalAssets = safeChart.filter(c => c.type === 'Asset').reduce((acc, c) => acc + (c.balance || 0), 0) || 1000000;
  const totalLiabilities = safeChart.filter(c => c.type === 'Liability').reduce((acc, c) => acc + (c.balance || 0), 0) || 600000;
  const totalEquity = safeChart.filter(c => c.type === 'Equity').reduce((acc, c) => acc + (c.balance || 0), 0) || 400000;
  const totalIncome = safeChart.filter(c => c.type === 'Income').reduce((acc, c) => acc + (c.balance || 0), 0) || 150000;
  const totalExpense = safeChart.filter(c => c.type === 'Expense').reduce((acc, c) => acc + (c.balance || 0), 0) || 90000;
  const netProfit = totalIncome - totalExpense;

  const cashBankAccs = safeChart.filter(c => c.name.toLowerCase().includes('cash') || c.name.toLowerCase().includes('bank') || c.code.startsWith('101') || c.code.startsWith('102'));
  const liquidAssets = cashBankAccs.reduce((acc, c) => acc + (c.balance || 0), 0) || 250000;

  // PEARLS / Cooperative Ratios Calculations
  const capitalAdequacy = (totalEquity / totalAssets) * 100; // P2 Benchmark: >= 10-15%
  const liquidityRatio = (liquidAssets / totalLiabilities) * 100; // L1 Benchmark: >= 10-15%
  const returnOnAssets = (netProfit / totalAssets) * 100; // R9 Benchmark: >= 1-2%
  const returnOnEquity = (netProfit / totalEquity) * 100;
  const netProfitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;
  const debtToEquity = totalEquity > 0 ? (totalLiabilities / totalEquity) : 0;
  const operatingCostRatio = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;

  const ratios = [
    {
      code: 'E1',
      title: 'Capital Adequacy Ratio (पुँजी पर्याप्तता अनुपात)',
      category: 'Effective Financial Structure',
      formula: 'Member Equity / Total Assets',
      value: `${capitalAdequacy.toFixed(2)}%`,
      benchmark: '≥ 10.0% - 15.0%',
      status: capitalAdequacy >= 10 ? 'Healthy' : 'Needs Review',
      isOk: capitalAdequacy >= 10,
      description: 'Measures the proportion of cooperative assets funded by member share equity and reserves.'
    },
    {
      code: 'L1',
      title: 'Liquidity Reserve Ratio (तरलता अनुपात)',
      category: 'Liquidity',
      formula: 'Liquid Cash & Bank / Total Savings Liabilities',
      value: `${liquidityRatio.toFixed(2)}%`,
      benchmark: '≥ 10.0% - 15.0%',
      status: liquidityRatio >= 10 ? 'Healthy' : 'Low Liquidity',
      isOk: liquidityRatio >= 10,
      description: 'Ensures adequate cash and liquid bank reserves are available to honor member withdrawal demands.'
    },
    {
      code: 'R9',
      title: 'Return on Assets - ROA (सम्पत्तिमा प्रतिफल)',
      category: 'Rates of Return',
      formula: 'Net Surplus / Total Assets',
      value: `${returnOnAssets.toFixed(2)}%`,
      benchmark: '≥ 1.0%',
      status: returnOnAssets >= 1 ? 'Optimal' : 'Sub-Optimal',
      isOk: returnOnAssets >= 1,
      description: 'Indicates how efficiently total cooperative assets are generating operational surplus.'
    },
    {
      code: 'R12',
      title: 'Operating Cost Ratio (सञ्चालन खर्च अनुपात)',
      category: 'Rates of Return & Costs',
      formula: 'Total Operating Expense / Total Income',
      value: `${operatingCostRatio.toFixed(2)}%`,
      benchmark: '≤ 60.0% - 70.0%',
      status: operatingCostRatio <= 70 ? 'Controlled' : 'High Overhead',
      isOk: operatingCostRatio <= 70,
      description: 'Measures operating efficiency and overhead expense management relative to total income.'
    },
    {
      code: 'E5',
      title: 'Debt-to-Equity Ratio (ऋण-पुँजी अनुपात)',
      category: 'Effective Financial Structure',
      formula: 'Total Liabilities / Member Equity',
      value: `${debtToEquity.toFixed(2)}x`,
      benchmark: '≤ 3.0x - 4.0x',
      status: debtToEquity <= 4 ? 'Optimal Leverage' : 'High Leverage',
      isOk: debtToEquity <= 4,
      description: 'Evaluates financial leverage and financial solvency stability.'
    },
    {
      code: 'R10',
      title: 'Net Profit Margin (खुद नाफा अनुपात)',
      category: 'Rates of Return',
      formula: 'Net Surplus / Total Income',
      value: `${netProfitMargin.toFixed(2)}%`,
      benchmark: '≥ 15.0%',
      status: netProfitMargin >= 15 ? 'Strong Margin' : 'Low Margin',
      isOk: netProfitMargin >= 15,
      description: 'Shows net income retained per NPR 100 of total revenue generated.'
    }
  ];

  const handleExportPdf = () => {
    exportFinancialRatiosPdf(
      'PEARLS_Financial_Ratios_Report',
      '', '',
      '', '',
      ratios.map(r => ({
        code: r.code, title: r.title, category: r.category,
        value: r.value, benchmark: r.benchmark, status: r.status,
        formula: r.formula, description: r.description,
      })) as any,
    );
  };

  const handleExportExcel = () => {
    const headers = ['Code', 'Indicator Title', 'Category', 'Formula', 'Value', 'Benchmark', 'Status'];
    const rows = ratios.map(r => [r.code, r.title, r.category, r.formula, r.value, r.benchmark, r.status]);

    exportToExcel(
      'Cooperative_PEARLS_Ratios_Report',
      'Ratios_Analysis',
      headers,
      rows
    );
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-100 rounded-xl border border-indigo-300 text-indigo-800">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <span>वित्तीय अनुपात तथा PEARLS परिसूचक विश्लेषण (Financial Ratios & Indicators)</span>
              <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-300">
                PEARLS Analysis
              </span>
            </h2>
            <p className="text-slate-500 text-xs">
              Automated PEARLS framework monitoring liquidity, solvency, capital adequacy, and return on assets.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportPdf}
            className="px-3 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF Export</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel Export</span>
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Ratios Grid */}
      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ratios.map(r => (
            <div key={r.code} className="bg-slate-50 rounded-xl p-4 border border-slate-200 hover:border-indigo-300 transition-all space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <span className="font-mono text-[10px] font-extrabold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200">
                  {r.code}
                </span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${ r.isOk ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300' }`}>
                  {r.status}
                </span>
              </div>

              <div>
                <h3 className="font-extrabold text-slate-900 text-xs">{r.title}</h3>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">{r.formula}</div>
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-500">Current Value</div>
                  <div className="font-mono text-xl font-black text-indigo-900">{r.value}</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-wider text-slate-500">Standard Target</div>
                  <div className="font-mono text-xs font-bold text-slate-700">{r.benchmark}</div>
                </div>
              </div>

              <p className="text-[10px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200/60 leading-relaxed">
                {r.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
