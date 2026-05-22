import net from "net";

export function isSafeTargetUrl(reqUrl: string): boolean {
  try {
    const parsedUrl = new URL(reqUrl);
    const hostname = parsedUrl.hostname.toLowerCase();

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return false;
    }

    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      return false;
    }

    if (net.isIPv4(hostname)) {
      const parts = hostname.split('.');
      if (parts[0] === '127') return false; 
      if (parts[0] === '169' && parts[1] === '254') return false; 
      if (parts[0] === '0') return false; 
    } else if (net.isIPv6(hostname)) {
      if (hostname === '::1' || hostname === '::') return false;
      if (hostname.includes('::ffff:127.')) return false;
      if (hostname.toLowerCase().startsWith('fe80:')) return false;
    }
    
    return true;
  } catch(e) {
    return false;
  }
}
