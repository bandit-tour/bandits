import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.BANDITS_WEB_BASE ?? 'http://127.0.0.1:8084';
const out = 'artifacts/runtime-proof/banditeam-sprint';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

async function shot(name, path, wait = 5000) {
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
}

try {
  await shot('01-feed', '/scam-alerts', 6000);
  await shot('02-detail-placeholder', '/scam-alert/00000000-0000-0000-0000-000000000000', 4000);
  await shot('03-map', '/scam-alerts-map', 5000);
  await shot('04-report', '/bandiTeam/report', 5000);
  console.log('Saved to', out);
} finally {
  await browser.close();
}
