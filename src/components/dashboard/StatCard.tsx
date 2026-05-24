import { motion } from "motion/react";
import { ReactNode } from "react";
import { TrendingUp, TrendingDown, Clock } from "lucide-react";
import { cn } from "../../lib/utils";

import { Card } from "../ui/Card";

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: number;
  trend?: 'up' | 'down';
  color?: string;
  tooltip?: string;
  timestamp?: string;
}

export function StatCard({ title, value, unit, change, trend, color = "blue", tooltip, timestamp }: StatCardProps) {
  const isPositive = trend === 'up';
  
  return (
    <Card 
      className="p-4 @[300px]:p-5 flex flex-col justify-between relative overflow-hidden group h-full transition-all duration-300 @container flex-1 cancel-drag"
    >
      {/* Header with Title Indicator */}
      <div className="relative z-10 flex flex-col gap-1.5 shrink-0 pr-6 lg:group-hover:pr-10 transition-all duration-300">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 truncate block w-full" title={tooltip || title}>
              {title}
            </span>
          </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 py-4 w-full overflow-hidden">
        {value === '-' ? (
          <div className="flex gap-2 items-center justify-center h-full">
            <motion.div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600" animate={{ backgroundColor: ['#2563eb', '#cbd5e1', '#cbd5e1'], y: [-3, 0, 0] }} transition={{ duration: 1.5, repeat: Infinity, times: [0, 0.2, 1] }} />
            <motion.div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600" animate={{ backgroundColor: ['#cbd5e1', '#2563eb', '#cbd5e1'], y: [0, -3, 0] }} transition={{ duration: 1.5, repeat: Infinity, times: [0, 0.2, 1] }} />
            <motion.div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600" animate={{ backgroundColor: ['#cbd5e1', '#cbd5e1', '#2563eb'], y: [0, 0, -3] }} transition={{ duration: 1.5, repeat: Infinity, times: [0, 0.2, 1] }} />
          </div>
        ) : (
          <div className="flex items-center justify-center w-full max-w-full px-2 gap-4">
            <div className="flex items-baseline min-w-0 justify-center">
                <div className={cn(
                  "font-bold tracking-tight leading-none transition-all duration-300 flex-shrink min-w-0 truncate",
                  color === "red" ? "text-rose-600 dark:text-rose-500" : "text-slate-900 dark:text-slate-100",
                  "text-4xl @[300px]:text-5xl"
                )}>
                  {value}
                  {unit && (
                    <span className="text-xl @[300px]:text-2xl font-medium text-slate-500 dark:text-slate-400 ml-1">{unit.trim()}</span>
                  )}
                </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer Area - Change indicator or Contextual Data */}
      <div className="relative z-10 flex flex-row items-center justify-between pt-1 shrink-0 mt-auto w-full min-w-0 gap-2">
        {timestamp ? (
            <div className="flex items-center gap-1 text-[9px] @[200px]:text-[10px] @[260px]:text-[11px] text-slate-400 dark:text-slate-500 font-medium px-1.5 @[200px]:px-2 py-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-full shrink min-w-0 overflow-hidden">
              <Clock className="w-2.5 h-2.5 @[200px]:w-3 @[200px]:h-3 shrink-0" />
              <span className="truncate min-w-0">{timestamp}</span>
            </div>
        ) : <div />}

        {change !== undefined && (
          <div className="hidden @[240px]:flex flex-col items-end justify-center shrink-0 min-w-0" aria-label="Compared to previous period of same duration">
              <div className={cn(
                "flex items-center gap-1 text-[9px] @[200px]:text-[10px] @[260px]:text-xs font-bold px-1.5 @[200px]:px-2 py-0.5 rounded border shrink-0",
                isPositive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
              )}>
                {isPositive ? <TrendingUp className="w-2.5 h-2.5 @[200px]:w-3 @[200px]:h-3" /> : <TrendingDown className="w-2.5 h-2.5 @[200px]:w-3 @[200px]:h-3" />}
                {Math.abs(change).toFixed(1)}%
              </div>
          </div>
        )}

      </div>
    </Card>
  );
}
