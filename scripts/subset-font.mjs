// Subset the Fusion Pixel fonts (OFL-1.1) to only the characters used by the game.
// Requires `uvx` (fonttools + brotli). Run: npm run font
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const chars = new Set();
for (let c = 32; c < 127; c++) chars.add(String.fromCharCode(c));
'，。！？、：；「」（）《》…—·×←→↑↓★☆♪♥●○■□▲▼◆※～“”‘’'.split('').forEach((c) => chars.add(c));
function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|html)$/.test(f)) for (const ch of readFileSync(p, 'utf8')) if (ch.codePointAt(0) > 127) chars.add(ch);
  }
}
walk(join(root, 'src'));
walk(join(root, 'index.html').replace(/index\.html$/, '')  === root ? join(root, 'src') : join(root, 'src'));
const text = [...chars].join('');
writeFileSync('/tmp/szsb-chars.txt', text);
console.log('chars:', chars.size);
for (const [src, dst] of [
  ['fonts-src/fusion12.woff2', 'src/assets/fonts/px12.woff2'],
  ['fonts-src/fusion8.woff2', 'src/assets/fonts/px8.woff2'],
]) {
  execSync(
    `uvx --from fonttools --with brotli pyftsubset ${join(root, src)} --text-file=/tmp/szsb-chars.txt --flavor=woff2 --layout-features='*' --output-file=${join(root, dst)}`,
    { stdio: 'inherit' },
  );
  console.log(dst, statSync(join(root, dst)).size, 'bytes');
}
