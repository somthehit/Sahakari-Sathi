import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import { formatNPR } from '../../utils/nepaliCalendar';
import { BarChart3, PieChart as PieIcon, RefreshCw } from 'lucide-react';

interface CashFlowD3ChartProps {
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  openingCash: number;
  closingCash: number;
}

const BAR_COLORS: Record<string, string> = {
  'Opening Cash': '#0284c7',
  'Cash Inflow': '#059669',
  'Cash Outflow': '#e11d48',
  'Closing Cash': '#4f46e5',
};

const CustomBarTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-bold text-slate-700 mb-0.5">{d.payload.name}</p>
      <p className="font-mono font-extrabold" style={{ color: d.fill }}>{formatNPR(d.value)}</p>
    </div>
  );
};

const CustomPieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-bold text-slate-700 mb-0.5">{d.name}</p>
      <p className="font-mono font-extrabold" style={{ color: d.payload.fill }}>{formatNPR(d.value)}</p>
    </div>
  );
};

export const CashFlowD3Chart: React.FC<CashFlowD3ChartProps> = ({
  totalInflow,
  totalOutflow,
  netCashFlow,
  openingCash,
  closingCash,
}) => {
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  const barData = [
    { name: 'Opening Cash', amount: openingCash },
    { name: 'Cash Inflow', amount: totalInflow },
    { name: 'Cash Outflow', amount: totalOutflow },
    { name: 'Closing Cash', amount: closingCash },
  ];

  const pieData = [
    { name: 'Total Receipts (Inflow)', value: totalInflow, fill: '#059669' },
    { name: 'Total Payments (Outflow)', value: totalOutflow, fill: '#e11d48' },
  ];

  return (
    <div className="bg-white text-slate-800 rounded-2xl p-4 md:p-5 border border-slate-200 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-950 rounded-xl border border-emerald-800 text-emerald-400">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <span>Cash Flow Analytics</span>
              <span className="text-[10px] font-bold bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-700">
                Receipts & Payments
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Visualizing liquidity changes, opening vs closing bank/cash reserves and net operating cash flow.
            </p>
          </div>
        </div>
      </div>

      {/* Hover hint bar */}
      <div className="min-h-[28px] bg-white border border-slate-200/80 rounded-lg px-3 py-1 flex items-center text-xs">
        {hoveredBar ? (
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BAR_COLORS[hoveredBar] }} />
            <span className="font-bold text-slate-700">{hoveredBar}</span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-500 italic flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3 text-slate-500 animate-spin" style={{ animationDuration: '4s' }} />
            Hover over bars or pie segments to inspect liquidity figures.
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl p-3 border border-slate-200/80 min-h-[270px]">
          <div className="text-[11px] font-bold text-slate-600 mb-2 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
            Cash Movements & Liquidity Reserves
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                stroke="#334155"
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 10, fill: '#cbd5e1', fontWeight: 600 }}
                width={90}
                stroke="#334155"
              />
              <Tooltip content={<CustomBarTooltip />} cursor={{ fill: '#1e293b' }} />
              <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={32}
                onMouseEnter={(d) => setHoveredBar(d.name)}
                onMouseLeave={() => setHoveredBar(null)}
              >
                {barData.map((entry) => (
                  <Cell key={entry.name} fill={BAR_COLORS[entry.name]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut / Pie Chart */}
        <div className="bg-white rounded-xl p-3 border border-slate-200/80 min-h-[270px] flex flex-col">
          <div className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1.5">
            <PieIcon className="w-3.5 h-3.5 text-emerald-400" />
            Inflow vs Outflow Ratio
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius="50%"
                  outerRadius="80%"
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Centre label overlay */}
            <div className="text-center -mt-2 mb-2">
              <div className="text-[10px] text-slate-500 font-bold">Net Cash Flow</div>
              <div className={`text-sm font-extrabold font-mono ${netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {netCashFlow >= 0 ? '+' : ''}{(netCashFlow / 1000).toFixed(0)}k
              </div>
            </div>
          </div>

          <div className="flex justify-around text-[10px] font-bold border-t border-slate-200/80 pt-2">
            <div className="text-emerald-400 text-center">
              <div>Total Receipts</div>
              <div className="font-mono text-xs">{formatNPR(totalInflow)}</div>
            </div>
            <div className="text-rose-400 text-center">
              <div>Total Payments</div>
              <div className="font-mono text-xs">{formatNPR(totalOutflow)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
