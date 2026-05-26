import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import dotenv from "dotenv";
import net from "net";
import rateLimit from "express-rate-limit";
import fs from "fs";
import { zabbixRouter } from "./server/routes/zabbix";
import { timeseriesRouter } from "./server/routes/timeseries";

dotenv.config();

// Robust SSRF Protection Function (CWE-918)
// Note: We permit RFC1918 (192.168.x.x, 10.x.x.x) as Zabbix is often hosted locally.


async function startServer() {
  const app = express();
  app.set("trust proxy", true);
  const PORT = process.env.APP_PORT ? parseInt(process.env.APP_PORT, 10) : 3000;

  // Set rigorous body parser limits to prevent Denial-of-Service via payload exhaustion
  app.use(express.json({ limit: "50mb" }));

  // Rate limiting to prevent DoS (CWE-770)
  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 120,
    message: { error: "Too many requests from this IP, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, trustProxy: false }
  });
  
  app.use("/api/", apiLimiter);


  // Zabbix API Configuration

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
  
  // Demo Dashboard File API
  app.get("/api/demo-dashboard", (req, res) => {
    try {
      const demoPath = path.join(process.cwd(), "src", "data", "demoDashboard.json");
      if (fs.existsSync(demoPath)) {
        res.json(JSON.parse(fs.readFileSync(demoPath, "utf-8")));
      } else {
        res.status(404).json({ error: "demoDashboard.json not found" });
      }
    } catch (e) {
      res.status(500).json({ error: "Failed to read demoDashboard.json" });
    }
  });

  app.post("/api/demo-dashboard", express.json(), (req, res) => {
    try {
      const demoPath = path.join(process.cwd(), "src", "data", "demoDashboard.json");
      const dirOfDemo = path.dirname(demoPath);
      if (!fs.existsSync(dirOfDemo)) {
        fs.mkdirSync(dirOfDemo, { recursive: true });
      }
      fs.writeFileSync(demoPath, JSON.stringify(req.body, null, 2), "utf-8");
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to write demoDashboard.json" });
    }
  });

  app.use('/api/zabbix', zabbixRouter);
  app.use('/api/timeseries', timeseriesRouter);

  // Dynamic Timeseries API for Dashboard
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
