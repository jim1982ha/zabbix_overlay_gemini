const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');

// We need to parse server.ts.
// It has isSafeTargetUrl, startServer, API configs, express routes.

const utilsCode = `import net from "net";
export function isSafeTargetUrl(reqUrl: string): boolean {
  try {
    const parsedUrl = new URL(reqUrl);
    const hostname = parsedUrl.hostname.toLowerCase();
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return false;
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false;
    if (net.isIPv4(hostname)) {
      const parts = hostname.split('.');
      if (parts[0] === '127' || (parts[0] === '169' && parts[1] === '254') || parts[0] === '0') return false;
    } else if (net.isIPv6(hostname)) {
      if (hostname === '::1' || hostname === '::' || hostname.includes('::ffff:127.') || hostname.toLowerCase().startsWith('fe80:')) return false;
    }
    return true;
  } catch(e) { return false; }
}
`;

fs.writeFileSync('server/utils/security.ts', utilsCode);

fs.writeFileSync('server/services/ZabbixService.ts', `
import axios from "axios";

export class ZabbixService {
  static async makeRequest(url: string, token: string | undefined, method: string, params: any, timeout = 30000) {
    let payload: any = { jsonrpc: "2.0", method, params, id: Date.now() };
    let headers: any = { 'Content-Type': 'application/json-rpc' };
    if (token) headers['Authorization'] = \`Bearer ${token}\`;
    
    let res = await axios.post(url, payload, { headers, maxBodyLength: Infinity, maxContentLength: Infinity, timeout });
    if (res.data?.error) {
       const errStr = JSON.stringify(res.data.error);
       if (errStr.includes("Session terminated") || errStr.includes("Not authorized")) {
          delete headers['Authorization'];
          payload.auth = token;
          res = await axios.post(url, payload, { headers, maxBodyLength: Infinity, maxContentLength: Infinity, timeout });
       }
    }
    return res;
  }
}
`);

console.log('Done small parts');
