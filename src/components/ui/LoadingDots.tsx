import { motion } from "motion/react";

export function LoadingDots({ size = 3 }: { size?: 3 | 4 }) {
  const dotClass = size === 4 ? "w-4 h-4" : "w-3 h-3";
  return (
    <div className={`flex items-center justify-center h-full ${size === 4 ? 'gap-3' : 'gap-2'}`}>
      <motion.div className={`${dotClass} rounded-full bg-slate-300 dark:bg-slate-600`} animate={{ backgroundColor: ['#2563eb', '#cbd5e1', '#cbd5e1'], y: [-3, 0, 0] }} transition={{ duration: 1.5, repeat: Infinity, times: [0, 0.2, 1] }} />
      <motion.div className={`${dotClass} rounded-full bg-slate-300 dark:bg-slate-600`} animate={{ backgroundColor: ['#cbd5e1', '#2563eb', '#cbd5e1'], y: [0, -3, 0] }} transition={{ duration: 1.5, repeat: Infinity, times: [0, 0.2, 1] }} />
      <motion.div className={`${dotClass} rounded-full bg-slate-300 dark:bg-slate-600`} animate={{ backgroundColor: ['#cbd5e1', '#cbd5e1', '#2563eb'], y: [0, 0, -3] }} transition={{ duration: 1.5, repeat: Infinity, times: [0, 0.2, 1] }} />
    </div>
  );
}
