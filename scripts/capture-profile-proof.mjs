/**
 * Profile screen proof (requires `npx expo start --web`). Signed-out still captures chrome.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.BANDITS_WEB_BASE ?? 'http://127.0.0.1:8084';
const out = 'artifacts/runtime-proof/profile-save-proof';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });

try {
  await page.goto(`${base}/profile`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}/01-profile-screen.png`, fullPage: true });
  console.log('Wrote', `${out}/01-profile-screen.png`);
} finally {
  await browser.close();
}
