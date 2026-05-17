import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Activity, Shield, AlertTriangle, CheckCircle, Clock, X, ExternalLink, Zap, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import axios from 'axios';

interface Notification {
  id: number;
  type: 'alert' | 'security' | 'system';
  title: string;
  description: string;
  time: string;
  severity: 'critical' | 'warning' | 'success' | 'info';
  itemId?: string;
  host?: string;
}

export function NotificationFeed({ globalSearch = "", zabbixBaseUrl = "", zabbixConfig }: { globalSearch?: string, zabbixBaseUrl?: string, zabbixConfig?: { url: string, token: string } }) {
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  
  const simNotifications = [
    { id: 1, type: 'alert' as const, title: 'High CPU Latency', description: 'SQL-DB-PRIMARY reporting 92% steal time. Investigating hypervisor load.', time: '2m ago', severity: 'critical' as const, itemId: '10293', host: 'SQL-DB-PRIMARY' },
    { id: 2, type: 'security' as const, title: 'WAF Signature Update', description: 'Global signatures updated to v4.2.1-stable. 12 new rules applied.', time: '15m ago', severity: 'info' as const, host: 'EDGE-GW-PROXY' },
    { id: 3, type: 'system' as const, title: 'Backup Completed', description: 'Daily differential backup for NAS-01-BKUP finished successfully.', time: '1h ago', severity: 'success' as const, host: 'NAS-01-BKUP' },
    { id: 4, type: 'alert' as const, title: 'Port Flap Detected', description: 'GigabitEthernet1/0/12 on SW-01 toggled status 4 times in 60s.', time: '3h ago', severity: 'warning' as const, itemId: '3392', host: 'SW-CORE-01' },
    { id: 5, type: 'system' as const, title: 'New Dashboard Created', description: 'Executive user "admin" created board "Q3 Hardware Audit".', time: '5h ago', severity: 'info' as const },
  ];

  const [zabbixNotifications, setZabbixNotifications] = useState<Notification[]>([]);
  const isSimulated = !zabbixConfig?.url || !zabbixConfig?.token;

  const fetchZabbixTriggers = useCallback(async () => {
    if (isSimulated) return;
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
          skipDependent: true,
          limit: 50,
          sortfield: "lastchange",
          sortorder: "DESC"
        }
      });
      if (response.data.result) {
        const mapped = response.data.result.map((t: any) => {
          let severity: 'info' | 'warning' | 'critical' | 'success' = 'info';
          if (t.priority > 3) severity = 'critical';
          else if (t.priority > 1) severity = 'warning';
          
          return {
             id: parseInt(t.triggerid, 10),
             type: 'alert',
             title: t.description,
             description: `Trigger active on host: ${t.hosts?.[0]?.host}`,
             time: new Date(parseInt(t.lastchange, 10) * 1000).toLocaleTimeString(),
             severity,
             itemId: t.triggerid,
             host: t.hosts?.[0]?.host
          };
        });
        setZabbixNotifications(mapped);
      }
    } catch (e) {
      console.error("Failed to fetch triggers from Zabbix", e);
    }
  }, [zabbixConfig, isSimulated]);

  useEffect(() => {
    fetchZabbixTriggers();
  }, [fetchZabbixTriggers]);

  const [notificationsList, setNotificationsList] = useState<Notification[]>([]);

  useEffect(() => {
    setNotificationsList(isSimulated ? simNotifications : zabbixNotifications);
  }, [isSimulated, zabbixNotifications]); // Only recompute on these dependencies

  const filteredNotifications = useMemo(() => {
    return notificationsList.filter(n => {
      const search = (globalSearch || "").toLowerCase();
      return n.title.toLowerCase().includes(search) || 
             n.description.toLowerCase().includes(search) ||
             n.host?.toLowerCase().includes(search);
    });
  }, [globalSearch, notificationsList]);

  const handleClearAll = () => {
      setNotificationsList([]);
  };

  const handleDismiss = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotificationsList(prev => prev.filter(n => n.id !== id));
  };

  const getZabbixUrl = (n: Notification) => {
    if (!zabbixBaseUrl) return null;
    if (n.type === 'alert' && n.itemId) {
        // Assume it's a trigger ID for alerts
        return `${zabbixBaseUrl}/tr_events.php?triggerid=${n.itemId}`;
    }
    return zabbixBaseUrl;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-end mb-6">
        <div className="flex items-center gap-3">
            {globalSearch && (
                <span className="text-xs text-blue-600 font-medium bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                    Filter: {globalSearch}
                </span>
            )}
            <button 
                onClick={handleClearAll}
                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
            >
                Clear All
            </button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredNotifications.length === 0 ? (
            <div className="py-20 text-center bg-slate-50 border border-slate-200 border-dashed rounded-3xl">
                <Bell className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-sm font-semibold text-slate-500">No notifications matching criteria</p>
            </div>
        ) : filteredNotifications.map((n, i) => (
          <motion.div 
            key={n.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => setSelectedNotification(n)}
            className="bg-white border border-slate-200 rounded-[24px] p-5 flex gap-5 hover:border-blue-500/30 transition-all group cursor-pointer relative overflow-hidden shadow-sm"
          >
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
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
                <h4 className="text-base font-semibold text-slate-900">{n.title}</h4>
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Clock className="w-3 h-3" />
                  {n.time}
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium line-clamp-1">{n.description}</p>
              {n.host && (
                  <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs font-medium text-blue-600 border border-blue-200 px-2 py-1 rounded-md bg-blue-50">
                        Source: {n.host}
                      </span>
                  </div>
              )}
            </div>
            <div className="flex flex-col justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <button 
                  onClick={(e) => handleDismiss(n.id, e)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 flex items-center justify-center transition-all"
                >
                  <X className="w-4 h-4" />
               </button>
               <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center transition-colors">
                  <ChevronRight className="w-4 h-4 text-slate-600" />
               </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="pt-10 flex flex-col items-center">
         <div className="w-1.5 h-1.5 bg-slate-200 rounded-full mb-4" />
         <button className="text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors">
            Load Historical Audit Trail
         </button>
      </div>

      {/* Drill-down Modal */}
      <AnimatePresence>
        {selectedNotification && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSelectedNotification(null)}
                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
                />
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative w-full max-w-lg bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-2xl"
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

                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                <p className="text-sm text-slate-600 font-medium leading-relaxed">
                                    {selectedNotification.description}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                    <span className="text-xs font-medium text-slate-500 block mb-1">Source Host</span>
                                    <span className="text-sm font-semibold text-slate-900">{selectedNotification.host || 'System Process'}</span>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
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
                                        onClick={() => alert("Zabbix configuration required for drill-down.")}
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
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
}
