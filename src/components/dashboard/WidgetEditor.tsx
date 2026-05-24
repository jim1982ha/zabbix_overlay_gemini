import React, { useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Settings2, X, ChevronDown, ArrowUpDown, Check } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Widget } from "../../types/zabbix";

export function MultiSelect({ options, selected = [], onChange, label, metricUnitsMap }: { options: string[], selected?: string[], onChange: (val: string[]) => void, label: string, metricUnitsMap: Record<string, string> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPos, setDropdownPos] = useState<{ top: number, left: number, width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const sortedOptions = [...options].sort((a, b) => a.localeCompare(b));
  const filteredOptions = sortedOptions.filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase()));

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    if (isOpen) {
      setDropdownPos(null);
    }
  };

  useLayoutEffect(() => {
    if (isOpen && buttonRef.current) {
      const updatePosition = () => {
        if (!buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        const fitsBelow = window.innerHeight - rect.bottom > 250;
        setDropdownPos({
          top: fitsBelow ? rect.bottom + 8 : Math.max(8, rect.top - 232), 
          left: rect.left,
          width: rect.width
        });
      };
      
      updatePosition();
      
      // Update position on scroll for nested containers
      window.addEventListener('scroll', updatePosition, true);
      return () => window.removeEventListener('scroll', updatePosition, true);
    } else {
      setDropdownPos(null);
    }
  }, [isOpen]);

  return (
    <div className="relative">
      <label className="text-sm font-semibold text-slate-400 block mb-2">{label}</label>
      <button 
        ref={buttonRef}
        onClick={toggleOpen}
        className={cn(
          "w-full bg-slate-50 dark:bg-slate-900/50 text-sm font-medium p-3 sm:p-4 rounded-xl border focus:border-blue-500 dark:focus:border-sky-500 outline-none transition-all flex justify-between items-center group",
          isOpen ? "border-blue-500 dark:border-sky-500 ring-1 ring-blue-500/50 dark:ring-sky-500/50" : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-900 dark:text-white"
        )}
      >
        <span className={cn("truncate font-medium flex-1 text-left", selected.length > 0 ? "text-blue-600 dark:text-sky-400 font-semibold" : "text-slate-400 dark:text-slate-500")}>
           {selected.length > 0 ? selected.map(s => {
             const unit = metricUnitsMap?.[s];
             return unit ? `${s} (${unit})` : s;
           }).join(', ') : 'None selected'}
        </span>
        <ChevronDown className={cn("w-4 h-4 transition-all duration-300 ml-2 shrink-0", isOpen ? "rotate-180 text-blue-500 dark:text-sky-500" : "opacity-30 group-hover:opacity-60 text-slate-400")} />
      </button>
      {isOpen && dropdownPos && typeof window !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[120]" onClick={() => setIsOpen(false)} />
          <div 
            className={cn(
              "fixed z-[130] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-2 max-h-56 overflow-y-auto animate-in fade-in zoom-in-95 duration-200 scrollbar-hide flex flex-col",
              dropdownPos?.top < (buttonRef.current?.getBoundingClientRect().top || 0) ? "origin-bottom" : "origin-top"
            )}
            style={{
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
            }}
          >
            <div className="sticky top-0 bg-white dark:bg-slate-900 pb-2 z-10 p-1 flex flex-col gap-2 border-b border-slate-100 dark:border-slate-800 mb-1">
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="w-full min-w-0 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-950 dark:text-slate-200 text-sm rounded-md px-3 py-2 outline-none focus:border-blue-500 dark:focus:border-sky-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={(e) => { 
                    e.preventDefault(); e.stopPropagation(); 
                    const newSelected = [...new Set([...selected, ...filteredOptions])];
                    onChange(newSelected);
                  }}
                  className="flex-1 px-3 py-1.5 text-xs font-semibold bg-blue-50 dark:bg-sky-500/10 text-blue-700 dark:text-sky-400 hover:text-blue-800 dark:hover:text-sky-300 rounded-md hover:bg-blue-100 dark:hover:bg-sky-500/20 border border-blue-200 dark:border-sky-500/30 transition-all whitespace-nowrap text-center"
                >
                  Select All
                </button>
                <button
                  onClick={(e) => { 
                    e.preventDefault(); e.stopPropagation(); 
                    const newSelected = selected.filter(s => !filteredOptions.includes(s));
                    onChange(newSelected);
                  }}
                  className="flex-1 px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all whitespace-nowrap opacity-75 hover:opacity-100 text-center"
                >
                  Deselect All
                </button>
              </div>
            </div>
            {filteredOptions.length === 0 && <div className="text-xs text-slate-500 text-center py-4">No results</div>}
            {filteredOptions.slice(0, 100).map((opt, i) => {
              const unit = metricUnitsMap?.[opt];
              return (
                <label 
                  key={opt} 
                  className={cn(
                    "flex items-center gap-3 p-2.5 rounded-md cursor-pointer group transition-all",
                    selected.includes(opt) ? "bg-blue-50 dark:bg-sky-500/10 hover:bg-blue-100 dark:hover:bg-sky-500/20" : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                  )}
                >
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      checked={selected.includes(opt)}
                      onChange={(e) => {
                        const next = e.target.checked ? [...selected, opt] : selected.filter(s => s !== opt);
                        onChange(next);
                      }}
                      className="w-4 h-4 rounded-md bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-600 text-blue-600 dark:text-sky-500 focus:ring-0 transition-all cursor-pointer appearance-none border checked:bg-blue-600 dark:checked:bg-sky-500 checked:border-blue-500 dark:checked:border-sky-400"
                    />
                    {selected.includes(opt) && <Check className="absolute w-3 h-3 text-white pointer-events-none" />}
                  </div>
                  <span className={cn(
                    "text-sm font-medium transition-colors text-left",
                    selected.includes(opt) ? "text-blue-600 dark:text-sky-400" : "text-slate-700 dark:text-slate-300 group-hover:text-slate-950 dark:group-hover:text-slate-100"
                  )}>
                    {opt} {unit && <span className="opacity-50 text-xs ml-1">({unit})</span>}
                  </span>
                </label>
              );
            })}
            {filteredOptions.length > 100 && (
              <div className="text-xs text-slate-500 text-center py-2 mt-1 border-t border-slate-150 dark:border-slate-800">
                Showing 100 of {filteredOptions.length} results. Use search to refine.
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

interface WidgetEditorProps {
  widget: Widget;
  isDemo: boolean;
  availableMetrics: string[];
  availableHosts: string[];
  hostMetricsMap: Record<string, string[]>;
  metricUnitsMap: Record<string, string>;
  handleCancelEdit: () => void;
  handleUpdateWidget: (id: string, updates: Partial<Widget>) => void;
  setEditingWidgetId: (id: string | null) => void;
}

export function WidgetEditor({
  widget: w,
  isDemo,
  availableMetrics,
  availableHosts,
  hostMetricsMap,
  metricUnitsMap,
  handleCancelEdit,
  handleUpdateWidget,
  setEditingWidgetId
}: WidgetEditorProps) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={handleCancelEdit} />
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-10 shadow-2xl rounded-xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 sm:mb-10">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <Settings2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white tracking-tight truncate">Widget Configuration</h4>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 truncate">ID: {w.id}</p>
            </div>
          </div>
          <button onClick={handleCancelEdit} className="p-2 sm:p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors shrink-0">
            <X className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 hover:text-slate-900 dark:hover:text-white" />
          </button>
        </div>

        <div className="space-y-8 sm:space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12">
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-semibold text-slate-400 block">Title</label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer select-none transition-colors">
                    <input 
                      type="checkbox" 
                      checked={!!w.forceNewline} 
                      onChange={e => handleUpdateWidget(w.id, { forceNewline: e.target.checked })} 
                      className="w-3.5 h-3.5 rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-blue-600 dark:text-sky-500 focus:ring-blue-500/20 dark:focus:ring-sky-500/20" 
                    /> 
                    Force New Line
                  </label>
                </div>
                <input 
                  type="text" 
                  value={w.title} 
                  onChange={e => handleUpdateWidget(w.id, { title: e.target.value })} 
                  className={cn(
                    "w-full bg-slate-50 dark:bg-slate-900/50 text-sm font-medium p-3 sm:p-4 rounded-xl border outline-none transition-all shadow-inner text-slate-900 dark:text-white",
                    !w.title.trim() ? "border-rose-500/50 focus:border-rose-500" : "border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-sky-500"
                  )} 
                  placeholder="Widget Title"
                />
                {!w.title.trim() && (
                  <p className="text-[10px] text-rose-500 font-semibold mt-1.5 uppercase tracking-wider animate-in fade-in slide-in-from-top-1">
                    Identification Label Required
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {w.type === 'chart' && (
                  <div>
                    <label className="text-sm font-semibold text-slate-400 block mb-2">Visualization</label>
                    <select 
                      value={w.chartType} 
                      onChange={e => handleUpdateWidget(w.id, { chartType: e.target.value as any })} 
                      className="w-full bg-slate-50 dark:bg-slate-900/50 text-sm font-medium p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-sky-500 outline-none transition-all text-slate-900 dark:text-white"
                    >
                      <option value="area">Area Map</option>
                      <option value="line">Line Chart</option>
                      <option value="bar">Bar Chart</option>
                      <option value="pie">Pie Chart</option>
                      <option value="mixed">Mixed (Dual Axis)</option>
                    </select>
                  </div>
                )}

                {w.chartType !== 'mixed' && (
                  <div>
                    <label className="text-sm font-semibold text-slate-400 block mb-2">Aggregation</label>
                    <select 
                      value={w.type === 'kpi' && w.aggregation === 'none' ? 'avg' : w.aggregation} 
                      onChange={e => handleUpdateWidget(w.id, { aggregation: e.target.value as any })} 
                      className="w-full bg-slate-50 dark:bg-slate-900/50 text-sm font-medium p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-sky-500 outline-none transition-all text-slate-900 dark:text-white"
                    >
                      {w.type !== 'kpi' && <option value="none">Detailed Multi-Series</option>}
                      <option value="sum">Sum</option>
                      <option value="avg">Average</option>
                    </select>
                  </div>
                )}
              </div>

              {w.type === 'chart' && w.chartType !== 'mixed' && (
                <div>
                  <label className="text-sm font-semibold text-slate-400 block mb-2">Display Mode</label>
                  <label className="flex items-center gap-3 sm:gap-4 w-full bg-slate-50 dark:bg-slate-900/50 text-sm font-medium p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 focus-within:border-blue-500 dark:focus-within:border-sky-500 outline-none transition-all text-slate-800 dark:text-white cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={w.stacked} 
                      onChange={e => handleUpdateWidget(w.id, { stacked: e.target.checked })} 
                      className="w-4 h-4 sm:w-5 sm:h-5 rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-blue-600 dark:text-sky-500 focus:ring-blue-500/20 dark:focus:ring-sky-500/20" 
                    /> 
                    Stack Series
                  </label>
                </div>
              )}
            </div>

            {w.chartType !== 'mixed' && (
              <div className="space-y-6">
                <MultiSelect 
                  label="Hostname" 
                  options={availableHosts} 
                  selected={w.hosts} 
                  onChange={(h) => handleUpdateWidget(w.id, { hosts: h })} 
                  metricUnitsMap={{}}
                />

                {(() => {
                  let optionsForWidget = isDemo ? availableMetrics : [];
                  const wHosts = w.hosts || [];
                  if (!isDemo) {
                    if (wHosts.length === 0) {
                      optionsForWidget = availableMetrics;
                    } else {
                      const metricItems = new Set<string>();
                      wHosts.forEach(h => {
                        const m = hostMetricsMap[h];
                        if (m) m.forEach(x => metricItems.add(x));
                      });
                      optionsForWidget = Array.from(metricItems);
                    }
                  }
                  return (
                    <div className="space-y-6">
                      <MultiSelect 
                        label="Telemetry Metric Stream" 
                        options={(!isDemo && wHosts.length > 0) ? optionsForWidget : availableMetrics} 
                        selected={w.metrics || []} 
                        onChange={(m) => handleUpdateWidget(w.id, { metrics: m })} 
                        metricUnitsMap={metricUnitsMap}
                      />
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {w.chartType === 'mixed' && (
            <div className="mt-8 space-y-6">
              <h5 className="text-sm font-semibold text-slate-400">Series Configuration (Max 2 metrics for Mixed)</h5>
              <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 flex flex-col gap-6 relative">
                 {['series1', 'series2'].map((seriesKey, idx) => {
                  const sConf = w.seriesConfig?.[seriesKey] || { metric: availableMetrics[0] || '', host: availableHosts[0] || 'all', chartType: 'line', aggregation: 'none', stacked: false };
                  
                  return (
                    <React.Fragment key={seriesKey}>
                      {idx === 1 && (
                        <div className="flex justify-center relative z-10 w-full my-6">
                          <div className="absolute inset-x-0 h-[1px] bg-slate-200 dark:bg-slate-800 top-1/2 -translate-y-1/2 -mx-6 sm:-mx-8" />
                          <button
                            type="button"
                            onClick={() => {
                              const prevSeries1 = w.seriesConfig?.['series1'] || { metric: availableMetrics[0] || '', host: availableHosts[0] || 'all', chartType: 'line', aggregation: 'none', stacked: false };
                              const prevSeries2 = w.seriesConfig?.['series2'] || { metric: availableMetrics[0] || '', host: availableHosts[0] || 'all', chartType: 'line', aggregation: 'none', stacked: false };
                              const allMetrics = Array.from(new Set([...(prevSeries2.metrics || (prevSeries2.metric ? [prevSeries2.metric] : [])), ...(prevSeries1.metrics || (prevSeries1.metric ? [prevSeries1.metric] : []))]));
                              const allHosts = Array.from(new Set([...(prevSeries2.hosts || (prevSeries2.host ? [prevSeries2.host] : [])), ...(prevSeries1.hosts || (prevSeries1.host ? [prevSeries1.host] : []))]));
                              handleUpdateWidget(w.id, { 
                                seriesConfig: { ...w.seriesConfig, series1: prevSeries2, series2: prevSeries1 },
                                metrics: allMetrics,
                                hosts: allHosts
                              });
                            }}
                            className="relative p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all transform hover:scale-110 shadow-md"
                            title="Swap Series"
                          >
                            <ArrowUpDown className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-blue-600 dark:text-sky-400">
                            Serie {idx + 1}{" "}
                            <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1.5 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-200/60 dark:border-slate-700/60">
                              {seriesKey === 'series2' ? 'Secondary (Right Axis)' : 'Primary (Left Axis)'}
                            </span>
                          </span>
                        </div>
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                        <div className="col-span-2 md:col-span-3">
                          <MultiSelect 
                            label="Hosts" 
                            options={['all', ...availableHosts]} 
                            selected={sConf.hosts || (sConf.host ? [sConf.host] : ['all'])}
                            onChange={(hosts) => {
                              const selectedHosts = hosts.length === 0 ? ['all'] : hosts;
                              const newConf = { ...w.seriesConfig, [seriesKey]: { ...sConf, hosts: selectedHosts, host: undefined } };
                              const allMetrics = Array.from(new Set([...(newConf.series1?.metrics || (newConf.series1?.metric ? [newConf.series1.metric] : [])), ...(newConf.series2?.metrics || (newConf.series2?.metric ? [newConf.series2.metric] : []))]));
                              const allHosts = Array.from(new Set([...(newConf.series1?.hosts || (newConf.series1?.host ? [newConf.series1.host] : [])), ...(newConf.series2?.hosts || (newConf.series2?.host ? [newConf.series2.host] : []))]));
                              handleUpdateWidget(w.id, { seriesConfig: newConf, metrics: allMetrics, hosts: allHosts });
                            }}
                            metricUnitsMap={metricUnitsMap}
                          />
                        </div>
                        <div className="col-span-2 md:col-span-3">
                          <MultiSelect 
                            label="Metrics" 
                            options={availableMetrics} 
                            selected={sConf.metrics || (sConf.metric ? [sConf.metric] : (availableMetrics[0] ? [availableMetrics[0]] : []))}
                            onChange={(metrics) => {
                              const newConf = { ...w.seriesConfig, [seriesKey]: { ...sConf, metrics: metrics, metric: undefined } };
                              const allMetrics = Array.from(new Set([...(newConf.series1?.metrics || (newConf.series1?.metric ? [newConf.series1.metric] : [])), ...(newConf.series2?.metrics || (newConf.series2?.metric ? [newConf.series2.metric] : []))]));
                              const allHosts = Array.from(new Set([...(newConf.series1?.hosts || (newConf.series1?.host ? [newConf.series1.host] : [])), ...(newConf.series2?.hosts || (newConf.series2?.host ? [newConf.series2.host] : []))]));
                              handleUpdateWidget(w.id, { seriesConfig: newConf, metrics: allMetrics, hosts: allHosts });
                            }}
                            metricUnitsMap={metricUnitsMap}
                          />
                        </div>
                        <div className="col-span-2 md:col-span-6 flex flex-col sm:flex-row gap-4 mt-2">
                          <div className="flex-1">
                            <label className="text-xs font-semibold text-slate-500 mb-1 block">Visual</label>
                            <div className="relative">
                              <select 
                                value={sConf.chartType} 
                                onChange={(e) => handleUpdateWidget(w.id, { seriesConfig: { ...w.seriesConfig, [seriesKey]: { ...sConf, chartType: e.target.value as any } } })}
                                className="w-full bg-slate-100 dark:bg-slate-900/80 text-xs py-2 pl-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white outline-none appearance-none cursor-pointer focus:border-blue-500 dark:focus:border-sky-500 transition-colors"
                              >
                                <option value="line">Line</option>
                                <option value="area">Area</option>
                                <option value="bar">Bar</option>
                              </select>
                              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                              </div>
                            </div>
                          </div>
                          <div className="flex-1">
                            <label className="text-xs font-semibold text-slate-500 mb-1 block">Aggregation</label>
                            <div className="relative">
                              <select 
                                value={sConf.aggregation} 
                                onChange={(e) => handleUpdateWidget(w.id, { seriesConfig: { ...w.seriesConfig, [seriesKey]: { ...sConf, aggregation: e.target.value as any } } })}
                                className="w-full bg-slate-100 dark:bg-slate-900/80 text-xs py-2 pl-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white outline-none appearance-none cursor-pointer focus:border-blue-500 dark:focus:border-sky-500 transition-colors"
                              >
                                <option value="none">Multi-Series</option>
                                <option value="sum">Sum</option>
                                <option value="avg">Avg</option>
                              </select>
                              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                              </div>
                            </div>
                          </div>
                          <div className="flex-1">
                            <label className="text-xs font-semibold text-slate-500 mb-1 block">Stacking</label>
                            <div className="relative">
                              <select 
                                value={sConf.stacked ? 'true' : 'false'} 
                                onChange={(e) => handleUpdateWidget(w.id, { seriesConfig: { ...w.seriesConfig, [seriesKey]: { ...sConf, stacked: e.target.value === 'true' } } })}
                                className="w-full bg-slate-100 dark:bg-slate-900/80 text-xs py-2 pl-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white outline-none appearance-none cursor-pointer focus:border-blue-500 dark:focus:border-sky-500 transition-colors"
                              >
                                <option value="false">Off</option>
                                <option value="true">On</option>
                              </select>
                              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-6 sm:pt-8 flex flex-col sm:flex-row justify-end gap-3 mt-2">
            <button 
              onClick={handleCancelEdit}
              className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm rounded-lg sm:rounded-xl transition-all border border-slate-200 dark:border-slate-700"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                if (w.title.trim()) {
                  setEditingWidgetId(null);
                }
              }}
              disabled={!w.title.trim()}
              className={cn(
                "w-full sm:w-auto px-8 sm:px-10 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-sm font-semibold transition-all shadow-md active:scale-95",
                !w.title.trim() 
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              )}
            >
              Save configuration
            </button>
          </div>
        </div>
      </div>
    </div>, document.body
  );
}
