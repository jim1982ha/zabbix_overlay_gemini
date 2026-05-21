/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Shell } from "./components/layout/Shell";
import { StatCard } from "./components/dashboard/StatCard";
import { TrendChart } from "./components/dashboard/TrendChart";
import { RangePicker } from "./components/dashboard/RangePicker";
import { NetworkTopology } from "./components/dashboard/NetworkTopology";
import { InfraInventory } from "./components/dashboard/InfraInventory";
import { ScrollableBar } from "./components/layout/ScrollableBar";
import { PortalMenu } from "./components/dashboard/PortalMenu";
import { Card } from "./components/ui/Card";
import { NotificationFeed } from "./components/dashboard/NotificationFeed";
import { ImportModal } from "./components/dashboard/ImportModal";
import { 
  Activity,   Cpu, 
  HardDrive, 
  Globe, 
  RefreshCw,
  Clock,
  Server,
  LayoutDashboard,
  Edit2,
  Eye,
  Plus,
  Settings2,
  Trash2,
  RefreshCcw,
  Pencil,
  Save,
  Check,
  Download,
  Upload,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Bell,
  Search,
  X,
  Calendar,
  ZoomOut,
  GripVertical,
  ArrowUpDown,
  TrendingUp,
  BarChart3,
  Hash,
  Info
} from "lucide-react";
import axios from "axios";
import { cn, getDeterministicColor, formatValue, updateMetricColor } from "./lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface Widget {
  id: string;
  title: string;
  type: 'kpi' | 'chart';
  chartType: 'area' | 'line' | 'bar' | 'pie' | 'mixed';
  metrics: string[];
  hosts: string[];
  aggregation: 'none' | 'sum' | 'avg';
  stacked: boolean;
  cols: number;
  rows: number;
  forceNewline?: boolean;
  seriesConfig?: Record<string, {
    metric?: string;
    host?: string;
    metrics?: string[];
    hosts?: string[];
    yAxis: 'left' | 'right';
    chartType: 'area' | 'line' | 'bar';
    aggregation: 'none' | 'sum' | 'avg';
    stacked: boolean;
  }>;
}

interface Dashboard {
  id: string;
  name: string;
  widgets: Widget[];
}

type View = "dashboard" | "network" | "infra" | "config" | "notifications";

declare global {
  interface Window {
    _resolveToken?: () => void;
    _rejectToken?: (reason?: any) => void;
  }
}

export default function App() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("dashboard");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [filters, setFilters] = useState<any>({ 
    mode: 'live',
    range: '24h',
    granularity: '1h',
    start: new Date(Date.now() - 86400000).toISOString().substring(0, 16),
    end: new Date().toISOString().substring(0, 16)
  });
  const [savedDashboards, setSavedDashboards] = useState<Dashboard[]>([]);
  const [activeDashboardId, setActiveDashboardId] = useState<string | undefined>();
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [globalSearch, setGlobalSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'warning' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const [discoveryStatus, setDiscoveryStatus] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [dashboardName, setDashboardName] = useState<string>('Executive Overview');
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [draggingWidgetId, setDraggingWidgetId] = useState<string | null>(null);
  const [widgetZoomDomains, setWidgetZoomDomains] = useState<Record<string, [number, number] | null>>({});
  const importInputRef = useRef<HTMLInputElement>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleUpdateWidgetZoom = (id: string, domain: [number, number] | null) => {
    setWidgetZoomDomains(prev => ({
      ...prev,
      [id]: domain
    }));
  };

  const handleZoomOut = (id: string) => {
    setWidgetZoomDomains(prev => ({
      ...prev,
      [id]: null
    }));
  };

  const [isRenaming, setIsRenaming] = useState(false);
  const [tempDashboardName, setTempDashboardName] = useState('');
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  
  const [secureTokenPrompt, setSecureTokenPrompt] = useState(false);
  const [secureTokenInput, setSecureTokenInput] = useState("");
  const [requiresSecureToken, setRequiresSecureToken] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);

  const [colorPickerTarget, setColorPickerTarget] = useState<{ metric: string, current: string } | null>(null);
  const [dummyColorRevision, setDummyColorRevision] = useState(0);

  useEffect(() => {
    const handler = () => setDummyColorRevision(r => r + 1);
    window.addEventListener('ha_color_map_changed', handler);
    return () => window.removeEventListener('ha_color_map_changed', handler);
  }, []);

  useEffect(() => {
    let isRefreshing = false;
    let failedQueue: { resolve: (value?: any) => void, reject: (reason?: any) => void }[] = [];

    const processQueue = (error: any, token: string | null = null) => {
      failedQueue.forEach(prom => {
        if (error) {
          prom.reject(error);
        } else {
          prom.resolve(token);
        }
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
            }).catch(err => {
              return Promise.reject(err);
            });
          }

          isRefreshing = true;
          setSecureTokenPrompt(true);
          
          return new Promise((resolve, reject) => {
            window._resolveToken = () => {
                const token = localStorage.getItem("hareporting_app_secure_token");
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
      const token = localStorage.getItem("hareporting_app_secure_token");
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



  const handleCancelEdit = useCallback(() => {
    if (!editingWidgetId) return;

    // Check if it's a new widget or an existing one
    const currentBoard = savedDashboards.find(d => d.id === activeDashboardId);
    const originalWidget = currentBoard?.widgets.find(w => w.id === editingWidgetId);

    if (!originalWidget) {
      // It's a new widget, remove it
      setWidgets(prev => prev.filter(w => w.id !== editingWidgetId));
    } else {
      // It's an existing widget, revert to its original state
      setWidgets(prev => prev.map(w => w.id === editingWidgetId ? originalWidget : w));
    }
    
    setEditingWidgetId(null);
  }, [editingWidgetId, activeDashboardId, savedDashboards]);

  const handleRenameDashboardLocal = (id: string, newName: string) => {
    setSavedDashboards(prev => {
      const updated = prev.map(d => d.id === id ? { ...d, name: newName } : d);
      localStorage.setItem(dashboardStorageKey, JSON.stringify(updated));
      return updated;
    });
    if (activeDashboardId === id) {
      setDashboardName(newName);
    }
  };

  const [zabbixConfig, setZabbixConfig] = useState<{url: string, token: string, isPreconfigured: boolean}>({
    url: localStorage.getItem('hareporting_zabbix_url') || '',
    token: localStorage.getItem('hareporting_zabbix_token') || '',
    isPreconfigured: false
  });

  const [savedZabbixUrl, setSavedZabbixUrl] = useState<string>(
    localStorage.getItem('hareporting_zabbix_url') || ''
  );

  const dashboardStorageKey = useMemo(() => {
    return savedZabbixUrl 
      ? `hareporting_dashboards_${btoa(savedZabbixUrl).replace(/=/g, '')}` 
      : 'hareporting_dashboards_v5';
  }, [savedZabbixUrl]);

  // Consolidated Tracker for unsaved changes (moved here to have access to dashboardStorageKey)
  const hasUnsavedChanges = useMemo(() => {
    if (!activeDashboardId) return widgets.length > 0;
    const currentSaved = savedDashboards.find(d => d.id === activeDashboardId);
    if (!currentSaved) return true;
    
    // Deep comparison of widgets and name
    const widgetsEqual = JSON.stringify(currentSaved.widgets) === JSON.stringify(widgets);
    const nameEqual = currentSaved.name === dashboardName;
    
    return !widgetsEqual || !nameEqual;
  }, [widgets, dashboardName, savedDashboards, activeDashboardId]);

  useEffect(() => {
    let configuredFromApi = false;
    const fetchConfig = async () => {
      try {
        const res = await axios.get("/api/config");
        if (res.data) {
          setRequiresSecureToken(res.data.requiresSecureToken);
          if (res.data.requiresSecureToken && !localStorage.getItem("hareporting_app_secure_token")) {
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
               configuredFromApi = true;
               setSavedZabbixUrl(newConfig.url);
            }
            return newConfig;
          });
          
          if (res.data.url && res.data.hasEnvToken) {
             // Let it render first, then trigger discovery
             setTimeout(() => {
               setInitialDiscoveryTriggered(false); // To force a re-evaluation
             }, 100);
          }
        }
      } catch (err) {
        console.error("Failed to load server configuration:", err);
      }
    };
    fetchConfig();
  }, []);

  const isDemo = !zabbixConfig.url || (!zabbixConfig.token && !zabbixConfig.isPreconfigured);
  const [availableHosts, setAvailableHosts] = useState<string[]>(['srv-prod-01', 'sql-db-primary', 'gateway-02']);
  const [availableMetrics, setAvailableMetrics] = useState<string[]>(['cpu', 'memory', 'traffic', 'latency', 'disk']);
  const [metricDict, setMetricDict] = useState<Record<string, {itemid: string, value_type: string, lastvalue: string}>>({});
  const [hostMetricsMap, setHostMetricsMap] = useState<Record<string, string[]>>({});
  const [metricUnitsMap, setMetricUnitsMap] = useState<Record<string, string>>({
    'cpu': '%',
    'memory': '%',
    'traffic': 'Gb/s',
    'latency': 'ms',
    'disk': '%'
  });

  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 640;

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
      cols: 4, 
      rows: 5 
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
      cols: 10, 
      rows: 5 
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
      cols: 5, 
      rows: 5 
    },
    { 
      id: 'kpi-4', 
      title: 'Cluster Storage Health', 
      type: 'kpi', 
      chartType: 'area', 
      metrics: ['disk'], 
      hosts: ['all'], 
      aggregation: 'avg', 
      stacked: false, 
      cols: 5, 
      rows: 5 
    },
    { 
      id: 'chart-1', 
      title: 'Dual-Axis Health Correlation (Mixed View)', 
      type: 'chart', 
      chartType: 'mixed', 
      metrics: ['cpu', 'traffic'], 
      hosts: ['all'], 
      aggregation: 'none', 
      stacked: false, 
      cols: 16, 
      rows: 13,
      seriesConfig: {
        series1: {
          metrics: ['cpu'],
          metric: 'cpu',
          hosts: ['all'],
          host: 'all',
          yAxis: 'left',
          chartType: 'line',
          aggregation: 'avg',
          stacked: false
        },
        series2: {
          metrics: ['traffic'],
          metric: 'traffic',
          hosts: ['all'],
          host: 'all',
          yAxis: 'right',
          chartType: 'bar',
          aggregation: 'sum',
          stacked: false
        }
      }
    },
    { 
      id: 'chart-2', 
      title: 'Storage Volume Allocation (Pie View)', 
      type: 'chart', 
      chartType: 'pie', 
      metrics: ['disk'], 
      hosts: ['all'], 
      aggregation: 'none', 
      stacked: false, 
      cols: 8, 
      rows: 13 
    },
    { 
      id: 'chart-3', 
      title: 'Production Server Resource Footprint', 
      type: 'chart', 
      chartType: 'line', 
      metrics: ['cpu', 'memory'], 
      hosts: ['srv-prod-01'], 
      aggregation: 'none', 
      stacked: false, 
      cols: 12, 
      rows: 11 
    },
    { 
      id: 'chart-4', 
      title: 'Database Read Latency Trends', 
      type: 'chart', 
      chartType: 'area', 
      metrics: ['latency'], 
      hosts: ['all'], 
      aggregation: 'none', 
      stacked: true, 
      cols: 12, 
      rows: 11 
    },
    { 
      id: 'chart-5', 
      title: 'Inter-Zone Network Traffic Load (Bar View)', 
      type: 'chart', 
      chartType: 'bar', 
      metrics: ['traffic'], 
      hosts: ['all'], 
      aggregation: 'none', 
      stacked: false, 
      cols: 24, 
      rows: 11 
    },
    { 
      id: 'chart-6', 
      title: 'Network Load & Resource Correlation (Dual-Axis Mixed Stacking)', 
      type: 'chart', 
      chartType: 'mixed', 
      metrics: ['traffic', 'cpu'], 
      hosts: ['srv-prod-01', 'sql-db-primary', 'gateway-02'], 
      aggregation: 'none', 
      stacked: false, 
      cols: 24, 
      rows: 12,
      seriesConfig: {
        series1: {
          metrics: ['traffic'],
          metric: 'traffic',
          hosts: ['srv-prod-01', 'sql-db-primary', 'gateway-02'],
          host: 'srv-prod-01',
          yAxis: 'left',
          chartType: 'bar',
          aggregation: 'none',
          stacked: true
        },
        series2: {
          metrics: ['cpu'],
          metric: 'cpu',
          hosts: ['all'],
          host: 'all',
          yAxis: 'right',
          chartType: 'area',
          aggregation: 'avg',
          stacked: false
        }
      }
    }
  ];

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

  // Load saved dashboards on storage key change
  useEffect(() => {
    const saved = localStorage.getItem(dashboardStorageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migrate old scale to 24-col scale if they are using the old small numbers
        const migrated = parsed.map((db: Dashboard) => ({
          ...db,
          widgets: db.widgets.map((w: Widget) => ({
            ...w,
            cols: w.cols <= 4 ? w.cols * 6 : w.cols,
            rows: w.rows <= 3 ? w.rows * 4 : w.rows
          }))
        }));
        setSavedDashboards(migrated);
      } catch (e) {
        console.error("Failed to parse saved dashboards", e);
      }
    } else {
      // Initialize with default if first time
      const initialWidgets = dashboardStorageKey === 'hareporting_dashboards_v5' ? defaultWidgets : [];
      const initialDashboard: Dashboard = {
        id: 'default-board-1',
        name: 'Executive Overview',
        widgets: initialWidgets
      };
      setSavedDashboards([initialDashboard]);
      setActiveDashboardId('default-board-1');
      localStorage.setItem(dashboardStorageKey, JSON.stringify([initialDashboard]));
    }
    
    // Set initial widgets
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
        if (migrated.length > 0) {
          setWidgets(migrated[0].widgets);
          setDashboardName(migrated[0].name);
          setActiveDashboardId(migrated[0].id);
        } else {
          setWidgets(dashboardStorageKey === 'hareporting_dashboards_v5' ? defaultWidgets : []);
        }
      } catch (e) {
        setWidgets(dashboardStorageKey === 'hareporting_dashboards_v5' ? defaultWidgets : []);
      }
    } else {
      setWidgets(dashboardStorageKey === 'hareporting_dashboards_v5' ? defaultWidgets : []);
    }
  }, [dashboardStorageKey]);

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

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const activeMetrics = activeMetricsStr ? activeMetricsStr.split(',') : (availableMetrics.length > 0 ? [availableMetrics[0]] : ['cpu']);
      const activeHosts = activeHostsStr ? activeHostsStr.split(',') : (availableHosts.length > 0 ? [availableHosts[0]] : ['srv-prod-01']);

      const response = await axios.post("/api/timeseries", {
        granularity: filters.mode === 'live' ? filters.granularity : filters.granularity,
        range: filters.range,
        mode: filters.mode,
        start: filters.start,
        end: filters.end,
        url: zabbixConfig.url,
        token: zabbixConfig.token,
        metrics: activeMetrics,
        hosts: activeHosts,
        itemDict: metricDict
      });
      setData(response.data);
      setLastSync(new Date());
    } catch (error: any) {
      console.error("Failed to fetch statistics", error);
      if (error.response?.status !== 401 && error.message !== "Switched to Demo Mode") {
        const msg = error.response?.data?.error || "Failed to fetch statistics from Zabbix";
        showToast(msg, "error");
      }
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  }, [filters.range, filters.mode, filters.start, filters.end, filters.granularity, zabbixConfig, activeMetricsStr, activeHostsStr, availableMetrics, availableHosts, metricDict]);

  const handleSync = () => {
    fetchStats();
  };

  useEffect(() => {
    fetchStats();
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
         
         const progress = Math.max(0, Math.min(100, ((t - lastRefreshTime) / (nextRefreshTime - lastRefreshTime)) * 100));
         setRefreshProgress(progress);
      };
      
      let lastSettledEnd = Math.floor((Date.now() - 60000) / stepMs) * stepMs;
      
      const interval = setInterval(() => {
         updateProgress();
         const t = Date.now();
         const currentSettledEnd = Math.floor((t - 60000) / stepMs) * stepMs;
         if (currentSettledEnd > lastSettledEnd) {
             lastSettledEnd = currentSettledEnd;
             fetchStats();
         }
      }, 1000);
      
      updateProgress();
      
      return () => clearInterval(interval);
    } else {
      setRefreshProgress(0);
    }
  }, [fetchStats, filters.mode, filters.granularity]);

  const handleAddWidget = (type: 'kpi' | 'chart') => {
    const newWidget: Widget = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'New Telemetry Probe',
      type,
      chartType: 'area',
      metrics: isDemo ? ['cpu'] : (availableMetrics.length > 0 ? [availableMetrics[0]] : []),
      hosts: isDemo ? ['srv-prod-01'] : (availableHosts.length > 0 ? [availableHosts[0]] : []),
      aggregation: 'avg',
      stacked: false,
      cols: type === 'kpi' ? 6 : 12,
      rows: type === 'kpi' ? 4 : 10,
    };
    setWidgets([...widgets, newWidget]);
    setEditingWidgetId(newWidget.id);
  };

  const handleRemoveWidget = (id: string) => {
    setWidgets(widgets.filter(w => w.id !== id));
  };

  const handleUpdateWidget = (id: string, updates: Partial<Widget>) => {
    setWidgets(widgets.map(w => w.id === id ? { ...w, ...updates } : w));
  };

  const handleMoveWidget = (id: string, direction: 'left' | 'right') => {
    const index = widgets.findIndex(w => w.id === id);
    if ((direction === 'left' && index === 0) || (direction === 'right' && index === widgets.length - 1)) return;
    const newWidgets = [...widgets];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    [newWidgets[index], newWidgets[targetIndex]] = [newWidgets[targetIndex], newWidgets[index]];
    setWidgets(newWidgets);
  };

  const handleSaveDashboard = (name: string) => {
    const newDashboard: Dashboard = {
      id: Math.random().toString(36).substr(2, 9),
      name: name || dashboardName,
      widgets: [...widgets]
    };
    const updated = [...savedDashboards, newDashboard];
    setSavedDashboards(updated);
    localStorage.setItem(dashboardStorageKey, JSON.stringify(updated));
    setActiveDashboardId(newDashboard.id);
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
    // Automatically trigger rename mode for the new board
    setIsRenaming(true);
    setTempDashboardName(newName);
  };

  const handleDeleteDashboard = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Safety check: Don't delete the only dashboard if we want to keep at least one, 
    // but here we'll just proceed with standard state update.
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
  }, [activeDashboardId, defaultWidgets]);

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

  const handleImportSuccess = (json: any) => {
    setWidgets(json.widgets);
    if (json.name) setDashboardName(json.name);
  };

  const discoverZabbixAssets = useCallback(async (manual = false, overrideConfig?: {url: string, token: string}) => {
    console.log("Starting Zabbix host discovery...");
    const urlToUse = overrideConfig?.url || zabbixConfig.url;
    const tokenToUse = overrideConfig?.token || zabbixConfig.token;
    
    if (!tokenToUse || !urlToUse) {
      if (manual) setDiscoveryStatus({ type: 'error', message: "Please specify URL and Token first." });
      return;
    }
    
    if (manual) {
      setIsDiscovering(true);
      setDiscoveryStatus(null);
    }
    try {
      // 1. Discover Hosts
      const hostRes = await axios.post("/api/zabbix", {
        url: urlToUse,
        token: tokenToUse,
        method: "host.get",
        params: { output: ["host", "name"] }
      });
      
      if (hostRes.data.result) {
        const hosts = hostRes.data.result.map((h: any) => h.name || h.host);
        setAvailableHosts(hosts);
      }

      // 2. Discover Items (Metrics)
      const itemRes = await axios.post("/api/zabbix", {
        url: urlToUse,
        token: tokenToUse,
        method: "item.get",
        params: { 
          output: ["name", "key_", "units", "itemid", "value_type", "lastvalue"], 
          selectHosts: ["name", "host"],
          monitored: true,
          limit: 5000
        }
      });

      if (itemRes.data.result) {
        const units: Record<string, string> = {};
        const mapping: Record<string, string[]> = {};
        const dict: Record<string, {itemid: string, value_type: string, lastvalue: string}> = {};
        itemRes.data.result.forEach((i: any) => {
          const base = i.name;
          if (i.units) units[base] = i.units;
          if (i.hosts && i.hosts.length > 0) {
            i.hosts.forEach((h: any) => {
              const hostName = h.name || h.host;
              if (!mapping[hostName]) mapping[hostName] = [];
              mapping[hostName].push(base);
              dict[`${base}_${hostName}`] = { itemid: i.itemid, value_type: i.value_type, lastvalue: i.lastvalue };
            });
          }
        });
        setMetricDict(dict);
        setMetricUnitsMap(prev => ({ ...prev, ...units }));

        for (const host in mapping) {
          mapping[host] = Array.from(new Set(mapping[host]));
        }
        setHostMetricsMap(mapping);
        
        const metrics = Array.from(new Set(itemRes.data.result.map((i: any) => i.name)));
        setAvailableMetrics(metrics as string[]);
      }
      
      console.log("Zabbix Assets Discovered Successfully");
      if (manual) {
        setDiscoveryStatus({ 
          type: hostRes.data.result.length === 0 ? 'error' : 'success', 
          message: `Discovered ${hostRes.data.result.length} hosts and ${itemRes.data.result.length} metrics.${hostRes.data.result.length === 0 ? ' (Hint: Ensure your Zabbix API User has explicit Read permissions for Host Groups in Zabbix under Users -> User Groups)' : ''}` 
        });
      }
    } catch (e: any) {
      console.error("Zabbix Discovery Failed", e);
      const msg = e.response?.data?.error || e.message || "Zabbix Discovery Failed";
      if (manual) setDiscoveryStatus({ type: 'error', message: msg });
    } finally {
      if (manual) setIsDiscovering(false);
    }
  }, [zabbixConfig]);

  const [initialDiscoveryTriggered, setInitialDiscoveryTriggered] = useState(false);
  useEffect(() => {
    // Only attempt automatic discovery if configuration was loaded from env or local storage.
    // If not, we just mark it as triggered so we don't fire while the user explicitly types.
    if (!initialDiscoveryTriggered) {
      const hasValidConfig = zabbixConfig.url && (zabbixConfig.token || zabbixConfig.isPreconfigured);
      if (hasValidConfig) {
        discoverZabbixAssets(false);
      }
      // Always set to true after first evaluation to prevent auto-triggering on keystrokes.
      setInitialDiscoveryTriggered(true);
    }
  }, [zabbixConfig, initialDiscoveryTriggered, discoverZabbixAssets]);

  const [draftZabbixConfig, setDraftZabbixConfig] = useState(zabbixConfig);

  // Sync draft when zabbixConfig changes from the initial load
  useEffect(() => {
    setDraftZabbixConfig(zabbixConfig);
  }, [zabbixConfig]);

  const handleSaveZabbixConfig = () => {
    setZabbixConfig(draftZabbixConfig);
    localStorage.setItem('hareporting_zabbix_url', draftZabbixConfig.url);
    localStorage.setItem('hareporting_zabbix_token', draftZabbixConfig.token);
    setSavedZabbixUrl(draftZabbixConfig.url);
    
    setDiscoveryStatus({ type: 'success', message: "Configuration saved." });
  };
  
  const handleDemoMode = () => {
    const simConfig = { url: '', token: '', isPreconfigured: false };
    setDraftZabbixConfig(simConfig);
    setZabbixConfig(simConfig);
    localStorage.setItem('hareporting_zabbix_url', '');
    localStorage.setItem('hareporting_zabbix_token', '');
    setSavedZabbixUrl('');
    setDiscoveryStatus({ type: 'success', message: "Reverted to Demo Mode." });
    setAvailableHosts(['srv-prod-01', 'sql-db-primary', 'gateway-02']);
    setAvailableMetrics(['cpu', 'memory', 'traffic', 'latency', 'disk']);
  };

  const [showRangeMenu, setShowRangeMenu] = useState(false);
  const [showGranMenu, setShowGranMenu] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);

  const rangeMenuBtnRef = useRef<HTMLButtonElement>(null);
  const granMenuBtnRef = useRef<HTMLButtonElement>(null);
  const modeMenuBtnRef = useRef<HTMLButtonElement>(null);

  const filterScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollFiltersLeft, setCanScrollFiltersLeft] = useState(false);
  const [canScrollFiltersRight, setCanScrollFiltersRight] = useState(false);

  const checkFilterScroll = useCallback(() => {
    if (filterScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = filterScrollRef.current;
      setCanScrollFiltersLeft(scrollLeft > 1);
      setCanScrollFiltersRight(scrollLeft + clientWidth < scrollWidth - 2);
    }
  }, []);

  useEffect(() => {
    // Add brief delay to ensure rendering completes
    const timer = setTimeout(checkFilterScroll, 100);
    window.addEventListener('resize', checkFilterScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkFilterScroll);
    };
  }, [checkFilterScroll, view, filters]);

  const renderContent = () => {
    if (view === "network") {
      return <NetworkTopology filters={filters} globalSearch={globalSearch} zabbixConfig={zabbixConfig} />;
    }

    if (view === "infra") {
      return <InfraInventory filters={filters} globalSearch={globalSearch} zabbixConfig={zabbixConfig} showToast={showToast} />;
    }

    if (view === "notifications") {
      const zabbixBaseUrl = zabbixConfig.url.replace('/api_jsonrpc.php', '');
      return <NotificationFeed globalSearch={globalSearch} zabbixBaseUrl={zabbixBaseUrl} zabbixConfig={zabbixConfig} showToast={showToast} />;
    }

    if (view === "config") {
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
                    onChange={e => localStorage.setItem('hareporting_app_secure_token', e.target.value)}
                    placeholder={localStorage.getItem('hareporting_app_secure_token') ? "Token is set. Enter a new one to update..." : "Your APP_SECURE_TOKEN..."}
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
                    setZabbixConfig(draftZabbixConfig);
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
          </Card>
        </div>
        </div>
      );
    }

    if (view !== "dashboard") {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-12 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">{view === 'network' ? 'Network Topology' : view === 'infra' ? 'Hardware Inventory' : 'System Alerts'}</h2>
          <p className="text-slate-500">Live telemetry stream active. Data visualization loading...</p>
        </div>
      );
    }

    return (
      <>
        {/* Dashboard Grid */}
        <div 
          className={cn(
            "grid auto-rows-[25px] sm:auto-rows-[30px] lg:auto-rows-[25px]",
            isMobile ? "grid-cols-1 gap-6" : "gap-4"
          )}
          style={!isMobile ? { gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' } : {}}
        >
          <AnimatePresence mode="popLayout">
            {widgets.filter(w => 
              w.title.toLowerCase().includes(globalSearch.toLowerCase()) ||
              w.metrics.some(m => m.toLowerCase().includes(globalSearch.toLowerCase())) ||
              w.hosts.some(h => h.toLowerCase().includes(globalSearch.toLowerCase()))
            ).map((w, index) => {
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
                        // For mixed charts, check if data exists? Let's just check hiddenSeries
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
                animate={{ 
                  opacity: 1, 
                  scale: 1
                }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{
                  layout: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 }
                }}
                data-widget-id={w.id}
                className={cn(
                  "relative group",
                  draggingWidgetId === w.id ? "z-[100] shadow-2xl ring-2 ring-blue-500/50 bg-white cursor-grabbing" :
                  editingWidgetId === w.id ? "z-[100]" : "z-10 hover:z-[60]",
                  hasFilter && "ring-2 ring-amber-400/80 ring-offset-2 ring-offset-slate-50"
                )}
                style={Object.assign(
                  {}, 
                  { 
                    gridRowEnd: isMobile ? (w.type === 'kpi' ? 'span 6' : 'span 12') : `span ${w.rows || 10}`,
                    gridColumn: isMobile ? 'span 1' : (w.forceNewline ? `1 / span ${w.cols || 24}` : `span ${w.cols || 24} / span ${w.cols || 24}`)
                  }
                )}
              >
                {/* Widget Controls (Top Left Stack) */}
                <div className={cn(
                  "absolute inset-0 z-30 pointer-events-none opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                  draggingWidgetId === w.id && "opacity-0"
                )}>
                  <div className="absolute top-3 right-3 flex flex-col justify-start gap-1.5 items-end pointer-events-auto z-50">
                      {widgetZoomDomains[w.id] && (
                        <button 
                          onClick={() => handleZoomOut(w.id)}
                          className="flex items-center gap-1.5 px-2 py-1.5 bg-sky-50 text-sky-600 border border-sky-200 hover:bg-sky-100 hover:text-sky-700 hover:border-sky-300 rounded-lg shadow-sm transition-all backdrop-blur-md text-[10px] font-bold uppercase tracking-wider h-[26px]"
                          title="Zoom Out"
                        >
                          <ZoomOut className="w-3 h-3" />
                          <span className="hidden sm:inline">Reset Zoom</span>
                        </button>
                      )}
                    {/* 1. Edit */}
                    <button 
                      onClick={() => setEditingWidgetId(editingWidgetId === w.id ? null : w.id)}
                      className={cn(
                        "p-1.5 rounded-lg border transition-all shadow-sm backdrop-blur-md h-[26px] w-[26px] flex items-center justify-center shrink-0",
                        editingWidgetId === w.id ? "bg-blue-600 border-blue-500 text-white" : "bg-white/90 border-slate-200/50 text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                      )}
                      title="Edit Widget"
                    >
                      <Settings2 className="w-3 h-3" />
                    </button>

                    {/* 2. Drag Handle */}
                    {!isMobile && (
                      <div 
                        className="flex items-center justify-center p-1.5 bg-white/90 backdrop-blur-md rounded-lg shadow-sm border border-slate-200/50 text-slate-400 cursor-grab active:cursor-grabbing hover:bg-slate-50 hover:text-slate-600 transition-colors h-[26px] w-[26px] shrink-0"
                        onMouseDown={(e) => {
                          // Only trigger drag if we are not clicking a button
                          if ((e.target as HTMLElement).closest('button')) return;
                          
                          const startX = e.clientX;
                          const startY = e.clientY;
                          let isDragging = false;
                          const dragThreshold = 5;

                          const handleGlobalMouseMove = (moveEvent: MouseEvent) => {
                            const dist = Math.sqrt(Math.pow(moveEvent.clientX - startX, 2) + Math.pow(moveEvent.clientY - startY, 2));
                            
                            if (!isDragging && dist > dragThreshold) {
                              isDragging = true;
                              setDraggingWidgetId(w.id);
                              document.body.style.cursor = 'grabbing';
                            }

                            if (isDragging) {
                              // Find element under cursor
                              const elements = document.elementsFromPoint(moveEvent.clientX, moveEvent.clientY);
                              const hoveredWidget = elements.find(el => 
                                el.getAttribute('data-widget-id') && el.getAttribute('data-widget-id') !== w.id
                              );

                              if (hoveredWidget) {
                                const targetId = hoveredWidget.getAttribute('data-widget-id');
                                if (targetId) {
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

                    {/* 3. Move up-down (was left-right) */}
                    <div className="flex flex-col bg-white/90 backdrop-blur-md border border-slate-200/50 rounded-lg overflow-hidden shadow-sm shrink-0">
                      <button 
                        onClick={() => handleMoveWidget(w.id, 'left')} 
                        className={cn(
                          "p-1 hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors border-b border-slate-200/50 flex items-center justify-center",
                          index === 0 && "opacity-20 pointer-events-none"
                        )} 
                        title="Move Up"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={() => handleMoveWidget(w.id, 'right')} 
                        className={cn(
                          "p-1 hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors flex items-center justify-center",
                          index === widgets.length - 1 && "opacity-20 pointer-events-none"
                        )} 
                        title="Move Down"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>

                    {/* 4. Delete */}
                    <button 
                      onClick={() => handleRemoveWidget(w.id)}
                      className="p-1.5 bg-white/90 hover:bg-rose-50 border border-slate-200/50 hover:border-rose-200 text-slate-400 hover:text-rose-600 rounded-lg shadow-sm transition-all backdrop-blur-md h-[26px] w-[26px] flex items-center justify-center opacity-60 hover:opacity-100 shrink-0"
                      title="Remove Widget"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                {/* Resize Handles (Hidden on small screens) */}
                <div 
                  className="hidden sm:flex absolute -top-1 left-6 right-6 h-2 cursor-row-resize pointer-events-auto group/v-resize flex-col items-center justify-center select-none"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const startY = e.clientY;
                    const startRows = w.rows || 10;
                    
                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      const deltaY = startY - moveEvent.clientY; 
                      const rowThreshold = 35; // Fine grained control
                      const deltaRows = Math.round(deltaY / rowThreshold);
                      const nextRows = Math.min(20, Math.max(1, startRows + deltaRows));
                      if (nextRows !== w.rows) {
                        handleUpdateWidget(w.id, { rows: nextRows });
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

                <div 
                  className="hidden sm:flex absolute top-6 bottom-6 -right-1 w-2 cursor-col-resize pointer-events-auto group/h-resize items-center justify-center select-none"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const startX = e.clientX;
                    const startCols = w.cols || 24;
                    const gridContainer = (e.currentTarget as HTMLElement).closest('.grid');
                    const availableWidth = gridContainer ? gridContainer.clientWidth : window.innerWidth;
                    const colThreshold = availableWidth / 24; // Dynamic exact grid column width
                    
                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      const deltaX = moveEvent.clientX - startX;
                      const deltaCols = Math.round(deltaX / colThreshold);
                      const nextCols = Math.min(24, Math.max(1, startCols + deltaCols));
                      if (nextCols !== w.cols) {
                        handleUpdateWidget(w.id, { cols: nextCols });
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

              {editingWidgetId === w.id ? createPortal(
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
                              if (!isDemo) {
                                if (w.hosts.length === 0) {
                                  optionsForWidget = availableMetrics;
                                } else {
                                  const metricItems = new Set<string>();
                                  w.hosts.forEach(h => {
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
                                    options={(!isDemo && w.hosts.length > 0) ? optionsForWidget : availableMetrics} 
                                    selected={w.metrics} 
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
                              const sConf = w.seriesConfig?.[seriesKey] || { metric: availableMetrics[0] || '', host: availableHosts[0] || 'all', yAxis: idx === 0 ? 'left' : 'right', chartType: 'line', aggregation: 'none', stacked: false };
                              
                              const generateOption = (val: string, lbl: string) => <option value={val} key={val}>{lbl}</option>;
                              
                              return (
                                <React.Fragment key={seriesKey}>
                                  {idx === 1 && (
                                    <div className="flex justify-center relative z-10 w-full my-6">
                                      <div className="absolute inset-x-0 h-[1px] bg-slate-200 dark:bg-slate-800 top-1/2 -translate-y-1/2 -mx-6 sm:-mx-8" />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const prevSeries1 = w.seriesConfig?.['series1'] || { metric: availableMetrics[0] || '', host: availableHosts[0] || 'all', yAxis: 'left', chartType: 'line', aggregation: 'none', stacked: false };
                                          const prevSeries2 = w.seriesConfig?.['series2'] || { metric: availableMetrics[0] || '', host: availableHosts[0] || 'all', yAxis: 'right', chartType: 'line', aggregation: 'none', stacked: false };
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
                                      <span className="text-sm font-bold text-blue-600 dark:text-sky-400 capitalize">Series {idx + 1}</span>
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
                                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Axis</label>
                                        <div className="relative">
                                          <select 
                                            value={sConf.yAxis} 
                                            onChange={(e) => handleUpdateWidget(w.id, { seriesConfig: { ...w.seriesConfig, [seriesKey]: { ...sConf, yAxis: e.target.value as any } } })}
                                            className="w-full bg-slate-100 dark:bg-slate-900/80 text-xs py-2 pl-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white outline-none appearance-none cursor-pointer focus:border-blue-500 dark:focus:border-sky-500 transition-colors"
                                          >
                                            <option value="left">Primary (Left)</option>
                                            <option value="right">Secondary (Right)</option>
                                          </select>
                                          <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                          </div>
                                        </div>
                                      </div>
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
              ) : (
                w.type === 'kpi' ? (
                  (() => {
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
                  })()
                ) : (
                  (() => {
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
                           // Aggregate all selected hosts for each selected metric
                           smetrics.forEach(m => {
                             const aggKey = `${sKey}_${m}_agg`;
                             const u = metricUnitsMap[m] === '%' ? '%' : ` ${metricUnitsMap[m]}`;
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
                             const u = metricUnitsMap[m] === '%' ? '%' : ` ${metricUnitsMap[m]}`;
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
                       chartSeries = [{ key: 'agg_val', name: label, color: getDeterministicColor('agg_val', w.metrics[0]), unit: u }];
                      
                      chartData = data.map(point => {
                        let values: number[] = [];
                        w.metrics.forEach(m => {
                          const hostsToUse = w.hosts.includes('all') ? availableHosts : w.hosts;
                          hostsToUse.forEach(h => {
                            const key = `${m}_${h}`;
                            if (!hiddenSeries.has(key) && point[key] !== undefined) {
                              values.push(Number(point[key]));
                            }
                          });
                        });
                        
                        const sum = values.reduce((a, b) => a + b, 0);
                        const val = w.aggregation === 'avg' && values.length > 0 ? sum / values.length : sum;
                        
                        return {
                          ...point,
                          agg_val: val
                        };
                      });
                    } else {
                      w.metrics.forEach(m => {
                        const u = metricUnitsMap[m] === '%' ? '%' : ` ${metricUnitsMap[m]}`;
                        const hostsToUse = w.hosts.includes('all') ? availableHosts : w.hosts;
                        hostsToUse.forEach(h => {
                          const key = `${m}_${h}`;
                          const hostLabel = h;
                          const metricLabel = m.toUpperCase();
                          chartSeries.push({
                            key,
                            name: (w.hosts.length > 1 || w.hosts.includes('all') || w.metrics.length > 1) ? `${metricLabel} [${hostLabel}]` : metricLabel,
                            color: getDeterministicColor(key, m),
                            metric: m,
                            unit: u
                          });
                        });
                      });
                    }

                    return (
                      <TrendChart 
                        title={w.title} 
                        data={chartData} 
                        series={chartSeries}
                        hosts={w.hosts}
                        stacked={w.stacked}
                        chartType={w.chartType}
                        seriesConfig={w.seriesConfig}
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
                          // Toggle all series for this host
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
                  })()
                )
              )}
              </motion.div>
            )})}
          </AnimatePresence>
        </div>
      </>
    );
  };

  const relevantHiddenSeries = useMemo(() => {
    if (view !== 'dashboard') return new Set<string>();
    const activeWidgetKeys = new Set<string>();
    widgets.forEach(w => {
      w.metrics.forEach(m => {
        w.hosts.forEach(h => {
          activeWidgetKeys.add(`${m}_${h}`);
        });
      });
    });
    return new Set(Array.from(hiddenSeries).filter((key: string) => activeWidgetKeys.has(key)));
  }, [hiddenSeries, widgets, view]);

  return (
    <>
    <Shell 
      topBar={
        <div className="flex items-center justify-between w-full h-full text-slate-800 dark:text-slate-200 gap-2 sm:gap-4 lg:gap-8">
          {view !== 'config' ? (
            <div className="hidden md:flex items-center w-[25%] md:max-w-[70px] lg:max-w-[100px] xl:max-w-[220px] h-[40px] pr-1 lg:pr-2 shrink transition-all min-w-[50px]">
              <Search className="w-5 h-5 text-slate-800 dark:text-slate-400 shrink-0 mr-2 md:mr-3 stroke-[2.5]" />
              <input 
                type="text" 
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search" 
                className="w-full bg-transparent text-[15px] font-semibold text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 min-w-[30px]" 
              />
            </div>
          ) : <div />}

          <div className="flex-1 min-w-0 flex items-center h-full justify-end select-none">
            {['dashboard', 'network', 'infra'].includes(view) && (
              <div className="w-full h-full max-w-full min-w-0">
               <ScrollableBar>
                  <div className="flex flex-nowrap items-center gap-1 sm:gap-4 py-1 h-full pt-1.5 shrink-0 px-2 sm:px-0 min-w-max ml-auto">
                    {filters.mode === 'live' ? (
                      <>
                        <div className="flex items-center min-w-[120px] h-full shrink-0">
                          <button 
                            ref={rangeMenuBtnRef}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowRangeMenu(!showRangeMenu); }}
                            className="bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 py-1 px-2 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none transition-all w-full text-left flex items-center justify-between gap-2 h-full rounded"
                          >
                            <span className="flex items-center gap-2">
                              <span className="text-slate-500 font-normal hidden xl:inline">Rolling:</span>
                              <span className="font-semibold text-blue-600 dark:text-sky-400">
                                {filters.range === '1h' ? 'Last Hour' : 
                                filters.range === '6h' ? 'Last 6 Hours' : 
                                filters.range === '24h' ? 'Last 24 Hours' : 'Last 7 Days'}
                              </span>
                            </span>
                            <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                          </button>
                        </div>
                        <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800 shrink-0" />
                        <div className="flex items-center min-w-[120px] h-full shrink-0">
                          <button 
                            ref={granMenuBtnRef}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowGranMenu(!showGranMenu); }}
                            className="bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 py-1 px-2 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none transition-all w-full text-left flex items-center justify-between gap-2 h-full rounded"
                          >
                            <span className="flex items-center gap-2">
                              <span className="text-slate-500 font-normal hidden xl:inline">Granularity:</span>
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {filters.granularity === '1m' ? '1 Min' :
                                filters.granularity === '5m' ? '5 Min' :
                                filters.granularity === '15m' ? '15 Min' : '1 Hour'}
                              </span>
                            </span>
                            <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <RangePicker 
                          range={{ start: filters.start, end: filters.end }}
                          onChange={(newVal) => setFilters({...filters, ...newVal})}
                        />
                        <div className="hidden sm:block w-[1px] h-4 bg-slate-200 dark:bg-slate-800 shrink-0" />
                        <div className="flex items-center min-w-[100px] h-full shrink-0">
                          <button 
                            ref={granMenuBtnRef}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowGranMenu(!showGranMenu); }}
                            className="bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 py-1 px-2 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none transition-all w-full text-left flex items-center justify-between gap-2 h-full rounded"
                          >
                            <span className="flex items-center gap-2">
                              <span className="text-slate-500 font-normal hidden xl:inline">Resolution:</span>
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {filters.granularity === '5m' ? '5 Min' :
                                filters.granularity === '30m' ? '30 Min' :
                                filters.granularity === '1d' ? '1 Day' : '1 Hour'}
                              </span>
                            </span>
                            <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                          </button>
                        </div>
                      </>
                    )}
                    <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800 block shrink-0" />
                    <div className="flex items-center min-w-[80px] sm:min-w-[100px] h-full shrink-0">
                      <button 
                        ref={modeMenuBtnRef}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowModeMenu(!showModeMenu); }}
                        className="bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 py-1 px-2 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none transition-all w-full text-left flex items-center justify-between gap-2 h-full rounded relative overflow-hidden"
                      >
                        <span className="flex items-center gap-2 relative z-10 w-full h-full justify-between">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {filters.mode === 'live' ? 'Live' : 'Historical'}
                          </span>
                          <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                        </span>
                        {filters.mode === 'live' && (
                            <div 
                              className="absolute bottom-0 left-0 h-[3px] bg-blue-600 transition-all duration-1000 ease-linear pointer-events-none rounded-b" 
                              style={{ width: `${refreshProgress}%` }} 
                            />
                        )}
                      </button>
                    </div>
                  </div>
               </ScrollableBar>
              </div>
            )}
            
            {/* Popups */}
            <PortalMenu isOpen={showRangeMenu} onClose={() => setShowRangeMenu(false)} anchorRef={rangeMenuBtnRef}>
               {['1h', '6h', '24h', '7d'].map((r) => (
                 <button 
                   key={r}
                   onClick={() => {
                     setFilters({...filters, range: r});
                     setShowRangeMenu(false);
                   }}
                   className={cn(
                     "w-full px-4 py-2.5 text-sm font-medium text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                     filters.range === r ? "text-blue-700 dark:text-sky-400 bg-blue-50/80 dark:bg-sky-500/10" : "text-slate-600 dark:text-slate-400"
                   )}
                 >
                   {r === '1h' ? 'Last Hour' : 
                    r === '6h' ? '6 Hours' : 
                    r === '24h' ? '24 Hours' : '7 Days'}
                 </button>
               ))}
            </PortalMenu>

            <PortalMenu isOpen={showGranMenu} onClose={() => setShowGranMenu(false)} anchorRef={granMenuBtnRef}>
               {(filters.mode === 'live' ? ['1m', '5m', '15m', '1h'] : ['5m', '30m', '1h', '1d']).map((g) => (
                 <button 
                   key={g}
                   onClick={() => {
                     setFilters({...filters, granularity: g});
                     setShowGranMenu(false);
                   }}
                   className={cn(
                     "w-full px-4 py-2.5 text-sm font-medium text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                     filters.granularity === g ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-500/10" : "text-slate-600 dark:text-slate-400"
                   )}
                 >
                   {g === '1m' ? '1 Minute' : g === '5m' ? '5 Minutes' : g === '15m' ? '15 Minutes' : g === '30m' ? '30 Minutes' : g === '1d' ? '1 Day' : '1 Hour'}
                 </button>
               ))}
            </PortalMenu>

            <PortalMenu isOpen={showModeMenu} onClose={() => setShowModeMenu(false)} anchorRef={modeMenuBtnRef} align="right">
               <button
                 onClick={() => { setFilters({...filters, mode: 'live'}); setShowModeMenu(false); }}
                 className={cn(
                   "w-full px-4 py-2.5 text-sm font-medium text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                   filters.mode === 'live' ? "text-blue-700 dark:text-sky-400 bg-blue-50/80 dark:bg-sky-500/10" : "text-slate-600 dark:text-slate-400"
                 )}
               >
                 Live
               </button>
               <button
                 onClick={() => { setFilters({...filters, mode: 'historical'}); setShowModeMenu(false); }}
                 className={cn(
                   "w-full px-4 py-2.5 text-sm font-medium text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                   filters.mode === 'historical' ? "text-blue-700 dark:text-sky-400 bg-blue-50/80 dark:bg-sky-500/10" : "text-slate-600 dark:text-slate-400"
                 )}
               >
                 Historical
               </button>
            </PortalMenu>
            
          </div>
        </div>
      }
      savedDashboards={savedDashboards} 
      onSelectDashboard={handleSelectDashboard}
      onRenameDashboard={handleRenameDashboardLocal}
      onAddDashboard={handleCreateDashboard}
      onDeleteDashboard={handleDeleteDashboard}
      activeDashboardId={activeDashboardId}
      onNavigate={(v: View) => setView(v)}
      currentView={view}
      lastSync={lastSync}
      isDemo={isDemo}
      hiddenSeries={relevantHiddenSeries}
      toggleSeriesVisibility={toggleSeriesVisibility}
    >
      <div className="w-full space-y-4">
        {/* Page Title Section Simplified */}
        <div className="flex flex-row items-center justify-between mb-4 flex-wrap gap-4">
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
                    className="bg-transparent border-b border-blue-500 px-1 py-1 text-2xl font-black text-slate-900 focus:outline-none w-full"
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
                      className="p-1.5 text-slate-400 hover:text-slate-700 bg-transparent hover:bg-slate-200/50 rounded-md lg:opacity-0 group-hover/header:opacity-100 transition-all border border-transparent shrink-0"
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

        {/* Telemetry Controls & Designer Bar */}


        {renderContent()}
      </div>
    </Shell>
    {secureTokenPrompt && (
      <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
          <div className="p-6">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-xl flex items-center justify-center shadow-sm mb-4">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield text-indigo-600 dark:text-indigo-400"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Authentication Required</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              This dashboard is protected by a secure token to prevent unauthorized access.
            </p>
            <form onSubmit={e => {
              e.preventDefault();
              localStorage.setItem("hareporting_app_secure_token", secureTokenInput);
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
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono text-sm leading-tight" 
                    placeholder="Enter APP_SECURE_TOKEN..." 
                    autoFocus
                  />
                </div>
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg shadow-sm transition-colors mt-2">
                  Verify Access
                </button>
                <button type="button" onClick={() => {
                  setSecureTokenPrompt(false);
                  setZabbixConfig({url: '', token: '', isPreconfigured: false});
                  setDraftZabbixConfig({url: '', token: '', isPreconfigured: false});
                  localStorage.setItem('hareporting_zabbix_url', '');
                  localStorage.setItem('hareporting_zabbix_token', '');
                  if (window._rejectToken) {
                     window._rejectToken(new Error("Switched to Demo Mode"));
                     window._resolveToken = undefined;
                     window._rejectToken = undefined;
                  }
                }} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 rounded-lg shadow-sm transition-colors mt-2">
                  Execute in Demo Mode
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )}
    {isImportModalOpen && createPortal(
      <ImportModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportSuccess}
      />,
      document.body
    )}
    {toast && createPortal(
      <div className="fixed bottom-6 right-6 z-[250] pointer-events-none max-w-sm w-full font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className={cn(
            "p-4 shadow-xl border select-none pointer-events-auto flex items-center gap-3 backdrop-blur-md",
            toast.type === 'error' ? "bg-rose-50/95 dark:bg-rose-950/90 border-rose-100 dark:border-rose-900 text-rose-800 dark:text-rose-200" :
            toast.type === 'success' ? "bg-emerald-50/90 dark:bg-emerald-950/90 border-emerald-100 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200" :
            toast.type === 'warning' ? "bg-amber-50/90 dark:bg-amber-950/90 border-amber-100 dark:border-amber-900 text-amber-800 dark:text-amber-200" :
            "bg-blue-50/90 dark:bg-blue-950/90 border-blue-100 dark:border-blue-900 text-blue-800 dark:text-blue-200"
          )}
        >
          <div className="shrink-0">
            {toast.type === 'error' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            ) : toast.type === 'success' ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            )}
          </div>
          <p className="text-sm font-semibold flex-1 leading-normal">{toast.message}</p>
        </motion.div>
      </div>,
      document.body
    )}
    {colorPickerTarget && createPortal(
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col"
        >
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 dark:text-white">Choose Color</h3>
            <button onClick={() => setColorPickerTarget(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-500">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">Selecting a color for metric <span className="font-semibold text-slate-900 dark:text-slate-200">{colorPickerTarget.metric}</span>. This will apply globally across all dashboards.</p>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Custom Hex:</span>
              <div className="flex-1 flex gap-2">
                 <input 
                   type="text" 
                   value={colorPickerTarget.current} 
                   onChange={(e) => setColorPickerTarget({...colorPickerTarget, current: e.target.value})}
                   className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-sm outline-none text-slate-800 dark:text-slate-200 uppercase font-mono"
                 />
                 <div className="w-8 h-8 rounded-md shrink-0 border border-slate-200 dark:border-slate-800 shadow-inner" style={{backgroundColor: colorPickerTarget.current}}/>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2">
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
                    "w-full pt-[100%] rounded-md relative outline-none ring-offset-2 dark:ring-offset-slate-900 transition-all hover:scale-110",
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
              className="px-4 py-2 font-medium text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                updateMetricColor(colorPickerTarget.metric, colorPickerTarget.current);
                setColorPickerTarget(null);
              }}
              className="px-4 py-2 font-semibold text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors"
            >
              Apply Globally
            </button>
          </div>
        </motion.div>
      </div>,
      document.body
    )}
    </>
  );
}

function MultiSelect({ options, selected, onChange, label, metricUnitsMap }: { options: string[], selected: string[], onChange: (val: string[]) => void, label: string, metricUnitsMap: Record<string, string> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const sortedOptions = [...options].sort((a, b) => a.localeCompare(b));
  const filteredOptions = sortedOptions.filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase()));

  const toggleOpen = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const fitsBelow = window.innerHeight - rect.bottom > 250;
      setDropdownPos({
        top: fitsBelow ? rect.bottom + 8 : rect.top - 232, // approximately menu height + gap
        left: rect.left,
        width: rect.width
      });
    }
    setIsOpen(!isOpen);
  };

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
      {isOpen && typeof window !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[120]" onClick={() => setIsOpen(false)} />
          <div 
            className="fixed z-[130] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-2 max-h-56 overflow-y-auto animate-in fade-in duration-200 scrollbar-hide flex flex-col"
            style={{
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
            }}
          >
            <div className="sticky top-0 bg-white dark:bg-slate-900 pb-2 z-10 p-1 flex gap-2">
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-950 dark:text-slate-200 text-sm rounded-md px-3 py-2 outline-none focus:border-blue-500 dark:focus:border-sky-500 transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange([]); }}
                className="px-3 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all whitespace-nowrap opacity-75 hover:opacity-100"
              >
                Clear All
              </button>
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

