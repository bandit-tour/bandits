/**
 * Copy root index.html to /hotel/play-theatrou/ so static hosts (Vercel) serve 200
 * for the QR URL without relying only on SPA rewrites.
 */
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const src = path.join(dist, 'index.html');
const destDir = path.join(dist, 'hotel', 'play-theatrou');
const dest = path.join(destDir, 'index.html');

if (!fs.existsSync(src)) {
  console.error('mirror-hotel-index: dist/index.html missing; run expo export first.');
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log('✅ mirror-hotel-index: copied index.html → hotel/play-theatrou/index.html');
