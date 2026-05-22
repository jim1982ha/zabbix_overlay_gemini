const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
    /const url = reqUrl \|\| process\.env\.VITE_ZABBIX_URL \|\| "http:\/\/localhost\/zabbix\/api_jsonrpc\.php";/g,
    'const url = reqUrl || process.env.VITE_ZABBIX_URL || "";'
);

content = content.replace(
    /const url = reqUrl \|\| process\.env\.VITE_ZABBIX_URL \|\| 'http:\/\/localhost\/zabbix\/api_jsonrpc\.php';/g,
    'const url = reqUrl || process.env.VITE_ZABBIX_URL || "";'
);

// Also fix in /api/zabbix
content = content.replace(
    /const url = reqUrl \|\| process\.env\.VITE_ZABBIX_URL \|\| "http:\/\/localhost\/zabbix\/api_jsonrpc\.php";/g,
    'const url = reqUrl || process.env.VITE_ZABBIX_URL || "";'
);

fs.writeFileSync('server.ts', content);
console.log('Fixed URLs');
