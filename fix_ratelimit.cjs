const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
    /app\.set\("trust proxy", 1\);/g,
    'app.set("trust proxy", true);' // Trust multiple proxies in GCP
);

content = content.replace(
    'legacyHeaders: false',
    'legacyHeaders: false,\n    validate: { xForwardedForHeader: false, trustProxy: false }'
);

fs.writeFileSync('server.ts', content);
console.log('Fixed rate limit validation config');
