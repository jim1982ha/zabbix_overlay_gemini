import { useState, useCallback } from "react";
import axios from "axios";
import { ZabbixHost, ZabbixItem } from "../types/zabbix";

export function useZabbixDiscovery(zabbixConfig: { url: string; token: string }) {
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryStatus, setDiscoveryStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [availableHosts, setAvailableHosts] = useState<string[]>(["srv-prod-01", "sql-db-primary", "gateway-02"]);
  const [availableMetrics, setAvailableMetrics] = useState<string[]>(["cpu", "memory", "traffic", "latency", "disk"]);
  const [metricDict, setMetricDict] = useState<Record<string, { itemid: string; value_type: string; lastvalue: string }>>({});
  const [hostMetricsMap, setHostMetricsMap] = useState<Record<string, string[]>>({});
  const [metricUnitsMap, setMetricUnitsMap] = useState<Record<string, string>>({
    cpu: "%",
    memory: "GB",
    traffic: "Mbps",
    latency: "ms",
    disk: "%"
  });

  const discoverZabbixAssets = useCallback(async (manual = false, overrideConfig?: { url: string; token: string }) => {
    const urlToUse = overrideConfig?.url || zabbixConfig.url;
    const tokenToUse = overrideConfig?.token || zabbixConfig.token;

    if (!tokenToUse || !urlToUse) {
      if (manual) {
        setDiscoveryStatus({ type: "error", message: "Please specify URL and Token first." });
      }
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

      let discoveredHosts: string[] = ["srv-prod-01", "sql-db-primary", "gateway-02"];
      if (hostRes.data && hostRes.data.result) {
        discoveredHosts = hostRes.data.result.map((h: ZabbixHost) => h.name || h.host);
        setAvailableHosts(discoveredHosts);
      }

      const itemRes = await axios.post("/api/zabbix", {
        url: urlToUse,
        token: tokenToUse,
        method: "item.get",
        params: {
          output: ["name", "key_", "units", "itemid", "value_type", "lastvalue"],
          selectHosts: ["name", "host"],
          monitored: true,
          limit: 1000
        }
      });

      if (itemRes.data && itemRes.data.result) {
        const units: Record<string, string> = {};
        const mapping: Record<string, string[]> = {};
        const dict: Record<string, { itemid: string; value_type: string; lastvalue: string }> = {};

        itemRes.data.result.forEach((i: ZabbixItem) => {
          const base = i.name;
          if (i.units) {
            units[base] = i.units;
          }
          if (i.hosts && i.hosts.length > 0) {
            i.hosts.forEach((h: ZabbixHost) => {
              const hostName = h.name || h.host;
              if (!mapping[hostName]) {
                mapping[hostName] = [];
              }
              mapping[hostName].push(base);
              dict[`${base}_${hostName}`] = {
                itemid: i.itemid,
                value_type: i.value_type,
                lastvalue: i.lastvalue
              };
            });
          }
        });

        setMetricDict(dict);
        setMetricUnitsMap((prev) => ({ ...prev, ...units }));

        for (const host in mapping) {
          mapping[host] = Array.from(new Set(mapping[host]));
        }
        setHostMetricsMap(mapping);

        const metrics = Array.from(new Set(itemRes.data.result.map((i: ZabbixItem) => i.name))) as string[];
        if (metrics.length > 0) {
          setAvailableMetrics(metrics);
        }

        if (manual) {
          setDiscoveryStatus({
            type: discoveredHosts.length === 0 ? "error" : "success",
            message: `Discovered ${discoveredHosts.length} hosts and ${itemRes.data.result.length} metrics.`
          });
        }
      }
    } catch (e: any) {
      console.error("Zabbix Discovery Error:", e);
      if (manual) {
        setDiscoveryStatus({
          type: "error",
          message: e.response?.data?.error || e.message || "Failed to discover hosts and metrics."
        });
      }
    } finally {
      if (manual) {
        setIsDiscovering(false);
      }
    }
  }, [zabbixConfig.url, zabbixConfig.token]);

  return {
    isDiscovering,
    discoveryStatus,
    setDiscoveryStatus,
    availableHosts,
    availableMetrics,
    metricDict,
    hostMetricsMap,
    metricUnitsMap,
    discoverZabbixAssets
  };
}
