import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const hashString = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

export function getDeterministicColor(key: string) {
  const palette = [
    '#0284c7', '#4f46e5', '#7c3aed', '#db2777', '#d97706', '#059669', 
    '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', 
    '#06b6d4', '#ef4444', '#84cc16', '#64748b', '#14b8a6', '#f97316'
  ];
  return palette[hashString(key) % palette.length];
}

export function formatValue(value: number, unit?: string, noUnitString = false): { value: string, unit: string } {
  if (value == null || isNaN(value)) return { value: '...', unit: '' };
  
  const cleanUnit = unit ? unit.trim() : '';
  
  if (cleanUnit === 'B') {
    if (Math.abs(value) < 1024) return { value: Math.round(value).toString(), unit: noUnitString ? '' : 'B' };
    if (Math.abs(value) < 1024 * 1024) return { value: (value / 1024).toFixed(1), unit: noUnitString ? '' : 'KB' };
    if (Math.abs(value) < 1024 * 1024 * 1024) return { value: (value / (1024 * 1024)).toFixed(1), unit: noUnitString ? '' : 'MB' };
    if (Math.abs(value) < 1024 * 1024 * 1024 * 1024) return { value: (value / (1024 * 1024 * 1024)).toFixed(2), unit: noUnitString ? '' : 'GB' };
    return { value: (value / (1024 * 1024 * 1024 * 1024)).toFixed(2), unit: noUnitString ? '' : 'TB' };
  }
  
  const formattedValue = Math.abs(value) >= 1000 ? Math.round(value).toLocaleString() : (value % 1 === 0 ? value.toString() : value.toFixed(1));
  let formattedUnit = cleanUnit ? (cleanUnit === '%' ? '%' : ` ${cleanUnit}`) : '';
  if (noUnitString) formattedUnit = '';

  return { value: formattedValue, unit: formattedUnit.trim() };
}
