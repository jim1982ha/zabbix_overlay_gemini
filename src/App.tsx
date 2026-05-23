/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Shell } from "./components/layout/Shell";
import { NetworkTopology } from "./components/dashboard/NetworkTopology";
import { InfraInventory } from "./components/dashboard/InfraInventory";
import { NotificationFeed } from "./components/dashboard/NotificationFeed";
import { ImportModal } from "./components/dashboard/ImportModal";
import { ConfigView } from "./components/dashboard/ConfigView";
import { useZabbixDiscovery } from "./hooks/useZabbixDiscovery";
import { useTimeseries } from "./hooks/useTimeseries";
import { DashboardProvider, useDashboard } from "./contexts/DashboardContext";
import type { Widget, Dashboard } from "./types/zabbix";
import { TopNavigationBar } from "./components/dashboard/TopNavigationBar";
import { DashboardGrid } from "./components/dashboard/DashboardGrid";
import { 
  Pencil,
  Save,
  X,
  Download,
  Upload,
  Hash,
  BarChart3
} from "lucide-react";
import axios from "axios";
import { cn, getDeterministicColor, updateMetricColor } from "./lib/utils";

type View = "dashboard" | "network" | "infra" | "config" | "notifications";

declare global {
  interface Window {
    _resolveToken?: () => void;
    _rejectToken?: (reason?: any) => void;
  }
}

const defaultWidgets: Widget[] = [
  { 
    id: 'kpi-1', 
    title: 'Average Cluster CPU', 
    type: 'kpi', 
    chartType: 'area', 
    metrics: ['cpu'], 
    hosts: ['all'], 
    aggregation: 'avg', 
    stacked: false, 
    cols: 6, 
    rows: 4 
  },
  { 
    id: 'kpi-2', 
    title: 'Global Cluster Network Flow', 
    type: 'kpi', 
    chartType: 'bar', 
    metrics: ['traffic'], 
    hosts: ['all'], 
    aggregation: 'sum', 
    stacked: false, 
    cols: 12, 
    rows: 4 
  },
  { 
    id: 'kpi-3', 
    title: 'Primary SQL Latency', 
    type: 'kpi', 
    chartType: 'line', 
    metrics: ['latency'], 
    hosts: ['sql-db-primary'], 
    aggregation: 'avg', 
    stacked: false, 
    cols: 6, 
    rows: 4
  }
];

function DashboardApp() {
  const { 
    filters, 
    setFilters, 
    widgets, 
    setWidgets, 
    setEditingWidgetId, 
    addWidget,
    modifyRangeAndGranularity
  } = useDashboard();

  const [view, setView] = useState<View>("dashboard");
  const [savedDashboards, setSavedDashboards] = useState<Dashboard[]>([]);
  const [activeDashboardId, setActiveDashboardId] = useState<string | undefined>();
  const [dashboardName, setDashboardName] = useState<string>('Executive Overview');
  const [globalSearch, setGlobalSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'warning' | 'error' } | null>(null);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [widgetZoomDomains, setWidgetZoomDomains] = useState<Record<string, [number, number] | null>>({});
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [tempDashboardName, setTempDashboardName] = useState('');
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [secureTokenPrompt, setSecureTokenPrompt] = useState(false);
  const [secureTokenInput, setSecureTokenInput] = useState("");
  const [requiresSecureToken, setRequiresSecureToken] = useState(false);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const isAuthorized = useMemo(() => {
    return !requiresSecureToken || !!sessionStorage.getItem("hareporting_app_secure_token");
  }, [requiresSecureToken, secureTokenPrompt]);
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [colorPickerTarget, setColorPickerTarget] = useState<{ metric: string, current: string } | null>(null);
  const [colorMapToggle, setColorMapToggle] = useState(0);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleColorMapChange = () => setColorMapToggle(prev => prev + 1);
    window.addEventListener('ha_color_map_changed', handleColorMapChange);
    return () => window.removeEventListener('ha_color_map_changed', handleColorMapChange);
  }, []);

  const [zabbixConfig, setZabbixConfig] = useState<{url: string, token: string, isPreconfigured: boolean}>({
    url: sessionStorage.getItem('hareporting_zabbix_url') || '',
    token: sessionStorage.getItem('hareporting_zabbix_token') || '',
    isPreconfigured: false
  });

  const [savedZabbixUrl, setSavedZabbixUrl] = useState<string>(
    sessionStorage.getItem('hareporting_zabbix_url') || ''
  );

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Handle Resize triggers
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 1024;
  const isDemo = !zabbixConfig.url || (!zabbixConfig.token && !zabbixConfig.isPreconfigured);

  const dashboardStorageKey = useMemo(() => {
    return savedZabbixUrl 
      ? `hareporting_dashboards_${btoa(savedZabbixUrl).replace(/=/g, '')}` 
      : 'hareporting_dashboards_v5';
  }, [savedZabbixUrl]);

  // Integrated Discovery Hook
  const {
    isDiscovering,
    discoveryStatus,
    setDiscoveryStatus,
    availableHosts,
    availableMetrics,
    metricDict,
    hostMetricsMap,
    metricUnitsMap,
    discoverZabbixAssets
  } = useZabbixDiscovery(zabbixConfig);

  // Integrated Timeseries Fetch system
  const activeMetricsStr = useMemo(() => {
    const s = new Set<string>();
    widgets.forEach(w => w.metrics.forEach(m => s.add(m)));
    return Array.from(s).sort().join(',');
  }, [widgets]);

  const activeHostsStr = useMemo(() => {
    const s = new Set<string>();
    widgets.forEach(w => w.hosts.forEach(h => s.add(h)));
    return Array.from(s).sort().join(',');
  }, [widgets]);

  // Memoized query params for timeseries loading
  const timeseriesParams = useMemo(() => ({
    start: filters.mode === 'live' ? null : filters.start,
    end: filters.mode === 'live' ? null : filters.end,
    granularity: filters.granularity,
    range: filters.range,
    mode: filters.mode,
    url: zabbixConfig.url,
    token: zabbixConfig.token,
    metrics: activeMetricsStr ? activeMetricsStr.split(',') : (availableMetrics.length > 0 ? [availableMetrics[0]] : ['cpu']),
    hosts: activeHostsStr ? activeHostsStr.split(',') : (availableHosts.length > 0 ? [availableHosts[0]] : ['srv-prod-01'])
  }), [filters, zabbixConfig, activeMetricsStr, activeHostsStr, availableMetrics, availableHosts]);

  const { data, isLoading: loading, error: timeseriesError, refetch: fetchStats } = useTimeseries(timeseriesParams, metricDict, !isConfigLoaded || !isAuthorized);

  // Sync last sync dates upon data change
  useEffect(() => {
    if (data && data.length > 0) {
      setLastSync(new Date());
    }
  }, [data]);

  // Show timeseries error toasts nicely
  useEffect(() => {
    if (timeseriesError) {
      showToast(timeseriesError, "error");
    }
  }, [timeseriesError, showToast]);

  // Setup auth tokens & interceptors safely
  useEffect(() => {
    let isRefreshing = false;
    let failedQueue: { resolve: (value?: any) => void, reject: (reason?: any) => void }[] = [];

    const processQueue = (error: any, token: string | null = null) => {
      failedQueue.forEach(prom => {
        if (error) prom.reject(error);
        else prom.resolve(token);
      });
      failedQueue = [];
    };

    const resInterceptor = axios.interceptors.response.use(
      response => response,
      error => {
        const originalRequest = error.config;
        if (error.response && error.response.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          if (isRefreshing) {
            return new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            }).then(token => {
              originalRequest.headers['Authorization'] = `Bearer ${token}`;
              return axios(originalRequest);
            }).catch(err => Promise.reject(err));
          }

          isRefreshing = true;
          setSecureTokenPrompt(true);
          
          return new Promise((resolve, reject) => {
            window._resolveToken = () => {
              const token = sessionStorage.getItem("hareporting_app_secure_token");
              processQueue(null, token);
              isRefreshing = false;
              originalRequest.headers['Authorization'] = `Bearer ${token}`;
              resolve(axios(originalRequest));
            };
            window._rejectToken = (reason) => {
              processQueue(reason, null);
              isRefreshing = false;
              reject(reason || error);
            };
          });
        }
        return Promise.reject(error);
      }
    );

    const reqInterceptor = axios.interceptors.request.use(config => {
      const token = sessionStorage.getItem("hareporting_app_secure_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    return () => {
      axios.interceptors.response.eject(resInterceptor);
      axios.interceptors.request.eject(reqInterceptor);
    };
  }, []);

  // Fetch API configs at start
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await axios.get("/api/config");
        if (res.data) {
          setRequiresSecureToken(res.data.requiresSecureToken);
          if (res.data.requiresSecureToken && !sessionStorage.getItem("hareporting_app_secure_token")) {
            setSecureTokenPrompt(true);
          }
          setZabbixConfig(prev => {
            const newConfig = {
              ...prev,
              url: prev.url || res.data.url,
              token: prev.token || res.data.token,
              isPreconfigured: res.data.hasEnvToken
            };
            if (newConfig.url && (newConfig.token || newConfig.isPreconfigured)) {
              setSavedZabbixUrl(newConfig.url);
            }
            return newConfig;
          });
        }
      } catch (err) {
        console.error("Failed to load server configuration:", err);
      } finally {
        setIsConfigLoaded(true);
      }
    };
    fetchConfig();
  }, []);

  const [initialDiscoveryTriggered, setInitialDiscoveryTriggered] = useState(false);
  useEffect(() => {
    if (!initialDiscoveryTriggered && isConfigLoaded && isAuthorized) {
      const hasValidConfig = zabbixConfig.url && (zabbixConfig.token || zabbixConfig.isPreconfigured);
      if (hasValidConfig) {
        discoverZabbixAssets(false);
      }
      setInitialDiscoveryTriggered(true);
    }
  }, [zabbixConfig, initialDiscoveryTriggered, discoverZabbixAssets, isConfigLoaded, isAuthorized]);

  const [draftZabbixConfig, setDraftZabbixConfig] = useState(zabbixConfig);
  useEffect(() => {
    setDraftZabbixConfig(zabbixConfig);
  }, [zabbixConfig]);

  const handleSaveZabbixConfig = () => {
    setZabbixConfig(draftZabbixConfig);
    sessionStorage.setItem('hareporting_zabbix_url', draftZabbixConfig.url);
    sessionStorage.setItem('hareporting_zabbix_token', draftZabbixConfig.token);
    setSavedZabbixUrl(draftZabbixConfig.url);
    showToast("Zabbix API configuration saved successfully.", "success");
    setView("dashboard");
    setTimeout(() => {
      setInitialDiscoveryTriggered(false);
    }, 100);
  };

  const handleDemoMode = () => {
    const emptyConfig = { url: '', token: '', isPreconfigured: false };
    setZabbixConfig(emptyConfig);
    setDraftZabbixConfig(emptyConfig);
    sessionStorage.setItem('hareporting_zabbix_url', '');
    sessionStorage.setItem('hareporting_zabbix_token', '');
    setSavedZabbixUrl('');
    showToast("Switched to offline Demo Mode.", "info");
    setView("dashboard");
  };

  // Consolidated Unsaved edits tracker
  const hasUnsavedChanges = useMemo(() => {
    if (!activeDashboardId) return widgets.length > 0;
    const currentSaved = savedDashboards.find(d => d.id === activeDashboardId);
    if (!currentSaved) return true;
    const widgetsEqual = JSON.stringify(currentSaved.widgets) === JSON.stringify(widgets);
    const nameEqual = currentSaved.name === dashboardName;
    return !widgetsEqual || !nameEqual;
  }, [widgets, dashboardName, savedDashboards, activeDashboardId]);

  // Load dashboards on startup or configuration save key changes
  useEffect(() => {
    const saved = localStorage.getItem(dashboardStorageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const migrated = parsed.map((db: Dashboard) => ({
          ...db,
          widgets: db.widgets.map((w: Widget) => ({
            ...w,
            cols: w.cols <= 4 ? w.cols * 6 : w.cols,
            rows: w.rows <= 3 ? w.rows * 4 : w.rows
          }))
        }));
        setSavedDashboards(migrated);
        if (migrated.length > 0) {
          setWidgets(migrated[0].widgets);
          setDashboardName(migrated[0].name);
          setActiveDashboardId(migrated[0].id);
        } else {
          setWidgets(dashboardStorageKey === 'hareporting_dashboards_v5' ? defaultWidgets : []);
        }
      } catch (e) {
        console.error("Failed to parse saved dashboards", e);
      }
    } else {
      const initialWidgets = dashboardStorageKey === 'hareporting_dashboards_v5' ? defaultWidgets : [];
      const initialDashboard: Dashboard = {
        id: 'default-board-1',
        name: 'Executive Overview',
        widgets: initialWidgets
      };
      setSavedDashboards([initialDashboard]);
      setActiveDashboardId('default-board-1');
      setWidgets(initialWidgets);
      localStorage.setItem(dashboardStorageKey, JSON.stringify([initialDashboard]));
    }
  }, [dashboardStorageKey]);

  const handleUpdateDashboardName = (newName: string) => {
    if (!newName) return;
    setDashboardName(newName);
    if (activeDashboardId) {
      setSavedDashboards(prev => {
        const next = prev.map(d => d.id === activeDashboardId ? { ...d, name: newName } : d);
        localStorage.setItem(dashboardStorageKey, JSON.stringify(next));
        return next;
      });
    }
  };

  const handleDiscardChanges = () => {
    if (activeDashboardId) {
      const original = savedDashboards.find(d => d.id === activeDashboardId);
      if (original) {
        setWidgets(original.widgets);
        setDashboardName(original.name);
      }
    } else {
      setWidgets([]);
    }
    setEditingWidgetId(null);
  };

  const handleSaveAll = () => {
    if (activeDashboardId) {
      const next = savedDashboards.map(d => d.id === activeDashboardId ? { ...d, name: dashboardName, widgets } : d);
      setSavedDashboards(next);
      localStorage.setItem(dashboardStorageKey, JSON.stringify(next));
    } else {
      const newId = `db-${Date.now()}`;
      const newBoard = { id: newId, name: dashboardName, widgets };
      const next = [...savedDashboards, newBoard];
      setSavedDashboards(next);
      setActiveDashboardId(newId);
      localStorage.setItem(dashboardStorageKey, JSON.stringify(next));
    }
  };

  const triggerOpenSecureTokenPrompt = () => {
    setSecureTokenPrompt(true);
  };

  const handleAddWidget = (type: 'kpi' | 'chart') => {
    const newWidget: Widget = {
      id: `w-${Date.now()}`,
      title: type === 'kpi' ? 'New KPI Metric Card' : 'New Analytical Trend Chart',
      type,
      chartType: 'area',
      metrics: isDemo ? ['cpu'] : (availableMetrics.length > 0 ? [availableMetrics[0]] : []),
      hosts: isDemo ? ['srv-prod-01'] : (availableHosts.length > 0 ? [availableHosts[0]] : []),
      aggregation: 'avg',
      stacked: false,
      cols: type === 'kpi' ? 6 : 12,
      rows: type === 'kpi' ? 4 : 10,
    };
    addWidget(newWidget);
  };

  const handleSelectDashboard = (id: string) => {
    if (!id) {
      setActiveDashboardId(undefined);
      setWidgets(defaultWidgets);
      setDashboardName('Executive Overview');
      setView("dashboard");
      return;
    }
    const db = savedDashboards.find(d => d.id === id);
    if (db) {
      setActiveDashboardId(id);
      setWidgets(db.widgets);
      setDashboardName(db.name);
      setView("dashboard");
    }
  };

  const handleCreateDashboard = () => {
    const newId = `db-${Date.now()}`;
    const newName = "New Analytical Board";
    const newBoard: Dashboard = { id: newId, name: newName, widgets: [] };
    setSavedDashboards(prev => {
      const next = [...prev, newBoard];
      localStorage.setItem(dashboardStorageKey, JSON.stringify(next));
      return next;
    });
    setActiveDashboardId(newId);
    setWidgets([]);
    setDashboardName(newName);
    setView("dashboard");
    setIsRenaming(true);
    setTempDashboardName(newName);
  };

  const handleDeleteDashboard = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSavedDashboards(prev => {
      const updated = prev.filter(d => d.id !== id);
      localStorage.setItem(dashboardStorageKey, JSON.stringify(updated));
      return updated;
    });
    
    if (activeDashboardId === id) {
      setActiveDashboardId(undefined);
      setWidgets(defaultWidgets);
      setDashboardName('Executive Overview');
      setView('dashboard');
    }
  }, [activeDashboardId, defaultWidgets, dashboardStorageKey]);

  const handleExportDashboard = () => {
    const exportData = {
      name: dashboardName,
      widgets: widgets,
      v: '1.0'
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dashboardName.replace(/\s+/g, '_').toLowerCase()}_config.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportSuccess = (json: unknown) => {
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      showToast("Invalid dashboard file format.", "error");
      return;
    }
    const payload = json as Record<string, unknown>;
    if (!Array.isArray(payload.widgets)) {
      showToast("Invalid dashboard structure: Missing widgets array.", "error");
      return;
    }
    const sanitizedWidgets = payload.widgets.filter((w: any) => 
      w && typeof w === 'object' && w.id && w.type && w.cols && w.rows
    );

    setWidgets(sanitizedWidgets as Widget[]);
    if (typeof payload.name === 'string') {
      setDashboardName(payload.name);
    }
    showToast("Dashboard configuration successfully imported.", "success");
  };

  const toggleSeriesVisibility = useCallback((key: string | string[]) => {
    setHiddenSeries(prev => {
      const next = new Set(prev);
      const keys = Array.isArray(key) ? key : [key];
      let allHidden = true;
      for (const k of keys) {
        if (!next.has(k)) {
          allHidden = false;
          break;
        }
      }
      if (allHidden) {
        keys.forEach(k => next.delete(k));
      } else {
        keys.forEach(k => next.add(k));
      }
      return next;
    });
  }, []);

  const handleUpdateWidgetZoom = useCallback((id: string, domain: [number, number] | null) => {
    setWidgetZoomDomains(prev => ({ ...prev, [id]: domain }));
  }, []);

  const handleZoomOut = useCallback((id: string) => {
    setWidgetZoomDomains(prev => ({ ...prev, [id]: null }));
  }, []);

  // Setup active Live polling progress calculations
  useEffect(() => {
    if (filters.mode === 'live') {
      let stepMs = 60000;
      switch (filters.granularity) {
        case '1m': stepMs = 60000; break;
        case '5m': stepMs = 300000; break;
        case '15m': stepMs = 900000; break;
        case '30m': stepMs = 1800000; break;
        case '1h': stepMs = 3600000; break;
        case '1d': stepMs = 86400000; break;
        default: stepMs = 60000;
      }
      
      const updateProgress = () => {
         const t = Date.now();
         const settledEnd = Math.floor((t - 60000) / stepMs) * stepMs;
         const nextRefreshTime = settledEnd + stepMs + 60000;
         const lastRefreshTime = settledEnd + 60000;
         const total = nextRefreshTime - lastRefreshTime;
         const elapsed = t - lastRefreshTime;
         const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
         setRefreshProgress(pct);
      };

      updateProgress();
      const interval = setInterval(updateProgress, 1000);
      return () => clearInterval(interval);
    } else {
      setRefreshProgress(0);
    }
  }, [filters.mode, filters.granularity]);

  // Widget Data Mapper for Chart/KPI display
  const widgetDataMapping = useMemo(() => {
    const mapping: Record<string, any> = {};
    widgets.forEach(w => {
      if (w.type === 'chart') {
        const isAggregated = w.chartType !== 'mixed' && w.aggregation !== 'none';
        let chartSeries: { key: string; name: string; color?: string; metric?: string; configKey?: string; unit?: string }[] = [];
        let chartData = data;

        if (w.chartType === 'mixed') {
          let mixedData = data.map(point => ({ ...point }));
          ['series1', 'series2'].forEach(sKey => {
            const sConf = w.seriesConfig?.[sKey];
            if (!sConf) return;
            
            const smetrics = sConf.metrics || (sConf.metric ? [sConf.metric] : []);
            const shosts = sConf.hosts || (sConf.host ? [sConf.host] : []);
            const axisLabel = sConf.yAxis === 'right' ? ' (Right)' : ' (Left)';
            const aggType = sConf.aggregation || 'none';
            
            if (aggType !== 'none') {
               smetrics.forEach(m => {
                 const aggKey = `${sKey}_${m}_agg`;
                 const u = metricUnitsMap[m] ? (metricUnitsMap[m] === '%' ? '%' : ` ${metricUnitsMap[m]}`) : '';
                 mixedData = mixedData.map(point => {
                   let vals: number[] = [];
                   const hostsToUse = shosts.includes('all') ? availableHosts : shosts;
                   hostsToUse.forEach(h => {
                     const key = `${m}_${h}`;
                     if (!hiddenSeries.has(key) && point[key] !== undefined) vals.push(Number(point[key]));
                   });
                   const sum = vals.reduce((a,b)=>a+b, 0);
                   const val = aggType === 'avg' && vals.length > 0 ? sum/vals.length : sum;
                   return { ...point, [aggKey]: val };
                 });
                 chartSeries.push({
                   key: aggKey,
                   name: `${m.toUpperCase()} (${aggType === 'sum' ? 'Sum' : 'Avg'})${axisLabel}`,
                   color: getDeterministicColor(aggKey, m),
                   metric: m,
                   configKey: sKey,
                   unit: u
                 });
               });
            } else {
               smetrics.forEach(m => {
                 const u = metricUnitsMap[m] ? (metricUnitsMap[m] === '%' ? '%' : ` ${metricUnitsMap[m]}`) : '';
                 const hostsToUse = shosts.includes('all') ? availableHosts : shosts;
                 hostsToUse.forEach(h => {
                   const key = `${m}_${h}`;
                   chartSeries.push({
                     key,
                     name: `${m.toUpperCase()} [${h}]${axisLabel}`,
                     color: getDeterministicColor(key, m),
                     metric: m,
                     configKey: sKey,
                     unit: u
                   });
                 });
               });
            }
          });
          chartData = mixedData;
        } else if (isAggregated) {
           const label = w.aggregation === 'sum' ? 'Aggregate Sum' : 'Aggregate Mean';
           const m = w.metrics[0];
           const u = m && metricUnitsMap[m] ? (metricUnitsMap[m] === '%' ? '%' : ` ${metricUnitsMap[m]}`) : '';
           chartSeries = [{ key: 'agg_val', name: label, color: getDeterministicColor('agg_val', m), unit: u }];
          
          chartData = data.map(point => {
            let vals: number[] = [];
            w.metrics.forEach(m => {
              const hostsToUse = w.hosts.includes('all') ? availableHosts : w.hosts;
              hostsToUse.forEach(h => {
                const key = `${m}_${h}`;
                if (!hiddenSeries.has(key) && point[key] != null) {
                  vals.push(Number(point[key]));
                }
              });
            });
            const sum = vals.reduce((a, b) => a + b, 0);
            const val = w.aggregation === 'avg' && vals.length > 0 ? sum / vals.length : sum;
            return { ...point, agg_val: val };
          });
        } else {
          w.metrics.forEach(m => {
            const u = metricUnitsMap[m] ? (metricUnitsMap[m] === '%' ? '%' : ` ${metricUnitsMap[m]}`) : '';
            const hostsToUse = w.hosts.includes('all') ? availableHosts : w.hosts;
            hostsToUse.forEach(h => {
              const key = `${m}_${h}`;
              chartSeries.push({
                key,
                name: `${m.toUpperCase()} [${h === 'all' ? 'All' : h}]`,
                color: getDeterministicColor(key, m),
                metric: m,
                unit: u
              });
            });
          });
        }
        mapping[w.id] = { chartData, chartSeries };
      }
    });
    return mapping;
  }, [data, widgets, hiddenSeries, availableHosts, metricUnitsMap, colorMapToggle]);

  const relevantHiddenSeries = useMemo(() => {
    if (view !== 'dashboard') return new Set<string>();
    const activeWidgetKeys = new Set<string>();
    
    // Fallback: standard grid iteration matching baseline definitions
    widgets.forEach(w => {
      w.metrics.forEach(m => {
        w.hosts.forEach(h => {
          activeWidgetKeys.add(`${m}_${h}`);
        });
      });
    });

    // Advanced: capture all exact synthesized keys for mixed/aggregated/pie structures from mapper
    Object.values(widgetDataMapping).forEach((mapping: any) => {
      if (mapping.chartSeries) {
        mapping.chartSeries.forEach((series: any) => {
          activeWidgetKeys.add(series.key);
        });
      }
    });

    return new Set(Array.from(hiddenSeries).filter((key: string) => activeWidgetKeys.has(key)));
  }, [hiddenSeries, widgets, view, widgetDataMapping]);

  // Main page content distributor
  const renderContent = () => {
    if (view === "network") {
      return <NetworkTopology filters={filters} globalSearch={globalSearch} zabbixConfig={zabbixConfig} isDemo={isDemo} />;
    }
    if (view === "infra") {
      return <InfraInventory filters={filters} globalSearch={globalSearch} zabbixConfig={zabbixConfig} showToast={showToast} isDemo={isDemo} />;
    }
    if (view === "notifications") {
      const zabbixBaseUrl = zabbixConfig.url.replace('/api_jsonrpc.php', '');
      return <NotificationFeed globalSearch={globalSearch} zabbixBaseUrl={zabbixBaseUrl} zabbixConfig={zabbixConfig} showToast={showToast} isDemo={isDemo} />;
    }
    if (view === "config") {
      return (
        <ConfigView
          zabbixConfig={zabbixConfig}
          requiresSecureToken={requiresSecureToken}
          isDemo={isDemo}
          isDiscovering={isDiscovering}
          draftZabbixConfig={draftZabbixConfig}
          setDraftZabbixConfig={setDraftZabbixConfig}
          handleSaveZabbixConfig={handleSaveZabbixConfig}
          discoverZabbixAssets={discoverZabbixAssets}
          handleDemoMode={handleDemoMode}
          discoveryStatus={discoveryStatus}
        />
      );
    }

    return (
      <div className="w-full min-w-0">
        <DashboardGrid 
          data={data}
          availableHosts={availableHosts}
          availableMetrics={availableMetrics}
          hostMetricsMap={hostMetricsMap}
          metricUnitsMap={metricUnitsMap}
          hiddenSeries={hiddenSeries}
          toggleSeriesVisibility={toggleSeriesVisibility}
          globalSearch={globalSearch}
          isDemo={isDemo}
          widgetZoomDomains={widgetZoomDomains}
          handleUpdateWidgetZoom={handleUpdateWidgetZoom}
          handleZoomOut={handleZoomOut}
          widgetDataMapping={widgetDataMapping}
          setColorPickerTarget={setColorPickerTarget}
          isMobile={isMobile}
        />
      </div>
    );
  };

  return (
    <>
    <Shell 
      topBar={
        <TopNavigationBar 
          globalSearch={globalSearch}
          setGlobalSearch={setGlobalSearch}
          isLoading={loading}
          onRefresh={fetchStats}
          lastSync={lastSync}
          isDemo={isDemo}
          zabbixUrl={zabbixConfig.url}
          requiresSecureToken={requiresSecureToken}
          onOpenSecureToken={triggerOpenSecureTokenPrompt}
          refreshProgress={refreshProgress}
        />
      }
      savedDashboards={savedDashboards} 
      onSelectDashboard={handleSelectDashboard}
      onRenameDashboard={handleUpdateDashboardName}
      onAddDashboard={handleCreateDashboard}
      onDeleteDashboard={handleDeleteDashboard}
      activeDashboardId={activeDashboardId}
      onNavigate={(v: any) => setView(v)}
      currentView={view}
      lastSync={lastSync}
      isDemo={isDemo}
      hiddenSeries={relevantHiddenSeries}
      toggleSeriesVisibility={toggleSeriesVisibility}
    >
      <div className="w-full space-y-4">
        {/* Dashboard Title & Actions header */}
        <div className="flex flex-row items-center justify-between mb-4 flex-wrap gap-4 select-none">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-4 group/header min-w-0">
              {isRenaming ? (
                <div className="flex items-center gap-2 w-full">
                  <input
                    autoFocus
                    type="text"
                    value={tempDashboardName}
                    onChange={(e) => setTempDashboardName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUpdateDashboardName(tempDashboardName);
                        setIsRenaming(false);
                      } else if (e.key === 'Escape') {
                        setIsRenaming(false);
                      }
                    }}
                    onBlur={() => {
                      handleUpdateDashboardName(tempDashboardName);
                      setIsRenaming(false);
                    }}
                    className="bg-transparent border-b border-blue-500 px-1 py-1 text-2xl font-black text-slate-800 dark:text-white focus:outline-none w-full"
                  />
                </div>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight truncate">
                    {view === 'dashboard' ? dashboardName : 
                     view === 'network' ? 'Network Topology' : 
                     view === 'infra' ? 'Asset Inventory' : 
                     view === 'notifications' ? 'Current Problems' : 'Zabbix API Settings'}
                  </h1>
                  {view === 'dashboard' && hasUnsavedChanges && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 border border-amber-100 rounded-full animate-pulse shrink-0 transition-all hidden sm:flex">
                      <div className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Unsaved</span>
                    </div>
                  )}
                  {view === 'dashboard' && (
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setTempDashboardName(dashboardName);
                        setIsRenaming(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-transparent hover:bg-slate-200/50 rounded lg:opacity-0 group-hover/header:opacity-100 transition-all border border-transparent shrink-0"
                      title="Rename Dashboard"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          {view === 'dashboard' && (
            <div className="flex items-center gap-2 sm:gap-3 justify-end shrink-0 ml-auto">
               <div className="flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-none p-1 gap-1 h-[40px] items-center">
                  <button onClick={() => handleAddWidget('kpi')} className="px-2 sm:px-4 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-none flex items-center gap-2 transition-all">
                    <Hash className="w-4 h-4 text-blue-600 dark:text-sky-500" /> <span className="hidden sm:inline">KPI</span>
                  </button>
                  <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-800 mx-1" />
                  <button onClick={() => handleAddWidget('chart')} className="px-2 sm:px-4 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-none flex items-center gap-2 transition-all">
                    <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> <span className="hidden sm:inline">CHART</span>
                  </button>
                  <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-800 mx-1" />
                  <button onClick={handleExportDashboard} className="px-2 sm:px-3 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-500 hover:text-blue-600 dark:hover:text-sky-400 rounded-none flex items-center gap-2 transition-all" title="Export Dashboard">
                    <Download className="w-4 h-4" /> <span className="hidden xl:inline">Export</span>
                  </button>
                  <button 
                    onClick={() => setIsImportModalOpen(true)}
                    className="px-2 sm:px-3 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-500 hover:text-blue-600 dark:hover:text-sky-400 rounded-none flex items-center gap-2 transition-all" 
                    title="Import Dashboard"
                  >
                    <Upload className="w-4 h-4" /> <span className="hidden xl:inline">Import</span>
                  </button>
               </div>

                {hasUnsavedChanges && (
                  <div className="flex bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-none p-1 gap-1 shadow-sm h-[40px] items-center animate-in slide-in-from-right-4 duration-500">
                    <button 
                      onClick={handleSaveAll}
                      className="px-3 sm:px-4 h-full bg-emerald-600 border border-emerald-600 hover:bg-emerald-700 text-white rounded-none transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Save className="w-4 h-4" />
                      <span className="hidden sm:inline text-xs font-semibold">Save</span>
                    </button>
                    <button 
                      onClick={handleDiscardChanges}
                      className="w-[36px] sm:w-[40px] h-full hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-500 rounded-none transition-all flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
            </div>
          )}
        </div>

        {renderContent()}
      </div>
    </Shell>

    {/* Token Prompt Model Option */}
    {secureTokenPrompt && (
      <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-none max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
          <div className="p-6">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-none flex items-center justify-center shadow-sm mb-4">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield text-indigo-600 dark:text-indigo-400"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Authentication Pin Needed</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              This dashboard is protected by a secure token code to prevent unauthorized configuration changes.
            </p>
            <form onSubmit={e => {
              e.preventDefault();
              sessionStorage.setItem("hareporting_app_secure_token", secureTokenInput);
              setSecureTokenPrompt(false);
              if (window._resolveToken) {
                 window._resolveToken();
                 window._resolveToken = undefined;
                 window._rejectToken = undefined;
              } else {
                 setDiscoveryStatus({ type: 'success', message: 'Token saved, trying again...' });
                 discoverZabbixAssets(false);
              }
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Access Token</label>
                  <input 
                    type="password" 
                    value={secureTokenInput}
                    onChange={e => setSecureTokenInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-none px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono text-sm leading-tight" 
                    placeholder="Enter APP_SECURE_TOKEN..." 
                    autoFocus
                  />
                </div>
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-none shadow-sm transition-colors mt-2">
                  Verify Access
                </button>
                <button type="button" onClick={() => {
                  setSecureTokenPrompt(false);
                  setZabbixConfig({url: '', token: '', isPreconfigured: false});
                  setDraftZabbixConfig({url: '', token: '', isPreconfigured: false});
                  sessionStorage.setItem('hareporting_zabbix_url', '');
                  sessionStorage.setItem('hareporting_zabbix_token', '');
                  setSavedZabbixUrl('');
                  if (window._rejectToken) {
                     window._rejectToken("Verification bypassed, default to Demo Mode");
                     window._resolveToken = undefined;
                     window._rejectToken = undefined;
                  }
                }} className="w-full text-center text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-300 py-1 font-medium transition-colors">
                  Bypass to offline Demo Node
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )}

    {/* Import Modal */}
    <ImportModal 
      isOpen={isImportModalOpen}
      onClose={() => setIsImportModalOpen(false)}
      onImportSuccess={handleImportSuccess}
    />

    {/* Global Color Selector Picker */}
    {colorPickerTarget && createPortal(
      <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-none max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
            <h3 className="font-bold text-slate-800 dark:text-white">Choose Color</h3>
            <button onClick={() => setColorPickerTarget(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-500">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Selecting a color mapping for metric <span className="font-semibold text-slate-900 dark:text-slate-200">{colorPickerTarget.metric}</span>. This will update color rendering globally.</p>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Custom Hex:</span>
              <div className="flex-1 flex gap-2">
                 <input 
                   type="text" 
                   value={colorPickerTarget.current} 
                   onChange={(e) => setColorPickerTarget({...colorPickerTarget, current: e.target.value})}
                   className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-1.5 text-sm outline-none text-slate-800 dark:text-slate-200 uppercase font-mono"
                 />
                 <div className="w-8 h-8 rounded border border-slate-200 dark:border-slate-800 shadow-inner" style={{backgroundColor: colorPickerTarget.current}}/>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2 pb-2">
              {[
                  '#ef4444', '#f97316', '#f59e0b', '#eab308', 
                  '#84cc16', '#22c55e', '#10b981', '#14b8a6', 
                  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', 
                  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', 
                  '#f43f5e', '#64748b', '#71717a', '#000000', '#ffffff'
              ].map(c => (
                <button 
                  key={c}
                  onClick={() => setColorPickerTarget({...colorPickerTarget, current: c})}
                  className={cn(
                    "w-full pt-[100%] rounded relative outline-none ring-offset-2 dark:ring-offset-slate-900 transition-all hover:scale-110",
                    colorPickerTarget.current.toLowerCase() === c.toLowerCase() ? "ring-2 ring-blue-500 scale-110 z-10 shell-ring" : "hover:z-10"
                  )}
                  style={{ backgroundColor: c, boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.06)' }}
                />
              ))}
            </div>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <button
              onClick={() => setColorPickerTarget(null)}
              className="px-4 py-2 font-medium text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-200 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                updateMetricColor(colorPickerTarget.metric, colorPickerTarget.current);
                setColorPickerTarget(null);
              }}
              className="px-4 py-2 font-semibold text-sm bg-blue-600 hover:bg-blue-700 text-white rounded shadow-sm transition-colors"
            >
              Apply Globally
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}

export default function App() {
  return (
    <DashboardProvider>
      <DashboardApp />
    </DashboardProvider>
  );
}
