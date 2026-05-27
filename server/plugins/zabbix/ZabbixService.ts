import axios from "axios";

export class ZabbixService {
  static async makeRequest(url: string, token: string | undefined, method: string, params: any, timeout = 30000) {
    let payload: any = { jsonrpc: "2.0", method, params, id: Date.now() };
    let headers: any = { 'Content-Type': 'application/json-rpc' };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    } else {
        payload.auth = token;
    }
    
    // Limit response size to 50MB instead of Infinity to prevent memory exhaustion (CWE-400)
    let res = await axios.post(url, payload, { headers, maxBodyLength: 50 * 1024 * 1024, maxContentLength: 50 * 1024 * 1024, timeout });
    
    if (res.data?.error) {
       const errStr = JSON.stringify(res.data.error);
       if (errStr.includes("Session terminated") || errStr.includes("Not authorized")) {
          delete headers['Authorization'];
          payload.auth = token;
          let fallbackRes = await axios.post(url, payload, { headers, maxBodyLength: 50 * 1024 * 1024, maxContentLength: 50 * 1024 * 1024, timeout });
          if (!(fallbackRes.data?.error && JSON.stringify(fallbackRes.data.error).includes('unexpected parameter "auth"'))) {
              res = fallbackRes;
          }
       }
    }
    
    return res;
  }
}
