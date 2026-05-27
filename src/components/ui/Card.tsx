import React from 'react';
import { cn } from '../../lib/utils';

export function Card({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn(
        "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-none shadow-none",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
