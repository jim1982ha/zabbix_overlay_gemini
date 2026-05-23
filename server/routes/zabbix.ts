import express from 'express';
import axios from 'axios';
import { isSafeTargetUrl } from '../utils/security';
import { ZabbixService } from '../services/ZabbixService';

export const zabbixRouter = express.Router();

zabbixRouter.post("/", async (req, res) => {
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
      const url = reqUrl || process.env.VITE_ZABBIX_URL || "";
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
      
      const allowedMethods = ['host.get', 'item.get', 'history.get', 'trend.get', 'hostgroup.get', 'apiinfo.version', 'trigger.get', 'problem.get'];
      if (typeof method !== 'string' || !allowedMethods.includes(method)) {

        return res.status(403).json({ error: "Forbidden: Method not in strict explicit allowlist." });
      }

      console.log(`Proxying Zabbix Request: ${method} to ${url}`);

      const requestPayload: any = {
        jsonrpc: "2.0",
        method,
        params,
        id: Date.now(),
      };

      

      let response = await ZabbixService.makeRequest(url, token, method, params, 30000);

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

  zabbixRouter.get("/zabbix-debug", (req, res) => {
    try {
        const dbgInfo = require('node:fs').readFileSync(require('node:path').join(process.cwd(), 'zabbix-debug.json'), 'utf8');
        res.json(JSON.parse(dbgInfo));
    } catch(e) {
        res.status(500).json({ error: "Debug file not found or could not be read", globalLogs: (global as any).zabbixHistDebugLog || [] });
    }
  });

  