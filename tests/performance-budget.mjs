import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const distHtml = fs.readFileSync('dist/index.html', 'utf8');
const scriptMatch = distHtml.match(/<script[^>]+src="([^"]+\.js)"/);
if (!scriptMatch) throw new Error('Não foi possível identificar o JavaScript inicial em dist/index.html.');

const entryPath = path.join('dist', scriptMatch[1].replace(/^\//, ''));
const entry = fs.readFileSync(entryPath);
const gzipBytes = zlib.gzipSync(entry).byteLength;
const maxEntryGzipBytes = 190 * 1024;

if (gzipBytes > maxEntryGzipBytes) {
  throw new Error(`Bundle inicial excedeu o orçamento mobile: ${Math.round(gzipBytes / 1024)} KB gzip > ${Math.round(maxEntryGzipBytes / 1024)} KB.`);
}

const cssMatches = [...distHtml.matchAll(/href="([^"]+\.css)"/g)];
let cssGzipBytes = 0;
for (const match of cssMatches) {
  const cssPath = path.join('dist', match[1].replace(/^\//, ''));
  if (fs.existsSync(cssPath)) cssGzipBytes += zlib.gzipSync(fs.readFileSync(cssPath)).byteLength;
}
const maxCssGzipBytes = 55 * 1024;
if (cssGzipBytes > maxCssGzipBytes) {
  throw new Error(`CSS inicial excedeu o orçamento mobile: ${Math.round(cssGzipBytes / 1024)} KB gzip > ${Math.round(maxCssGzipBytes / 1024)} KB.`);
}

console.log(`Performance budget OK: JS inicial ${Math.round(gzipBytes / 1024)} KB gzip; CSS inicial ${Math.round(cssGzipBytes / 1024)} KB gzip.`);
