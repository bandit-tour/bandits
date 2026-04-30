/**
 * Polish proof pack: home card copy, bandiTEAM hub, Alerts dual tab, Pilot Desk row/actions.
 * Requires web dev server (e.g. `npx expo start --web`). Override base: BANDITS_WEB_BASE=http://127.0.0.1:8084
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.BANDITS_WEB_BASE ?? 'http://127.0.0.1:8084';
const out = 'artifacts/runtime-proof/banditeam-polish-pass';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 900 } });

async function gotoShot(name, path, waitMs = 5000) {
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
}

try {
  await gotoShot('01-home-bandits-card', '/bandits', 6000);
  const card = page.locator('[data-testid="banditeam-home-alerts-card"]');
  if ((await card.count()) > 0) {
    await card.scrollIntoViewIfNeeded();
    await card.screenshot({ path: `${out}/01b-home-card-crop.png` });
  }

  await gotoShot('02-menu-banditeam-hub', '/bandiTeam', 5000);

  await gotoShot('03-alerts-tab-dual', '/scam-alerts', 6000);
  const dest = page.locator('[data-testid="scam-alerts-destination-read"]');
  if ((await dest.count()) > 0) {
    await dest.scrollIntoViewIfNeeded();
    await dest.screenshot({ path: `${out}/03b-destination-read-crop.png` });
  }

  await gotoShot('04-pilot-desk', '/operatorDesk', 5000);
  const firstReport = page.locator('[data-testid^="pilot-desk-report-"]').first();
  if ((await firstReport.count()) > 0) {
    await firstReport.scrollIntoViewIfNeeded();
    await firstReport.screenshot({ path: `${out}/04b-pilot-desk-first-row.png` });
    const actions = firstReport.locator('[data-testid^="pilot-desk-actions-"]');
    if ((await actions.count()) > 0) {
      await actions.screenshot({ path: `${out}/04c-pilot-desk-actions-crop.png` });
    }
  }

  console.log('Wrote screenshots to', out);
} finally {
  await browser.close();
}
