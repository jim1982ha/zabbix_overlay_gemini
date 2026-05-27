import React, { useMemo, useCallback, useState, useRef, useEffect } from "react";
// @ts-ignore
import { ResponsiveGridLayout, Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { 
  Settings2, 
  Trash2, 
  GripVertical,
  BarChart3,
  PlusCircle
} from "lucide-react";
import { useDashboard } from "../../contexts/DashboardContext";
import { Widget } from "../../types/zabbix";
import { StatCard } from "./StatCard";
import { TrendChart } from "./TrendChart";
import { WidgetEditor } from "./WidgetEditor";
import { KpiTrendModal } from "./KpiTrendModal";
import { ErrorBoundary } from "../ErrorBoundary";
import { cn, getDeterministicColor, formatValue, formatTimestampRange, resolveHosts } from "../../lib/utils";
import { LoadingDots } from "../ui/LoadingDots";

interface DashboardGridProps {
  data: any[];
  availableHosts: string[];
  availableMetrics: string[];
  hostMetricsMap: Record<string, string[]>;
  metricUnitsMap: Record<string, string>;
  hiddenSeries: Set<string>;
  toggleSeriesVisibility: (key: string | string[]) => void;
  globalSearch: string;
  isDemo: boolean;
  widgetZoomDomains: Record<string, [number, number] | null>;
  handleUpdateWidgetZoom: (id: string, domain: [number, number] | null) => void;
  handleZoomOut: (id: string) => void;
  widgetDataMapping: Record<string, { chartData: any[], chartSeries: any[] }>;
  setColorPickerTarget: (val: { metric: string, current: string } | null) => void;
  isMobile: boolean;
  isLoading?: boolean;
}

export const DashboardGrid = React.memo(function DashboardGrid({
  data,
  availableHosts,
  availableMetrics,
  hostMetricsMap,
  metricUnitsMap,
  hiddenSeries,
  toggleSeriesVisibility,
  globalSearch,
  isDemo,
  widgetZoomDomains,
  handleUpdateWidgetZoom,
  handleZoomOut,
  widgetDataMapping,
  setColorPickerTarget,
  isMobile,
  isLoading
}: DashboardGridProps) {
  const {
    widgets,
    setWidgets,
    editingWidgetId,
    setEditingWidgetId,
    draggingWidgetId,
    setDraggingWidgetId,
    deleteWidget,
    updateWidget,
    moveWidget,
    addWidget,
    filters
  } = useDashboard();

  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const measure = (source: string) => {
      if (containerRef.current) {
        const rectWidth = containerRef.current.getBoundingClientRect().width;
        const offsetW = containerRef.current.offsetWidth;
        const measuredWidth = rectWidth || offsetW;
        
        // Always ensure we have a valid positive width before rendering to prevent react-grid-layout from breaking
        if (measuredWidth > 10) {
          setContainerWidth((prev) => {
             // Only update if changed by more than 1px to avoid micro-re-renders
             if (prev === null || Math.abs(prev - measuredWidth) > 1) {
                 return measuredWidth;
             }
             return prev;
          });
        }
      }
    };
    
    measure('initial-mount');
    
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        // debounce or wrap in requestAnimationFrame to prevent ResizeObserver loop limit exceeded
        window.requestAnimationFrame(() => measure('resize-observer'));
      }
    });
    
    observer.observe(containerRef.current);
    
    // Fallback resize listener
    const handleResize = () => measure('window-resize');
    window.addEventListener('resize', handleResize);
    
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Cancel edit mode helper
  const handleCancelEdit = () => {
    setEditingWidgetId(null);
  };

  // Render the stats card value for KPI widgets
  const renderKpiWidget = (w: Widget) => {
    let finalValue = null;
    let lastPoint: any = null;
    
    if (data.length > 0) {
      lastPoint = [...data].reverse().find((d: any) => 
        (w.metrics || []).some((m: string) => {
          const hostsToUse = resolveHosts(w.hosts, availableHosts);
          return hostsToUse.some((h: string) => !hiddenSeries.has(`${m}_${h}`) && d[`${m}_${h}`] != null);
        })
      ) || data[data.length - 1];
      
      let values: number[] = [];
      
      (w.metrics || []).forEach(m => {
        const hostsToUse = resolveHosts(w.hosts, availableHosts);
        hostsToUse.forEach(h => {
          const key = `${m}_${h}`;
          if (!hiddenSeries.has(key) && lastPoint[key] != null) {
            values.push(Number(lastPoint[key]));
          }
        });
      });

      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const kpiAgg = w.aggregation === 'none' ? 'avg' : w.aggregation;
        if (kpiAgg === 'avg') finalValue = sum / values.length;
        else if (kpiAgg === 'sum') finalValue = sum;
        else finalValue = sum / values.length;
      }
    }

    const rawUnit = w.metrics && w.metrics[0] ? (metricUnitsMap[w.metrics[0]] || '') : '';
    const { value: fmtValue, unit: fmtUnit } = finalValue !== null ? formatValue(finalValue, rawUnit) : { value: '...', unit: '' };

    let changePct = 0;
    let trendDir: 'up' | 'down' = 'up';

    if (data.length >= 2) {
      const getVal = (point: any) => {
        let values: number[] = [];
        (w.metrics || []).forEach(m => {
          const hostsToUse = resolveHosts(w.hosts, availableHosts);
          hostsToUse.forEach(h => {
            const key = `${m}_${h}`;
            if (!hiddenSeries.has(key) && point[key] != null) {
              values.push(Number(point[key]));
            }
          });
        });
        if (values.length === 0) return 0;
        const sum = values.reduce((a, b) => a + b, 0);
        const kpiAgg = w.aggregation === 'none' ? 'avg' : w.aggregation;
        if (kpiAgg === 'avg') return sum / values.length;
        if (kpiAgg === 'sum') return sum;
        return sum / values.length;
      };

      const prevPoint = data.length >= 2 ? data[data.length - 2] : data[0];
      const prevVal = getVal(prevPoint);
      const lastVal = getVal(lastPoint);
      if (prevVal === 0) changePct = lastVal > 0 ? 100 : 0;
      else changePct = Number((((lastVal - prevVal) / prevVal) * 100).toFixed(1));
      
      trendDir = lastVal >= prevVal ? 'up' : 'down';
    }

    let timestampStr = formatTimestampRange(data, filters.granularity);

    return (
      <StatCard 
        title={w.title} 
        tooltip={(w.metrics || []).map(m => m.toUpperCase()).join(', ')}
        value={fmtValue}
        unit={fmtUnit || (rawUnit === '%' ? '%' : (rawUnit ? ` ${rawUnit}` : ''))}
        change={changePct}
        trend={trendDir}
        color={w.aggregation !== 'none' ? getDeterministicColor('agg_val', w.metrics?.[0]) : (w.metrics?.[0] && w.hosts?.[0] ? getDeterministicColor(`${w.metrics[0]}_${w.hosts[0]}`, w.metrics[0]) : '#0EA5E9')}
        timestamp={timestampStr}
        onClick={() => setKpiModalWidget(w)}
      />
    );
  };

  const handleLegendClick = useCallback((key: string) => toggleSeriesVisibility(key), [toggleSeriesVisibility]);
  
  const handleColorChangeRequest = useCallback((metric: string, current: string) => setColorPickerTarget({ metric, current }), [setColorPickerTarget]);
  
  const handleHostClick = useCallback((host: string) => {
    const keysForHost: string[] = [];
    availableMetrics.forEach(m => {
      keysForHost.push(`${m}_${host}`);
    });
    toggleSeriesVisibility(keysForHost);
  }, [availableMetrics, toggleSeriesVisibility]);

  const handleZoomDomainChange = useCallback((id: string, domain: any) => {
    handleUpdateWidgetZoom(id, domain);
  }, [handleUpdateWidgetZoom]);

  // Render the trend chart visualization
  const renderTrendChart = (w: Widget) => {
    const { chartData = data, chartSeries = [] } = widgetDataMapping[w.id] || {};
    
    let timestampStr = w.chartType === 'pie' ? formatTimestampRange(chartData, filters.granularity) : undefined;

    return (
      <TrendChart 
        title={w.title} 
        data={chartData} 
        series={chartSeries}
        hosts={w.hosts}
        stacked={w.stacked}
        chartType={w.chartType}
        timestamp={timestampStr}
        seriesConfig={w.seriesConfig as any}
        unit={w.metrics && w.metrics[0] && metricUnitsMap[w.metrics[0]] ? (metricUnitsMap[w.metrics[0]] === '%' ? '%' : ` ${metricUnitsMap[w.metrics[0]]}`) : ''} 
        leftUnit={(() => {
           if (w.chartType !== 'mixed' || !w.seriesConfig) return '';
           const s = w.seriesConfig['series1'];
           if (!s) return '';
           const m = s.metrics?.[0] || s.metric;
           return m && metricUnitsMap[m] ? (metricUnitsMap[m] === '%' ? '%' : ` ${metricUnitsMap[m]}`) : '';
        })()}
        rightUnit={(() => {
           if (w.chartType !== 'mixed' || !w.seriesConfig) return '';
           const s = w.seriesConfig['series2'];
           if (!s) return '';
           const m = s.metrics?.[0] || s.metric;
           return m && metricUnitsMap[m] ? (metricUnitsMap[m] === '%' ? '%' : ` ${metricUnitsMap[m]}`) : '';
        })()}
        mode={filters.mode as 'live' | 'historical'}
        granularity={filters.granularity}
        aggregation={w.chartType === 'mixed' ? undefined : w.aggregation}
        hiddenSeries={hiddenSeries}
        onLegendClick={handleLegendClick}
        onColorChangeRequest={handleColorChangeRequest}
        onHostClick={handleHostClick}
        widgetId={w.id}
        zoomDomain={widgetZoomDomains[w.id]}
        onZoomDomainChange={handleZoomDomainChange}
      />
    );
  };

  const filteredWidgets = useMemo(() => {
    return widgets.filter(w => 
      w.title.toLowerCase().includes(globalSearch.toLowerCase()) ||
      (w.metrics && w.metrics.some(m => m.toLowerCase().includes(globalSearch.toLowerCase()))) ||
      (w.hosts && w.hosts.some(h => h.toLowerCase().includes(globalSearch.toLowerCase())))
    );
  }, [widgets, globalSearch]);

  const [currentBreakpoint, setCurrentBreakpoint] = useState<string>('lg');
  const [kpiModalWidget, setKpiModalWidget] = useState<Widget | null>(null);

  const [layouts, setLayouts] = useState<Partial<Record<string, Layout>>>(() => {
    const lg: any = widgets.map(w => ({
      i: w.id,
      x: typeof w.x === 'number' ? w.x : 0,
      y: typeof w.y === 'number' ? w.y : Infinity,
      w: typeof w.w === 'number' ? w.w : (isMobile ? 1 : 12),
      h: typeof w.h === 'number' ? w.h : 10
    }));
    const mobileLayout: any = widgets.map(w => ({
      i: w.id,
      x: 0,
      y: typeof w.y === 'number' ? w.y : Infinity,
      w: 1,
      h: typeof w.h === 'number' ? w.h : 10
    }));
    return { lg, md: lg, sm: lg, xs: mobileLayout, xxs: mobileLayout };
  });

  const prevWidgetIds = React.useRef<string>('');
  
  // Derived state to catch widget changes before render phase completes
  const layoutFingerprint = widgets.map(w => `${w.id}:${w.x}:${w.y}:${w.w}:${w.h}:${w.type}`).join('|');
  if (layoutFingerprint !== prevWidgetIds.current) {
    prevWidgetIds.current = layoutFingerprint;
    const lg: any = widgets.map(w => ({ 
      i: w.id, 
      x: typeof w.x === 'number' ? w.x : 0, 
      y: typeof w.y === 'number' ? w.y : Infinity, 
      w: typeof w.w === 'number' ? w.w : (isMobile ? 1 : 12), 
      h: typeof w.h === 'number' ? w.h : 10 
    }));
    const mobileLayout: any = widgets.map(w => ({ 
      i: w.id, 
      x: 0, 
      y: typeof w.y === 'number' ? w.y : Infinity, 
      w: 1, 
      h: typeof w.h === 'number' ? w.h : 10 
    }));
    setLayouts({ lg, md: lg, sm: lg, xs: mobileLayout, xxs: mobileLayout });
  }

  // Robust boundary-detection, user-interaction tracking, and debouncing setup for layout persistence
  const isUserInteracting = React.useRef(false);
  const interactionTimeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined);
  const layoutChangeTimer = React.useRef<NodeJS.Timeout | undefined>(undefined);

  const startInteraction = useCallback(() => {
    isUserInteracting.current = true;
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
      interactionTimeoutRef.current = undefined;
    }
  }, []);

  const stopInteraction = useCallback(() => {
    if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    interactionTimeoutRef.current = setTimeout(() => {
      isUserInteracting.current = false;
    }, 500);
  }, []);

  React.useEffect(() => {
    return () => {
      if (layoutChangeTimer.current) clearTimeout(layoutChangeTimer.current);
      if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    };
  }, []);

  const handleLayoutChange = (currentLayout: Layout, allLayouts: Partial<Record<string, Layout>>) => {
    setLayouts(allLayouts);
    
    // De-bounce and persist changes back to the canonical widgets store
    if (layoutChangeTimer.current) clearTimeout(layoutChangeTimer.current);

    layoutChangeTimer.current = setTimeout(() => {
      setWidgets(prevWidgets => {
        let changed = false;
        const isMobileBreakpoint = currentBreakpoint === 'xs' || currentBreakpoint === 'xxs';

        const next = prevWidgets.map(w => {
          const item = currentLayout.find((l: any) => l.i === w.id);
          if (item) {
            if (isMobileBreakpoint) {
              // In mobile mode, copy only y and h to prevent resetting desktop width (which is 1 on mobile) and x (which is 0 on mobile)
              if (w.y !== item.y || w.h !== item.h) {
                changed = true;
                return { ...w, y: item.y, h: item.h };
              }
            } else {
              let newW = item.w;
              let newX = item.x;
              
              if (w.x !== newX || w.y !== item.y || w.w !== newW || w.h !== item.h) {
                changed = true;
                return { ...w, x: newX, y: item.y, w: newW, h: item.h };
              }
            }
          }
          return w;
        });
        return changed ? next : prevWidgets;
      });
    }, 150); // Faster reaction, clean debounced writing back
  };

  return (
    <div ref={containerRef} className="w-full relative min-w-0 overflow-x-hidden min-h-[600px]">
      {widgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] w-full bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center animate-in fade-in duration-500">
          <div className="w-16 h-16 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-full flex items-center justify-center shadow-sm mb-4">
            <BarChart3 className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">Your Dashboard is Empty</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            This dashboard doesn't have any widgets yet. Click the button below to add your first visualization and start exploring your data.
          </p>
          <button 
            onClick={() => {
              const newWidget: Widget = {
                id: `widget_${Date.now()}`,
                type: 'chart',
                title: 'New Widget',
                metrics: [],
                hosts: [],
                x: 0,
                y: 0,
                w: 12,
                h: 10,
                chartType: 'line',
                aggregation: 'none',
                stacked: false
              };
              addWidget(newWidget);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-all shadow-blue-500/20 active:scale-95"
          >
            <PlusCircle className="w-5 h-5" />
            Add First Widget
          </button>
        </div>
      ) : filteredWidgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] w-full bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center animate-in fade-in duration-300">
          <div className="w-12 h-12 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-full flex items-center justify-center shadow-sm mb-3">
            <Settings2 className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">No Matching Widgets</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No widgets match your current search query <strong>"{globalSearch}"</strong>. Try checking your spelling or search terms.
          </p>
        </div>
      ) : containerWidth === null ? (
        <div style={{ height: '600px' }} className="w-full flex items-center justify-center bg-slate-50/10 dark:bg-slate-900/10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-slate-400 font-medium">Initializing Dashboard Grid...</span>
          </div>
        </div>
      ) : (
      <ErrorBoundary>
        <ResponsiveGridLayout
            className="layout"
            width={containerWidth}
            layouts={layouts as any}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 24, md: 24, sm: 24, xs: 1, xxs: 1 }}
            rowHeight={isMobile ? 30 : 25}
            onLayoutChange={handleLayoutChange}
            onBreakpointChange={(bp) => {
              setCurrentBreakpoint(bp);
            }}
            onDragStart={startInteraction}
            onDragStop={stopInteraction}
            onResizeStart={startInteraction}
            onResizeStop={stopInteraction}
            dragConfig={{
              enabled: !isMobile,
              handle: ".drag-handle",
              cancel: ".cancel-drag"
            }}
            resizeConfig={{
              enabled: true,
              handles: ['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne']
            }}
          >
          {filteredWidgets.map((w, index) => {
          let hasFilter = false;
        if (w.chartType === 'mixed' && w.seriesConfig) {
          ['series1', 'series2'].forEach(sKey => {
            const sConf = w.seriesConfig?.[sKey];
            if (!sConf) return;
            const smetrics = sConf.metrics || (sConf.metric ? [sConf.metric] : []);
            const shosts = sConf.hosts || (sConf.host ? [sConf.host] : []);
            const aggType = sConf.aggregation || 'none';
            if (aggType !== 'none') {
              if (hiddenSeries.has(`${sKey}_agg`)) hasFilter = true;
            }
            smetrics.forEach((m: string) => {
              const hostsToUse = resolveHosts(shosts, availableHosts);
              hostsToUse.forEach((h: string) => {
                const key = `${m}_${h}`;
                const hasDataForSeries = data.some((point: any) => point[key] != null);
                if (hasDataForSeries && hiddenSeries.has(key)) hasFilter = true;
              });
            });
          });
        } else if (w.type === 'kpi') {
          const hostsToUse = resolveHosts(w.hosts, availableHosts);
          (w.metrics || []).forEach((m: string) => {
            hostsToUse.forEach((h: string) => {
              const key = `${m}_${h}`;
              if (hiddenSeries.has(key)) hasFilter = true;
            });
          });
        } else {
          if (w.aggregation === 'avg' || w.aggregation === 'sum') {
            if (hiddenSeries.has('agg_val')) hasFilter = true;
          }
          (w.metrics || []).forEach((m: string) => {
            const hostsToUse = resolveHosts(w.hosts, availableHosts);
            hostsToUse.forEach((h: string) => {
              const key = `${m}_${h}`;
              const hasDataForSeries = data.some((point: any) => point[key] != null);
              if (hasDataForSeries && hiddenSeries.has(key)) hasFilter = true;
            });
          });
        }
        
        return (
          <div
            key={w.id}
            data-grid={{ i: w.id, x: w.x ?? 0, y: w.y ?? Infinity, w: w.w ?? 12, h: w.h ?? 10 }}
            className={cn(
              "relative group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 flex flex-col rounded",
              editingWidgetId === w.id ? "z-[100]" : "z-10 hover:z-[60]",
              hasFilter && "ring-2 ring-amber-400/80 ring-offset-2 ring-offset-slate-50"
            )}
          >
            {/* Widget Controls (Top Right Overlay) */}
            <div className="absolute inset-0 z-30 pointer-events-none opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="absolute top-3 right-3 flex flex-col justify-start gap-1.5 items-end pointer-events-auto z-50">
                {/* Edit Button */}
                <button 
                  onClick={() => setEditingWidgetId(editingWidgetId === w.id ? null : w.id)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={cn(
                    "p-1.5 rounded border transition-all shadow-sm h-[26px] w-[26px] flex items-center justify-center shrink-0 cancel-drag",
                    editingWidgetId === w.id ? "bg-blue-600 border-blue-500 text-white" : "bg-white/90 border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-500 hover:text-slate-900"
                  )}
                  title="Edit Widget"
                >
                  <Settings2 className="w-3" />
                </button>

                {/* Drag Handle */}
                {!isMobile && (
                  <div 
                    className="drag-handle flex items-center justify-center p-1.5 bg-white/90 dark:bg-slate-800 dark:border-slate-700 rounded shadow-sm border border-slate-200 text-slate-400 cursor-grab active:cursor-grabbing hover:bg-slate-50 hover:text-slate-600 transition-colors h-[26px] w-[26px] shrink-0 outline-none select-none"
                  >
                    <GripVertical className="w-4 h-4 pointer-events-none" />
                  </div>
                )}

                {/* Remove widget */}
                <button 
                  onClick={() => deleteWidget(w.id)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="p-1.5 bg-rose-500 border border-rose-600 text-white rounded hover:bg-rose-600 shadow-sm transition-all h-[26px] w-[26px] flex items-center justify-center opacity-70 hover:opacity-100 shrink-0 cancel-drag"
                  title="Remove Widget"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

              {/* Widget Body Content */}
              {editingWidgetId === w.id ? (
                <WidgetEditor
                  widget={w}
                  isDemo={isDemo}
                  availableMetrics={availableMetrics}
                  availableHosts={availableHosts}
                  hostMetricsMap={hostMetricsMap}
                  metricUnitsMap={metricUnitsMap}
                  handleCancelEdit={handleCancelEdit}
                  handleUpdateWidget={(id, updates) => updateWidget(id, updates)}
                  setEditingWidgetId={setEditingWidgetId}
                />
              ) : isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[100px] h-full w-full bg-slate-50/10 dark:bg-slate-900/10">
                  <div className="flex flex-col items-center gap-[10px]">
                    <LoadingDots size={3} />
                    <span className="text-[13.8px] font-medium text-slate-500 w-full text-center">Loading data</span>
                  </div>
                </div>
              ) : (
                w.type === 'kpi' ? renderKpiWidget(w) : renderTrendChart(w)
              )}
          </div>
        );
      })}
        </ResponsiveGridLayout>
      </ErrorBoundary>
      )}

      {kpiModalWidget && (
        <KpiTrendModal
          widget={kpiModalWidget}
          onClose={() => setKpiModalWidget(null)}
          chartData={(widgetDataMapping[kpiModalWidget.id]?.chartData || data).map((point: any) => {
            // we will need to aggregate the data because kpi uses aggregations or we can just show the raw series
            let newPoint = { ...point };
            if (kpiModalWidget.aggregation !== 'none') {
               let vals: number[] = [];
               (kpiModalWidget.metrics || []).forEach(m => {
                 const hostsToUse = resolveHosts(kpiModalWidget.hosts, availableHosts);
                 hostsToUse.forEach(h => {
                   const key = `${m}_${h}`;
                   if (!hiddenSeries.has(key) && point[key] != null) vals.push(Number(point[key]));
                 });
               });
               const sum = vals.reduce((a,b)=>a+b, 0);
               newPoint['agg_val'] = (kpiModalWidget.aggregation === 'avg' && vals.length > 0) ? sum / vals.length : sum;
            }
            return newPoint;
          })}
          chartSeries={
            kpiModalWidget.aggregation !== 'none' 
            ? [{ 
                key: 'agg_val', 
                name: kpiModalWidget.aggregation === 'sum' ? 'Aggregate Sum' : 'Aggregate Mean', 
                color: getDeterministicColor('agg_val', kpiModalWidget.metrics?.[0] || 'kpi'),
                metric: kpiModalWidget.metrics?.[0]
              }]
            : (kpiModalWidget.metrics || []).flatMap(m => {
                const hostsToUse = resolveHosts(kpiModalWidget.hosts, availableHosts);
                return hostsToUse.map(h => ({
                  key: `${m}_${h}`,
                  name: `${m.toUpperCase()} [${h}]`,
                  color: getDeterministicColor(`${m}_${h}`, m),
                  metric: m
                }));
            })
          }
          timestampStr={formatTimestampRange(data, filters.granularity)}
          unit={(() => {
             const m = kpiModalWidget.metrics?.[0];
             return m && metricUnitsMap[m] ? (metricUnitsMap[m] === '%' ? '%' : ` ${metricUnitsMap[m]}`) : '';
          })()}
          hiddenSeries={hiddenSeries}
          onLegendClick={handleLegendClick}
          onColorChangeRequest={handleColorChangeRequest}
          onHostClick={handleHostClick}
          zoomDomain={widgetZoomDomains[`modal-${kpiModalWidget.id}`]}
          onZoomDomainChange={handleZoomDomainChange}
        />
      )}
    </div>
  );
});
