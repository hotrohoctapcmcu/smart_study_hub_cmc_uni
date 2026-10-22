import { readFileSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Suy ra thư mục Frontend từ vị trí file để chạy được trên mọi máy.
const base = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(base + '/index.html', 'utf-8');

// Check CSS
const cssRe = /href="(src[^"?]+\.css)/g;
let m, allOk = true;
while ((m = cssRe.exec(html)) !== null) {
  const p = resolve(base, m[1]);
  try { statSync(p); console.log('CSS OK:', m[1]); } 
  catch { console.error('CSS MISSING:', m[1]); allOk = false; }
}

// Check JS script src
const jsRe = /src="(src[^"?]+\.js)/g;
while ((m = jsRe.exec(html)) !== null) {
  const p = resolve(base, m[1]);
  try { statSync(p); console.log('JS OK:', m[1]); }
  catch { console.error('JS MISSING:', m[1]); allOk = false; }
}

if (allOk) console.log('\nAll HTML-referenced files exist on disk!');
else process.exit(1);
