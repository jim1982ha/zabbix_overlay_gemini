import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import dotenv from "dotenv";
import net from "net";

dotenv.config();

// Robust SSRF Protection Function (CWE-918)
// Note: We permit RFC1918 (192.168.x.x, 10.x.x.x) as Zabbix is often hosted locally.
function isSafeTargetUrl(reqUrl: string): boolean {
  try {
    const parsedUrl = new URL(reqUrl);
    const hostname = parsedUrl.hostname.toLowerCase();

    // Block protocols other than http/https
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return false;
    }

    // Block clear loopback hostnames
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      return false;
    }

    // WHATWG URL parser normalizes octal/hex IPs, so checking decimal is sufficient
    if (net.isIPv4(hostname)) {
      const parts = hostname.split('.');
      if (parts[0] === '127') return false; // Loopback
      if (parts[0] === '169' && parts[1] === '254') return false; // AWS Metadata / Link-local
      if (parts[0] === '0') return false; // 0.0.0.0
    } else if (net.isIPv6(hostname)) {
      if (hostname === '::1' || hostname === '::') return false;
      if (hostname.includes('::ffff:127.')) return false;
      if (hostname.toLowerCase().startsWith('fe80:')) return false; // Link-local
    }
    
    return true;
  } catch(e) {
    return false; // Invalid URL format
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.APP_PORT ? parseInt(process.env.APP_PORT, 10) : 3000;

  // Set rigorous body parser limits to prevent Denial-of-Service via payload exhaustion
  app.use(express.json({ limit: "1mb" }));

  // Zabbix API Configuration
  const ZABBIX_URL = process.env.VITE_ZABBIX_URL || "http://localhost/zabbix/api_jsonrpc.php";
  const ZABBIX_TOKEN = process.env.VITE_ZABBIX_TOKEN;

  // Expose runtime environment configuration to the frontend
  app.get("/api/config", (req, res) => {
    res.json({
      url: process.env.VITE_ZABBIX_URL || "",
      token: process.env.VITE_ZABBIX_TOKEN ? '********************************' : "", // Obfuscate token for security, handle specially in frontend
      hasEnvToken: !!process.env.VITE_ZABBIX_TOKEN,
      requiresSecureToken: !!process.env.APP_SECURE_TOKEN
    });
  });

  // Proxy Zabbix API calls to avoid CORS and hide token
  app.post("/api/zabbix", async (req, res) => {
    try {
      // Optional: Internal Authorization Gate if APP_SECURE_TOKEN is injected via environment (CWE-306 fix)
      const expectedToken = process.env.APP_SECURE_TOKEN;
      if (expectedToken) {
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
          return res.status(401).json({ error: "Unauthorized access detected." });
        }
      }

      if (!req.body || typeof req.body !== "object") {
        return res.status(400).json({ error: "Invalid request payload." });
      }

      const { 
        method,
        params,
        url: reqUrl,
        token: reqToken
      } = req.body;

      // Basic SSRF protection (CWE-918): Reject loopback and AWS Metadata IPs
      if (reqUrl && !isSafeTargetUrl(reqUrl)) {
        return res.status(403).json({ error: "Forbidden: Unsafe target URL provided." });
      }

      // Prefer user-provided values from the frontend configuration, fallback to environment variables
      const url = reqUrl || process.env.VITE_ZABBIX_URL || "http://localhost/zabbix/api_jsonrpc.php";
      if (!isSafeTargetUrl(url)) {
        return res.status(403).json({ error: "Forbidden: Configured URL is unsafe." });
      }
      
      // If client sends the obfuscated token placeholder, fall back to the actual environment variable token
      let token = reqToken;
      if (!token || token === '********************************') {
        token = process.env.VITE_ZABBIX_TOKEN;
      }

      if (!token) {
        return res.status(400).json({ error: "Zabbix Token not configured in environment" });
      }

      // STRICT ALLOWLIST: Only permit read-only GET methods to prevent destructive actions or RCE via script.execute
      if (typeof method !== 'string' || !method.endsWith('.get')) {
        return res.status(403).json({ error: "Forbidden: Only read-only (.get) methods are permitted via this proxy." });
      }

      console.log(`Proxying Zabbix Request: ${method} to ${url}`);

      const requestPayload: any = {
        jsonrpc: "2.0",
        method,
        params,
        id: Date.now(),
      };

      const doRequest = async (useAuthHeader: boolean) => {
        const payload = { ...requestPayload };
        const headers: any = { 'Content-Type': 'application/json-rpc' };
        
        if (useAuthHeader) {
           headers['Authorization'] = `Bearer ${token}`;
        } else {
           payload.auth = token;
        }
        return await axios.post(url, payload, { headers });
      };

      let response = await doRequest(true);

      // If we get an authentication error using the modern header-based auth, 
      // the Zabbix server might be < 6.4, which strictly requires the `auth` property in the body.
      if (
        response.data.error && 
        (
          response.data.error.data?.includes("Session terminated") || 
          response.data.error.data?.includes("Not authorized") ||
          response.data.error.message?.includes("Not authorized")
        )
      ) {
        console.log("Modern Zabbix auth failed. Attempting legacy body auth (Zabbix < 6.4)...");
        const fallbackResponse = await doRequest(false);
        
        // If the fallback gives us an "unexpected parameter 'auth'" or similar parameter error,
        // it means the server is actually modern (>= 6.4) and the original token was simply invalid.
        // In that case, we should return the original authentication error, not the fallback parameter error.
        if (
            fallbackResponse.data.error && 
            fallbackResponse.data.error.data?.includes('unexpected parameter "auth"')
        ) {
            console.log("Server is modern (rejected 'auth' param). The token was likely invalid.");
        } else {
            // Otherwise, use the fallback response (it either succeeded, or failed with a different error)
            response = fallbackResponse;
        }
      }

      if (response.data.error) {
        console.error("Zabbix API Internal Error:", response.data.error);
        return res.status(400).json({ 
          error: "Zabbix reported an error: " + (response.data.error.data || response.data.error.message || "Unknown error"), 
          details: response.data.error 
        });
      }

      res.json(response.data);
    } catch (error: any) {
      console.error("Zabbix Proxy Error:", error.message);
      
      let upstreamErr = error.message;
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          // If it's an HTML error page from a bad gateway/404, just return the status text.
          if (error.response.data.toLowerCase().includes('<html')) {
             upstreamErr = `HTTP ${error.response.status} ${error.response.statusText}`;
          } else {
             upstreamErr = error.response.data;
          }
        } else {
          upstreamErr = JSON.stringify(error.response.data);
        }
      } else if (error.code) {
        upstreamErr = error.code;
      }

      res.status(500).json({ 
        error: `Failed to communicate with Zabbix monitoring gateway: ${upstreamErr}`, 
        details: "Internal Server Error" 
      });
    }
  });

  app.get("/api/zabbix-debug", (req, res) => {
    try {
        const dbgInfo = require('node:fs').readFileSync(require('node:path').join(process.cwd(), 'zabbix-debug.json'), 'utf8');
        res.json(JSON.parse(dbgInfo));
    } catch(e) {
        res.status(500).json({ error: "Debug file not found or could not be read", globalLogs: global.zabbixHistDebugLog || [] });
    }
  });

  // Dynamic Timeseries API for Dashboard
  app.post("/api/timeseries", async (req, res) => {
    let { start, end, granularity = '5m', range = '24h', mode = 'live', url, token, metrics = [], hosts = [], itemDict = {} } = req.body;
    
    const isDemo = !url || !token;

    // Optional: Internal Authorization Gate if APP_SECURE_TOKEN is injected via environment (CWE-306 fix)
    const expectedToken = process.env.APP_SECURE_TOKEN;
    if (expectedToken && !isDemo) {
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
        return res.status(401).json({ error: "Unauthorized access detected." });
      }
    }

    // Type checking for arrays to prevent DoS via TypeError Exceptions
    if (!Array.isArray(metrics)) metrics = [];
    if (!Array.isArray(hosts)) hosts = [];
    // Ensure array elements are strings to prevent NoSQL / Prototype pollution issues downstream
    metrics = metrics.filter((m: any) => typeof m === 'string');
    hosts = hosts.filter((h: any) => typeof h === 'string');

    // Basic SSRF protection (CWE-918): Reject loopback and AWS Metadata IPs
    if (url && !isSafeTargetUrl(url)) {
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

      dataPoints = Math.min(Math.floor(durationMs / stepMs), 500); 
      if (dataPoints < 1) dataPoints = 1; 
      
      timeLabels = Array.from({ length: dataPoints }, (_, i) => {
        return new Date(startTime + i * stepMs).toISOString();
      });
    } else {
      const now = Date.now();
      const totalRangeMs = rangeMsMap[range as string] || 86400000;
      
      dataPoints = Math.min(Math.floor(totalRangeMs / stepMs), 500);
      if (dataPoints < 1) dataPoints = 1; 

      timeLabels = Array.from({ length: dataPoints }, (_, i) => {
        return new Date(now - (dataPoints - 1 - i) * stepMs).toISOString();
      });
    }

    let itemValueMap: Record<string, string> = {};
    let historyValues: Record<string, [number, number][]> = {};

    if (url && token && metrics.length > 0 && hosts.length > 0) {
      console.log(`[timeseries] fetch start. metrics: ${metrics.length}, hosts: ${hosts.length}`);
      console.log(`metrics array:`, metrics);
      console.log(`hosts array:`, hosts);
      try {
        const itemsToFetchHistory: Record<number, string[]> = {};
        const itemIdToKey: Record<string, string> = {};

        if (Object.keys(itemDict).length > 0) {
           console.log(`[timeseries] Using provided itemDict`);
           metrics.forEach((m: string) => {
              hosts.forEach((h: string) => {
                 const key = `${m}_${h}`;
                 const info = itemDict[key];
                 if (info) {
                    itemValueMap[key] = info.lastvalue;
                    const vtype = parseInt(info.value_type, 10);
                    if (!isNaN(vtype)) {
                       if (!itemsToFetchHistory[vtype]) itemsToFetchHistory[vtype] = [];
                       itemsToFetchHistory[vtype].push(info.itemid);
                       itemIdToKey[info.itemid] = key;
                    }
                 }
              });
           });
        } else {
           console.log(`[timeseries] No itemDict provided, falling back to item.get`);
           const itemRes = await axios.post(url, {
             jsonrpc: "2.0",
             method: "item.get",
             params: {
               output: ["itemid", "name", "value_type", "lastvalue"],
               selectHosts: ["name", "host"],
               search: { name: metrics },
               searchByAny: true,
               monitored: true,
             },
             auth: token,
             id: Date.now()
           }, { timeout: 10000 });
           
           if (itemRes.data && itemRes.data.result) {
             itemRes.data.result.forEach((item: any) => {
                const h = item.hosts?.[0]?.name || item.hosts?.[0]?.host;
                const m = item.name;
                if (h && m) {
                   const key = `${m}_${h}`;
                   itemValueMap[key] = item.lastvalue;
                   const vtype = parseInt(item.value_type, 10);
                   if (!isNaN(vtype)) {
                      if (!itemsToFetchHistory[vtype]) itemsToFetchHistory[vtype] = [];
                      itemsToFetchHistory[vtype].push(item.itemid);
                      itemIdToKey[item.itemid] = key;
                   }
                }
             });
           }
        }
        
        if (mode === 'live' && Object.keys(itemIdToKey).length > 0) {
           try {
               const liveItemRes = await axios.post(url, {
                   jsonrpc: "2.0",
                   method: "item.get",
                   params: {
                        output: ["itemid", "lastvalue", "lastclock"],
                        itemids: Object.keys(itemIdToKey)
                   },
                   auth: token,
                   id: Date.now()
               }, { timeout: 15000 });
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
                  const trendRes = await axios.post(url, {
                     jsonrpc: "2.0",
                     method: "trend.get",
                     params: {
                        output: ["itemid", "clock", "value_avg"],
                        itemids,
                        time_from: Math.floor(actualStartTime / 1000) - lookbackSeconds,
                        time_till: Math.floor(actualEndTime / 1000) + Math.floor(stepMs / 1000)
                     },
                     auth: token,
                     id: Date.now()
                  }, { timeout: 30000 });
                  
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
              const zabbixReqPayload = {
                jsonrpc: "2.0",
                method: "history.get",
                params: {
                  output: ["itemid", "clock", "value"],
                  history: vtype,
                  itemids,
                  time_from: Math.floor(actualStartTime / 1000) - lookbackSeconds,
                  time_till: Math.floor(actualEndTime / 1000) + Math.floor(stepMs / 1000)
                },
                auth: token,
                id: Date.now()
              };
              try {
                const histRes = await axios.post(url, zabbixReqPayload, { maxBodyLength: Infinity, maxContentLength: Infinity, timeout: 30000 });
                results = histRes.data?.result || [];
                queryUsed = "history.get";
                
                if (!global.zabbixHistDebugLog) global.zabbixHistDebugLog = [];
                global.zabbixHistDebugLog.push({
                   vtype,
                   query: queryUsed,
                   reqSize: itemids.length,
                   resLen: results.length,
                   err: histRes.data?.error
                });
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
        
        try {
           const dbgInfo = {
             itemsToFetchHistory,
             itemIdToKey,
             zabbixHistDebugLog: global.zabbixHistDebugLog,
             historyKeys: Object.keys(historyValues),
             historyCounts: Object.fromEntries(Object.entries(historyValues).map(([k,v]) => [k, (v as any[]).length]))
           };
           require('fs').writeFileSync(require('path').join(process.cwd(), 'zabbix-debug.json'), JSON.stringify(dbgInfo, null, 2));
           console.log(`[timeseries] Debug log written. historyCounts:`, dbgInfo.historyCounts);
        } catch(e) {}
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

      hostsArr.forEach((h: string) => {
        metricsArr.forEach((m: string) => {
           const key = `${m}_${h}`;
           
           if (historyValues[key] && historyValues[key].length > 0) {
              const pts = historyValues[key]; 
              let sum = 0;
              let count = 0;
              
              const rangeStart = bucketTime;
              const rangeEnd = bucketTime + stepMs;

              let lastSeenBeforeOrAtStart: number | null = null;
              // Optimally, we can find the exact value active at rangeStart.
              // Note: pts is sorted by timestamp asc
              let bestTBefore = -Infinity;
              
              for (let p=0; p<pts.length; p++) {
                 const t = pts[p][0];
                 const v = pts[p][1];
                 
                 // If the point is before passing rangeStart, track it as latest known state
                 if (t <= rangeStart && t > bestTBefore) {
                    bestTBefore = t;
                    lastSeenBeforeOrAtStart = v;
                 }
                 
                 // If inside the bucket
                 if (t > rangeStart && t <= rangeEnd) {
                    sum += v;
                    count++;
                 }
                 
                 // Optimisation: stop if we passed the end
                 // if (t > rangeEnd) break;  // Can do this since pts is sorted
              }
              
              if (count > 0) {
                  // If we got values strictly this period, use average or last value?
                  // Trend charting typically uses the average during this bucket
                  point[key] = parseFloat((sum/count).toFixed(2));
              } else if (lastSeenBeforeOrAtStart !== null) {
                  // No data *inside* bucket, hold latest known state!
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
             // Mock values based on metric name heuristics (Demo Mode only)
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
             // Real API but no data found for this timestamp bucket
             point[key] = null;
           }
        });
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
