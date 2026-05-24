import React, { createContext, useContext, useState } from 'react';
import type { Widget } from '../types/zabbix';

export interface DashboardFilters {
  mode: 'live' | 'historical';
  range: string;
  granularity: '1m' | '5m' | '15m' | '30m' | '1h' | '1d' | 'auto';
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
  
  // Centralized Actions
  addWidget: (newWidget: Widget) => void;
  deleteWidget: (id: string) => void;
  updateWidget: (id: string, updates: Partial<Widget>) => void;
  moveWidget: (id: string, direction: 'left' | 'right') => void;
  modifyRangeAndGranularity: (updates: Partial<DashboardFilters>) => void;
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

  const addWidget = (newWidget: Widget) => {
    setWidgets(prev => [...prev, newWidget]);
    setEditingWidgetId(newWidget.id);
  };

  const deleteWidget = (id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
    if (editingWidgetId === id) {
      setEditingWidgetId(null);
    }
  };

  const updateWidget = (id: string, updates: Partial<Widget>) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
  };

  const moveWidget = (id: string, direction: 'left' | 'right') => {
    setWidgets(prev => {
      const index = prev.findIndex(w => w.id === id);
      if (index === -1) return prev;
      if ((direction === 'left' && index === 0) || (direction === 'right' && index === prev.length - 1)) return prev;
      const newWidgets = [...prev];
      const targetIndex = direction === 'left' ? index - 1 : index + 1;
      [newWidgets[index], newWidgets[targetIndex]] = [newWidgets[targetIndex], newWidgets[index]];
      return newWidgets;
    });
  };

  const modifyRangeAndGranularity = (updates: Partial<DashboardFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...updates
    }));
  };

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
        setDraggingWidgetId,
        
        addWidget,
        deleteWidget,
        updateWidget,
        moveWidget,
        modifyRangeAndGranularity
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
