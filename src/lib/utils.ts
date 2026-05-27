import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function getSeverityClasses(severity: string) {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return "bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40";
    case 'warning':
      return "bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40";
    case 'success':
      return "bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40";
    default:
      return "bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/40";
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getPollingIntervalMs(granularity: string, defaultMs = 300000): number {
  switch (granularity) {
    case '1m': return 60000;
    case '5m': return 300000;
    case '15m': return 900000;
    case '30m': return 1800000;
    case '1h': return 3600000;
    case '1d': return 86400000;
    case 'auto': return defaultMs;
    default: return defaultMs;
  }
}

const hashString = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

export function getDeterministicColor(key: string, baseMetric?: string) {
  try {
    const customColorMap = JSON.parse(localStorage.getItem('ha_metric_colors') || '{}');
    if (customColorMap[key]) return customColorMap[key];
    if (baseMetric && customColorMap[baseMetric]) return customColorMap[baseMetric];
  } catch {
    //
  }

  // Use a highly distinct color palette designed for data visualization
  const BRAND_COLORS = [
    '#3b82f6', // blue-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#ef4444', // red-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#f97316', // orange-500
    '#14b8a6', // teal-500
    '#6366f1', // indigo-500
    '#eab308', // yellow-500
    '#0ea5e9', // sky-500
    '#84cc16'  // lime-500
  ];
  return BRAND_COLORS[hashString(key) % BRAND_COLORS.length];
}

export function updateMetricColor(key: string, color: string) {
  try {
    const customColorMap = JSON.parse(localStorage.getItem('ha_metric_colors') || '{}');
    customColorMap[key] = color;
    localStorage.setItem('ha_metric_colors', JSON.stringify(customColorMap));
    window.dispatchEvent(new Event('ha_color_map_changed'));
  } catch {
    //
  }
}

export function formatTimestampRange(data: any[], granularity: string): string | undefined {
  if (!data || data.length === 0) return undefined;
  
  const firstPoint = data[0];
  const lastPointData = data[data.length - 1];
  
  if (!firstPoint?.time || !lastPointData?.time) return undefined;
  
  const d1 = new Date(firstPoint.time);
  const d2 = new Date(lastPointData.time);
  
  let d2End = new Date(d2.getTime());
  if (granularity === '1h') d2End = new Date(d2.getTime() + 60 * 60 * 1000);
  else if (granularity === '1m') d2End = new Date(d2.getTime() + 60 * 1000);
  else if (granularity === '5m') d2End = new Date(d2.getTime() + 5 * 60 * 1000);
  else if (granularity === '15m') d2End = new Date(d2.getTime() + 15 * 60 * 1000);
  else if (granularity === '30m') d2End = new Date(d2.getTime() + 30 * 60 * 1000);
  else if (granularity === '1d') d2End = new Date(d2.getTime() + 24 * 60 * 60 * 1000);

  if (granularity === '1d') {
      return d1.toLocaleDateString() === d2End.toLocaleDateString() 
          ? d1.toLocaleDateString() 
          : `${d1.toLocaleDateString()} - ${d2End.toLocaleDateString()}`;
  } else {
      if (d1.toLocaleDateString() === d2End.toLocaleDateString()) {
          return `${d1.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${d2End.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else {
          return `${d1.toLocaleDateString()} ${d1.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${d2End.toLocaleDateString()} ${d2End.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
  }
}

export function resolveHosts(hostsParams: string[] | undefined, availableHosts: string[]): string[] {
  return (hostsParams || []).includes('all') ? availableHosts : (hostsParams || []);
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
