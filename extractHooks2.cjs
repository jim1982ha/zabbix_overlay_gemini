const fs = require('fs');

let appCode = fs.readFileSync('src/App.tsx', 'utf8');

appCode = appCode.replace(
  'import { WidgetEditor } from "./components/dashboard/WidgetEditor";',
  'import { WidgetEditor } from "./components/dashboard/WidgetEditor";\nimport { useZabbixDiscovery } from "./hooks/useZabbixDiscovery";\nimport { useTimeseries } from "./hooks/useTimeseries";'
);

fs.writeFileSync('src/App.tsx', appCode);
console.log('Hooks injected in App.tsx imports!');
