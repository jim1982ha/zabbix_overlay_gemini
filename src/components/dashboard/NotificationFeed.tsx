import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Bell, Activity, Shield, AlertTriangle, CheckCircle, Clock, X, ExternalLink, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import axios from 'axios';
import { FilterBar, FilterButton } from "../ui/FilterBar";
import { STDL_LIST_CARD_CLASS } from "../ui/Card";

interface Notification {
  id: number;
  type: 'alert' | 'security' | 'system';
  title: string;
  description: string;
  eventName?: string;
  time: string;
  duration?: string;
  severity: 'critical' | 'warning' | 'success' | 'info';
  itemId?: string;
  eventId?: string;
  host?: string;
}

export function NotificationFeed({ globalSearch = "", zabbixBaseUrl = "", zabbixConfig, showToast }: { globalSearch?: string, zabbixBaseUrl?: string, zabbixConfig?: { url: string, token: string }, showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void }) {
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info' | 'success'>('all');
  
  const demoNotifications = [
    { id: 1, type: 'alert' as const, title: 'High CPU Latency', description: 'SQL-DB-PRIMARY reporting 92% steal time. Investigating hypervisor load.', time: '2m ago', duration: '2m', severity: 'critical' as const, itemId: '10293', host: 'SQL-DB-PRIMARY' },
    { id: 2, type: 'security' as const, title: 'WAF Signature Update', description: 'Global signatures updated to v4.2.1-stable. 12 new rules applied.', time: '15m ago', duration: '15m', severity: 'info' as const, host: 'EDGE-GW-PROXY' },
    { id: 3, type: 'system' as const, title: 'Backup Completed', description: 'Daily differential backup for NAS-01-BKUP finished successfully.', time: '1h ago', duration: '1h', severity: 'success' as const, host: 'NAS-01-BKUP' },
    { id: 4, type: 'alert' as const, title: 'Port Flap Detected', description: 'GigabitEthernet1/0/12 on SW-01 toggled status 4 times in 60s.', time: '3h ago', duration: '3h 12m', severity: 'warning' as const, itemId: '3392', host: 'SW-CORE-01' },
    { id: 5, type: 'system' as const, title: 'New Dashboard Created', description: 'Executive user "admin" created board "Q3 Hardware Audit".', time: '5h ago', duration: '5h', severity: 'info' as const },
  ];

  const [zabbixNotifications, setZabbixNotifications] = useState<Notification[]>([]);
  const isDemo = !zabbixConfig?.url || !zabbixConfig?.token;

  const fetchZabbixTriggers = useCallback(async () => {
    if (isDemo) return;
    try {
      const response = await axios.post("/api/zabbix", {
        url: zabbixConfig.url,
        token: zabbixConfig.token,
        method: "trigger.get",
        params: {
          output: "extend",
          selectHosts: ["host", "name"],
          selectLastEvent: "extend",
          expandDescription: true,
          monitored: true,
          skipDependent: true,
          only_true: true,
          limit: 100,
          sortfield: "lastchange",
          sortorder: "DESC"
        }
      });
      if (response.data.error) {
         console.error("Zabbix API Error:", response.data.error);
         if (showToast) showToast(`Zabbix Error: ${response.data.error.data || response.data.error.message}`, "error");
         return;
      }
      if (response.data.result) {
        const mapped = response.data.result.map((t: any) => {
          let severity: 'info' | 'warning' | 'critical' | 'success' = 'info';
          if (t.priority > 3) severity = 'critical';
          else if (t.priority > 1) severity = 'warning';
          
          const durationSeconds = Math.floor(Date.now() / 1000) - parseInt(t.lastchange, 10);
          let durationStr = '';
          if (durationSeconds < 60) durationStr = `${durationSeconds}s`;
          else if (durationSeconds < 3600) durationStr = `${Math.floor(durationSeconds / 60)}m`;
          else if (durationSeconds < 86400) durationStr = `${Math.floor(durationSeconds / 3600)}h ${Math.floor((durationSeconds % 3600) / 60)}m`;
          else durationStr = `${Math.floor(durationSeconds / 86400)}d ${Math.floor((durationSeconds % 86400) / 3600)}h`;

          let cleanDesc = t.comments || `Trigger active on host: ${t.hosts?.[0]?.host}`;
          if (t.lastEvent?.name) {
              const usedPercentMatch = t.lastEvent.name.match(/used > (\d+(?:\.\d+)?)%/);
              if (usedPercentMatch) {
                  cleanDesc = cleanDesc.replace(/\{\$[^:]+?MAX\.(?:WARN|CRIT)[^\}]*\}/g, usedPercentMatch[1]);
              }
          }
          cleanDesc = cleanDesc.replace(/\{\$[A-Z0-9_\.]+(?::[^}]+)?\}/g, "configured");

          return {
             id: parseInt(t.triggerid, 10),
             type: 'alert',
             title: t.lastEvent?.name || t.description,
             description: cleanDesc,
             eventName: t.lastEvent?.name,
             time: new Date(parseInt(t.lastchange, 10) * 1000).toLocaleTimeString(),
             duration: durationStr,
             severity,
             itemId: t.triggerid,
             eventId: t.lastEvent?.eventid,
             host: t.hosts?.[0]?.host
          };
        });
        setZabbixNotifications(mapped);
      }
    } catch (e) {
      console.error("Failed to fetch triggers from Zabbix", e);
    }
  }, [zabbixConfig, isDemo]);

  useEffect(() => {
    fetchZabbixTriggers();
  }, [fetchZabbixTriggers]);

  const [notificationsList, setNotificationsList] = useState<Notification[]>([]);

  useEffect(() => {
    setNotificationsList(isDemo ? demoNotifications : zabbixNotifications);
  }, [isDemo, zabbixNotifications]); // Only recompute on these dependencies

  const filteredNotifications = useMemo(() => {
    return notificationsList.filter(n => {
      const search = (globalSearch || "").toLowerCase();
      const matchSearch = n.title.toLowerCase().includes(search) || 
             n.description.toLowerCase().includes(search) ||
             (n.eventName && n.eventName.toLowerCase().includes(search)) ||
             n.host?.toLowerCase().includes(search);
      const matchSeverity = severityFilter === 'all' || n.severity === severityFilter;
      return matchSearch && matchSeverity;
    });
  }, [globalSearch, notificationsList, severityFilter]);

  const handleDismiss = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotificationsList(prev => prev.filter(n => n.id !== id));
  };

  const getZabbixUrl = (n: Notification) => {
    if (!zabbixBaseUrl) return null;
    if (n.type === 'alert' && n.itemId) {
        if (n.eventId) {
            return `${zabbixBaseUrl}/tr_events.php?triggerid=${n.itemId}&eventid=${n.eventId}`;
        }
        // Assume it's a trigger ID for alerts
        return `${zabbixBaseUrl}/zabbix.php?action=problem.view&filter_triggerids[]=${n.itemId}&filter_set=1`;
    }
    return zabbixBaseUrl;
  };

  const counts = useMemo(() => {
    const res = { all: 0, critical: 0, warning: 0, info: 0, success: 0 };
    notificationsList.forEach(n => {
      res.all++;
      if (n.severity in res) {
        res[n.severity as keyof typeof res]++;
      }
    });
    return res;
  }, [notificationsList]);

  return (
    <div className="space-y-6">
      <FilterBar>
        <div className="flex gap-2 flex-1 overflow-x-auto scrollbar-hide scroll-smooth pb-1 sm:pb-0">
          <FilterButton 
            onClick={() => setSeverityFilter('all')}
            active={severityFilter === 'all'}
            activeVariant="slate"
            badge={counts.all}
          >
            All
          </FilterButton>
          <FilterButton 
            onClick={() => setSeverityFilter('critical')}
            active={severityFilter === 'critical'}
            activeVariant="rose"
            badge={counts.critical}
          >
            Critical
          </FilterButton>
          <FilterButton 
            onClick={() => setSeverityFilter('warning')}
            active={severityFilter === 'warning'}
            activeVariant="amber"
            badge={counts.warning}
          >
            Warning
          </FilterButton>
          <FilterButton 
            onClick={() => setSeverityFilter('info')}
            active={severityFilter === 'info'}
            activeVariant="blue"
            badge={counts.info}
          >
            Info
          </FilterButton>
          <FilterButton 
            onClick={() => setSeverityFilter('success')}
            active={severityFilter === 'success'}
            activeVariant="emerald"
            badge={counts.success}
          >
            Success
          </FilterButton>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-auto">
            {globalSearch && (
                <span className="text-xs text-slate-500 font-semibold px-3 py-1.5 flex items-center">
                    Filtering for: "{globalSearch}"
                </span>
            )}
        </div>
      </FilterBar>

      <div className="space-y-4">
        {filteredNotifications.length === 0 ? (
            <div className="py-20 text-center bg-slate-50 border border-slate-200 border-dashed">
                <Bell className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-sm font-semibold text-slate-500">No notifications matching criteria</p>
            </div>
        ) : filteredNotifications.map((n, i) => (
          <div 
            key={n.id}
            onClick={() => setSelectedNotification(n)}
            className={cn(STDL_LIST_CARD_CLASS, "p-5 flex gap-5 hover:border-blue-300 dark:hover:border-blue-800/40 cursor-pointer")}
          >
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
              n.severity === 'critical' ? "bg-rose-50 text-rose-600 border border-rose-100" :
              n.severity === 'warning' ? "bg-amber-50 text-amber-600 border border-amber-100" :
              n.severity === 'success' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
              "bg-blue-50 text-blue-600 border border-blue-100"
            )}>
              {n.type === 'alert' ? <AlertTriangle className="w-5 h-5" /> :
               n.type === 'security' ? <Shield className="w-5 h-5" /> :
                n.type === 'system' && n.severity === 'success' ? <CheckCircle className="w-5 h-5" /> :
                <Activity className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3">
                  <h4 className="text-base font-semibold text-slate-900">{n.title}</h4>
                  {n.host && (
                    <span className="text-[11px] uppercase tracking-wide font-bold text-blue-600 border border-blue-200 px-2 py-0.5 rounded-md bg-blue-50">
                      {n.host}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 shrink-0">
                  <Clock className="w-3 h-3" />
                  {n.duration || n.time}
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium line-clamp-1">{n.description}</p>
            </div>
            <div className="flex flex-col justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <button 
                  onClick={(e) => handleDismiss(n.id, e)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 text-slate-500 hover:text-rose-600 flex items-center justify-center transition-all"
                >
                  <X className="w-4 h-4" />
               </button>
            </div>
          </div>
        ))}
      </div>

      {/* Drill-down Modal */}
      <>
        {selectedNotification && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div 
                    onClick={() => setSelectedNotification(null)}
                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
                />
                <div 
                    className="relative w-full max-w-lg bg-white border border-slate-200 overflow-hidden shadow-2xl"
                >
                    <div className={cn(
                        "h-2",
                        selectedNotification.severity === 'critical' ? "bg-rose-500" :
                        selectedNotification.severity === 'warning' ? "bg-amber-500" :
                        selectedNotification.severity === 'success' ? "bg-emerald-500" : "bg-blue-500"
                    )} />
                    
                    <div className="p-8">
                        <div className="flex justify-between items-start mb-8">
                            <div className={cn(
                                "w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm border",
                                selectedNotification.severity === 'critical' ? "bg-rose-50 text-rose-600 border-rose-100" :
                                selectedNotification.severity === 'warning' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                "bg-blue-50 text-blue-600 border-blue-100"
                            )}>
                                {selectedNotification.type === 'alert' ? <AlertTriangle className="w-7 h-7" /> : <Shield className="w-7 h-7" />}
                            </div>
                            <button 
                                onClick={() => setSelectedNotification(null)}
                                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={cn(
                                        "px-2.5 py-1 rounded-md text-xs font-semibold capitalize border",
                                        selectedNotification.severity === 'critical' ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-slate-100 text-slate-600 border-slate-200"
                                    )}>
                                        {selectedNotification.severity}
                                    </span>
                                    <span className="text-xs font-medium text-slate-500">{selectedNotification.time}</span>
                                </div>
                                <h3 className="text-2xl font-semibold text-slate-900 tracking-tight leading-tight">
                                    {selectedNotification.title}
                                </h3>
                            </div>

                            <div className="p-4 bg-slate-50 border border-slate-200">
                                <p className="text-sm text-slate-600 font-medium leading-relaxed whitespace-pre-wrap">
                                    {selectedNotification.description}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 border border-slate-200">
                                    <span className="text-xs font-medium text-slate-500 block mb-1">Source Host</span>
                                    <span className="text-sm font-semibold text-slate-900">{selectedNotification.host || 'System Process'}</span>
                                </div>
                                <div className="p-4 bg-slate-50 border border-slate-200">
                                    <span className="text-xs font-medium text-slate-500 block mb-1">Zabbix Item ID</span>
                                    <span className="text-sm font-mono font-medium text-blue-600">{selectedNotification.itemId || 'N/A'}</span>
                                </div>
                            </div>

                            <div className="pt-4 flex flex-col sm:flex-row gap-3">
                                {getZabbixUrl(selectedNotification) ? (
                                    <a 
                                        href={getZabbixUrl(selectedNotification)!}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
                                    >
                                        <ExternalLink className="w-4 h-4" /> Open in Zabbix
                                    </a>
                                ) : (
                                    <button 
                                        onClick={() => {
                                            if (showToast) {
                                                showToast("Zabbix configuration required for drill-down.", "warning");
                                            } else {
                                                alert("Zabbix configuration required for drill-down.");
                                            }
                                        }}
                                        className="flex-1 py-3 bg-slate-100 text-slate-400 rounded-xl font-semibold text-sm transition-all cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        <ExternalLink className="w-4 h-4 opacity-50" /> Open in Zabbix (Locked)
                                    </button>
                                )}
                                <button 
                                    onClick={() => setSelectedNotification(null)}
                                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-all shadow-sm flex items-center justify-center"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </>
    </div>
  );
}
