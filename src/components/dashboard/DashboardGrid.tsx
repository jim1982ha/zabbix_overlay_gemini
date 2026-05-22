import React, { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Settings2, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  GripVertical,
  ZoomOut
} from "lucide-react";
import { useDashboard } from "../../contexts/DashboardContext";
import { Widget } from "../../types/zabbix";
import { StatCard } from "./StatCard";
import { TrendChart } from "./TrendChart";
import { WidgetEditor } from "./WidgetEditor";
import { cn, getDeterministicColor, formatValue } from "../../lib/utils";

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
}

export function DashboardGrid({
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
  isMobile
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
    filters
  } = useDashboard();

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
        w.metrics.some((m: string) => {
          const hostsToUse = w.hosts.includes('all') ? availableHosts : w.hosts;
          return hostsToUse.some((h: string) => !hiddenSeries.has(`${m}_${h}`) && d[`${m}_${h}`] != null);
        })
      ) || data[data.length - 1];
      
      let values: number[] = [];
      
      w.metrics.forEach(m => {
        const hostsToUse = w.hosts.includes('all') ? availableHosts : w.hosts;
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

    const rawUnit = metricUnitsMap[w.metrics[0]] || '';
    const { value: fmtValue, unit: fmtUnit } = finalValue !== null ? formatValue(finalValue, rawUnit, true) : { value: '...', unit: '' };

    let changePct = 0;
    let trendDir: 'up' | 'down' = 'up';

    if (data.length >= 2) {
      const getVal = (point: any) => {
        let values: number[] = [];
        w.metrics.forEach(m => {
          const hostsToUse = w.hosts.includes('all') ? availableHosts : w.hosts;
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

    let timestampStr: string | undefined = undefined;
    if (lastPoint?.time) {
       const d = new Date(lastPoint.time);
       let d2: Date | null = null;
       if (filters.granularity === '1h') d2 = new Date(d.getTime() + 60 * 60 * 1000);
       else if (filters.granularity === '1m') d2 = new Date(d.getTime() + 60 * 1000);
       else if (filters.granularity === '5m') d2 = new Date(d.getTime() + 5 * 60 * 1000);
       else if (filters.granularity === '15m') d2 = new Date(d.getTime() + 15 * 60 * 1000);
       else if (filters.granularity === '30m') d2 = new Date(d.getTime() + 30 * 60 * 1000);
       
       if (d2) {
           timestampStr = `${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${d2.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
       } else if (filters.granularity === '1d') {
           const dNext = new Date(d.getTime() + 24 * 60 * 60 * 1000);
           timestampStr = `${d.toLocaleDateString()} - ${dNext.toLocaleDateString()}`;
       } else {
           timestampStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
       }
    }

    return (
      <StatCard 
        title={w.title} 
        tooltip={w.metrics.map(m => m.toUpperCase()).join(', ')}
        value={fmtValue}
        unit={fmtUnit || (rawUnit === '%' ? '%' : (rawUnit ? ` ${rawUnit}` : ''))}
        change={changePct}
        trend={trendDir}
        color={w.aggregation !== 'none' ? getDeterministicColor('agg_val', w.metrics[0]) : (w.metrics[0] && w.hosts[0] ? getDeterministicColor(`${w.metrics[0]}_${w.hosts[0]}`, w.metrics[0]) : '#0EA5E9')}
        timestamp={timestampStr}
      />
    );
  };

  // Render the trend chart visualization
  const renderTrendChart = (w: Widget) => {
    const { chartData = data, chartSeries = [] } = widgetDataMapping[w.id] || {};
    return (
      <TrendChart 
        title={w.title} 
        data={chartData} 
        series={chartSeries}
        hosts={w.hosts}
        stacked={w.stacked}
        chartType={w.chartType}
        seriesConfig={w.seriesConfig as any}
        unit={metricUnitsMap[w.metrics[0]] ? (metricUnitsMap[w.metrics[0]] === '%' ? '%' : ` ${metricUnitsMap[w.metrics[0]]}`) : ''} 
        leftUnit={(() => {
           if (w.chartType !== 'mixed' || !w.seriesConfig) return '';
           const s1 = w.seriesConfig['series1'];
           const s2 = w.seriesConfig['series2'];
           const s = s1?.yAxis !== 'right' ? s1 : (s2?.yAxis === 'left' ? s2 : null);
           if (!s) return '';
           const m = s.metrics?.[0] || s.metric;
           return m && metricUnitsMap[m] ? (metricUnitsMap[m] === '%' ? '%' : ` ${metricUnitsMap[m]}`) : '';
        })()}
        rightUnit={(() => {
           if (w.chartType !== 'mixed' || !w.seriesConfig) return '';
           const s1 = w.seriesConfig['series1'];
           const s2 = w.seriesConfig['series2'];
           const s = s2?.yAxis !== 'left' ? s2 : (s1?.yAxis === 'right' ? s1 : null);
           if (!s) return '';
           const m = s.metrics?.[0] || s.metric;
           return m && metricUnitsMap[m] ? (metricUnitsMap[m] === '%' ? '%' : ` ${metricUnitsMap[m]}`) : '';
        })()}
        mode={filters.mode as 'live' | 'historical'}
        granularity={filters.granularity}
        aggregation={w.chartType === 'mixed' ? undefined : w.aggregation}
        hiddenSeries={hiddenSeries}
        onLegendClick={(key) => toggleSeriesVisibility(key)}
        onColorChangeRequest={(metric, current) => setColorPickerTarget({ metric, current })}
        onHostClick={(host) => {
          const keysForHost: string[] = [];
          availableMetrics.forEach(m => {
            keysForHost.push(`${m}_${host}`);
          });
          toggleSeriesVisibility(keysForHost);
        }}
        zoomDomain={widgetZoomDomains[w.id]}
        onZoomDomainChange={(domain) => handleUpdateWidgetZoom(w.id, domain)}
      />
    );
  };

  const filteredWidgets = useMemo(() => {
    return widgets.filter(w => 
      w.title.toLowerCase().includes(globalSearch.toLowerCase()) ||
      w.metrics.some(m => m.toLowerCase().includes(globalSearch.toLowerCase())) ||
      w.hosts.some(h => h.toLowerCase().includes(globalSearch.toLowerCase()))
    );
  }, [widgets, globalSearch]);

  return (
    <div 
      className={cn(
        "grid auto-rows-[25px] sm:auto-rows-[30px] lg:auto-rows-[25px]",
        isMobile ? "grid-cols-1 gap-6" : "gap-4"
      )}
      style={!isMobile ? { gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' } : {}}
    >
      <AnimatePresence mode="popLayout">
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
                smetrics.forEach((m: string) => {
                  if (hiddenSeries.has(`${sKey}_${m}_agg`)) hasFilter = true;
                });
              } else {
                smetrics.forEach((m: string) => {
                  const hostsToUse = shosts.includes('all') ? availableHosts : shosts;
                  hostsToUse.forEach((h: string) => {
                    const key = `${m}_${h}`;
                    if (hiddenSeries.has(key)) hasFilter = true;
                  });
                });
              }
            });
          } else if (w.type === 'kpi') {
            const hostsToUse = w.hosts.includes('all') ? availableHosts : w.hosts;
            w.metrics.forEach((m: string) => {
              hostsToUse.forEach((h: string) => {
                const key = `${m}_${h}`;
                if (hiddenSeries.has(key)) hasFilter = true;
              });
            });
          } else if (w.aggregation === 'avg' || w.aggregation === 'sum') {
            if (hiddenSeries.has('agg_val')) hasFilter = true;
          } else {
            w.metrics.forEach((m: string) => {
              const hostsToUse = w.hosts.includes('all') ? availableHosts : w.hosts;
              hostsToUse.forEach((h: string) => {
                const key = `${m}_${h}`;
                const hasDataForSeries = data.some((point: any) => point[key] != null);
                if (hasDataForSeries && hiddenSeries.has(key)) hasFilter = true;
              });
            });
          }
          
          return (
            <motion.div 
              key={w.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{
                layout: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 }
              }}
              data-widget-id={w.id}
              className={cn(
                "relative group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 flex flex-col shadow-sm rounded",
                draggingWidgetId === w.id ? "z-[100] shadow-2xl ring-2 ring-blue-500/50 bg-white cursor-grabbing" :
                editingWidgetId === w.id ? "z-[100]" : "z-10 hover:z-[60]",
                hasFilter && "ring-2 ring-amber-400/80 ring-offset-2 ring-offset-slate-50"
              )}
              style={{ 
                gridRowEnd: isMobile ? (w.type === 'kpi' ? 'span 6' : 'span 12') : `span ${w.rows || 10}`,
                gridColumn: isMobile ? 'span 1' : (w.forceNewline ? `1 / span ${w.cols || 24}` : `span ${w.cols || 24} / span ${w.cols || 24}`)
              }}
            >
              {/* Widget Controls (Top Right Overlay) */}
              <div className={cn(
                "absolute inset-0 z-30 pointer-events-none opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                draggingWidgetId === w.id && "opacity-0"
              )}>
                <div className="absolute top-3 right-3 flex flex-col justify-start gap-1.5 items-end pointer-events-auto z-50">
                  {widgetZoomDomains[w.id] && (
                    <button 
                      onClick={() => handleZoomOut(w.id)}
                      className="flex items-center gap-1.5 px-2 py-1.5 bg-sky-50 text-sky-600 border border-sky-200 hover:bg-sky-100 hover:text-sky-700 hover:border-sky-300 rounded shadow-sm transition-all text-[10px] font-bold uppercase tracking-wider h-[26px]"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3 h-3" />
                      <span className="hidden sm:inline">Reset Zoom</span>
                    </button>
                  )}
                  {/* Edit Button */}
                  <button 
                    onClick={() => setEditingWidgetId(editingWidgetId === w.id ? null : w.id)}
                    className={cn(
                      "p-1.5 rounded border transition-all shadow-sm h-[26px] w-[26px] flex items-center justify-center shrink-0",
                      editingWidgetId === w.id ? "bg-blue-600 border-blue-500 text-white" : "bg-white/90 border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-500 hover:text-slate-900"
                    )}
                    title="Edit Widget"
                  >
                    <Settings2 className="w-3" />
                  </button>

                  {/* Drag Handle */}
                  {!isMobile && (
                    <div 
                      className="flex items-center justify-center p-1.5 bg-white/90 dark:bg-slate-800 dark:border-slate-700 rounded shadow-sm border border-slate-200 text-slate-400 cursor-grab active:cursor-grabbing hover:bg-slate-50 hover:text-slate-600 transition-colors h-[26px] w-[26px] shrink-0 select-none"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if ((e.target as HTMLElement).closest('button')) return;
                        
                        const startX = e.clientX;
                        const startY = e.clientY;
                        let isDragging = false;
                        const dragThreshold = 5;
                        let lastSwapTime = 0;

                        const handleGlobalMouseMove = (moveEvent: MouseEvent) => {
                          const dist = Math.sqrt(Math.pow(moveEvent.clientX - startX, 2) + Math.pow(moveEvent.clientY - startY, 2));
                          
                          if (!isDragging && dist > dragThreshold) {
                            isDragging = true;
                            setDraggingWidgetId(w.id);
                            document.body.style.cursor = 'grabbing';
                          }

                          if (isDragging) {
                            const now = Date.now();
                            if (now - lastSwapTime < 150) return;

                            const elements = document.elementsFromPoint(moveEvent.clientX, moveEvent.clientY);
                            const hoveredWidget = elements.find(el => 
                              el.getAttribute('data-widget-id') && el.getAttribute('data-widget-id') !== w.id
                            );

                            if (hoveredWidget) {
                              const targetId = hoveredWidget.getAttribute('data-widget-id');
                              if (targetId) {
                                lastSwapTime = now;
                                setWidgets(currentWidgets => {
                                  const fromIndex = currentWidgets.findIndex(item => item.id === w.id);
                                  const toIndex = currentWidgets.findIndex(item => item.id === targetId);
                                  
                                  if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
                                    const newWidgets = [...currentWidgets];
                                    const [movedItem] = newWidgets.splice(fromIndex, 1);
                                    newWidgets.splice(toIndex, 0, movedItem);
                                    return newWidgets;
                                  }
                                  return currentWidgets;
                                });
                              }
                            }
                          }
                        };

                        const handleGlobalMouseUp = () => {
                          window.removeEventListener('mousemove', handleGlobalMouseMove);
                          window.removeEventListener('mouseup', handleGlobalMouseUp);
                          setDraggingWidgetId(null);
                          document.body.style.cursor = 'default';
                        };

                        window.addEventListener('mousemove', handleGlobalMouseMove);
                        window.addEventListener('mouseup', handleGlobalMouseUp);
                      }}
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>
                  )}

                  {/* Horizontal shift for accessibility/order */}
                  <div className="flex flex-col bg-white/90 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded overflow-hidden shadow-sm shrink-0 select-none">
                    <button 
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => moveWidget(w.id, 'left')} 
                      className={cn(
                        "p-1.5 hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors border-b border-slate-200/50 flex items-center justify-center",
                        index === 0 && "opacity-20 pointer-events-none"
                      )} 
                      title="Move Left"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => moveWidget(w.id, 'right')} 
                      className={cn(
                        "p-1.5 hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors flex items-center justify-center",
                        index === widgets.length - 1 && "opacity-20 pointer-events-none"
                      )} 
                      title="Move Right"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Remove widget */}
                  <button 
                    onClick={() => deleteWidget(w.id)}
                    className="p-1.5 bg-rose-500 border border-rose-600 text-white rounded hover:bg-rose-600 shadow-sm transition-all h-[26px] w-[26px] flex items-center justify-center opacity-70 hover:opacity-100 shrink-0"
                    title="Remove Widget"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Resize vertical handle */}
                <div 
                  className="hidden sm:flex absolute -top-1 left-6 right-6 h-2 cursor-row-resize pointer-events-auto group/v-resize flex-col items-center justify-center select-none"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const startY = e.clientY;
                    const startRows = w.rows || 10;
                    
                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      const deltaY = startY - moveEvent.clientY; 
                      const rowThreshold = 35;
                      const deltaRows = Math.round(deltaY / rowThreshold);
                      const nextRows = Math.min(20, Math.max(1, startRows + deltaRows));
                      if (nextRows !== w.rows) {
                        updateWidget(w.id, { rows: nextRows });
                      }
                    };
                    
                    const handleMouseUp = () => {
                      window.removeEventListener('mousemove', handleMouseMove);
                      window.removeEventListener('mouseup', handleMouseUp);
                      document.body.style.cursor = 'default';
                    };
                    
                    document.body.style.cursor = 'row-resize';
                    window.addEventListener('mousemove', handleMouseMove);
                    window.addEventListener('mouseup', handleMouseUp);
                  }}
                >
                  <div className="h-1 w-12 bg-sky-500/10 rounded-full group-hover/v-resize:bg-sky-500/60 group-hover/v-resize:w-20 transition-all" />
                </div>

                {/* Resize horizontal handle */}
                <div 
                  className="hidden sm:flex absolute top-6 bottom-6 -right-1 w-2 cursor-col-resize pointer-events-auto group/h-resize items-center justify-center select-none"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const startX = e.clientX;
                    const startCols = w.cols || 24;
                    const gridContainer = (e.currentTarget as HTMLElement).closest('.grid');
                    const availableWidth = gridContainer ? gridContainer.clientWidth : window.innerWidth;
                    const colThreshold = availableWidth / 24;
                    
                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      const deltaX = moveEvent.clientX - startX;
                      const deltaCols = Math.round(deltaX / colThreshold);
                      const nextCols = Math.min(24, Math.max(1, startCols + deltaCols));
                      if (nextCols !== w.cols) {
                        updateWidget(w.id, { cols: nextCols });
                      }
                    };
                    
                    const handleMouseUp = () => {
                      window.removeEventListener('mousemove', handleMouseMove);
                      window.removeEventListener('mouseup', handleMouseUp);
                      document.body.style.cursor = 'default';
                    };
                    
                    document.body.style.cursor = 'col-resize';
                    window.addEventListener('mousemove', handleMouseMove);
                    window.addEventListener('mouseup', handleMouseUp);
                  }}
                >
                  <div className="w-1 h-12 bg-sky-500/10 rounded-full group-hover/h-resize:bg-sky-500/60 group-hover/h-resize:h-20 transition-all" />
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
              ) : (
                w.type === 'kpi' ? renderKpiWidget(w) : renderTrendChart(w)
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
