import React, { useState } from "react";
import { Card } from "../ui/Card";
import { RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils";

interface ConfigViewProps {
  zabbixConfig: { url: string; token: string; isPreconfigured: boolean };
  requiresSecureToken: boolean;
  isDemo: boolean;
  isDiscovering: boolean;
  draftZabbixConfig: { url: string; token: string; isPreconfigured: boolean };
  setDraftZabbixConfig: React.Dispatch<React.SetStateAction<{ url: string; token: string; isPreconfigured: boolean }>>;
  handleSaveZabbixConfig: () => void;
  discoverZabbixAssets: (manual: boolean, config?: { url: string; token: string }) => Promise<void>;
  handleDemoMode: () => void;
  discoveryStatus: { type: 'success' | 'error'; message: string } | null;
}

export const ConfigView: React.FC<ConfigViewProps> = ({
  zabbixConfig,
  requiresSecureToken,
  isDemo,
  isDiscovering,
  draftZabbixConfig,
  setDraftZabbixConfig,
  handleSaveZabbixConfig,
  discoverZabbixAssets,
  handleDemoMode,
  discoveryStatus,
}) => {
  return (
    <div className="w-full flex-1 flex flex-col items-center py-1 sm:py-2">
      <div className="w-full max-w-3xl space-y-6">
        <Card className="p-6 sm:p-8">
          <div className="space-y-6">
            {zabbixConfig.isPreconfigured ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400">
                <p className="font-semibold mb-2 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield-check"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
                  Connected via Server Environment
                </p>
                <p className="text-sm opacity-90">
                  This instance is securely configured via server environment variables. You cannot override the endpoint URL or API token from the UI.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 block mb-2">Zabbix Endpoint</label>
                  <input 
                    type="text" 
                    value={draftZabbixConfig.url} 
                    onChange={e => setDraftZabbixConfig({...draftZabbixConfig, url: e.target.value})}
                    placeholder="https://your-zabbix.com/zabbix/api_jsonrpc.php"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 font-mono focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm" 
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 block mb-2">Zabbix API Token</label>
                  <input 
                    type="password" 
                    value={draftZabbixConfig.token} 
                    onChange={e => setDraftZabbixConfig({...draftZabbixConfig, token: e.target.value})}
                    placeholder="Your Zabbix API Token..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 font-mono focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm" 
                  />
                </div>
              </div>
            )}
            
            {requiresSecureToken && (
              <div className={cn("pt-6 border-t", zabbixConfig.isPreconfigured ? "border-slate-200 dark:border-slate-800" : "border-slate-200 dark:border-slate-800")}>
                <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-400 mb-2 flex items-center gap-2">
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-lock"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                   Secure Application Access
                </p>
                <p className="text-xs text-indigo-700 dark:text-indigo-300 opacity-90 mb-4">
                   This application requires an access token. Ensure this is configured if you intend to trigger a discovery or save your options.
                </p>
                <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 block mb-2">Access Token</label>
                <input 
                  type="password" 
                  defaultValue=""
                  onChange={e => sessionStorage.setItem('hareporting_app_secure_token', e.target.value)}
                  placeholder={sessionStorage.getItem('hareporting_app_secure_token') ? "Token is set. Enter a new one to update..." : "Your APP_SECURE_TOKEN..."}
                  className="w-full bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 font-mono focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all shadow-sm" 
                />
              </div>
            )}
          </div>
          
          <div className={cn("grid gap-4 mt-8", (!isDemo && !zabbixConfig.isPreconfigured) ? "grid-cols-3" : "grid-cols-2")}>
            {!zabbixConfig.isPreconfigured && (
              <button 
                onClick={handleSaveZabbixConfig}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-blue-500 transition-all active:scale-95"
              >
                Save Configuration
              </button>
            )}
            <button 
              onClick={async () => {
                if (!zabbixConfig.isPreconfigured) {
                  setDraftZabbixConfig(draftZabbixConfig);
                  await discoverZabbixAssets(true, draftZabbixConfig);
                } else {
                  await discoverZabbixAssets(true);
                }
              }}
              className={cn(
                "w-full py-3 bg-slate-800 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-slate-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              disabled={(!zabbixConfig.isPreconfigured && (!draftZabbixConfig.url || !draftZabbixConfig.token)) || isDiscovering}
            >
              <RefreshCw className={cn("w-4 h-4", isDiscovering && "animate-spin")} /> {isDiscovering ? 'Discovering...' : 'Trigger Discovery'}
            </button>
            {!isDemo && (
              <button 
                onClick={handleDemoMode}
                className={cn(
                  "w-full py-3 bg-rose-100 text-rose-700 rounded-xl font-semibold text-sm shadow-md hover:bg-rose-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                )}
              >
                Switch to DEMO Mode
              </button>
            )}
          </div>
          {discoveryStatus && (
            <div className={cn(
              "p-4 rounded-xl border text-sm font-medium mt-4",
              discoveryStatus.type === 'success' ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
            )}>
              {discoveryStatus.message}
            </div>
          )}
          <p className="text-xs text-slate-500 text-center font-medium mt-6">
            Authentication is handled server-side via the HA Gateway Proxy.
          </p>
          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800/60 flex justify-center">
            <span className="text-xs text-slate-400 font-mono">v1.2.4 (Build: b6d9e8f)</span>
          </div>
        </Card>
      </div>
    </div>
  );
};
