const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

if (!content.includes('trust proxy')) {
    content = content.replace(
        '  const app = express();',
        '  const app = express();\n  app.set("trust proxy", 1);'
    );
    fs.writeFileSync('server.ts', content);
    console.log('Added trust proxy to server.ts');
} else {
    console.log('trust proxy already found');
}
