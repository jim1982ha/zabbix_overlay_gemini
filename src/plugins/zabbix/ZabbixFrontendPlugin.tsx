import React from 'react';
import { IDataSourceFrontendPlugin, WidgetQueryTarget } from '../../core/interfaces/plugins';

interface ZabbixUiState {
  hostGroup?: string;
  host?: string;
  item?: string;
  itemid?: string;
}

const ZabbixQueryEditor: React.FC<{ target: WidgetQueryTarget, onChange: (t: WidgetQueryTarget) => void }> = ({ target, onChange }) => {
  const state = (target.uiState || {}) as ZabbixUiState;
  
  const updateState = (updates: Partial<ZabbixUiState>) => {
    const newState = { ...state, ...updates };
    onChange({
      ...target,
      uiState: newState,
      semanticPathway: [newState.hostGroup || 'Any', newState.host || 'Any', newState.item || 'Any']
    });
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-slate-50 border border-slate-200 rounded-md">
       <span className="text-sm font-semibold tracking-tight text-slate-700">Zabbix Metric Selection</span>
       <div className="flex gap-2">
         <div className="flex flex-col flex-1 gap-1">
            <label className="text-xs text-slate-500">Host Group</label>
            <input className="px-3 py-1.5 border rounded text-sm outline-none" placeholder="Linux Servers" value={state.hostGroup || ''} onChange={e => updateState({ hostGroup: e.target.value })} />
         </div>
         <div className="flex flex-col flex-1 gap-1">
            <label className="text-xs text-slate-500">Host</label>
            <input className="px-3 py-1.5 border rounded text-sm outline-none" placeholder="Web-01" value={state.host || ''} onChange={e => updateState({ host: e.target.value })} />
         </div>
       </div>
       <div className="flex gap-2">
         <div className="flex flex-col flex-1 gap-1">
            <label className="text-xs text-slate-500">Item Name</label>
            <input className="px-3 py-1.5 border rounded text-sm outline-none" placeholder="CPU utilization" value={state.item || ''} onChange={e => updateState({ item: e.target.value })} />
         </div>
         <div className="flex flex-col flex-1 gap-1">
            <label className="text-xs text-slate-500">Item ID (Hidden/Selected)</label>
            <input className="px-3 py-1.5 border rounded border-slate-300 bg-slate-100 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="e.g. 23341" value={state.itemid || ''} onChange={e => updateState({ itemid: e.target.value })} />
         </div>
       </div>
    </div>
  );
}

export const ZabbixFrontendPlugin: IDataSourceFrontendPlugin = {
  id: 'zabbix-core',
  name: 'Zabbix Enterprise',
  capabilities: {
    supportsTimeseries: true,
    supportsKpi: true,
    supportsTopology: true,
    supportsAlerts: true
  },
  QueryEditorComponent: ZabbixQueryEditor
};
