import express from 'express';
import { isSafeTargetUrl, requireSecureToken, resolveEnvironmentToken } from '../../utils/security';
import { ZabbixService } from './ZabbixService';
import axios from 'axios';

export const timeseriesRouter = express.Router();

timeseriesRouter.post("/", requireSecureToken, async (req, res) => {
    let { start, end, granularity = '5m', range = '24h', mode = 'live', url: reqUrl, token: reqToken, metrics = [], hosts = [], itemDict = {}, isDemoRequest } = req.body;
    
    // Prefer user-provided values from the frontend configuration, fallback to environment variables
    const url = reqUrl || process.env.VITE_ZABBIX_URL || "";
    
    const token = resolveEnvironmentToken(reqToken);
    
    const isDemo = isDemoRequest || (!url || !token);

    // Type checking for arrays to prevent DoS via TypeError Exceptions
    if (!Array.isArray(metrics)) metrics = [];
    if (!Array.isArray(hosts)) hosts = [];
    // Ensure array elements are strings to prevent NoSQL / Prototype pollution issues downstream
    metrics = metrics.filter((m: any) => typeof m === 'string');
    hosts = hosts.filter((h: any) => typeof h === 'string');

    // Basic SSRF protection (CWE-918): Reject loopback and AWS Metadata IPs
    if (url && !(await isSafeTargetUrl(url))) {
      return res.status(403).json({ error: "Forbidden: Unsafe target URL provided." });
    }

    let timeLabels: string[] = [];
    let dataPoints = 12;

    const granMsMap: any = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '30m': 1800000,
      '1h': 3600000,
      '1d': 86400000
    };

    const rangeMsMap: any = {
      '1h': 3600000,
      '6h': 21600000,
      '24h': 86400000,
      '7d': 604800000
    };

    const stepMs = granMsMap[granularity as string] || 300000;

    if (mode === 'historical' && start && end) {
      const startTime = new Date(start as string).getTime();
      const endTime = new Date(end as string).getTime();
      
      if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
        return res.status(400).json({ error: "Invalid date format provided for historical query." });
      }

      const durationMs = endTime - startTime;

      dataPoints = Math.min(Math.floor(durationMs / stepMs), 10000); 
      if (dataPoints < 1) dataPoints = 1; 
      
      timeLabels = Array.from({ length: dataPoints }, (_, i) => {
        return new Date(startTime + i * stepMs).toISOString();
      });
    } else {
      const t = Date.now();
      const settledEnd = Math.floor((t - 60000) / stepMs) * stepMs;
      const now = settledEnd - stepMs;
      
      const totalRangeMs = rangeMsMap[range as string] || 86400000;
      
      dataPoints = Math.min(Math.floor(totalRangeMs / stepMs), 10000);
      if (dataPoints < 1) dataPoints = 1; 

      timeLabels = Array.from({ length: dataPoints }, (_, i) => {
        return new Date(now - (dataPoints - 1 - i) * stepMs).toISOString();
      });
    }

    let itemValueMap: Record<string, string> = {};
    let historyValues: Record<string, [number, number][]> = {};

    if (url && token && metrics.length > 0 && hosts.length > 0) {
      try {
        const itemsToFetchHistory: Record<number, string[]> = {};
        const itemIdToKey: Record<string, string> = {};

        const zReq = async (method: string, params: any, timeout = 30000) => ZabbixService.makeRequest(url, token, method, params, timeout);

        if (Object.keys(itemDict).length > 0) {
           // Create a case-insensitive map of the provided itemDict for robust matching
           const lowerItemDict: Record<string, any> = {};
           for (const [k, v] of Object.entries(itemDict)) {
              if (v) lowerItemDict[k.toLowerCase()] = v;
           }

           const missingMetrics = new Set<string>();

           metrics.forEach((m: string) => {
              hosts.forEach((h: string) => {
                 const key = `${m}_${h}`;
                 // Search case-insensitively in the itemDict keys
                 let info = lowerItemDict[key.toLowerCase()];
                 let finalH = h;
                 if (!info) {
                    // Try to find a fuzzy match for the legacy metric (e.g. "cpu" -> "cpu utilization" or support "all" hosts wildcard)
                    const mLower = m.toLowerCase();
                    const hLower = h.toLowerCase();
                    const fuzzyKeys = hLower === 'all' 
                       ? Object.keys(lowerItemDict).filter(k => k.includes(mLower))
                       : Object.keys(lowerItemDict).filter(k => k.endsWith(`_${hLower}`) && k.includes(mLower));
                    
                    if (fuzzyKeys.length > 0) {
                        // Use the first fuzzy match if we have a specific host, but if all, we should technically add them all.
                        // However, since we process (m,h) nested loop, if h is 'all', we just add it to missingMetrics and let Zabbix search it below
                        if (hLower !== 'all') {
                           info = lowerItemDict[fuzzyKeys[0]];
                        }
                    }
                 }
                 
                 if (info && h !== 'all') {
                    itemValueMap[key] = info.lastvalue;
                    const vtype = parseInt(info.value_type, 10);
                    if (!isNaN(vtype)) {
                       if (!itemsToFetchHistory[vtype]) itemsToFetchHistory[vtype] = [];
                       itemsToFetchHistory[vtype].push(info.itemid);
                       itemIdToKey[info.itemid] = key; // Preserve the requested casing key
                    }
                 } else {
                    missingMetrics.add(m);
                 }
              });
           });

           if (missingMetrics.size > 0) {
               try {
                  const missingRes = await zReq("item.get", {
                      output: ["itemid", "name", "value_type", "lastvalue"],
                      selectHosts: ["name", "host"],
                      search: { name: Array.from(missingMetrics) },
                      searchByAny: true,
                      monitored: true,
                  }, 10000);
                  
                  if (missingRes.data && missingRes.data.result) {
                    missingRes.data.result.forEach((item: any) => {
                       const h = item.hosts?.[0]?.name || item.hosts?.[0]?.host;
                       const m = item.name;
                       if (h && m) {
                          // Match case-insensitively with missing metrics to use the requested metric key
                          const matchedMetric = Array.from(missingMetrics).find((reqM: string) => m.toLowerCase().includes(reqM.toLowerCase())) || m;
                          const key = `${matchedMetric}_${h}`;
                          // Ensure we only process if this host matches requested hosts (to prevent unexpected inserts)
                          if (!Object.values(itemIdToKey).includes(key) && (hosts.includes('all') || hosts.includes(h) || hosts.map((x: string)=>x.toLowerCase()).includes(h.toLowerCase()))) {
                              itemValueMap[key] = item.lastvalue;
                              const vtype = parseInt(item.value_type, 10);
                              if (!isNaN(vtype)) {
                                 if (!itemsToFetchHistory[vtype]) itemsToFetchHistory[vtype] = [];
                                 itemsToFetchHistory[vtype].push(item.itemid);
                                 itemIdToKey[item.itemid] = key; // Preserve the requested casing key
                              }
                          }
                       }
                    });
                  }
               } catch (e) {
                  console.error("[timeseries] Failed to fetch missing metrics", e);
               }
           }
        } else {
           const itemRes = await zReq("item.get", {
               output: ["itemid", "name", "value_type", "lastvalue"],
               selectHosts: ["name", "host"],
               search: { name: metrics },
               searchByAny: true,
               monitored: true,
           }, 10000);
           
           if (itemRes.data && itemRes.data.result) {
             itemRes.data.result.forEach((item: any) => {
                const h = item.hosts?.[0]?.name || item.hosts?.[0]?.host;
                const m = item.name;
                if (h && m) {
                   // Match case-insensitively with requested metrics to preserve requested casing key
                   const matchedMetric = metrics.find((reqM: string) => m.toLowerCase().includes(reqM.toLowerCase())) || m;
                   const key = `${matchedMetric}_${h}`;
                   if (!Object.values(itemIdToKey).includes(key) && (hosts.includes('all') || hosts.includes(h) || hosts.map((x: string)=>x.toLowerCase()).includes(h.toLowerCase()))) {
                       itemValueMap[key] = item.lastvalue;
                       const vtype = parseInt(item.value_type, 10);
                       if (!isNaN(vtype)) {
                          if (!itemsToFetchHistory[vtype]) itemsToFetchHistory[vtype] = [];
                          itemsToFetchHistory[vtype].push(item.itemid);
                          itemIdToKey[item.itemid] = key; // Preserve the requested casing key
                       }
                   }
                }
             });
           }
        }
        
        if (mode === 'live' && Object.keys(itemIdToKey).length > 0) {
           try {
               const liveItemRes = await zReq("item.get", {
                    output: ["itemid", "lastvalue", "lastclock"],
                    itemids: Object.keys(itemIdToKey)
               }, 15000);
               if (liveItemRes.data?.result) {
                   liveItemRes.data.result.forEach((pt: any) => {
                       const key = itemIdToKey[pt.itemid];
                       if (key && pt.lastvalue !== undefined) {
                           itemValueMap[key] = pt.lastvalue;
                           const ts = parseInt(pt.lastclock, 10) * 1000;
                           if (!isNaN(ts)) {
                               if (!historyValues[key]) historyValues[key] = [];
                               const val = parseFloat(pt.lastvalue);
                               if (!isNaN(val)) {
                                  // push the latest point into history to guarantee the line extends to the present truthfully
                                  historyValues[key].push([ts, val]);
                               }
                           }
                       }
                   });
               }
           } catch (err) {
               console.error("[timeseries] Failed to refetch live lastvalue", err);
           }
        }

        const actualStartTime = new Date(timeLabels[0]).getTime();
        const actualEndTime = new Date(timeLabels[timeLabels.length - 1]).getTime();

        // Decide whether to use history or trends based on duration
        const durationSeconds = (actualEndTime - actualStartTime) / 1000;
        const useTrend = durationSeconds > 86400 * 2; // Use trends if duration is > 2 days
        const lookbackSeconds = useTrend ? 86400 : 7200; // Look back 1 day for trends, 2 hours for history to find a "before" point.
        
        for (const [vtypeStr, itemids] of Object.entries(itemsToFetchHistory)) {
           const vtype = parseInt(vtypeStr, 10);
           const isNumeric = (vtype === 0 || vtype === 3);

           let results: any[] = [];
           let queryUsed = "";

           // If it's numeric and duration > 2 days, try trend.get first
           if (isNumeric && useTrend) {
               try {
                  const trendRes = await zReq("trend.get", {
                        output: "extend",
                        itemids,
                        time_from: Math.floor(actualStartTime / 1000) - lookbackSeconds,
                        time_till: Math.floor(actualEndTime / 1000) + Math.floor(stepMs / 1000)
                  }, 30000);
                  
                  if (trendRes.data && trendRes.data.result) {
                     results = trendRes.data.result.map((pt: any) => ({
                        itemid: pt.itemid,
                        clock: pt.clock,
                        value: pt.value_avg
                     }));
                     queryUsed = "trend.get";
                  }
               } catch (e) { console.error("[timeseries] trend.get failed", e); }
           }

           // If not used trend, or trend returned nothing, fallback to history.get
            if (results.length === 0) {
              try {
                const histRes = await zReq("history.get", {
                  output: "extend",
                  history: vtype,
                  itemids,
                  time_from: Math.floor(actualStartTime / 1000) - lookbackSeconds,
                  time_till: Math.floor(actualEndTime / 1000) + Math.floor(stepMs / 1000)
                }, 30000);
                results = histRes.data?.result || [];
                queryUsed = "history.get";
                

              } catch (e) { console.error("[timeseries] history.get failed", e); }
           }

           if (results.length > 0) {
              results.forEach((pt: any) => {
                 const key = itemIdToKey[pt.itemid];
                 if (key) {
                    if (!historyValues[key]) historyValues[key] = [];
                    historyValues[key].push([parseInt(pt.clock, 10) * 1000, parseFloat(pt.value)]);
                 }
              });
           }
        }
        
        // Sort history by time map
        for (const key of Object.keys(historyValues)) {
           historyValues[key].sort((a,b) => a[0] - b[0]);
        }
        
        // No debug logging in production
      } catch (e) {
        console.error("Failed to fetch real data for timeseries", e);
      }
    }
    
    // Fallback default hosts/metrics if empty
    const hostsArr = hosts.length > 0 ? hosts : ['srv-prod-01', 'sql-db-primary', 'gateway-02', 'all'];
    const metricsArr = metrics.length > 0 ? metrics : ['cpu', 'memory', 'traffic', 'latency', 'disk'];
    
    const data = Array.from({ length: dataPoints }, (_, i) => {
      const point: any = {
        time: timeLabels[i] || `${i}:00`,
      };
      const bucketTime = new Date(timeLabels[i]).getTime();

      // Ensure all fetched keys are injected into the point
      const allKeys = new Set([
        ...Object.keys(historyValues),
        ...Object.keys(itemValueMap),
        ...hostsArr.flatMap(h => metricsArr.map(m => `${m}_${h}`))
      ]);

      allKeys.forEach((key: string) => {
           // We might not have h and m distinctly mapped if we just iterate keys,
           // but we can compute them if needed for Demo fallback.
           const parts = key.split('_');
           const h = parts.length > 1 ? parts[parts.length - 1] : hostsArr[0];
           const m = parts.slice(0, parts.length - 1).join('_') || parts[0];

           if (historyValues[key] && historyValues[key].length > 0) {
              const pts = historyValues[key]; 
              let sum = 0;
              let count = 0;
              
              const rangeStart = bucketTime;
              const rangeEnd = bucketTime + stepMs;

              let lastSeenBeforeOrAtStart: number | null = null;
              let bestTBefore = -Infinity;
              
              for (let p=0; p<pts.length; p++) {
                 const t = pts[p][0];
                 const v = pts[p][1];
                 
                 if (t <= rangeStart && t > bestTBefore) {
                    bestTBefore = t;
                    lastSeenBeforeOrAtStart = v;
                 }
                 
                 if (t > rangeStart && t <= rangeEnd) {
                    sum += v;
                    count++;
                 }
              }
              
              if (count > 0) {
                  point[key] = parseFloat((sum/count).toFixed(2));
              } else if (lastSeenBeforeOrAtStart !== null) {
                  point[key] = parseFloat(lastSeenBeforeOrAtStart.toFixed(2));
              } else {
                  point[key] = null;
              }
           } else if (itemValueMap[key] !== undefined) {
              if (i === dataPoints - 1) {
                  point[key] = parseFloat(parseFloat(itemValueMap[key]).toFixed(2));
              } else {
                  point[key] = null;
              }
           } else if (isDemo) {
             const timeValue = new Date(timeLabels[i]).getTime();
             const seedValue = timeValue / 10000; 
             const hostSeed = h.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
             const metricSeed = m.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
             const combined = seedValue + hostSeed + metricSeed;
             
             let val = 0;
             if (m.toLowerCase().includes('cpu')) val = Math.floor(((Math.sin(combined) + 1) / 2) * 60) + 10;
             else if (m.toLowerCase().includes('mem')) val = Math.floor(((Math.cos(combined * 0.7) + 1) / 2) * 40) + 30;
             else if (m.toLowerCase().includes('traffic')) val = Math.floor(((Math.sin(combined * 0.3) + 1) / 2) * 1000) + 100;
             else if (m.toLowerCase().includes('lat')) val = Math.floor(((Math.cos(combined * 0.5) + 1) / 2) * 200) + 20;
             else if (m.toLowerCase().includes('space') || m.toLowerCase().includes('disk')) val = Math.floor(((Math.sin(combined * 0.1) + 1) / 2) * 80) + 5;
             else val = Math.floor(((Math.sin(combined) + 1) / 2) * 100) + 10;

             point[key] = val;
           } else {
             point[key] = null;
           }
      });

      // Legacy global keys for backward compatibility for demo mode
      point.cpu = point.cpu_all || point[`cpu_${hostsArr[0]}`];
      point.memory = point.memory_all || point[`memory_${hostsArr[0]}`];
      point.traffic = point.traffic_all || point[`traffic_${hostsArr[0]}`];
      point.latency = point.latency_all || point[`latency_${hostsArr[0]}`];
      point.disk = point.disk_all || point[`disk_${hostsArr[0]}`];

      return point;
    });
    res.json(data);
  });

  