/**
 * Deep scan all .js files under src/ and find broken relative imports
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, dirname, relative } from 'path';

const base = 'd:/Reporitory/smart_study_hub_cmc_uni/Frontend';

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) files.push(...walk(full));
    else if (entry.endsWith('.js') || entry.endsWith('.mjs')) files.push(full);
  }
  return files;
}

const allFiles = walk(join(base, 'src'));
const importRe = /from\s+["']([^"']+)["']|import\s*\(["']([^"']+)["']\)/g;

const missing = [];
for (const file of allFiles) {
  const content = readFileSync(file, 'utf-8');
  let m;
  importRe.lastIndex = 0;
  while ((m = importRe.exec(content)) !== null) {
    const imp = m[1] || m[2];
    if (!imp || imp.startsWith('http')) continue;
    if (!imp.startsWith('.')) continue;
    // Strip query strings like ?v=4
    const cleanImp = imp.split('?')[0];
    const absPath = resolve(dirname(file), cleanImp);
    // Try with and without .js extension
    const candidates = [absPath, absPath + '.js', absPath + '/index.js'];
    let found = false;
    for (const c of candidates) {
      try { statSync(c); found = true; break; } catch {}
    }
    if (!found) {
      missing.push({ from: relative(base, file).replace(/\\/g, '/'), imp });
    }
  }
}

if (missing.length === 0) {
  console.log('✓ ALL IMPORTS RESOLVED OK - no broken references!');
} else {
  console.error('❌ BROKEN IMPORTS FOUND:');
  missing.forEach(m => console.error('  ' + m.from + ' => ' + m.imp));
  process.exit(1);
}
