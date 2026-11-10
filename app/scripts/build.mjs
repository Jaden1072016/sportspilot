// Copies ONLY browser-facing files into dist/ for static hosting. Server code, tests, docs,
// data and scripts are never published. Netlify bundles functions separately from source.
import { mkdirSync, rmSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_PATH } from './local.mjs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
rmSync(DIST, { recursive: true, force: true });
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? (['node_modules', 'dist', '.git', 'netlify', 'tests', 'scripts'].includes(f) ? [] : walk(p)) : [p]; });
let n = 0;
for (const file of walk(ROOT)) {
  const web = '/' + file.slice(ROOT.length + 1).split('\\').join('/');
  if (!PUBLIC_PATH.test(web)) continue;
  mkdirSync(dirname(join(DIST, web)), { recursive: true });
  copyFileSync(file, join(DIST, web)); n++;
}
console.log(`dist/ built with ${n} public files`);
