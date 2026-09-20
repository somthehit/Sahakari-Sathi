import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { formatNPR } from '../../utils/nepaliCalendar';
import { BarChart3, PieChart as PieIcon, RefreshCw } from 'lucide-react';

export interface CategorySummaryData {
  category: string;
  type: string;
  opening: number;
  debit: number;
  credit: number;
  closing: number;
  count: number;
}

interface TrialBalanceD3ChartProps {
  categorySummaries: CategorySummaryData[];
  totalDebit: number;
  totalCredit: number;
  totalOpening: number;
  totalClosing: number;
}

export const TrialBalanceD3Chart: React.FC<TrialBalanceD3ChartProps> = ({
  categorySummaries,
  totalDebit,
  totalCredit,
  totalOpening,
  totalClosing,
}) => {
  const barContainerRef = useRef<HTMLDivElement>(null);
  const pieContainerRef = useRef<HTMLDivElement>(null);
  const barSvgRef = useRef<SVGSVGElement>(null);
  const pieSvgRef = useRef<SVGSVGElement>(null);

  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 500, height: 260 });
  const [pieDimensions, setPieDimensions] = useState<{ width: number; height: number }>({ width: 300, height: 260 });
  const [hoveredData, setHoveredData] = useState<{ label: string; value: number; color: string } | null>(null);

  // ResizeObserver for fluid SVG rendering
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

  // Render D3 Bar Chart
  useEffect(() => {
    if (!barSvgRef.current || categorySummaries.length === 0) return;

    const svg = d3.select(barSvgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 25, right: 20, bottom: 45, left: 90 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) return;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Category labels
    const categories = categorySummaries.map((d) => d.category);

    const y0Scale = d3.scaleBand()
      .domain(categories)
      .range([0, height])
      .paddingInner(0.25);

    const metrics = ['opening', 'debit', 'credit', 'closing'];
    const metricLabels: Record<string, string> = {
      opening: 'Opening',
      debit: 'Debit',
      credit: 'Credit',
      closing: 'Closing',
    };

    const metricColors: Record<string, string> = {
      opening: '#0284c7', // sky-600
      debit: '#059669',   // emerald-600
      credit: '#d97706',  // amber-600
      closing: '#4f46e5', // indigo-600
    };

    const y1Scale = d3.scaleBand()
      .domain(metrics)
      .range([0, y0Scale.bandwidth()])
      .padding(0.08);

    const maxVal = d3.max(categorySummaries, (d) =>
      Math.max(d.opening, d.debit, d.credit, d.closing)
    ) || 100;

    const xScale = d3.scaleLinear()
      .domain([0, maxVal * 1.1])
      .nice()
      .range([0, width]);

    // Background Grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3.axisBottom(xScale)
          .ticks(5)
          .tickSize(-height)
          .tickFormat(() => '')
      )
      .selectAll('line')
      .attr('stroke', '#f1f5f9')
      .attr('stroke-dasharray', '2,2');

    // Draw Bars
    const categoryGroups = g.selectAll('.cat-group')
      .data(categorySummaries)
      .enter()
      .append('g')
      .attr('class', 'cat-group')
      .attr('transform', (d) => `translate(0,${y0Scale(d.category) || 0})`);

    metrics.forEach((metric) => {
      categoryGroups.selectAll(`.bar-${metric}`)
        .data((d) => [{ category: d.category, val: (d as any)[metric] || 0, metric }])
        .enter()
        .append('rect')
        .attr('class', `bar-${metric}`)
        .attr('y', (d) => y1Scale(d.metric) || 0)
        .attr('x', 0)
        .attr('height', y1Scale.bandwidth())
        .attr('width', 0)
        .attr('rx', 3)
        .attr('fill', (d) => metricColors[d.metric])
        .on('mouseenter', (event, d) => {
          setHoveredData({
            label: `${d.category} - ${metricLabels[d.metric]}`,
            value: d.val,
            color: metricColors[d.metric],
          });
          d3.select(event.currentTarget).attr('opacity', 0.85);
        })
        .on('mouseleave', (event) => {
          setHoveredData(null);
          d3.select(event.currentTarget).attr('opacity', 1);
        })
        .transition()
        .duration(600)
        .attr('width', (d) => xScale(d.val));
    });

    // Y Axis (Categories)
    const yAxis = d3.axisLeft(y0Scale).tickSize(0);
    g.append('g')
      .call(yAxis)
      .selectAll('text')
      .style('font-size', '11px')
      .style('font-weight', '600')
      .style('fill', '#334155');

    // X Axis
    const xAxis = d3.axisBottom(xScale)
      .ticks(5)
      .tickFormat((d) => `NPR ${(Number(d) / 1000).toFixed(0)}k`);

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
      .selectAll('text')
      .style('font-size', '10px')
      .style('fill', '#64748b');

  }, [categorySummaries, dimensions]);

  // Render D3 Donut Chart
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
      { label: 'Debit Accounts', value: totalDebit, color: '#059669' },
      { label: 'Credit Accounts', value: totalCredit, color: '#d97706' },
    ];

    const pie = d3.pie<{ label: string; value: number; color: string }>()
      .value((d) => d.value)
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
      .attr('fill', (d) => d.data.color)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', '2')
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        d3.select(this).transition().duration(200).attr('d', hoverArc as any);
        setHoveredData({
          label: d.data.label,
          value: d.data.value,
          color: d.data.color,
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

    // Center Text
    const grandTotal = totalDebit + totalCredit;
    const debitPct = grandTotal > 0 ? ((totalDebit / grandTotal) * 100).toFixed(1) : '50.0';

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.3em')
      .style('font-size', '11px')
      .style('font-weight', '700')
      .style('fill', '#475569')
      .text('Debit Share');

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1em')
      .style('font-size', '16px')
      .style('font-weight', '900')
      .style('fill', '#059669')
      .text(`${debitPct}%`);

  }, [totalDebit, totalCredit, pieDimensions]);

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
              <span>Trial Balance Visual Analytics (D3.js Data Engine)</span>
              <span className="text-[10px] font-bold bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-700">
                Live Dynamic Feed
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Real-time balance distribution & category movements synced with current table filters.
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] bg-white px-3 py-1.5 rounded-xl border border-slate-200">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
            <span className="text-slate-600 font-medium">Opening</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-slate-600 font-medium">Debit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span className="text-slate-600 font-medium">Credit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
            <span className="text-slate-600 font-medium">Closing</span>
          </div>
        </div>
      </div>

      {/* Hover Information Banner */}
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
            Hover over chart bars or donut segments to inspect detailed category figures.
          </span>
        )}
      </div>

      {/* Charts Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Category Movements Grouped Bar Chart (2 cols) */}
        <div ref={barContainerRef} className="lg:col-span-2 bg-white rounded-xl p-3 border border-slate-200/80 min-h-[270px] relative">
          <div className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Category-Wise Financial Movements Breakdown</span>
          </div>
          <svg ref={barSvgRef} width={dimensions.width} height={dimensions.height} className="w-full h-auto overflow-visible" />
        </div>

        {/* Right: Debit vs Credit Donut Distribution Chart (1 col) */}
        <div ref={pieContainerRef} className="bg-white rounded-xl p-3 border border-slate-200/80 min-h-[270px] flex flex-col items-center justify-center relative">
          <div className="w-full text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1.5">
            <PieIcon className="w-3.5 h-3.5 text-amber-400" />
            <span>Debit vs Credit Balance Split</span>
          </div>
          <svg ref={pieSvgRef} width={pieDimensions.width} height={pieDimensions.height} className="w-full h-auto" />
          <div className="w-full flex justify-around text-[10px] font-bold border-t border-slate-200/80 pt-2 mt-1">
            <div className="text-emerald-400 text-center">
              <div>Total Debit</div>
              <div className="font-mono text-xs">{formatNPR(totalDebit)}</div>
            </div>
            <div className="text-amber-400 text-center">
              <div>Total Credit</div>
              <div className="font-mono text-xs">{formatNPR(totalCredit)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
