import React, { createContext, useContext, useState } from 'react';
import type { Widget } from '../types/zabbix';

export interface DashboardFilters {
  mode: 'live' | 'historical';
  range: string;
  granularity: '1m' | '5m' | '15m' | '1h' | 'auto';
  start: string;
  end: string;
}

interface DashboardContextType {
  filters: DashboardFilters;
  setFilters: React.Dispatch<React.SetStateAction<DashboardFilters>>;
  widgets: Widget[];
  setWidgets: React.Dispatch<React.SetStateAction<Widget[]>>;
  editingWidgetId: string | null;
  setEditingWidgetId: React.Dispatch<React.SetStateAction<string | null>>;
  draggingWidgetId: string | null;
  setDraggingWidgetId: React.Dispatch<React.SetStateAction<string | null>>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<DashboardFilters>({
    mode: 'live',
    range: '24h',
    granularity: '1h',
    start: new Date(Date.now() - 86400000).toISOString().substring(0, 16),
    end: new Date().toISOString().substring(0, 16)
  });
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [draggingWidgetId, setDraggingWidgetId] = useState<string | null>(null);

  return (
    <DashboardContext.Provider
      value={{
        filters,
        setFilters,
        widgets,
        setWidgets,
        editingWidgetId,
        setEditingWidgetId,
        draggingWidgetId,
        setDraggingWidgetId
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
