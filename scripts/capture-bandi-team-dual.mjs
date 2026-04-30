/**
 * Captures web screenshots for bandiTEAM dual-use routes (requires `npx expo start --web`).
 * Saves under artifacts/runtime-proof/bandi-team-dual/
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.BANDITS_WEB_BASE ?? 'http://127.0.0.1:8084';
const out = 'artifacts/runtime-proof/bandi-team-dual';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

async function shot(name, urlPath, opts = {}) {
  const url = `${base}${urlPath}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(opts.waitMs ?? 4000);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
}

try {
  await shot('01-report-form', '/bandiTeam/report', { waitMs: 5000 });

  const submit = page.locator('[data-testid="banditeam-report-submit"]');
  if ((await submit.count()) > 0) {
    await submit.scrollIntoViewIfNeeded();
    await submit.screenshot({ path: `${out}/02-submit-button.png` });
  }

  await shot('03-hub-bandiTeam', '/bandiTeam/index', { waitMs: 5000 });

  const row = page.locator('[data-testid^="banditeam-preview-row-"]').first();
  if ((await row.count()) > 0) {
    await row.scrollIntoViewIfNeeded();
    await row.screenshot({ path: `${out}/04-preview-row.png` });
    await row.click();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${out}/05-after-row-click.png`, fullPage: true });
  } else {
    await shot('04-feed-try-scam-alerts', '/scam-alerts', { waitMs: 5000 });
    const feedRow = page.locator('[data-testid^="scam-alert-feed-row-"]').first();
    if ((await feedRow.count()) > 0) {
      await feedRow.scrollIntoViewIfNeeded();
      await feedRow.screenshot({ path: `${out}/04-feed-row.png` });
      await feedRow.click();
      await page.waitForTimeout(4000);
      await page.screenshot({ path: `${out}/05-after-feed-row-click.png`, fullPage: true });
    }
  }

  const detail = page.locator('[data-testid="scam-alert-detail-root"]');
  if ((await detail.count()) > 0) {
    await detail.screenshot({ path: `${out}/06-alert-detail-root.png` });
  }

  console.log('Wrote screenshots to', out);
} finally {
  await browser.close();
}
