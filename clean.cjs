const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
    '  const ZABBIX_URL = process.env.VITE_ZABBIX_URL || "http://localhost/zabbix/api_jsonrpc.php";\n  const ZABBIX_TOKEN = process.env.VITE_ZABBIX_TOKEN;\n',
    ''
);

fs.writeFileSync('server.ts', content);
console.log('Cleaned unused vars');
