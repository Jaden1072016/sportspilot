import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const need=['index.html','styles.css','app.js','manifest.webmanifest','sw.js','netlify.toml','netlify/functions/scores.mjs','netlify/functions/markets.mjs','lib/model.mjs'];
for(const filename of need){if(!existsSync(join(process.cwd(),filename)))throw new Error(`Missing ${filename}`);}
const manifest=JSON.parse(readFileSync('manifest.webmanifest','utf8'));
if(!manifest.name) throw new Error('Manifest missing name');
console.log(`Smoke file check PASS (${need.length} files)`);
