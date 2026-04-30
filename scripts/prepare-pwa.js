const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const publicDir = path.join(__dirname, '..', 'public');
const assetsDir = path.join(__dirname, '..', 'assets/images');

// Copy manifest.json to dist
const manifestSrc = path.join(publicDir, 'manifest.json');
const manifestDest = path.join(distDir, 'manifest.json');

if (fs.existsSync(manifestSrc)) {
  fs.copyFileSync(manifestSrc, manifestDest);
  console.log('✅ Copied manifest.json to dist/');
} else {
  console.error('❌ manifest.json not found in public/');
}

// Copy and resize app icon as PWA icons
const iconSrc = path.join(assetsDir, 'banditour-main-logo.png');

if (fs.existsSync(iconSrc)) {
  const icon192 = path.join(distDir, 'icon-192.png');
  const icon512 = path.join(distDir, 'icon-512.png');

  // Resize icons using sips (macOS) or just copy if resize fails
  const { execSync } = require('child_process');

  try {
    execSync(`sips -z 192 192 "${iconSrc}" --out "${icon192}"`, { stdio: 'pipe' });
    execSync(`sips -z 512 512 "${iconSrc}" --out "${icon512}"`, { stdio: 'pipe' });
    console.log('✅ Resized and copied app icons to dist/');
  } catch (err) {
    // Fallback: just copy if resize fails
    fs.copyFileSync(iconSrc, icon192);
    fs.copyFileSync(iconSrc, icon512);
    console.log('⚠️  Copied icons without resizing (sips failed)');
  }

  console.log('   - icon-192.png');
  console.log('   - icon-512.png');
} else {
  console.error('❌ App icon not found at:', iconSrc);
}

// Inject manifest link into HTML files
const manifestLink = '<link rel="manifest" href="/manifest.json" />';
const appleIconLink = '<link rel="apple-touch-icon" href="/icon-192.png" />';
const themeColor = '<meta name="theme-color" content="#0a0a0a" />';

/** Baked into dist HTML — static export may omit `app/+html` shell styles. Prevents white flash before JS. */
const shellStyleBlock = `<style id="bandits-shell">html,body{background-color:#0a0a0a;}#root{min-height:100vh;min-height:100dvh;background-color:#0a0a0a;}</style>`;

function injectManifestLinks(htmlPath) {
  if (!fs.existsSync(htmlPath)) {
    return;
  }

  let html = fs.readFileSync(htmlPath, 'utf8');
  let changed = false;

  if (!html.includes('id="bandits-shell"') && html.includes('</head>')) {
    html = html.replace('</head>', `${shellStyleBlock}</head>`);
    changed = true;
    console.log(`✅ Injected shell style into ${path.basename(htmlPath)}`);
  }

  if (html.includes('rel="manifest"')) {
    if (changed) {
      fs.writeFileSync(htmlPath, html);
    }
    console.log(`⏭️  Skipping manifest: ${path.basename(htmlPath)} (already has link)`);
    return;
  }

  if (html.includes('</head>')) {
    const injection = `${manifestLink}${appleIconLink}${themeColor}</head>`;
    html = html.replace('</head>', injection);
    fs.writeFileSync(htmlPath, html);
    console.log(`✅ Injected manifest link into ${path.basename(htmlPath)}`);
  } else {
    if (changed) {
      fs.writeFileSync(htmlPath, html);
    }
    console.warn(`⚠️  No </head> tag found in ${path.basename(htmlPath)}`);
  }
}

// Find all HTML files
function findHtmlFiles(dir) {
  const files = fs.readdirSync(dir);
  const htmlFiles = [];

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      htmlFiles.push(...findHtmlFiles(filePath));
    } else if (file.endsWith('.html')) {
      htmlFiles.push(filePath);
    }
  });

  return htmlFiles;
}

console.log('\n🔧 Preparing PWA assets...\n');

const htmlFiles = findHtmlFiles(distDir);

if (htmlFiles.length === 0) {
  console.error('❌ No HTML files found in dist directory');
  process.exit(1);
}

console.log('\n📝 Injecting manifest links into HTML files...\n');
htmlFiles.forEach(injectManifestLinks);

console.log(`\n✨ Done! Processed ${htmlFiles.length} HTML files`);