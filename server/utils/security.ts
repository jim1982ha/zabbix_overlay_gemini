import net from "net";
import dns from "dns/promises";
import { Request, Response, NextFunction } from "express";

export async function isSafeTargetUrl(reqUrl: string): Promise<boolean> {
  try {
    const parsedUrl = new URL(reqUrl);
    const hostname = parsedUrl.hostname.toLowerCase();

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return false;
    }

    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      return false;
    }

    const checkIp = (ip: string) => {
      if (net.isIPv4(ip)) {
        const parts = ip.split('.');
        if (parts[0] === '127') return false; 
        if (parts[0] === '169' && parts[1] === '254') return false; 
        if (parts[0] === '0') return false; 
      } else if (net.isIPv6(ip)) {
        if (ip === '::1' || ip === '::') return false;
        if (ip.toLowerCase().includes('::ffff:127.')) return false;
        if (ip.toLowerCase().startsWith('fe80:')) return false;
      }
      return true;
    };

    if (net.isIP(hostname)) {
      return checkIp(hostname);
    } else {
      const records = await dns.lookup(hostname, { all: true });
      for (const record of records) {
        if (!checkIp(record.address)) return false;
      }
    }
    
    return true;
  } catch(e) {
    return false; // DNS resolution failure or invalid URL
  }
}

export function requireSecureToken(req: Request, res: Response, next: NextFunction) {
  const isDemo = req.body && req.body.isDemoRequest;
  const expectedToken = process.env.APP_SECURE_TOKEN;
  if (expectedToken && !isDemo) {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      res.status(401).json({ error: "Unauthorized access detected." });
      return;
    }
  }
  next();
}

export function resolveEnvironmentToken(reqToken?: string): string | undefined {
  if (!reqToken || reqToken === '********************************') {
    return process.env.VITE_ZABBIX_TOKEN;
  }
  return reqToken;
}
