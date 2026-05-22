const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

serverCode = serverCode.replace(/function isSafeTargetUrl[\s\S]*?^}/m, '');

let zabbixRouteMatch = serverCode.match(/app\.post\("\/api\/zabbix"[\s\S]*?\/\/ Dynamic Timeseries API/);
let tsRouteMatch = serverCode.match(/app\.post\("\/api\/timeseries"[\s\S]*?\/\/ Vite middleware for development/);

if (zabbixRouteMatch && tsRouteMatch) {
    let zabbixRoute = zabbixRouteMatch[0].replace('// Dynamic Timeseries API', '');
    let tsRoute = tsRouteMatch[0].replace('// Vite middleware for development', '');
    
    let zabbixRouterCode = "import express from 'express';\nimport axios from 'axios';\nimport { isSafeTargetUrl } from '../utils/security';\nimport { ZabbixService } from '../services/ZabbixService';\n\nexport const zabbixRouter = express.Router();\n\n" + zabbixRoute.replace(/app\.post\("\/api\/zabbix",/g, 'zabbixRouter.post("\/",');
    
    let tsRouterCode = "import express from 'express';\nimport { isSafeTargetUrl } from '../utils/security';\nimport { ZabbixService } from '../services/ZabbixService';\nimport fs from 'fs';\nimport path from 'path';\nimport axios from 'axios';\n\nexport const timeseriesRouter = express.Router();\n\n" + tsRoute.replace(/app\.post\("\/api\/timeseries",/g, 'timeseriesRouter.post("\/",');
    
    tsRouterCode = tsRouterCode.replace(
        /const zReq = async \(method: string, params: any, timeout = 30000\) => \{[\s\S]*?return res;\n\s*\};/g,
        'const zReq = async (method: string, params: any, timeout = 30000) => ZabbixService.makeRequest(url, token, method, params, timeout);'
    );
    
    zabbixRouterCode = zabbixRouterCode.replace(
        /const doRequest = async \(useAuthHeader: boolean\) => \{[\s\S]*?return await axios.post\(url, payload, \{ headers \}\);\n\s*\};/g,
        ''
    );
    zabbixRouterCode = zabbixRouterCode.replace(
        /let response = await doRequest\(true\);[\s\S]*?response = fallbackResponse;\n\s*\}\n\s*\}/g,
        'let response = await ZabbixService.makeRequest(url, token, method, params, 30000);'
    );
    
    fs.writeFileSync('server/routes/zabbix.ts', zabbixRouterCode);
    fs.writeFileSync('server/routes/timeseries.ts', tsRouterCode);
    
    serverCode = serverCode.replace(zabbixRoute, '');
    serverCode = serverCode.replace(tsRoute, '');
    
    serverCode = serverCode.replace('import rateLimit from "express-rate-limit";', 'import rateLimit from "express-rate-limit";\nimport { zabbixRouter } from "./server/routes/zabbix";\nimport { timeseriesRouter } from "./server/routes/timeseries";');
    
    let routeMounts = "\n  app.use('/api/zabbix', zabbixRouter);\n  app.use('/api/timeseries', timeseriesRouter);\n";
    serverCode = serverCode.replace('// Dynamic Timeseries API', routeMounts + '\n  // Dynamic Timeseries API');
    
    fs.writeFileSync('server.ts', serverCode);
    console.log('Successfully detached backend routers.');
} else {
    console.log('Could not find matches for routes.');
}
