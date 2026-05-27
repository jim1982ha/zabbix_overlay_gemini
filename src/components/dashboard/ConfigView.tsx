import React, { useState } from "react";
import { Card } from "../ui/Card";
import { Plus, Settings2, Trash2, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";
import { getAllPlugins } from "../../plugins/registry";
import { ConfiguredDataSource } from "../../core/interfaces/plugins";

interface ConfigViewProps {
  dataSources: ConfiguredDataSource[];
  onSaveDataSource: (ds: ConfiguredDataSource) => void;
  onDeleteDataSource: (id: string) => void;
  requiresSecureToken: boolean;
  isDemo: boolean;
}

export const ConfigView: React.FC<ConfigViewProps> = ({
  dataSources,
  onSaveDataSource,
  onDeleteDataSource,
  requiresSecureToken,
  isDemo,
}) => {
  const plugins = getAllPlugins();
  const [selectedPlugin, setSelectedPlugin] = useState<string>(plugins[0]?.id || "");
  const [isAdding, setIsAdding] = useState(false);
  const [editingDs, setEditingDs] = useState<Partial<ConfiguredDataSource> | null>(null);

  const handleStartAdd = () => {
    setIsAdding(true);
    setEditingDs({
      id: `ds-${Date.now()}`,
      pluginId: selectedPlugin,
      name: plugins.find(p => p.id === selectedPlugin)?.name || "New Source",
      config: {}
    });
  };

  const handleSave = () => {
    if (editingDs && editingDs.id && editingDs.pluginId) {
      onSaveDataSource(editingDs as ConfiguredDataSource);
      setIsAdding(false);
      setEditingDs(null);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col items-center py-1 sm:py-2 px-4 sm:px-0">
      <div className="w-full max-w-4xl space-y-6">
        
        <div className="flex items-center justify-end mb-4">
          <button 
            onClick={handleStartAdd}
            disabled={isAdding}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Add Integration
          </button>
        </div>

        {dataSources.length === 0 && !isAdding && (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
             <Settings2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
             <p className="text-slate-500 font-medium">No data sources configured yet.</p>
             <p className="text-slate-400 text-sm mt-1">Add an integration to start visualizing data.</p>
          </div>
        )}

        <AnimatePresence>
          {isAdding && editingDs && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAdding(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                    {dataSources.some(d => d.id === editingDs.id) ? 'Edit Integration' : 'Add Integration'}
                  </h3>
                  <button 
                    onClick={() => setIsAdding(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="p-6">
                  <div className="grid gap-4 mb-2">
                    <div>
                      <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 block mb-1">Plugin Type</label>
                      <select 
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm"
                        value={editingDs.pluginId}
                        onChange={(e) => {
                          const pluginId = e.target.value;
                          const pluginName = plugins.find(p => p.id === pluginId)?.name || "Source";
                          setEditingDs({ ...editingDs, pluginId, name: pluginName, config: {} });
                        }}
                      >
                        {plugins.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 block mb-1">Display Name</label>
                      <input 
                        type="text" 
                        value={editingDs.name || ""} 
                        onChange={e => setEditingDs({...editingDs, name: e.target.value})}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm" 
                        placeholder="e.g. Primary Zabbix Server"
                      />
                    </div>

                    {/* Dynamic plugin global config settings would be injected here if supported by the plugin */}
                    {editingDs.pluginId === 'zabbix-core' && (
                      <>
                        <div className="mt-2">
                          <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 block mb-1">Zabbix URL</label>
                          <input 
                            type="text" 
                            value={editingDs.config?.url || ""} 
                            onChange={e => setEditingDs({...editingDs, config: { ...editingDs.config, url: e.target.value }})}
                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm font-mono" 
                            placeholder="https://your-zabbix.com/zabbix/api_jsonrpc.php"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 block mb-1">API Token</label>
                          <input 
                            type="password" 
                            value={editingDs.config?.token || ""} 
                            onChange={e => setEditingDs({...editingDs, config: { ...editingDs.config, token: e.target.value }})}
                            className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-2 text-sm font-mono" 
                            placeholder="Your secure token..."
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                  <button onClick={() => setIsAdding(false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-sm font-medium transition-colors">Cancel</button>
                  <button onClick={handleSave} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors shadow-sm">Save Config</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dataSources.map(ds => {
            const pluginDef = plugins.find(p => p.id === ds.pluginId);
            return (
              <Card 
                key={ds.id} 
                className="p-5 flex flex-col justify-between cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                onClick={() => {
                  setEditingDs(ds);
                  setIsAdding(true);
                }}
              >
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-slate-800 dark:text-slate-100">{ds.name}</h4>
                      <div className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {pluginDef?.name || "Unknown Plugin"}
                      </div>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteDataSource(ds.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md transition-colors"
                      title="Delete Source"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-4 space-y-1">
                    {/* Basic visual for config settings */}
                    {Object.entries(ds.config || {}).map(([k, v]) => (
                      <div key={k} className="flex items-center text-xs w-full overflow-hidden">
                        <span className="text-slate-500 w-16 shrink-0 truncate">{k}:</span>
                        <span className="text-slate-700 dark:text-slate-300 font-mono truncate bg-slate-50 dark:bg-slate-800 px-1 py-0.5 rounded opacity-70">
                          {k.toLowerCase().includes('token') || k.toLowerCase().includes('pass') ? "••••••••" : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {requiresSecureToken && (
          <Card className="mt-8 p-6 bg-slate-50 dark:bg-slate-900/50">
            <div className="py-2">
              <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-400 mb-2 flex items-center gap-2">
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-lock"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                 Secure Application Access
              </p>
              <p className="text-xs text-indigo-700 dark:text-indigo-300 opacity-90 mb-4">
                 This application requires an access token for proxy routing.
              </p>
              <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 block mb-2">Access Token</label>
              <input 
                type="password" 
                defaultValue=""
                onChange={e => sessionStorage.setItem('hareporting_app_secure_token', e.target.value)}
                placeholder={sessionStorage.getItem('hareporting_app_secure_token') ? "Token is set. Enter a new one to update..." : "Your APP_SECURE_TOKEN..."}
                className="w-full bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 font-mono focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm max-w-md" 
              />
            </div>
          </Card>
        )}

      </div>
    </div>
  );
};

