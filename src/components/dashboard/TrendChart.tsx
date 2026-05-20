// @ts-nocheck
import React, { useState } from 'react';
import { 
  AreaChart, 
  Area, 
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  ReferenceArea,
  Brush
} from 'recharts';
import { motion } from 'motion/react';
import { cn, formatValue } from '../../lib/utils';

interface DataPoint {
  time: string;
  [key: string]: any;
}

interface LegendItem {
  key: string;
  name: string;
  color?: string;
  metric?: string; // added to identify parent metric for mixed config
  unit?: string;
}

interface TrendChartProps {
  title: string;
  data: DataPoint[];
  series: LegendItem[];
  hosts: string[];
  chartType?: 'area' | 'line' | 'bar' | 'pie' | 'mixed';
  seriesConfig?: Record<string, {
    yAxis: 'left' | 'right';
    chartType: 'area' | 'line' | 'bar';
    aggregation: 'none' | 'sum' | 'avg';
    stacked: boolean;
  }>;
  stacked?: boolean;
  unit?: string;
  leftUnit?: string;
  rightUnit?: string;
  mode?: 'live' | 'historical';
  granularity?: string;
  aggregation?: 'none' | 'sum' | 'avg';
  color?: string;
  hiddenSeries?: Set<string>;
  onLegendClick?: (key: string) => void;
  onHostClick?: (host: string) => void;
  zoomDomain?: [number, number] | null;
  onZoomDomainChange?: (domain: [number, number] | null) => void;
}

export function TrendChart({ title, data, series, hosts, chartType = 'area', seriesConfig, stacked = false, unit, leftUnit, rightUnit, mode = 'live', granularity, aggregation, color, hiddenSeries, onLegendClick, onHostClick, zoomDomain, onZoomDomainChange }: TrendChartProps) {
  const defaultColors = ['#0284c7', '#4f46e5', '#7c3aed', '#db2777', '#d97706', '#059669', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];
  const chartColors = color ? [color, ...defaultColors.filter(c => c !== color)] : defaultColors;

  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);

  let displayedData = data;
  if (zoomDomain) {
    displayedData = data.slice(zoomDomain[0], zoomDomain[1] + 1);
  }

  const handleMouseDown = (e: any) => {
    if (chartType === 'pie' || !e || !e.activeLabel) return;
    setRefAreaLeft(e.activeLabel);
  };

  const handleMouseMove = (e: any) => {
    if (chartType === 'pie' || !refAreaLeft || !e || !e.activeLabel) return;
    setRefAreaRight(e.activeLabel);
  };

  const handleMouseUp = () => {
    if (chartType === 'pie') return;
    if (refAreaLeft && refAreaRight && refAreaLeft !== refAreaRight) {
      let index1 = displayedData.findIndex(d => d.time === refAreaLeft);
      let index2 = displayedData.findIndex(d => d.time === refAreaRight);
      
      // Safety checks in case labels weren't found
      if (index1 !== -1 && index2 !== -1) {
        let start = Math.min(index1, index2);
        let end = Math.max(index1, index2);
        
        const absStart = data.findIndex(d => d.time === displayedData[start].time);
        const absEnd = data.findIndex(d => d.time === displayedData[end].time);
        
        onZoomDomainChange?.([absStart, absEnd]);
      }
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const getSeriesColor = (s: LegendItem) => {
    const originalIndex = series.findIndex((item) => item.key === s.key);
    const idx = originalIndex !== -1 ? originalIndex : 0;
    return s.color || chartColors[idx % chartColors.length];
  };

  // For Pie charts, we aggregate the latest values for each series
  const pieData = chartType === 'pie' ? series.map((s, i) => {
    const latest = data[data.length - 1]?.[s.key] || 0;
    const isHidden = hiddenSeries?.has(s.key);
    return { 
      name: s.name, 
      value: isHidden ? 0 : (typeof latest === 'number' ? latest : 0), 
      color: isHidden ? '#e2e8f0' : getSeriesColor(s),
      dataKey: s.key // pass dataKey so we know which one was clicked
    };
  }).sort((a, b) => b.value - a.value) : [];

  const formatXAxis = (tickItem: string) => {
    try {
      const date = new Date(tickItem);
      if (isNaN(date.getTime())) return tickItem;

      if (mode === 'live') {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      }

      // Historical formatting based on granularity
      if (granularity === '1d') {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
      
      // If granularity is large but not a full day, or if we have multiple days, show short date + time
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    } catch (e) {
      return tickItem;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-sm border border-slate-100 rounded-lg shadow-lg p-1.5 max-h-[400px] overflow-y-auto flex flex-col gap-0.5 border-l-2 border-l-blue-600 min-w-[160px]">
          {label && (
             <div className="text-[10px] uppercase font-bold text-slate-500 mb-0.5 px-1 border-b border-slate-100 pb-1">
               {(() => {
                 try {
                   const d = new Date(label);
                   if (isNaN(d.getTime())) return formatXAxis(label);
                   let stepMs = 60000;
                   const granLower = (granularity || '').toLowerCase();
                   if (granLower === '1m') stepMs = 60000;
                   else if (granLower === '5m') stepMs = 300000;
                   else if (granLower === '15m') stepMs = 900000;
                   else if (granLower === '30m') stepMs = 1800000;
                   else if (granLower === '1h') stepMs = 3600000;
                   else if (granLower === '1d') stepMs = 86400000;
                   else stepMs = 60000;

                   const d2 = new Date(d.getTime() + stepMs);
                   const t1 = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                   const t2 = d2.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                   
                   if (granLower === '1d') {
                     const opt = { month: 'short', day: 'numeric' } as const;
                     return `[${d.toLocaleDateString([], opt)} - ${d2.toLocaleDateString([], opt)}]`;
                   }
                   return `[${t1} - ${t2}]`;
                 } catch (err) {
                   return formatXAxis(label);
                 }
               })()}
             </div>
          )}
          <div className="space-y-0.5">
            {payload.map((entry: any, index: number) => (
              <div key={`item-${index}`} className="flex items-center justify-between gap-3 px-1 py-0.5 hover:bg-slate-50 rounded bg-transparent transition-colors">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: entry.color || entry.fill }} />
                  <span className="text-[10px] font-medium text-slate-600 truncate block max-w-[120px]">
                    {entry.name}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-900 whitespace-nowrap ml-2">
                  {(() => {
                    const u = entry.payload?.unit || series.find((s) => s.key === entry.dataKey)?.unit || unit;
                    const { value, unit: fmtUnit } = formatValue(entry.value || 0, u);
                    return `${value} ${fmtUnit}`.trim();
                  })()}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    const gridColor = "#f1f5f9";
    const axisColor = "#94a3b8";
    
    // Base props for charts that shouldn't be added to pie chart
    const dragProps = chartType !== 'pie' ? {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp
    } : {};

    switch(chartType) {
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={0}
              outerRadius="80%"
              dataKey="value"
              isAnimationActive={true}
              animationBegin={0}
              animationDuration={350}
              animationEasing="ease-out"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} allowEscapeViewBox={{ x: true, y: true }} wrapperStyle={{ zIndex: 100 }} />
          </PieChart>
        );
      case 'line':
        return (
          <LineChart data={displayedData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }} {...dragProps}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
            <XAxis 
              dataKey="time" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: axisColor, fontWeight: 500 }} 
              tickFormatter={formatXAxis}
              minTickGap={30}
            />
            <YAxis axisLine={false} tickLine={false} tickFormatter={(tick) => { const fmt = formatValue(tick, unit); return `${fmt.value} ${fmt.unit}`.trim(); }} tick={{ fontSize: 10, fill: axisColor, fontWeight: 500 }} label={unit && unit !== 'B' ? { value: unit.trim(), angle: -90, position: 'insideLeft', offset: 25, style: { textAnchor: 'middle', fill: axisColor, fontSize: 11, fontWeight: 600 } } : undefined} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} allowEscapeViewBox={{ x: true, y: true }} wrapperStyle={{ zIndex: 100 }} />
            {series.map((s, i) => (
              <Line 
                key={s.key} 
                hide={hiddenSeries?.has(s.key)} 
                name={s.name} 
                type="monotone" 
                dataKey={s.key} 
                stroke={getSeriesColor(s)} 
                strokeWidth={2.5} 
                dot={false} 
                activeDot={{ r: 4, strokeWidth: 0 }} 
                unit={unit} 
              />
            ))}
            {refAreaLeft && refAreaRight ? (
              <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="#0ea5e9" fillOpacity={0.1} />
            ) : null}
          </LineChart>
        );
      case 'mixed':
        const hasRight = series.some(s => {
          const metric = s.metric || s.key.split('_')[0];
          return seriesConfig?.[metric]?.yAxis === 'right';
        });
        const hasLeft = series.some(s => {
          const metric = s.metric || s.key.split('_')[0];
          return (seriesConfig?.[metric]?.yAxis || 'left') === 'left';
        });

        return (
          <ComposedChart data={displayedData} margin={{ top: 10, right: hasRight ? 20 : 20, left: 10, bottom: 0 }} {...dragProps}>
            <defs>
              {series.map((s, i) => {
                const metric = s.metric || s.key.split('_')[0];
                const type = seriesConfig?.[metric]?.chartType || 'line';
                if (type !== 'area') return null;
                const safeId = `gradient-${s.key.replace(/[^a-zA-Z0-9-_]/g, '_')}`;
                return (
                <linearGradient key={`mixed-grad-${s.key}`} id={safeId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={getSeriesColor(s)} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={getSeriesColor(s)} stopOpacity={0.05}/>
                </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
            <XAxis 
              dataKey="time" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: axisColor, fontWeight: 500 }} 
              tickFormatter={formatXAxis}
              minTickGap={30}
            />
            {hasLeft && <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tickFormatter={(tick) => { const fmt = formatValue(tick, leftUnit); return `${fmt.value} ${fmt.unit}`.trim(); }} tick={{ fontSize: 10, fill: axisColor, fontWeight: 500 }} label={leftUnit && leftUnit !== 'B' ? { value: leftUnit.trim(), angle: -90, position: 'insideLeft', offset: 25, style: { textAnchor: 'middle', fill: axisColor, fontSize: 11, fontWeight: 600 } } : undefined} />}
            {hasRight && <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tickFormatter={(tick) => { const fmt = formatValue(tick, rightUnit); return `${fmt.value} ${fmt.unit}`.trim(); }} tick={{ fontSize: 10, fill: axisColor, fontWeight: 500 }} width={55} label={rightUnit && rightUnit !== 'B' ? { value: rightUnit.trim(), angle: 90, position: 'insideRight', offset: 0, style: { textAnchor: 'middle', fill: axisColor, fontSize: 11, fontWeight: 600 } } : undefined} />}
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} allowEscapeViewBox={{ x: true, y: true }} wrapperStyle={{ zIndex: 100 }} />
            {[...series].sort((a, b) => {
              if (a.metric === 'series1' && b.metric === 'series2') return 1;
              if (a.metric === 'series2' && b.metric === 'series1') return -1;
              return 0;
            }).map((s, i) => {
              const metric = s.metric || s.key.split('_')[0];
              const conf = seriesConfig?.[metric] || { chartType: 'line', yAxis: 'left', stacked: false };
              const t = conf.chartType;
              const yId = conf.yAxis || 'left';
              
              if (t === 'bar') {
                return (
                  <Bar 
                    key={s.key} 
                    hide={hiddenSeries?.has(s.key)} 
                    name={s.name} 
                    dataKey={s.key} 
                    fill={getSeriesColor(s)} 
                    fillOpacity={0.85}
                    stackId={conf.stacked ? `stack-${metric}` : undefined} 
                    unit={unit} 
                    radius={[4, 4, 0, 0]} 
                    yAxisId={yId}
                  />
                );
              } else if (t === 'area') {
                const safeId = `gradient-${s.key.replace(/[^a-zA-Z0-9-_]/g, '_')}`;
                return (
                  <Area 
                    key={s.key} 
                    hide={hiddenSeries?.has(s.key)} 
                    name={s.name} 
                    type="monotone" 
                    dataKey={s.key} 
                    stroke={getSeriesColor(s)} 
                    stackId={conf.stacked ? `stack-${metric}` : undefined} 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill={`url(#${safeId})`} 
                    unit={unit} 
                    animationDuration={1000} 
                    yAxisId={yId}
                  />
                );
              } else {
                return (
                  <Line 
                    key={s.key} 
                    hide={hiddenSeries?.has(s.key)} 
                    name={s.name} 
                    type="monotone" 
                    dataKey={s.key} 
                    stroke={getSeriesColor(s)} 
                    strokeWidth={2.5} 
                    dot={false} 
                    activeDot={{ r: 4, strokeWidth: 0 }} 
                    unit={unit} 
                    yAxisId={yId}
                  />
                );
              }
            })}
            {refAreaLeft && refAreaRight ? (
              <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="#0ea5e9" fillOpacity={0.1} />
            ) : null}
          </ComposedChart>
        );
      case 'bar':
        return (
          <BarChart data={displayedData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }} {...dragProps}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
            <XAxis 
              dataKey="time" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: axisColor, fontWeight: 500 }} 
              tickFormatter={formatXAxis}
              minTickGap={30}
            />
            <YAxis axisLine={false} tickLine={false} tickFormatter={(tick) => { const fmt = formatValue(tick, unit); return `${fmt.value} ${fmt.unit}`.trim(); }} tick={{ fontSize: 10, fill: axisColor, fontWeight: 500 }} label={unit && unit !== 'B' ? { value: unit.trim(), angle: -90, position: 'insideLeft', offset: 25, style: { textAnchor: 'middle', fill: axisColor, fontSize: 11, fontWeight: 600 } } : undefined} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} allowEscapeViewBox={{ x: true, y: true }} wrapperStyle={{ zIndex: 100 }} />
            {series.map((s, i) => (
              <Bar 
                key={s.key} 
                hide={hiddenSeries?.has(s.key)} 
                name={s.name} 
                dataKey={s.key} 
                fill={getSeriesColor(s)} 
                fillOpacity={0.85}
                stackId={stacked ? "a" : undefined} 
                unit={unit} 
                radius={[4, 4, 0, 0]} 
              />
            ))}
            {refAreaLeft && refAreaRight ? (
              <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="#0ea5e9" fillOpacity={0.1} />
            ) : null}
          </BarChart>
        );
      default:
        return (
          <AreaChart data={displayedData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }} {...dragProps}>
            <defs>
              {series.map((s, i) => {
                const safeId = `gradient-${s.key.replace(/[^a-zA-Z0-9-_]/g, '_')}`;
                return (
                <linearGradient key={s.key} id={safeId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={getSeriesColor(s)} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={getSeriesColor(s)} stopOpacity={0.05}/>
                </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
            <XAxis 
              dataKey="time" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: axisColor, fontWeight: 500 }} 
              tickFormatter={formatXAxis}
              minTickGap={30} 
            />
            <YAxis axisLine={false} tickLine={false} tickFormatter={(tick) => { const fmt = formatValue(tick, unit); return `${fmt.value} ${fmt.unit}`.trim(); }} tick={{ fontSize: 10, fill: axisColor, fontWeight: 500 }} label={unit && unit !== 'B' ? { value: unit.trim(), angle: -90, position: 'insideLeft', offset: 25, style: { textAnchor: 'middle', fill: axisColor, fontSize: 11, fontWeight: 600 } } : undefined} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} allowEscapeViewBox={{ x: true, y: true }} wrapperStyle={{ zIndex: 100 }} />
            {series.map((s, i) => {
              const safeId = `gradient-${s.key.replace(/[^a-zA-Z0-9-_]/g, '_')}`;
              return (
              <Area 
                key={s.key} 
                hide={hiddenSeries?.has(s.key)} 
                name={s.name} 
                type="monotone" 
                dataKey={s.key} 
                stroke={getSeriesColor(s)} 
                stackId={stacked ? "1" : undefined} 
                strokeWidth={2.5} 
                fillOpacity={1} 
                fill={`url(#${safeId})`} 
                unit={unit} 
                animationDuration={1000} 
              />
              );
            })}
            {refAreaLeft && refAreaRight ? (
              <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="#0ea5e9" fillOpacity={0.1} />
            ) : null}
          </AreaChart>
        );
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`bg-white rounded-2xl shadow-sm h-full flex flex-col @container transition-colors duration-300 ${zoomDomain ? 'border-[3px] border-sky-300 ring-2 ring-sky-100 ring-offset-1 p-[13px] @[400px]:p-[21px]' : 'border border-slate-100 p-4 @[400px]:p-6'}`}
    >
      <div className="flex justify-between items-start mb-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between mb-2 gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-1.5 h-5 bg-blue-600 rounded-full shrink-0" />
              <h3 className="text-base @[400px]:text-lg font-semibold text-slate-800 tracking-tight truncate">{title}</h3>
              {stacked && (
                <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium border border-blue-200 shrink-0 hidden @[250px]:flex">Stacked</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 items-center pl-3.5">
            {hosts.map(h => {
              const hostSeries = series.filter(s => s.key.endsWith(`_${h}`));
              const isFiltered = hostSeries.length > 0 && hostSeries.every(s => hiddenSeries?.has(s.key));
              
              return (
              <button 
                key={h} 
                onClick={() => onHostClick?.(h)}
                className={cn(
                  "text-xs px-2 py-0.5 rounded font-medium border transition-colors cursor-pointer",
                  isFiltered 
                    ? "bg-amber-50 text-amber-600 border-amber-200 line-through opacity-70" 
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-slate-200"
                )}
                title={isFiltered ? "Click to show this host globally" : "Click to hide this host globally"}
              >
                {h}
              </button>
            )})}
            {aggregation && aggregation !== 'none' && (
              <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-medium border border-emerald-200">{aggregation}</span>
            )}
          </div>
        </div>
      </div>

      <div className={cn(
        "flex-1 w-full relative min-h-0 flex", 
        chartType === 'pie' ? "flex-col @[450px]:flex-row items-center justify-center gap-3" : "flex-col"
      )}>
        <div className={cn(
          "flex-1 w-full relative select-none cursor-crosshair",
          chartType === 'pie' ? "h-[160px] @[450px]:h-full min-h-[120px]" : "h-full min-h-[100px]"
        )}>
          <div className="absolute inset-0 min-w-0 min-h-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              {renderChart()}
            </ResponsiveContainer>
          </div>
        </div>
        
        {chartType === 'pie' && (
          <div className={cn(
            "shrink-0 min-h-0 bg-white relative z-10",
            "flex flex-row @[450px]:flex-col flex-wrap @[450px]:flex-nowrap justify-center gap-x-3 gap-y-1.5 w-full @[450px]:w-auto @[450px]:min-w-[120px] @[450px]:max-w-[40%] @[450px]:ml-4 max-h-[80px] @[450px]:max-h-[160px] overflow-y-auto px-2 scrollbar-hide" 
          )}>
            {series.map((s, i) => {
              const isHidden = hiddenSeries?.has(s.key);
              return (
                <div 
                  key={s.key} 
                  onClick={() => onLegendClick?.(s.key)} 
                  className={cn(
                    "flex items-center gap-1.5 cursor-pointer text-[10px] font-semibold transition-opacity duration-200 select-none max-w-full min-w-0",
                    isHidden ? "opacity-40 hover:opacity-70" : "opacity-100 hover:opacity-80"
                  )}
                  title={s.name}
                >
                  <div 
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0" 
                    style={{ backgroundColor: isHidden ? '#cbd5e1' : getSeriesColor(s) }} 
                  />
                  <span className={cn("truncate block min-w-0 flex-1", isHidden ? "text-slate-400 line-through" : "text-slate-600")}>
                    {s.name}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        
        {chartType !== 'pie' && (
          <div className="shrink min-h-0 bg-white relative z-10 w-full mb-1 flex flex-wrap gap-x-4 gap-y-1.5 mt-2 max-h-[120px] overflow-y-auto px-1 scrollbar-hide flex-shrink">
              {series.map((s, i) => {
                const isHidden = hiddenSeries?.has(s.key);
                return (
                  <div 
                    key={s.key} 
                    onClick={() => onLegendClick?.(s.key)} 
                    className={cn(
                      "flex items-center gap-1.5 cursor-pointer text-[10px] font-semibold transition-opacity duration-200 select-none max-w-full min-w-0",
                      isHidden ? "opacity-40 hover:opacity-70" : "opacity-100 hover:opacity-80"
                    )}
                    title={s.name}
                  >
                    <div 
                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0" 
                      style={{ backgroundColor: isHidden ? '#cbd5e1' : getSeriesColor(s) }} 
                    />
                    <span className={cn("truncate block min-w-0 flex-1", isHidden ? "text-slate-400 line-through" : "text-slate-600")}>
                      {s.name}
                    </span>
                  </div>
                );
              })}
            </div>
        )}

        {zoomDomain && data && data.length > 0 && (
          <div className="flex items-center gap-2 mt-2 px-2 text-[10px] sm:text-xs">
            <span className="shrink-0 text-slate-500 font-medium hidden sm:inline text-[10px]">Zoom:</span>
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden relative shadow-inner pt">
              <div 
                className="absolute h-full bg-sky-400 rounded-full shadow-sm" 
                style={{ 
                  left: `${Math.max(0, (zoomDomain[0] / data.length) * 100)}%`, 
                  width: `${Math.min(100, ((zoomDomain[1] - zoomDomain[0] + 1) / data.length) * 100)}%` 
                }} 
              />
            </div>
            <span className="shrink-0 text-slate-500 font-medium hidden @[400px]:inline text-[10px]">
              {data[zoomDomain[0]]?.time?.split(' ')[1] || data[zoomDomain[0]]?.time} - {data[zoomDomain[1]]?.time?.split(' ')[1] || data[zoomDomain[1]]?.time}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
