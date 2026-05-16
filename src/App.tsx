/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Shell } from "./components/layout/Shell";
import { StatCard } from "./components/dashboard/StatCard";
import { TrendChart } from "./components/dashboard/TrendChart";
import { AlertTable } from "./components/dashboard/AlertTable";
import { RangePicker } from "./components/dashboard/RangePicker";
import { NetworkTopology } from "./components/dashboard/NetworkTopology";
import { InfraInventory } from "./components/dashboard/InfraInventory";
import { NotificationFeed } from "./components/dashboard/NotificationFeed";
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
  Bell,
  Search,
  X,
  Calendar,
  Zap
} from "lucide-react";
import axios from "axios";
import { cn } from "./lib/utils";

interface Widget {
  id: string;
  title: string;
  type: 'kpi' | 'chart';
  chartType: 'area' | 'line' | 'bar' | 'pie';
  metrics: string[];
  hosts: string[];
  aggregation: 'none' | 'sum' | 'avg';
  stacked: boolean;
  cols: 1 | 2 | 3 | 4;
  rows: number;
  color: string;
}

interface Dashboard {
  id: string;
  name: string;
  widgets: Widget[];
}

type View = "dashboard" | "network" | "infra" | "config" | "notifications" | "events";

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
  const [discoveryStatus, setDiscoveryStatus] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [dashboardName, setDashboardName] = useState<string>('Executive Overview');
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);

  const [isRenaming, setIsRenaming] = useState(false);
  const [tempDashboardName, setTempDashboardName] = useState('');

  // Detect unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!activeDashboardId) return widgets.length > 0;
    const currentBoard = savedDashboards.find(d => d.id === activeDashboardId);
    if (!currentBoard) return true;
    return JSON.stringify(currentBoard.widgets) !== JSON.stringify(widgets) || currentBoard.name !== dashboardName;
  }, [widgets, dashboardName, activeDashboardId, savedDashboards]);

  const handleSaveAll = () => {
    if (activeDashboardId) {
      const next = savedDashboards.map(d => d.id === activeDashboardId ? { ...d, name: dashboardName, widgets } : d);
      setSavedDashboards(next);
      localStorage.setItem('hareporting_dashboards_v1', JSON.stringify(next));
    } else {
      const newId = `db-${Date.now()}`;
      const newBoard = { id: newId, name: dashboardName, widgets };
      const next = [...savedDashboards, newBoard];
      setSavedDashboards(next);
      setActiveDashboardId(newId);
      localStorage.setItem('hareporting_dashboards_v1', JSON.stringify(next));
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
      localStorage.setItem('hareporting_dashboards_v1', JSON.stringify(updated));
      return updated;
    });
    if (activeDashboardId === id) {
      setDashboardName(newName);
    }
  };

  const [zabbixConfig, setZabbixConfig] = useState<{url: string, token: string, discoveryInterval: number}>({
    url: localStorage.getItem('hareporting_zabbix_url') || '',
    token: localStorage.getItem('hareporting_zabbix_token') || '',
    discoveryInterval: parseInt(localStorage.getItem('hareporting_zabbix_interval') || '3600', 10)
  });

  const isSimulated = !zabbixConfig.url || !zabbixConfig.token;
  const [availableHosts, setAvailableHosts] = useState<string[]>(['srv-prod-01', 'sql-db-primary', 'gateway-02', 'all']);
  const [availableMetrics, setAvailableMetrics] = useState<string[]>(['cpu', 'memory', 'traffic', 'latency', 'disk']);
  const [metricUnitsMap, setMetricUnitsMap] = useState<Record<string, string>>({
    'cpu': '%',
    'memory': '%',
    'traffic': 'Gb/s',
    'latency': 'ms',
    'disk': '%'
  });

  const defaultWidgets: Widget[] = [
    { id: 'kpi-1', title: 'Average Cluster CPU', type: 'kpi', chartType: 'area', metrics: ['cpu'], hosts: ['all'], aggregation: 'avg', stacked: false, cols: 2, rows: 1, color: '#0EA5E9' },
    { id: 'kpi-2', title: 'Total Network Flow', type: 'kpi', chartType: 'area', metrics: ['traffic'], hosts: ['all'], aggregation: 'sum', stacked: false, cols: 2, rows: 1, color: '#6366F1' },
    { id: 'chart-1', title: 'Production Core Trends', type: 'chart', chartType: 'area', metrics: ['cpu', 'memory'], hosts: ['srv-prod-01'], aggregation: 'none', stacked: true, cols: 4, rows: 2, color: '#0EA5E9' },
  ];

  const handleUpdateDashboardName = (newName: string) => {
    if (!newName) return;
    setDashboardName(newName);
    if (activeDashboardId) {
      setSavedDashboards(prev => {
        const next = prev.map(d => d.id === activeDashboardId ? { ...d, name: newName } : d);
        localStorage.setItem('hareporting_dashboards_v1', JSON.stringify(next));
        return next;
      });
    }
  };

  // Load saved dashboards on mount
  useEffect(() => {
    const saved = localStorage.getItem('hareporting_dashboards_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSavedDashboards(parsed);
      } catch (e) {
        console.error("Failed to parse saved dashboards", e);
      }
    } else {
      // Initialize with default if first time
      const initialDashboard: Dashboard = {
        id: 'default-board-1',
        name: 'Executive Overview',
        widgets: defaultWidgets
      };
      setSavedDashboards([initialDashboard]);
      setActiveDashboardId('default-board-1');
      localStorage.setItem('hareporting_dashboards_v1', JSON.stringify([initialDashboard]));
    }
    
    // Set initial widgets
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length > 0) {
        setWidgets(parsed[0].widgets);
        setDashboardName(parsed[0].name);
        setActiveDashboardId(parsed[0].id);
      } else {
        setWidgets(defaultWidgets);
      }
    } else {
      setWidgets(defaultWidgets);
    }

    if (zabbixConfig.token && zabbixConfig.url) {
        discoverZabbixAssets();
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      if (zabbixConfig.token && zabbixConfig.url) {
        // Real Zabbix Fetch Logic
        const response = await axios.post("/api/zabbix", {
          url: zabbixConfig.url,
          token: zabbixConfig.token,
          method: "history.get",
          params: {
            output: "extend",
            history: 0, // float
            sortfield: "clock",
            sortorder: "DESC",
            limit: 100
          }
        });
        // For the demo, we transform real history or still use mock if Zabbix response structure varies
        // In a real app, we'd map response.data.result to our chart format
        console.log("Real Zabbix Data Received:", response.data);
        if (response.data.result) {
          // If we have real data, we could map it here. For now, we'll keep the mock logic 
          // but visually confirm Zabbix is being called.
        }
      }

      const response = await axios.get("/api/mock/stats", {
        params: { 
          granularity: filters.mode === 'live' ? filters.granularity : filters.granularity, // Prioritize Res/Granularity
          range: filters.range,
          mode: filters.mode,
          start: filters.start,
          end: filters.end
        }
      });
      setData(response.data);
      setLastSync(new Date());
    } catch (error: any) {
      console.error("Failed to fetch statistics", error);
      const msg = error.response?.data?.error || "Failed to fetch statistics from Zabbix";
      alert(msg);
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  }, [filters.range, filters.mode, filters.start, filters.end, filters.granularity, zabbixConfig]);

  const handleSync = () => {
    fetchStats();
  };

  useEffect(() => {
    setData([]);
    fetchStats();
    if (filters.mode === 'live') {
      const interval = setInterval(fetchStats, 60000);
      return () => clearInterval(interval);
    }
  }, [fetchStats, filters.mode]);

  const handleAddWidget = (type: 'kpi' | 'chart') => {
    const newWidget: Widget = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'New Telemetry Probe',
      type,
      chartType: 'area',
      metrics: ['cpu'],
      hosts: ['all'],
      aggregation: 'avg',
      stacked: false,
      cols: type === 'kpi' ? 1 : 4,
      rows: type === 'kpi' ? 1 : 2,
      color: '#0EA5E9'
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
    localStorage.setItem('hareporting_dashboards_v1', JSON.stringify(updated));
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
      localStorage.setItem('hareporting_dashboards_v1', JSON.stringify(next));
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
      localStorage.setItem('hareporting_dashboards_v1', JSON.stringify(updated));
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

  const handleImportDashboard = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.widgets && Array.isArray(json.widgets)) {
          // If we have a successful parse, we update the current state
          // We don't auto-save to localStorage yet, allowing user to review
          setWidgets(json.widgets);
          if (json.name) setDashboardName(json.name);
          alert("Dashboard configuration imported. Review and click 'Save' to persist.");
        } else {
          alert("Invalid dashboard configuration file.");
        }
      } catch (err) {
        alert("Failed to parse the configuration file.");
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const discoverZabbixAssets = useCallback(async (manual = false) => {
    if (!zabbixConfig.token || !zabbixConfig.url) {
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
        url: zabbixConfig.url,
        token: zabbixConfig.token,
        method: "host.get",
        params: { output: ["host", "name"] }
      });
      
      if (hostRes.data.result) {
        const hosts = hostRes.data.result.map((h: any) => h.name || h.host);
        setAvailableHosts([...hosts, 'all']);
      }

      // 2. Discover Items (Metrics)
      const itemRes = await axios.post("/api/zabbix", {
        url: zabbixConfig.url,
        token: zabbixConfig.token,
        method: "item.get",
        params: { output: ["name", "key_", "units"] }
      });

      if (itemRes.data.result) {
        const units: Record<string, string> = {};
        itemRes.data.result.forEach((i: any) => {
          const base = i.name;
          if (i.units) units[base] = i.units;
        });
        setMetricUnitsMap(prev => ({ ...prev, ...units }));
        
        const metrics = Array.from(new Set(itemRes.data.result.map((i: any) => i.name)));
        setAvailableMetrics(metrics as string[]);
      }
      
      console.log("Zabbix Assets Discovered Successfully");
      if (manual) {
        setDiscoveryStatus({ 
          type: 'success', 
          message: `Discovered ${hostRes.data.result.length} hosts and ${itemRes.data.result.length} metrics.` 
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

  const handleSaveZabbixConfig = () => {
    localStorage.setItem('hareporting_zabbix_url', zabbixConfig.url);
    localStorage.setItem('hareporting_zabbix_token', zabbixConfig.token);
    localStorage.setItem('hareporting_zabbix_interval', zabbixConfig.discoveryInterval.toString());
    
    setDiscoveryStatus({ type: 'success', message: "Configuration saved. Initializing discovery..." });
    discoverZabbixAssets();
    
    if (widgets.length === defaultWidgets.length) {
      setWidgets([]); // Clear default template to start fresh with real data
    }
  };

  useEffect(() => {
    if (zabbixConfig.discoveryInterval > 0) {
      const intervalId = setInterval(() => {
        discoverZabbixAssets();
      }, zabbixConfig.discoveryInterval * 1000);
      return () => clearInterval(intervalId);
    }
  }, [zabbixConfig.discoveryInterval, discoverZabbixAssets]);

  const [showRangeMenu, setShowRangeMenu] = useState(false);
  const [showGranMenu, setShowGranMenu] = useState(false);

  const renderContent = () => {
    if (view === "events") {
      return <AlertTable mode={filters.mode} globalSearch={globalSearch} zabbixConfig={zabbixConfig} />;
    }

    if (view === "network") {
      return <NetworkTopology filters={filters} globalSearch={globalSearch} />;
    }

    if (view === "infra") {
      return <InfraInventory filters={filters} globalSearch={globalSearch} />;
    }

    if (view === "notifications") {
      const zabbixBaseUrl = zabbixConfig.url.replace('/api_jsonrpc.php', '');
      return <NotificationFeed globalSearch={globalSearch} zabbixBaseUrl={zabbixBaseUrl} />;
    }

    if (view !== "dashboard") {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] bg-white border border-slate-200 shadow-sm rounded-3xl p-12 text-center">
          {view === 'config' && (
            <div className="max-w-2xl mx-auto w-full text-left">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Zabbix Gateway Configuration</h2>
              <div className="space-y-6">
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                  <label className="text-sm font-semibold text-slate-600 block mb-2">Endpoint URL</label>
                  <input 
                    type="text" 
                    value={zabbixConfig.url} 
                    onChange={e => setZabbixConfig({...zabbixConfig, url: e.target.value})}
                    placeholder="https://your-zabbix.com/zabbix/api_jsonrpc.php"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm" 
                  />
                  <div className="mt-4">
                    <label className="text-sm font-semibold text-slate-600 block mb-2">API Token</label>
                    <input 
                      type="password" 
                      value={zabbixConfig.token} 
                      onChange={e => setZabbixConfig({...zabbixConfig, token: e.target.value})}
                      placeholder="Your Zabbix API Token..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm" 
                    />
                  </div>
                  <div className="mt-4">
                    <label className="text-sm font-semibold text-slate-600 block mb-2">Discovery Interval (seconds)</label>
                    <input 
                      type="number" 
                      min="0"
                      value={zabbixConfig.discoveryInterval} 
                      onChange={e => setZabbixConfig({...zabbixConfig, discoveryInterval: parseInt(e.target.value) || 0})}
                      placeholder="e.g. 3600 for 1 hour, 0 to disable"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={handleSaveZabbixConfig}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-blue-500 transition-all active:scale-95"
                  >
                    Save Configuration
                  </button>
                  <button 
                    onClick={async () => {
                      await discoverZabbixAssets(true);
                    }}
                    className="w-full py-3 bg-slate-800 text-white rounded-xl font-semibold text-sm shadow-md hover:bg-slate-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!zabbixConfig.url || !zabbixConfig.token || isDiscovering}
                  >
                    <RefreshCw className={cn("w-4 h-4", isDiscovering && "animate-spin")} /> {isDiscovering ? 'Discovering...' : 'Trigger Discovery'}
                  </button>
                </div>
                {discoveryStatus && (
                  <div className={cn(
                    "p-4 rounded-xl border text-sm font-medium",
                    discoveryStatus.type === 'success' ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
                  )}>
                    {discoveryStatus.message}
                  </div>
                )}
                <p className="text-xs text-slate-500 text-center font-medium">
                  Authentication is handled server-side via the HA Gateway Proxy.
                </p>
              </div>
            </div>
          )}
          {view !== 'config' && (
            <>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">{view === 'network' ? 'Network Topology' : view === 'infra' ? 'Hardware Inventory' : 'System Alerts'}</h2>
              <p className="text-slate-500">Live telemetry stream active. Data visualization loading...</p>
            </>
          )}
        </div>
      );
    }

    return (
      <>
        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 lg:grid-cols-12 gap-4 auto-rows-[60px] sm:auto-rows-[70px] lg:auto-rows-[60px]">
          {widgets.filter(w => 
            w.title.toLowerCase().includes(globalSearch.toLowerCase()) ||
            w.metrics.some(m => m.toLowerCase().includes(globalSearch.toLowerCase())) ||
            w.hosts.some(h => h.toLowerCase().includes(globalSearch.toLowerCase()))
          ).map((w, index) => (
            <div key={w.id} 
              className={cn(
                "relative transition-all duration-300 group col-span-1 hover:z-50",
                w.cols === 1 ? 'sm:col-span-1 md:col-span-3 lg:col-span-3' :
                w.cols === 2 ? 'sm:col-span-2 md:col-span-6 lg:col-span-6' :
                w.cols === 3 ? 'sm:col-span-2 md:col-span-6 lg:col-span-9' : 'sm:col-span-2 md:col-span-6 lg:col-span-12'
              )}
              style={{ gridRowEnd: `span ${w.rows * 2 || 2}` }}
            >
              {/* Widget Actions */}
              <div className="absolute inset-0 z-20 pointer-events-none opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="absolute top-3 right-3 flex gap-1.5 items-center pointer-events-auto">
                    <div className="flex bg-white/90 backdrop-blur-md border border-slate-200/50 rounded-lg overflow-hidden shadow-sm">
                      <button 
                        onClick={() => handleMoveWidget(w.id, 'left')} 
                        className={cn(
                          "p-1.5 hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors border-r border-slate-200/50",
                          index === 0 && "opacity-20 pointer-events-none"
                        )} 
                        title="Move Backwards"
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={() => handleMoveWidget(w.id, 'right')} 
                        className={cn(
                          "p-1.5 hover:bg-blue-50 text-slate-500 hover:text-blue-600 transition-colors",
                          index === widgets.length - 1 && "opacity-20 pointer-events-none"
                        )} 
                        title="Move Forwards"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                    <button 
                      onClick={() => setEditingWidgetId(editingWidgetId === w.id ? null : w.id)}
                      className={cn(
                        "p-1.5 rounded-lg border transition-all shadow-sm backdrop-blur-md",
                        editingWidgetId === w.id ? "bg-blue-600 border-blue-500 text-white" : "bg-white/90 border-slate-200/50 text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                      )}
                    >
                      <Settings2 className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={() => handleRemoveWidget(w.id)}
                      className="p-1.5 bg-white/90 border border-rose-100/50 text-rose-500 rounded-lg hover:bg-rose-50 hover:text-rose-600 shadow-sm transition-all backdrop-blur-md"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                </div>

                {/* Resize Handles (Hidden on small screens) */}
                <div 
                  className="hidden sm:flex absolute -top-1 left-6 right-6 h-2 cursor-row-resize pointer-events-auto group/v-resize flex-col items-center justify-center select-none"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const startY = e.clientY;
                    const startRows = w.rows;
                    
                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      const deltaY = startY - moveEvent.clientY; 
                      const rowThreshold = 30; 
                      const deltaRows = Math.round(deltaY / rowThreshold);
                      const nextRows = Math.max(1, startRows + deltaRows);
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
                    const startCols = w.cols;
                    
                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      const deltaX = moveEvent.clientX - startX;
                      const colThreshold = 40; 
                      const deltaCols = Math.round(deltaX / colThreshold);
                      const nextCols = Math.min(4, Math.max(1, startCols + deltaCols)) as 1 | 2 | 3 | 4;
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

              {editingWidgetId === w.id ? (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={handleCancelEdit} />
                  <div className="relative w-full max-w-4xl bg-white border border-slate-200 p-6 sm:p-10 rounded-[28px] sm:rounded-[40px] shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6 sm:mb-10">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                          <Settings2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight truncate">Widget Configuration</h4>
                          <p className="text-xs font-medium text-slate-500 mt-1 truncate">ID: {w.id}</p>
                        </div>
                      </div>
                      <button onClick={handleCancelEdit} className="p-2 sm:p-3 hover:bg-slate-100 rounded-full transition-colors shrink-0">
                        <X className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 hover:text-slate-900" />
                      </button>
                    </div>

                    <div className="space-y-8 sm:space-y-10">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12">
                        <div className="space-y-6">
                          <div>
                            <label className="text-sm font-semibold text-slate-400 block mb-2">Title</label>
                            <input 
                              type="text" 
                              value={w.title} 
                              onChange={e => handleUpdateWidget(w.id, { title: e.target.value })} 
                              className={cn(
                                "w-full bg-slate-900/50 text-sm font-medium p-3 sm:p-4 rounded-xl border outline-none transition-all shadow-inner text-white",
                                !w.title.trim() ? "border-rose-500/50 focus:border-rose-500" : "border-slate-700 focus:border-sky-500"
                              )} 
                              placeholder="Widget Title"
                            />
                            {!w.title.trim() && (
                              <p className="text-[10px] text-rose-500 font-semibold mt-1.5 uppercase tracking-wider animate-in fade-in slide-in-from-top-1">
                                Identification Label Required
                              </p>
                            )}
                          </div>

                          <div>
                            <ColorPicker 
                              label="Theme Accent" 
                              value={w.color || '#0EA5E9'} 
                              onChange={(c) => handleUpdateWidget(w.id, { color: c })} 
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            {w.type === 'chart' && (
                              <div>
                                <label className="text-sm font-semibold text-slate-400 block mb-2">Visualization</label>
                                <select 
                                  value={w.chartType} 
                                  onChange={e => handleUpdateWidget(w.id, { chartType: e.target.value as any })} 
                                  className="w-full bg-slate-900/50 text-sm font-medium p-3 sm:p-4 rounded-xl border border-slate-700 focus:border-sky-500 outline-none transition-all text-white"
                                >
                                  <option value="area">Area Map</option>
                                  <option value="line">Line Chart</option>
                                  <option value="bar">Bar Chart</option>
                                  <option value="pie">Pie Chart</option>
                                </select>
                              </div>
                            )}

                            <div>
                              <label className="text-sm font-semibold text-slate-400 block mb-2">Aggregation</label>
                              <select 
                                value={w.aggregation} 
                                onChange={e => handleUpdateWidget(w.id, { aggregation: e.target.value as any })} 
                                className="w-full bg-slate-900/50 text-sm font-medium p-3 sm:p-4 rounded-xl border border-slate-700 focus:border-sky-500 outline-none transition-all text-white"
                              >
                                <option value="none">Detailed Multi-Series</option>
                                <option value="sum">Sum</option>
                                <option value="avg">Average</option>
                              </select>
                            </div>
                          </div>

                          {w.type === 'chart' && (
                            <div className="bg-slate-900/30 px-4 sm:px-6 py-4 sm:py-5 rounded-xl border border-slate-800">
                              <label className="flex items-center gap-3 sm:gap-4 text-sm text-slate-300 font-medium cursor-pointer select-none">
                                <input 
                                  type="checkbox" 
                                  checked={w.stacked} 
                                  onChange={e => handleUpdateWidget(w.id, { stacked: e.target.checked })} 
                                  className="w-4 h-4 sm:w-5 sm:h-5 rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-sky-500/20" 
                                /> 
                                Stack Series
                              </label>
                            </div>
                          )}
                        </div>

                        <div className="space-y-6">
                          <MultiSelect 
                            label="Target Host Group" 
                            options={availableHosts} 
                            selected={w.hosts} 
                            onChange={(h) => handleUpdateWidget(w.id, { hosts: h })} 
                            metricUnitsMap={{}}
                          />

                          <MultiSelect 
                            label="Telemetry Metric Stream" 
                            options={availableMetrics} 
                            selected={w.metrics} 
                            onChange={(m) => handleUpdateWidget(w.id, { metrics: m })} 
                            metricUnitsMap={metricUnitsMap}
                          />
                        </div>
                      </div>

                      <div className="pt-6 sm:pt-8 border-t border-slate-800 flex flex-col sm:flex-row justify-end gap-3">
                        <button 
                          onClick={handleCancelEdit}
                          className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm rounded-lg sm:rounded-xl transition-all"
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
                </div>
              ) : (
                w.type === 'kpi' ? (
                  <StatCard 
                    title={w.title} 
                    value={(() => {
                      if (data.length === 0) return '...';
                      const lastPoint = data[data.length - 1];
                      let values: number[] = [];
                      
                      w.metrics.forEach(m => {
                        w.hosts.forEach(h => {
                          const key = `${m}_${h}`;
                          if (lastPoint[key] !== undefined) {
                            values.push(Number(lastPoint[key]));
                          }
                        });
                      });

                      if (values.length === 0) return '0';
                      
                      const sum = values.reduce((a, b) => a + b, 0);
                      if (w.aggregation === 'avg') {
                        return (sum / values.length).toFixed(1);
                      }
                      if (w.aggregation === 'sum') {
                        return Math.round(sum).toLocaleString();
                      }
                      return values[0].toFixed(1);
                    })()} 
                    unit={metricUnitsMap[w.metrics[0]] ? (metricUnitsMap[w.metrics[0]] === '%' ? '%' : ` ${metricUnitsMap[w.metrics[0]]}`) : ''} 
                    change={5.2} 
                    trend="up" 
                    color={w.color}
                  />
                ) : (
                  (() => {
                    const isAggregated = w.aggregation !== 'none';
                    let chartSeries: { key: string; name: string }[] = [];
                    let chartData = data;

                    if (isAggregated) {
                      const label = w.aggregation === 'sum' ? 'Aggregate Sum' : 'Aggregate Mean';
                      chartSeries = [{ key: 'agg_val', name: label }];
                      
                      chartData = data.map(point => {
                        let values: number[] = [];
                        w.metrics.forEach(m => {
                          w.hosts.forEach(h => {
                            const key = `${m}_${h}`;
                            if (point[key] !== undefined) {
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
                        w.hosts.forEach(h => {
                          const key = `${m}_${h}`;
                          const hostLabel = h === 'all' ? 'All' : h;
                          const metricLabel = m.toUpperCase();
                          chartSeries.push({
                            key,
                            name: (w.hosts.length > 1 || w.metrics.length > 1) ? `${metricLabel} [${hostLabel}]` : metricLabel
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
                        unit={metricUnitsMap[w.metrics[0]] ? (metricUnitsMap[w.metrics[0]] === '%' ? '%' : ` ${metricUnitsMap[w.metrics[0]]}`) : ''} 
                        mode={filters.mode as 'live' | 'historical'}
                        granularity={filters.granularity}
                        aggregation={w.aggregation}
                        color={w.color}
                      />
                    );
                  })()
                )
              )}
            </div>
          ))}
        </div>
      </>
    );
  };

  return (
    <Shell 
      savedDashboards={savedDashboards} 
      onSelectDashboard={handleSelectDashboard}
      onRenameDashboard={handleRenameDashboardLocal}
      onAddDashboard={handleCreateDashboard}
      onDeleteDashboard={handleDeleteDashboard}
      activeDashboardId={activeDashboardId}
      onNavigate={(v: View) => setView(v)}
      currentView={view}
      lastSync={lastSync}
      isSimulated={isSimulated}
    >
      <div className="max-w-[1400px] mx-auto space-y-4">
        {/* Page Title Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center shadow-sm shrink-0">
                {view === 'dashboard' ? (
                  <LayoutDashboard className="w-4 h-4 text-blue-600" />
                ) : view === 'network' ? (
                  <Activity className="w-4 h-4 text-blue-600" />
                ) : view === 'events' ? (
                  <Zap className="w-4 h-4 text-blue-600" />
                ) : view === 'infra' ? (
                  <Server className="w-4 h-4 text-blue-600" />
                ) : view === 'notifications' ? (
                  <Bell className="w-4 h-4 text-blue-600" />
                ) : (
                  <Settings2 className="w-4 h-4 text-blue-600" />
                )}
              </div>
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
                      className="bg-white border border-blue-500 rounded-xl px-3 py-1.5 text-lg sm:text-3xl font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-full"
                    />
                  </div>
                ) : (
                  <>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight truncate">
                      {view === 'dashboard' ? dashboardName : 
                      view === 'network' ? 'Network Topology' : 
                      view === 'events' ? 'Application Events' :
                      view === 'infra' ? 'Asset Inventory' : 'Zabbix API Settings'}
                    </h1>
                    {view === 'dashboard' && (
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setTempDashboardName(dashboardName);
                          setIsRenaming(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-50 rounded-md lg:opacity-0 group-hover/header:opacity-100 transition-all border border-transparent hover:border-slate-200 shrink-0"
                        title="Rename Dashboard"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
                <div className="hidden sm:block w-[1px] h-8 bg-slate-200 mx-2" />
                {view !== 'config' && (
                  <div className="relative group w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                      type="text" 
                      value={globalSearch}
                      onChange={(e) => setGlobalSearch(e.target.value)}
                      placeholder="Search metrics, hosts, or entities..." 
                      className="w-full bg-white border border-slate-200 focus:border-blue-500/50 rounded-lg py-2 pl-9 pr-3 text-sm font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 shadow-sm" 
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 self-end sm:self-auto">
            {['dashboard', 'network', 'infra', 'events'].includes(view) && (
              <div className="flex bg-white border border-slate-200 p-1 rounded-lg shadow-sm shrink-0 h-[36px] items-center">
                  <button 
                    onClick={() => setFilters({...filters, mode: 'live'})}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-medium transition-all h-full flex items-center justify-center min-w-[70px]",
                      filters.mode === 'live' ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                    )}
                  >
                    Live
                  </button>
                  <button 
                    onClick={() => setFilters({...filters, mode: 'historical'})}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-medium transition-all h-full flex items-center justify-center min-w-[70px]",
                      filters.mode === 'historical' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                    )}
                  >
                    Archive
                  </button>
              </div>
            )}
            <div className="w-[1px] h-6 bg-slate-200 mx-1 sm:mx-2" />
            <button 
              onClick={handleSync}
              className={cn(
                "h-[36px] w-[36px] bg-white border border-slate-200 text-slate-400 hover:text-blue-600 rounded-lg shadow-sm flex items-center justify-center transition-all active:scale-95",
                loading && "opacity-50"
              )}
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>



        {/* Telemetry Controls & Designer Bar */}
        {['dashboard', 'network', 'infra', 'events'].includes(view) && (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm shrink-0 lg:h-[40px] gap-2 sm:gap-4">
              {filters.mode === 'live' ? (
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 w-full h-full">
                  <div className="flex items-center min-w-full sm:min-w-[140px] relative h-full">
                    <button 
                      onClick={() => setShowRangeMenu(!showRangeMenu)}
                      className="bg-transparent hover:bg-slate-50 rounded-md py-1 px-2 text-sm font-medium text-slate-700 outline-none transition-all w-full text-left flex items-center justify-between gap-2 h-full"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-slate-500 font-normal">Rolling Window:</span>
                        <span className="font-semibold text-blue-600">
                          {filters.range === '1h' ? 'Last Hour' : 
                          filters.range === '6h' ? 'Last 6 Hours' : 
                          filters.range === '24h' ? 'Last 24 Hours' : 'Last 7 Days'}
                        </span>
                      </span>
                      <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                    </button>
                    {showRangeMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowRangeMenu(false)} />
                        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                          {['1h', '6h', '24h', '7d'].map((r) => (
                            <button 
                              key={r}
                              onClick={() => {
                                setFilters({...filters, range: r});
                                setShowRangeMenu(false);
                              }}
                              className={cn(
                                "w-full px-3 py-2 text-sm font-medium text-left hover:bg-slate-50 transition-colors",
                                filters.range === r ? "text-blue-700 bg-blue-50/80" : "text-slate-600"
                              )}
                            >
                              {r === '1h' ? 'Last Hour' : 
                               r === '6h' ? '6 Hours' : 
                               r === '24h' ? '24 Hours' : '7 Days'}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="hidden sm:block w-[1px] h-4 bg-slate-200" />
                  <div className="flex items-center min-w-full sm:min-w-[100px] relative h-full">
                    <button 
                      onClick={() => setShowGranMenu(!showGranMenu)}
                      className="bg-transparent hover:bg-slate-50 rounded-md py-1 px-2 text-sm font-medium text-slate-700 outline-none transition-all w-full text-left flex items-center justify-between gap-2 h-full"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-slate-500 font-normal">Granularity:</span>
                        <span className="font-semibold text-emerald-600">
                          {filters.granularity === '1m' ? '1 Minute' :
                          filters.granularity === '5m' ? '5 Minutes' :
                          filters.granularity === '15m' ? '15 Min' : '1 Hour'}
                        </span>
                      </span>
                      <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                    </button>
                    {showGranMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowGranMenu(false)} />
                        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                          {['1m', '5m', '15m', '1h'].map((g) => (
                            <button 
                              key={g}
                              onClick={() => {
                                setFilters({...filters, granularity: g});
                                setShowGranMenu(false);
                              }}
                              className={cn(
                                "w-full px-3 py-2 text-sm font-medium text-left hover:bg-slate-50 transition-colors",
                                filters.granularity === g ? "text-emerald-700 bg-emerald-50" : "text-slate-600"
                              )}
                            >
                              {g === '1m' ? '1 Minute' : g === '5m' ? '5 Minutes' : g === '15m' ? '15 Min' : '1 Hour'}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full h-full">
                  <RangePicker 
                    range={{ start: filters.start, end: filters.end }}
                    onChange={(newVal) => setFilters({...filters, ...newVal})}
                  />
                  <div className="hidden sm:block w-[1px] h-4 bg-slate-200" />
                  <div className="flex items-center min-w-full sm:min-w-[100px] relative h-full">
                    <button 
                      onClick={() => setShowGranMenu(!showGranMenu)}
                      className="bg-transparent hover:bg-slate-50 rounded-md py-1 px-2 text-sm font-medium text-slate-700 outline-none transition-all w-full text-left flex items-center justify-between gap-2 h-full"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-slate-500 font-normal">Resolution:</span>
                        <span className="font-semibold text-emerald-600">
                          {filters.granularity === '5m' ? '5 Minutes' :
                          filters.granularity === '30m' ? '30 Minutes' :
                          filters.granularity === '1d' ? '1 Day' : '1 Hour'}
                        </span>
                      </span>
                      <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                    </button>
                    {showGranMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowGranMenu(false)} />
                        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                          {['5m', '30m', '1h', '1d'].map((g) => (
                            <button 
                              key={g}
                              onClick={() => {
                                setFilters({...filters, granularity: g});
                                setShowGranMenu(false);
                              }}
                              className={cn(
                                "w-full px-3 py-2 text-sm font-medium text-left hover:bg-slate-50 transition-colors",
                                filters.granularity === g ? "text-emerald-700 bg-emerald-50" : "text-slate-600"
                              )}
                            >
                              {g === '5m' ? '5 Minutes' : g === '30m' ? '30 Minutes' : g === '1d' ? '1 Day' : '1 Hour'}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {view === 'dashboard' && (
              <div className="flex items-center gap-3 justify-end">
                 <div className="flex bg-white border border-slate-200 rounded-lg p-1 gap-1 shadow-sm h-[40px] items-center">
                    <button onClick={() => handleAddWidget('kpi')} className="px-3 sm:px-4 py-1 hover:bg-slate-50 text-xs font-semibold text-slate-500 hover:text-slate-900 rounded-md flex items-center gap-2 transition-all">
                      <Plus className="w-4 h-4 text-blue-600" /> KPI
                    </button>
                    <div className="w-[1px] h-6 bg-slate-200 mx-1" />
                    <button onClick={() => handleAddWidget('chart')} className="px-3 sm:px-4 py-1 hover:bg-slate-50 text-xs font-semibold text-slate-500 hover:text-slate-900 rounded-md flex items-center gap-2 transition-all">
                      <Plus className="w-4 h-4 text-blue-600" /> CHART
                    </button>
                    <div className="w-[1px] h-6 bg-slate-200 mx-1" />
                    <button onClick={handleExportDashboard} className="px-3 py-1 hover:bg-slate-50 text-xs font-semibold text-slate-500 hover:text-blue-600 rounded-md flex items-center gap-2 transition-all" title="Export Dashboard">
                      <Download className="w-4 h-4" /> <span className="hidden xl:inline">Export</span>
                    </button>
                    <label className="px-3 py-1 hover:bg-slate-50 text-xs font-semibold text-slate-500 hover:text-blue-600 rounded-md flex items-center gap-2 transition-all cursor-pointer" title="Import Dashboard">
                      <Upload className="w-4 h-4" /> <span className="hidden xl:inline">Import</span>
                      <input type="file" accept=".json" className="hidden" onChange={handleImportDashboard} />
                    </label>
                </div>

                {hasUnsavedChanges && (
                  <div className="flex bg-white border border-emerald-200 rounded-lg p-1 gap-1 shadow-sm h-[40px] items-center animate-in slide-in-from-right-4 duration-500">
                    <button 
                      onClick={handleSaveAll}
                      className="px-4 h-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Save className="w-4 h-4" />
                      <span className="hidden sm:inline text-xs font-semibold">Save</span>
                    </button>
                    <button 
                      onClick={handleDiscardChanges}
                      className="w-[40px] h-full hover:bg-rose-50 text-rose-600 rounded-md transition-all flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}


        {renderContent()}
      </div>
    </Shell>
  );
}

function ColorPicker({ value, onChange, label }: { value: string, onChange: (val: string) => void, label: string }) {
  const colors = [
    { name: 'Sky', value: '#0EA5E9' },
    { name: 'Indigo', value: '#6366F1' },
    { name: 'Violet', value: '#8B5CF6' },
    { name: 'Rose', value: '#F43F5E' },
    { name: 'Emerald', value: '#10B981' },
    { name: 'Amber', value: '#F59E0B' },
    { name: 'Slate', value: '#64748B' },
  ];

  return (
    <div>
      <label className="text-xs font-semibold text-slate-400 block mb-3">{label}</label>
      <div className="flex flex-wrap gap-3">
        {colors.map(c => (
          <button
            key={c.value}
            onClick={() => onChange(c.value)}
            className={cn(
              "w-8 h-8 rounded-full border-2 transition-all p-0.5",
              value === c.value ? "border-white scale-110 shadow-lg" : "border-transparent hover:scale-110"
            )}
            style={{ backgroundColor: c.value }}
            title={c.name}
          >
            {value === c.value && (
              <div className="w-full h-full rounded-full border border-slate-900/20 flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function MultiSelect({ options, selected, onChange, label, metricUnitsMap }: { options: string[], selected: string[], onChange: (val: string[]) => void, label: string, metricUnitsMap: Record<string, string> }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative">
      <label className="text-xs font-semibold text-slate-400 block mb-2">{label}</label>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full bg-slate-900 border transition-all flex justify-between items-center group shadow-inner",
          "rounded-lg px-4 py-3",
          isOpen ? "border-sky-500 ring-2 ring-sky-500/10" : "border-slate-700 hover:border-slate-600"
        )}
      >
        <span className="truncate text-sky-400 text-sm font-medium">
           {selected.map(s => {
             const unit = metricUnitsMap?.[s];
             return unit ? `${s} (${unit})` : s;
           }).join(', ')}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-sky-500 transition-all duration-300", isOpen ? "rotate-180" : "opacity-50 group-hover:opacity-100")} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-2 max-h-56 overflow-y-auto animate-in fade-in zoom-in-95 duration-200 scrollbar-hide">
            {options.map((opt, i) => {
              const unit = metricUnitsMap?.[opt];
              return (
                <label 
                  key={opt} 
                  className={cn(
                    "flex items-center gap-3 p-2.5 rounded-md cursor-pointer group transition-all",
                    selected.includes(opt) ? "bg-sky-500/10 hover:bg-sky-500/20" : "hover:bg-slate-800"
                  )}
                >
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      checked={selected.includes(opt)}
                      onChange={(e) => {
                        const next = e.target.checked ? [...selected, opt] : selected.filter(s => s !== opt);
                        onChange(next.length > 0 ? next : [options[0]]);
                      }}
                      className="w-4 h-4 rounded-md bg-slate-950 border-slate-600 text-sky-500 focus:ring-0 transition-all cursor-pointer appearance-none border checked:bg-sky-500 checked:border-sky-400"
                    />
                    {selected.includes(opt) && <Check className="absolute w-3 h-3 text-white pointer-events-none" />}
                  </div>
                  <span className={cn(
                    "text-sm font-medium transition-colors",
                    selected.includes(opt) ? "text-sky-400" : "text-slate-300 group-hover:text-slate-100"
                  )}>
                    {opt} {unit && <span className="opacity-50 text-xs ml-1">({unit})</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

