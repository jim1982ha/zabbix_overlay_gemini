import React from "react";
import { X } from "lucide-react";
import { TrendChart } from "./TrendChart";
import { Widget } from "../../core/interfaces/dashboard";

interface KpiTrendModalProps {
  widget: Widget;
  chartData: any[];
  chartSeries: any[];
  timestampStr?: string;
  unit: string;
  onClose: () => void;
  hiddenSeries: Set<string>;
  onLegendClick: (key: string) => void;
  onColorChangeRequest: (metric: string, current: string) => void;
  onHostClick: (host: string) => void;
  zoomDomain?: [number, number] | null;
  onZoomDomainChange?: (id: string, domain: [number, number] | null) => void;
}

export function KpiTrendModal({
  widget,
  chartData,
  chartSeries,
  timestampStr,
  unit,
  onClose,
  hiddenSeries,
  onLegendClick,
  onColorChangeRequest,
  onHostClick,
  zoomDomain,
  onZoomDomainChange
}: KpiTrendModalProps) {
  // We want to force chartType to 'area' for KPI trend.
  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-5xl h-[80vh] flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {widget.title} Trend
          </h3>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 rounded-full transition-colors outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 relative min-h-0 overflow-hidden bg-slate-50/50 dark:bg-slate-950/50 flex flex-col">
          <TrendChart 
            title=""
            data={chartData}
            series={chartSeries}
            hosts={widget.hosts}
            aggregation={widget.aggregation}
            chartType="area" // Request specifically wants Area chart type
            stacked={widget.stacked}
            unit={unit}
            hiddenSeries={hiddenSeries}
            onLegendClick={onLegendClick}
            onColorChangeRequest={onColorChangeRequest}
            onHostClick={onHostClick}
            widgetId={`modal-${widget.id}`}
            timestamp={timestampStr}
            zoomDomain={zoomDomain}
            onZoomDomainChange={onZoomDomainChange}
          />
        </div>
      </div>
    </div>
  );
}
