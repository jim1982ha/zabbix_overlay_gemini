import React from 'react';
import { cn } from '../../lib/utils';
import { Card } from '../ui/Card';

export function FilterBar({ children, className }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Card className={cn("flex flex-col sm:flex-row items-stretch sm:items-center gap-4 p-2 relative overflow-hidden shadow-none border-slate-200 dark:border-slate-800", className)}>
      {children}
    </Card>
  );
}

interface FilterButtonProps {
  key?: React.Key;
  children: React.ReactNode;
  active: boolean;
  badge?: string | number;
  activeVariant?: 'slate' | 'blue' | 'rose' | 'amber' | 'emerald';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  disabled?: boolean;
}

export function FilterButton({ 
  children, 
  active, 
  badge, 
  activeVariant = 'slate', 
  className, 
  ...props 
}: FilterButtonProps) {
  
  // Base classes following Asset Inventory style
  const baseClass = "px-4 py-2 text-sm font-semibold transition-all rounded-lg whitespace-nowrap flex items-center gap-2 cursor-pointer outline-none select-none";
  
  // Variant colors on active state (without shadow effect!)
  const variantClasses = {
    slate: "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold",
    blue: "bg-blue-600 text-white font-bold",
    rose: "bg-rose-600 text-white font-bold",
    amber: "bg-amber-600 text-white font-bold",
    emerald: "bg-emerald-600 text-white font-bold",
  };
  
  const inactiveClass = "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40";

  // Badge active or inactive classes
  const badgeActiveClasses = {
    slate: "bg-slate-800 dark:bg-slate-700 text-white",
    blue: "bg-blue-500 text-white",
    rose: "bg-rose-500 text-white",
    amber: "bg-amber-500 text-white",
    emerald: "bg-emerald-500 text-white",
  };

  const badgeInactiveClass = "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400";

  return (
    <button
      className={cn(
        baseClass,
        active ? variantClasses[activeVariant] : inactiveClass,
        className
      )}
      {...props}
    >
      {children}
      {badge !== undefined && (
        <span className={cn(
          "px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-colors",
          active ? badgeActiveClasses[activeVariant] : badgeInactiveClass
        )}>
          {badge}
        </span>
      )}
    </button>
  );
}

