import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

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
      hasEnvToken: !!process.env.VITE_ZABBIX_TOKEN
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

      // Prefer user-provided values from the frontend configuration, fallback to environment variables
      const url = reqUrl || process.env.VITE_ZABBIX_URL || "http://localhost/zabbix/api_jsonrpc.php";
      
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

      const response = await axios.post(url, {
        jsonrpc: "2.0",
        method,
        params,
        auth: token,
        id: Date.now(),
      });

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
        upstreamErr = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
      } else if (error.code) {
        upstreamErr = error.code;
      }

      res.status(500).json({ 
        error: `Failed to communicate with Zabbix monitoring gateway: ${upstreamErr}`, 
        details: "Internal Server Error" 
      });
    }
  });

  // Mock API for development with filtering simulation
  app.get("/api/mock/stats", (req, res) => {
    const { start, end, granularity = '5m', range = '24h', mode = 'live' } = req.query;
    
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
      if (dataPoints < 1) dataPoints = 1; // Ensure at least one point
      
      timeLabels = Array.from({ length: dataPoints }, (_, i) => {
        return new Date(startTime + i * stepMs).toISOString();
      });
    } else {
      // Live mode data generation - backwards from now respecting range
      const now = Date.now();
      const totalRangeMs = rangeMsMap[range as string] || 86400000;
      
      dataPoints = Math.min(Math.floor(totalRangeMs / stepMs), 500);
      if (dataPoints < 1) dataPoints = 1; // Ensure at least one point

      timeLabels = Array.from({ length: dataPoints }, (_, i) => {
        return new Date(now - (dataPoints - 1 - i) * stepMs).toISOString();
      });
    }
    
    const hostsArr = ['srv-prod-01', 'sql-db-primary', 'gateway-02', 'all'];
    
    const data = Array.from({ length: dataPoints }, (_, i) => {
      const point: any = {
        time: timeLabels[i] || `${i}:00`,
      };

      // Generate metrics for each host
      hostsArr.forEach(h => {
        const timeValue = new Date(timeLabels[i]).getTime();
        // Use timestamp as part of the seed for deterministic but period-specific values
        const seedValue = timeValue / 10000; 
        const hostSeed = h.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        
        point[`cpu_${h}`] = Math.floor(((Math.sin(seedValue + hostSeed) + 1) / 2) * 60) + 10;
        point[`memory_${h}`] = Math.floor(((Math.cos(seedValue * 0.7 + hostSeed) + 1) / 2) * 40) + 30;
        point[`traffic_${h}`] = Math.floor(((Math.sin(seedValue * 0.3 + hostSeed) + 1) / 2) * 1000) + 100;
        point[`latency_${h}`] = Math.floor(((Math.cos(seedValue * 0.5 + hostSeed) + 1) / 2) * 200) + 20;
        point[`disk_${h}`] = Math.floor(((Math.sin(seedValue * 0.1 + hostSeed) + 1) / 2) * 80) + 5;
      });

      // Legacy global keys for backward compatibility
      point.cpu = point.cpu_all;
      point.memory = point.memory_all;
      point.traffic = point.traffic_all;
      point.latency = point.latency_all;
      point.disk = point.disk_all;

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
