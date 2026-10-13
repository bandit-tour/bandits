import { chromium } from 'playwright';
import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.development.local' });
dotenv.config();

const outDir = 'artifacts/runtime-proof';
fs.mkdirSync(outDir, { recursive: true });

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

const { data: seedEvents } = await supabase
  .from('event')
  .select('*')
  .not('location_lat', 'is', null)
  .limit(40);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message || e)));
page.on('console', (msg) => {
  if (msg.type() === 'error') {
    const t = msg.text();
    if (/Failed to load resource|401|400|Download the React DevTools/i.test(t)) return;
    errors.push('console:' + t.slice(0, 240));
  }
});

// Anon RLS returns 0 rows — stub Explore event reads with service-role seed for UX proof.
await page.route('**/rest/v1/event**', async (route) => {
  const rows = Array.isArray(seedEvents) ? seedEvents : [];
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` },
    body: JSON.stringify(rows),
  });
});

await page.goto('http://localhost:8081/explore?view=map', {
  waitUntil: 'domcontentloaded',
  timeout: 180000,
});
await page.waitForTimeout(10000);

// Dismiss LogBox overlays if present
for (let i = 0; i < 3; i++) {
  const dismiss = page.getByText('Dismiss', { exact: true });
  if (await dismiss.count()) {
    await dismiss.first().click().catch(() => {});
    await page.waitForTimeout(500);
  } else break;
}

const mapBtn = page.getByText('Map', { exact: true }).first();
if (await mapBtn.count()) {
  await mapBtn.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(4000);
}

await page.screenshot({ path: `${outDir}/explore-map-desktop.png`, fullPage: false });

const mapInfo = await page.evaluate(() => {
  const leaflet = !!document.querySelector('.leaflet-container');
  const markers = document.querySelectorAll('.leaflet-marker-icon').length;
  const paths = document.querySelectorAll('.leaflet-interactive').length;
  const mapH = document.querySelector('.leaflet-container')?.getBoundingClientRect().height || 0;
  const mapW = document.querySelector('.leaflet-container')?.getBoundingClientRect().width || 0;
  return {
    leaflet,
    markers,
    paths,
    mapH,
    mapW,
    hasListToggle: /List|Map/.test(document.body?.innerText || ''),
    snippet: (document.body?.innerText || '').slice(0, 900),
  };
});

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(2500);
for (let i = 0; i < 2; i++) {
  const dismiss = page.getByText('Dismiss', { exact: true });
  if (await dismiss.count()) await dismiss.first().click().catch(() => {});
}
await page.screenshot({ path: `${outDir}/explore-map-mobile.png`, fullPage: false });

const placePhotoTdZ = errors.filter((e) => /placePhotoArgs/i.test(e));
const report = {
  seedCount: Array.isArray(seedEvents) ? seedEvents.length : 0,
  errors: errors.slice(0, 30),
  placePhotoTdZ,
  mapInfo,
  screenshots: [
    `${outDir}/explore-map-desktop.png`,
    `${outDir}/explore-map-mobile.png`,
  ],
};
fs.writeFileSync(`${outDir}/explore-map-verify.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();

if (placePhotoTdZ.length) process.exit(2);
if (!mapInfo.leaflet || mapInfo.mapH < 400) process.exit(3);
