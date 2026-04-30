/**
 * Inbox / notifications UI proof (requires `npx expo start --web`).
 * BANDITS_WEB_BASE default http://127.0.0.1:8083
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.BANDITS_WEB_BASE ?? 'http://127.0.0.1:8083';
const out = 'artifacts/runtime-proof/inbox-delete-proof';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });

try {
  await page.goto(`${base}/inbox`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${out}/01-inbox-header-actions.png`, fullPage: true });

  const selectBtn = page.getByTestId('inbox-header-select');
  if (await selectBtn.count()) {
    await selectBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/02-inbox-select-mode.png`, fullPage: true });

    const selectAll = page.getByTestId('inbox-header-select-all');
    if (await selectAll.count()) {
      await selectAll.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${out}/03-inbox-selected-rows.png`, fullPage: true });

      const deleteSelected = page.getByTestId('inbox-header-delete-selected');
      if (await deleteSelected.count()) {
        page.once('dialog', async (d) => d.accept());
        await deleteSelected.click();
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `${out}/04-inbox-delete-working.png`, fullPage: true });
      }
    }
  }

  await page.goto(`${base}/inbox`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/05-inbox-empty-state.png`, fullPage: true });

  await page.goto(`${base}/bandits`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/06-home-tab-badge.png`, fullPage: true });

  console.log('Screenshots written to', out);
} finally {
  await browser.close();
}
