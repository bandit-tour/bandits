import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.BANDITS_WEB_BASE ?? 'http://127.0.0.1:8084';
const out = 'artifacts/runtime-proof/banditeam-ux-cleanup';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

async function shot(name, path, wait = 5000) {
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
}

try {
  await shot('01-home-bandits', '/bandits', 7000);
  await shot('02-alerts-feed', '/alerts', 6000);
  await shot('03-report-form', '/bandiTeam/report', 5000);
  await shot('04-bandiTeam-hub-menu-route', '/bandiTeam', 6000);
  console.log('Saved to', out);
} finally {
  await browser.close();
}
