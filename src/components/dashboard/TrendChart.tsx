import { 
  AreaChart, 
  Area, 
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { motion } from 'framer-motion';

interface DataPoint {
  time: string;
  [key: string]: any;
}

interface LegendItem {
  key: string;
  name: string;
}

interface TrendChartProps {
  title: string;
  data: DataPoint[];
  series: LegendItem[];
  hosts: string[];
  chartType?: 'area' | 'line' | 'bar' | 'pie';
  stacked?: boolean;
  unit?: string;
  mode?: 'live' | 'historical';
  granularity?: string;
  aggregation?: 'none' | 'sum' | 'avg';
  color?: string;
}

export function TrendChart({ title, data, series, hosts, chartType = 'area', stacked = false, unit, mode = 'live', granularity, aggregation, color }: TrendChartProps) {
  const defaultColors = ['#0284c7', '#4f46e5', '#7c3aed', '#db2777', '#d97706', '#059669'];
  const chartColors = color ? [color, ...defaultColors.filter(c => c !== color)] : defaultColors;

  // For Pie charts, we aggregate the latest values for each series
  const pieData = chartType === 'pie' ? series.map((s, i) => {
    const latest = data[data.length - 1]?.[s.key] || 0;
    return { name: s.name, value: typeof latest === 'number' ? latest : 0, color: chartColors[i % chartColors.length] };
  }) : [];

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
        <div className="bg-white border border-slate-100 rounded-xl shadow-xl p-2.5 max-h-[240px] overflow-y-auto flex flex-col gap-1.5 scrollbar-hide border-l-4 border-l-blue-600 min-w-[200px]">
          {label && (
             <div className="text-xs font-semibold text-slate-500 mb-1 px-1 border-b border-slate-100 pb-1.5">
               {formatXAxis(label)}
             </div>
          )}
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <div key={`item-${index}`} className="flex items-center justify-between gap-4 px-1 py-1 hover:bg-slate-50 rounded-md transition-colors">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color || entry.fill }} />
                  <span className="text-xs font-medium text-slate-600 truncate max-w-[150px]">
                    {entry.name}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-900 whitespace-nowrap">
                  {entry.value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{unit || ''}
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

    switch(chartType) {
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="#fff" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              layout="vertical" 
              align="right" 
              verticalAlign="middle" 
              iconType="circle"
              wrapperStyle={{ paddingLeft: '20px', fontSize: '9px', fontWeight: 600, color: '#64748b' }} 
            />
          </PieChart>
        );
      case 'line':
        return (
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
            <XAxis 
              dataKey="time" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: axisColor, fontWeight: 500 }} 
              tickFormatter={formatXAxis}
              minTickGap={30}
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: axisColor, fontWeight: 500 }} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />
            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ paddingTop: '10px', fontSize: '10px', fontWeight: 600 }} />
            {series.map((s, i) => (
              <Line key={s.key} name={s.name} type="monotone" dataKey={s.key} stroke={chartColors[i % chartColors.length]} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} unit={unit} />
            ))}
          </LineChart>
        );
      case 'bar':
        return (
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
            <XAxis 
              dataKey="time" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: axisColor, fontWeight: 500 }} 
              tickFormatter={formatXAxis}
              minTickGap={30}
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: axisColor, fontWeight: 500 }} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
            <Legend verticalAlign="bottom" height={36} iconType="rect" wrapperStyle={{ paddingTop: '10px', fontSize: '10px', fontWeight: 600 }} />
            {series.map((s, i) => (
              <Bar key={s.key} name={s.name} dataKey={s.key} fill={chartColors[i % chartColors.length]} stackId={stacked ? "a" : undefined} unit={unit} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        );
      default:
        return (
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              {series.map((s, i) => (
                <linearGradient key={s.key} id={`gradient-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors[i % chartColors.length]} stopOpacity={0.15}/>
                  <stop offset="95%" stopColor={chartColors[i % chartColors.length]} stopOpacity={0}/>
                </linearGradient>
              ))}
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
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: axisColor, fontWeight: 500 }} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />
            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ paddingTop: '10px', fontSize: '10px', fontWeight: 600 }} />
            {series.map((s, i) => (
              <Area key={s.key} name={s.name} type="monotone" dataKey={s.key} stroke={chartColors[i % chartColors.length]} stackId={stacked ? "1" : undefined} strokeWidth={2.5} fillOpacity={1} fill={`url(#gradient-${s.key})`} unit={unit} animationDuration={1000} />
            ))}
          </AreaChart>
        );
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white border border-slate-100 p-4 @[400px]:p-6 rounded-2xl shadow-sm h-full flex flex-col @container"
    >
      <div className="flex justify-between items-start mb-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-5 bg-blue-600 rounded-full shrink-0" />
            <h3 className="text-base @[400px]:text-lg font-semibold text-slate-800 tracking-tight truncate flex-1">{title}</h3>
          </div>
          <div className="flex flex-wrap gap-1.5 items-center pl-3.5">
            {hosts.map(h => (
              <span key={h} className="text-xs px-2 py-0.5 bg-slate-50 text-slate-600 rounded font-medium border border-slate-200">{h}</span>
            ))}
            {stacked && (
              <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium border border-blue-200">Stacked</span>
            )}
            {aggregation && aggregation !== 'none' && (
              <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-medium border border-emerald-200">{aggregation}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 w-full relative min-h-0">
        <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}
