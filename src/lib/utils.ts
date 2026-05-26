import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
