import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { formatNPR } from '../../utils/nepaliCalendar';
import { BarChart3, PieChart as PieIcon, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';

export interface PLHeadData {
  id: string;
  code: string;
  name: string;
  type: 'Income' | 'Expense';
  priorBalance: number;
  periodAmount: number;
  closingAmount: number;
  varAmount: number;
  varPercent: number;
  isSignificant?: boolean;
}

interface ProfitLossD3ChartProps {
  incomeHeads: PLHeadData[];
  expenseHeads: PLHeadData[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
}

export const ProfitLossD3Chart: React.FC<ProfitLossD3ChartProps> = ({
  incomeHeads,
  expenseHeads,
  totalIncome,
  totalExpense,
  netProfit,
}) => {
  const barContainerRef = useRef<HTMLDivElement>(null);
  const pieContainerRef = useRef<HTMLDivElement>(null);
  const barSvgRef = useRef<SVGSVGElement>(null);
  const pieSvgRef = useRef<SVGSVGElement>(null);

  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 500, height: 260 });
  const [pieDimensions, setPieDimensions] = useState<{ width: number; height: number }>({ width: 300, height: 260 });
  const [hoveredData, setHoveredData] = useState<{ label: string; value: number; color: string } | null>(null);

  useEffect(() => {
    if (!barContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === barContainerRef.current) {
          const w = Math.max(300, entry.contentRect.width);
          setDimensions({ width: w, height: 260 });
        }
        if (pieContainerRef.current && entry.target === pieContainerRef.current) {
          const w = Math.max(240, entry.contentRect.width);
          setPieDimensions({ width: w, height: 260 });
        }
      }
    });

    observer.observe(barContainerRef.current);
    if (pieContainerRef.current) observer.observe(pieContainerRef.current);

    return () => observer.disconnect();
  }, []);

  // Top 5 Income vs Top 5 Expense Heads grouped bar chart
  useEffect(() => {
    if (!barSvgRef.current) return;

    const svg = d3.select(barSvgRef.current);
    svg.selectAll('*').remove();

    const topIncome = [...incomeHeads].sort((a, b) => b.periodAmount - a.periodAmount).slice(0, 4);
    const topExpense = [...expenseHeads].sort((a, b) => b.periodAmount - a.periodAmount).slice(0, 4);

    const chartData = [
      ...topIncome.map(d => ({ name: d.name.length > 18 ? d.name.substring(0, 16) + '...' : d.name, amount: d.periodAmount, type: 'Income' as const })),
      ...topExpense.map(d => ({ name: d.name.length > 18 ? d.name.substring(0, 16) + '...' : d.name, amount: d.periodAmount, type: 'Expense' as const }))
    ];

    if (chartData.length === 0) return;

    const margin = { top: 25, right: 20, bottom: 45, left: 130 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) return;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const yScale = d3.scaleBand()
      .domain(chartData.map(d => d.name))
      .range([0, height])
      .padding(0.2);

    const maxVal = d3.max(chartData, d => d.amount) || 100;

    const xScale = d3.scaleLinear()
      .domain([0, maxVal * 1.1])
      .nice()
      .range([0, width]);

    // Grid lines
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale).ticks(5).tickSize(-height).tickFormat(() => ''))
      .selectAll('line')
      .attr('stroke', '#f1f5f9')
      .attr('stroke-dasharray', '2,2');

    // Bars
    g.selectAll('.bar')
      .data(chartData)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('y', d => yScale(d.name) || 0)
      .attr('x', 0)
      .attr('height', yScale.bandwidth())
      .attr('width', 0)
      .attr('rx', 4)
      .attr('fill', d => d.type === 'Income' ? '#059669' : '#e11d48')
      .on('mouseenter', (event, d) => {
        setHoveredData({
          label: `${d.name} (${d.type})`,
          value: d.amount,
          color: d.type === 'Income' ? '#059669' : '#e11d48'
        });
        d3.select(event.currentTarget).attr('opacity', 0.85);
      })
      .on('mouseleave', (event) => {
        setHoveredData(null);
        d3.select(event.currentTarget).attr('opacity', 1);
      })
      .transition()
      .duration(600)
      .attr('width', d => xScale(d.amount));

    // Y Axis
    g.append('g')
      .call(d3.axisLeft(yScale).tickSize(0))
      .selectAll('text')
      .style('font-size', '10px')
      .style('font-weight', '600')
      .style('fill', '#334155');

    // X Axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => `NPR ${(Number(d) / 1000).toFixed(0)}k`))
      .selectAll('text')
      .style('font-size', '10px')
      .style('fill', '#64748b');

  }, [incomeHeads, expenseHeads, dimensions]);

  // Donut Chart: Income vs Expense vs Net Profit
  useEffect(() => {
    if (!pieSvgRef.current) return;

    const svg = d3.select(pieSvgRef.current);
    svg.selectAll('*').remove();

    const width = pieDimensions.width;
    const height = pieDimensions.height;
    const radius = Math.min(width, height) / 2 - 25;

    if (radius <= 0) return;

    const g = svg
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const data = [
      { label: 'Total Expense', value: totalExpense, color: '#e11d48' },
      { label: 'Net Surplus (Profit)', value: Math.max(0, netProfit), color: '#10b981' },
    ];

    const pie = d3.pie<{ label: string; value: number; color: string }>()
      .value(d => d.value)
      .sort(null);

    const arc = d3.arc<d3.PieArcDatum<{ label: string; value: number; color: string }>>()
      .innerRadius(radius * 0.55)
      .outerRadius(radius)
      .cornerRadius(4);

    const hoverArc = d3.arc<d3.PieArcDatum<{ label: string; value: number; color: string }>>()
      .innerRadius(radius * 0.52)
      .outerRadius(radius * 1.05)
      .cornerRadius(4);

    const arcs = g.selectAll('.arc')
      .data(pie(data))
      .enter()
      .append('g')
      .attr('class', 'arc');

    arcs.append('path')
      .attr('d', arc)
      .attr('fill', d => d.data.color)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', '2')
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        d3.select(this).transition().duration(200).attr('d', hoverArc as any);
        setHoveredData({
          label: d.data.label,
          value: d.data.value,
          color: d.data.color
        });
      })
      .on('mouseleave', function (event, d) {
        d3.select(this).transition().duration(200).attr('d', arc as any);
        setHoveredData(null);
      })
      .transition()
      .duration(700)
      .attrTween('d', function (d) {
        const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return function (t) {
          return arc(i(t)) || '';
        };
      });

    const profitMarginPct = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : '0.0';

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.3em')
      .style('font-size', '10px')
      .style('font-weight', '700')
      .style('fill', '#475569')
      .text('Net Profit Margin');

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1em')
      .style('font-size', '15px')
      .style('font-weight', '900')
      .style('fill', netProfit >= 0 ? '#10b981' : '#e11d48')
      .text(`${profitMarginPct}%`);

  }, [totalIncome, totalExpense, netProfit, pieDimensions]);

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
              <span>P&L Visual Analytics (D3.js Financial Engine)</span>
              <span className="text-[10px] font-bold bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-700">
                Live Dynamic Sync
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Visualizing major revenue streams, operating costs, and net surplus margin in real time.
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] bg-white px-3 py-1.5 rounded-xl border border-slate-200">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-slate-600 font-medium">Income Streams</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span className="text-slate-600 font-medium">Operating Expenses</span>
          </div>
        </div>
      </div>

      {/* Hover Info Banner */}
      <div className="min-h-[28px] bg-white border border-slate-200/80 rounded-lg px-3 py-1 flex items-center justify-between text-xs">
        {hoveredData ? (
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hoveredData.color }} />
            <span className="font-bold text-slate-700">{hoveredData.label}:</span>
            <span className="font-mono font-extrabold text-emerald-400">{formatNPR(hoveredData.value)}</span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-500 italic flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3 text-slate-500 animate-spin" style={{ animationDuration: '4s' }} />
            Hover over chart bars or donut slices to inspect revenue & cost details.
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div ref={barContainerRef} className="lg:col-span-2 bg-white rounded-xl p-3 border border-slate-200/80 min-h-[270px] relative">
          <div className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Top Income vs Expense Accounts (Period Volume)</span>
          </div>
          <svg ref={barSvgRef} width={dimensions.width} height={dimensions.height} className="w-full h-auto overflow-visible" />
        </div>

        <div ref={pieContainerRef} className="bg-white rounded-xl p-3 border border-slate-200/80 min-h-[270px] flex flex-col items-center justify-center relative">
          <div className="w-full text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1.5">
            <PieIcon className="w-3.5 h-3.5 text-amber-400" />
            <span>Revenue Retention (Net Margin)</span>
          </div>
          <svg ref={pieSvgRef} width={pieDimensions.width} height={pieDimensions.height} className="w-full h-auto" />
          <div className="w-full flex justify-around text-[10px] font-bold border-t border-slate-200/80 pt-2 mt-1">
            <div className="text-emerald-400 text-center">
              <div>Total Revenue</div>
              <div className="font-mono text-xs">{formatNPR(totalIncome)}</div>
            </div>
            <div className="text-rose-400 text-center">
              <div>Total Expenses</div>
              <div className="font-mono text-xs">{formatNPR(totalExpense)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
