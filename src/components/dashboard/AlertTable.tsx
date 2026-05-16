import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Info, ShieldAlert, Cpu, Network, Database, Search, X, Check, Filter, Zap, RefreshCw } from "lucide-react";
import React, { useState, useMemo } from "react";
import axios from "axios";
import { cn } from "../../lib/utils";

interface Alert {
  id: number;
  host: string;
  issue: string;
  severity: "low" | "medium" | "high";
  time: string;
  type: string;
  acknowledged?: boolean;
  zabbixTriggerId?: string;
}

const initialAlerts: Alert[] = [
  { id: 1, host: "SRV-PROD-01", issue: "High CPU Usage (Above 90%)", severity: "high", time: "12m ago", type: "cpu" },
  { id: 2, host: "SQL-DB-PRIMARY", issue: "Query Latency Spike Detected", severity: "medium", time: "45m ago", type: "db" },
  { id: 3, host: "GATEWAY-02", issue: "Interface Gig1/0/1 flapping", severity: "high", time: "1h ago", type: "network" },
  { id: 4, host: "BACKUP-STORAGE", issue: "Disk space monitoring task error", severity: "low", time: "3h ago", type: "storage" },
  { id: 5, host: "APP-SERVER-CLUSTER", issue: "SSL Certificate expiring soon", severity: "medium", time: "4h ago", type: "security" },
];

export function AlertTable({ mode = 'live', globalSearch = "", zabbixConfig }: { mode?: 'live' | 'historical', globalSearch?: string, zabbixConfig?: { url: string, token: string } }) {
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts);
  const [loading, setLoading] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const isSimulated = !zabbixConfig?.url || !zabbixConfig?.token;

  const fetchZabbixTriggers = React.useCallback(async () => {
    if (isSimulated) return;
    setLoading(true);
    try {
      const response = await axios.post("/api/zabbix", {
        url: zabbixConfig.url,
        token: zabbixConfig.token,
        method: "trigger.get",
        params: {
          output: "extend",
          selectHosts: ["host"],
          monitored: true,
          only_true: true,
          sortfield: "priority",
          sortorder: "DESC",
          expandDescription: true,
          skipDependent: true
        }
      });

      if (response.data.result) {
        const mappedAlerts: Alert[] = response.data.result.map((t: any) => ({
          id: parseInt(t.triggerid),
          host: t.hosts?.[0]?.host || "Unknown",
          issue: t.description,
          severity: t.priority >= 4 ? "high" : t.priority >= 2 ? "medium" : "low",
          time: "Live from Zabbix",
          type: "system",
          acknowledged: t.value === "0", // In Zabbix value 0 means OK, 1 means Problem. But here we want acknowledged state.
          zabbixTriggerId: t.triggerid,
          // Actually Zabbix triggers don't have a simple 'acknowledged' boolean on the trigger itself, 
          // it's on events. But some setups use trigger value or tags.
          // For now, let's assume we fetch problems.
        }));
        setAlerts(mappedAlerts);
      }
    } catch (e) {
      console.error("Failed to fetch Zabbix triggers", e);
    } finally {
      setLoading(false);
    }
  }, [zabbixConfig, isSimulated]);

  React.useEffect(() => {
    fetchZabbixTriggers();
    if (!isSimulated && mode === 'live') {
        const interval = setInterval(fetchZabbixTriggers, 30000);
        return () => clearInterval(interval);
    }
  }, [fetchZabbixTriggers, isSimulated, mode]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      const combinedSearch = (globalSearch || "").toLowerCase();
      const matchesSearch = alert.host.toLowerCase().includes(combinedSearch.trim()) || 
                           alert.issue.toLowerCase().includes(combinedSearch.trim());
      const matchesSeverity = severityFilter === "all" || alert.severity === severityFilter;
      return matchesSearch && matchesSeverity;
    });
  }, [alerts, globalSearch, severityFilter]);

  const handleAcknowledge = async (id: number) => {
    if (isSimulated) {
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: !a.acknowledged } : a));
        return;
    }

    try {
        // Find the alert to get its last event ID if possible
        // For simplicity, we'll try to find the event related to this trigger
        const eventRes = await axios.post("/api/zabbix", {
            url: zabbixConfig.url,
            token: zabbixConfig.token,
            method: "event.get",
            params: {
                output: "extend",
                objectids: id.toString(),
                sortfield: ["clock", "eventid"],
                sortorder: "DESC",
                limit: 1
            }
        });

        const lastEvent = eventRes.data.result?.[0];
        if (lastEvent) {
            await axios.post("/api/zabbix", {
                url: zabbixConfig.url,
                token: zabbixConfig.token,
                method: "event.acknowledge",
                params: {
                    eventids: lastEvent.eventid,
                    action: 6, // Acknowledge + Message
                    message: "Acknowledged via HA Reporting Dashboard"
                }
            });
            fetchZabbixTriggers(); // Refresh state
        } else {
            alert("Could not find event to acknowledge for this trigger.");
        }
    } catch (e) {
        console.error("Zabbix Acknowledge Failed", e);
        alert("Acknowledge failed. Check network or permissions.");
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-[28px] sm:rounded-[32px] shadow-sm overflow-hidden flex flex-col min-h-[600px]">
      <div className="p-6 sm:p-8 border-b border-slate-50 flex flex-col xl:flex-row justify-between items-start xl:items-center bg-slate-50/30 gap-6">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-md transition-all duration-500 shrink-0",
              mode === 'live' ? "bg-rose-50 border border-rose-100" : "bg-blue-50 border border-blue-100"
            )}>
              {loading ? (
                <RefreshCw className={cn("w-5 h-5 sm:w-6 sm:h-6 animate-spin", mode === 'live' ? "text-rose-600" : "text-blue-600")} />
              ) : (
                <ShieldAlert className={cn("w-5 h-5 sm:w-6 sm:h-6", mode === 'live' ? "text-rose-600" : "text-blue-600")} />
              )}
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-slate-800 tracking-tight flex items-center gap-3">
                {mode === 'live' ? "Live System Events" : "Historical Event Archive"}
                {isSimulated && (
                  <span className="text-[10px] sm:text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    Simulation Mode
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {!isSimulated && mode === 'live' && (
                    <span className="flex items-center gap-2">
                        <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Real-time Trigger Stream Active
                    </span>
                )}
                {!isSimulated && mode === 'historical' && (
                    <span className="flex items-center gap-2">
                        Archive view for post-mortem analysis
                    </span>
                )}
                {isSimulated && (
                    <span className="flex items-center gap-2 opacity-70">
                        Using placeholder data for preview
                    </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="w-full xl:w-auto">
            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200 w-full xl:w-96 shadow-inner relative">
              {["all", "low", "medium", "high"].map((sev) => {
                const isActive = severityFilter === sev;
                return (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={cn(
                      "relative flex-1 py-1.5 sm:py-2 rounded-lg text-xs font-semibold capitalize transition-all duration-300 z-10",
                      isActive ? "text-slate-800" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {isActive && (
                        <motion.div 
                            layoutId="sev-pill"
                            className="absolute inset-0 bg-white rounded-lg shadow-sm border border-slate-200"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                    )}
                    <span className="relative z-20">{sev}</span>
                  </button>
                );
              })}
            </div>
          </div>
      </div>
      
      <div className="flex-1 overflow-x-auto custom-scrollbar">
        <table className="w-full text-left min-w-[700px] sm:min-w-[800px]">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
            <tr>
              <th className="px-6 sm:px-8 py-4">Classification</th>
              <th className="px-6 sm:px-8 py-4">Source Node</th>
              <th className="px-6 sm:px-8 py-4">Operational Alert</th>
              <th className="px-6 sm:px-8 py-4">Timestamp</th>
              <th className="px-6 sm:px-8 py-4 text-right">Intervention</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredAlerts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 sm:px-10 py-20 text-center">
                  <div className="flex flex-col items-center gap-4 opacity-40">
                    <Search className="w-10 h-10 sm:w-12 text-slate-200" />
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-300">No signals found matching criteria</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredAlerts.map((alert, idx) => (
                <motion.tr 
                  key={alert.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "hover:bg-slate-50/50 transition-colors group relative",
                    alert.acknowledged && "opacity-40"
                  )}
                >
                  <td className="px-6 sm:px-8 py-4">
                    <div className={cn(
                      "w-fit px-2 sm:px-2.5 py-1 sm:py-1 rounded-md text-[10px] sm:text-xs font-semibold capitalize flex items-center gap-1.5 sm:gap-2 border",
                      alert.severity === "high" ? "bg-rose-50 text-rose-700 border-rose-200" :
                      alert.severity === "medium" ? "bg-amber-50 text-amber-700 border-amber-200" :
                      "bg-blue-50 text-blue-700 border-blue-200"
                    )}>
                      <div className={cn(
                        "w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-pulse",
                        alert.severity === "high" ? "bg-rose-500" :
                        alert.severity === "medium" ? "bg-amber-500" :
                        "bg-blue-500"
                      )} />
                      {alert.severity}
                    </div>
                  </td>
                  <td className="px-6 sm:px-8 py-4">
                    <div className="flex flex-col gap-0.5 sm:gap-1">
                      <span className="text-xs sm:text-sm font-semibold text-slate-800 tracking-tight truncate max-w-[120px] sm:max-w-none">{alert.host}</span>
                      <span className="text-[10px] sm:text-xs text-slate-500 font-medium capitalize">{alert.type}</span>
                    </div>
                  </td>
                  <td className="px-6 sm:px-8 py-4">
                    <div className="flex items-center gap-2">
                      <p className={cn(
                        "text-sm font-medium transition-all max-w-[200px] sm:max-w-md truncate",
                        alert.acknowledged ? "text-slate-400 line-through" : "text-slate-700"
                      )}>{alert.issue}</p>
                      {alert.zabbixTriggerId && (
                        <span 
                          className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200 cursor-help shrink-0"
                          title={`Zabbix Trigger ID: ${alert.zabbixTriggerId}`}
                        >
                          #{alert.zabbixTriggerId}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 sm:px-8 py-4">
                    <div className="flex items-center gap-1.5 sm:gap-2 text-slate-500">
                      <Zap className="w-3.5 h-3.5 text-blue-500/50" />
                      <span className="text-xs sm:text-sm font-medium">{alert.time}</span>
                    </div>
                  </td>
                  <td className="px-6 sm:px-8 py-4 text-right">
                    <button 
                      onClick={() => handleAcknowledge(alert.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-semibold transition-all shadow-sm",
                        alert.acknowledged 
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-blue-600 hover:text-white hover:border-blue-600"
                      )}
                    >
                      {alert.acknowledged ? (
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Acknowledged</span><span className="sm:hidden">Ack</span>
                        </div>
                      ) : (
                        <>
                          <span className="hidden sm:inline">Acknowledge</span>
                          <span className="sm:hidden">Ack</span>
                        </>
                      )}
                    </button>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="p-4 sm:p-5 bg-slate-50/50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0">
        <span className="text-xs font-medium text-slate-500">Active Signals: {alerts.filter(a => !a.acknowledged).length}</span>
        <button 
          onClick={async () => {
            if (isSimulated) {
                setAlerts(prev => prev.map(a => ({...a, acknowledged: true})));
                return;
            }
            if (confirm("Acknowledge ALL current filtered signals?")) {
                for (const alert of filteredAlerts) {
                    if (!alert.acknowledged) {
                        await handleAcknowledge(alert.id);
                    }
                }
            }
          }}
          className="text-[9px] sm:text-[10px] font-bold text-rose-500 hover:text-rose-600 uppercase tracking-widest transition-colors flex items-center gap-2"
        >
          <X className="w-3 h-3" /> Mass Intervention
        </button>
      </div>
    </div>
  );
}
