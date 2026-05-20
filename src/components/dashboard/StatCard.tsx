import { motion } from "motion/react";
import { ReactNode } from "react";
import { TrendingUp, TrendingDown, Clock } from "lucide-react";
import { cn } from "../../lib/utils";

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
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -2 }}
      className="bg-white border border-slate-100 rounded-2xl p-4 @[300px]:p-5 flex flex-col justify-between relative overflow-hidden group hover:border-sky-200 shadow-sm h-full transition-all duration-300 @container flex-1"
    >
      {/* Header with Title Indicator */}
      <div className="relative z-10 flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center gap-2">
            <div 
              className={cn(
                "w-1 h-3 rounded-full shrink-0",
                !color.startsWith('#') && (
                  color === "blue" ? "bg-blue-600" :
                  color === "green" ? "bg-emerald-600" :
                  color === "red" ? "bg-rose-600" :
                  "bg-amber-600"
                )
              )} 
              style={color.startsWith('#') ? { backgroundColor: color } : {}}
            />
            <span className="text-sm font-semibold text-slate-600 truncate w-full" title={tooltip || title}>
              {title}
            </span>
          </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 py-4 w-full overflow-hidden">
        <div className="flex items-center justify-between w-full max-w-full px-2 gap-4">
          <div className="flex items-baseline min-w-0 justify-center flex-1">
              <div className={cn(
                "font-extrabold tracking-tight leading-none transition-all duration-300 flex-shrink min-w-0 truncate",
                color === "red" ? "text-rose-600" : "text-slate-900",
                "text-[clamp(2rem,15cqw,4.5rem)]"
              )}>
                {value}
              </div>
              {unit && (
                <span className={cn(
                  "font-semibold text-slate-500 ml-2 shrink-0 self-end mb-[0.15em]",
                  "text-[clamp(1rem,8cqw,1.75rem)]"
                )}>
                  {unit}
                </span>
              )}
          </div>
          
          {change !== undefined && (
            <div className="flex flex-col items-start justify-center" aria-label="Compared to previous period of same duration">
                <div className={cn(
                  "flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded border shrink-0 shadow-sm",
                  isPositive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                )}>
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(change).toFixed(1)}%
                </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Footer Area - Change indicator or Contextual Data */}
      <div className="relative z-10 flex items-center justify-between pt-1 shrink-0 mt-auto">
        {timestamp ? (
            <div className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-400 font-medium px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-full shrink-0">
              <Clock className="w-3 h-3" />
              {timestamp}
            </div>
        ) : <div />}

        {change === undefined && (
          <div className="w-1/2 flex flex-col gap-1 px-1 opacity-60 ml-auto">
            <div className={cn(
              "w-full h-1.5 rounded-full overflow-hidden bg-slate-100",
              "group-hover:bg-slate-200 transition-colors"
            )}>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={cn(
                  "h-full rounded-full bg-gradient-to-r",
                  !color.startsWith('#') ? (
                    color === "blue" ? "from-sky-700 to-sky-500" :
                    color === "green" ? "from-emerald-700 to-emerald-500" :
                    color === "red" ? "from-rose-700 to-rose-500" :
                    "from-amber-700 to-amber-500"
                  ) : ""
                )}
                style={color.startsWith('#') ? { background: `linear-gradient(to right, ${color}, ${color}CC)` } : {}}
              />
            </div>
          </div>
        )}
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,0,0,0.01),transparent)] pointer-events-none" />
    </motion.div>
  );
}
