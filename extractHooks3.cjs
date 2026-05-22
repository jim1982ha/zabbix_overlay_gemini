const fs = require('fs');

const useZabbixHooksCode = `import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { ZabbixHost, ZabbixItem } from '../types/zabbix';

export function useZabbixDiscovery(zabbixConfig: { url: string, token: string, isPreconfigured?: boolean }) {
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryStatus, setDiscoveryStatus] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [availableHosts, setAvailableHosts] = useState<string[]>(['srv-prod-01', 'sql-db-primary', 'gateway-02']);
  const [availableMetrics, setAvailableMetrics] = useState<string[]>(['cpu', 'memory', 'traffic', 'latency', 'disk']);
  const [metricDict, setMetricDict] = useState<Record<string, {itemid: string, value_type: string, lastvalue: string}>>({});
  const [hostMetricsMap, setHostMetricsMap] = useState<Record<string, string[]>>({});
  const [metricUnitsMap, setMetricUnitsMap] = useState<Record<string, string>>({
    'cpu': '%', 'memory': 'GB', 'traffic': 'Mbps', 'latency': 'ms', 'disk': '%'
  });
  const [initialDiscoveryTriggered, setInitialDiscoveryTriggered] = useState(false);

  const discoverZabbixAssets = useCallback(async (manual = false, overrideConfig?: {url: string, token: string}) => {
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
      const hostRes = await axios.post("/api/zabbix", {
        url: urlToUse,
        token: tokenToUse,
        method: "host.get",
        params: { output: ["host", "name"] }
      });
      
      if (hostRes.data.result) {
        const hosts = hostRes.data.result.map((h: ZabbixHost) => h.name || h.host);
        setAvailableHosts(hosts);
      }

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
        itemRes.data.result.forEach((i: ZabbixItem) => {
          const base = i.name;
          if (i.units) units[base] = i.units;
          if (i.hosts && i.hosts.length > 0) {
            i.hosts.forEach((h: ZabbixHost) => {
              const hostName = h.name || h.host;
              if (!mapping[hostName]) mapping[hostName] = [];
              mapping[hostName].push(base);
              dict[\`${base}_${hostName}\`] = { itemid: i.itemid, value_type: i.value_type, lastvalue: i.lastvalue };
            });
          }
        });
        setMetricDict(dict);
        setMetricUnitsMap(prev => ({ ...prev, ...units }));

        for (const host in mapping) {
          mapping[host] = Array.from(new Set(mapping[host]));
        }
        setHostMetricsMap(mapping);
        
        const metrics = Array.from(new Set(itemRes.data.result.map((i: ZabbixItem) => i.name)));
        setAvailableMetrics(metrics as string[]);
      }
      
      if (manual) {
        setDiscoveryStatus({ 
          type: hostRes.data.result.length === 0 ? 'error' : 'success', 
          message: \`Discovered ${hostRes.data.result.length} hosts and ${itemRes.data.result.length} metrics.\` 
        });
      }
    } catch (e: any) {
      console.error("Zabbix Discovery Failed", e);
      let msg = e.response?.data?.error || e.message || "Zabbix Discovery Failed";
      if (typeof msg === 'string') {
        msg = msg.split('\n')[0];
        msg = msg.replace(/Trace ID: .*/, '').trim(); 
      }
      if (manual) setDiscoveryStatus({ type: 'error', message: msg });
    } finally {
      if (manual) setIsDiscovering(false);
    }
  }, [zabbixConfig]);

  useEffect(() => {
    if (!initialDiscoveryTriggered) {
      if (zabbixConfig.url && (zabbixConfig.token || zabbixConfig.isPreconfigured)) {
        setInitialDiscoveryTriggered(true);
        discoverZabbixAssets(false);
      }
    }
  }, [zabbixConfig, initialDiscoveryTriggered, discoverZabbixAssets]);

  return {
    isDiscovering,
    discoveryStatus,
    availableHosts, setAvailableHosts,
    availableMetrics, setAvailableMetrics,
    metricDict, setMetricDict,
    hostMetricsMap, setHostMetricsMap,
    metricUnitsMap, setMetricUnitsMap,
    discoverZabbixAssets,
    setDiscoveryStatus,
  };
}
`;

fs.mkdirSync('src/hooks', { recursive: true });
fs.writeFileSync('src/hooks/useZabbixDiscovery.ts', useZabbixHooksCode);

const useTimeseriesCode = `import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { Widget } from '../types/zabbix';

export function useTimeseries(
    zabbixConfig: { url: string, token: string },
    filters: any,
    widgets: Widget[],
    metricDict: any
) {
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [refreshProgress, setRefreshProgress] = useState(0);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const hostsUsed = new Set<string>();
      const metricsUsed = new Set<string>();
      
      widgets.forEach(w => {
        w.hosts.forEach((h: string) => h !== 'all' && hostsUsed.add(h));
        w.metrics.forEach((m: string) => metricsUsed.add(m));
      });

      const response = await axios.post("/api/timeseries", {
        metrics: Array.from(metricsUsed),
        hosts: Array.from(hostsUsed),
        granularity: filters.mode === 'live' ? filters.granularity : filters.granularity,
        range: filters.range,
        mode: filters.mode,
        start: filters.start,
        end: filters.end,
        url: zabbixConfig.url,
        token: zabbixConfig.token,
        itemDict: metricDict 
      });
      setData(response.data);
      setLastSync(new Date());
    } catch (error: any) {
      console.error("Failed to fetch statistics", error);
    } finally {
      setLoading(false);
    }
  }, [filters, zabbixConfig, widgets, metricDict]);

  useEffect(() => {
    fetchStats();
    if (filters.mode === 'live') {
      let stepMs = 60000;
      if (filters.granularity === '5m') stepMs = 300000;
      if (filters.granularity === '15m') stepMs = 900000;
      if (filters.granularity === '1h') stepMs = 3600000;

      const refreshInterval = Math.max(stepMs, 60000); 
      let elapsed = 0;
      const progressTimer = setInterval(() => {
        elapsed += 1000;
        setRefreshProgress(Math.min((elapsed / refreshInterval) * 100, 100));
      }, 1000);

      const fetchTimer = setInterval(() => {
        elapsed = 0;
        setRefreshProgress(0);
        fetchStats();
      }, refreshInterval);

      return () => {
        clearInterval(progressTimer);
        clearInterval(fetchTimer);
        setRefreshProgress(0);
      };
    }
  }, [fetchStats, filters.mode, filters.granularity]);

  return { data, setData, loading, lastSync, setLastSync, refreshProgress, fetchStats };
}
`;

fs.writeFileSync('src/hooks/useTimeseries.ts', useTimeseriesCode);
