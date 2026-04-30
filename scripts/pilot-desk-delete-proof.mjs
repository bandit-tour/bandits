import { config as loadEnv } from 'dotenv';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
loadEnv({ path: path.join(root, '.env.local'), quiet: true });

const base = process.env.BANDITS_WEB_BASE ?? process.env.RUNTIME_BASE_URL ?? 'http://127.0.0.1:8083';
const email = String(process.env.E2E_ADMIN_EMAIL || '').trim();
const password = String(process.env.E2E_ADMIN_PASSWORD || '').trim();
const out = 'artifacts/runtime-proof/pilot-desk-delete-proof';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 920 } });
const apiEvents = [];

page.on('response', async (res) => {
  const req = res.request();
  const url = res.url();
  if (!url.includes('/rest/v1/')) return;
  const method = req.method();
  if (!['DELETE', 'PATCH', 'POST'].includes(method)) return;
  if (!url.includes('/notifications') && !url.includes('/scam_alerts')) return;
  apiEvents.push({ method, status: res.status(), url });
});

async function signIn() {
  if (!email || !password) return;
  await page.goto(`${base}/login?forceAuth=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  const btn = page.getByText('Sign in', { exact: true });
  await btn.nth((await btn.count()) - 1).click();
  await page.waitForTimeout(2600);
}

try {
  await signIn();
  await page.goto(`${base}/operatorDesk`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${out}/01-before-delete.png`, fullPage: true });

  const selectBtn = page.getByTestId('pilot-desk-incoming-select');
  if (await selectBtn.count()) {
    await selectBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/02-bulk-controls-visible.png`, fullPage: true });

    const selectAll = page.getByTestId('pilot-desk-incoming-select-all');
    if (await selectAll.count()) {
      await selectAll.click();
      await page.waitForTimeout(350);
      await page.screenshot({ path: `${out}/03-selected-rows.png`, fullPage: true });

      const deleteSelected = page.getByTestId('pilot-desk-incoming-delete-selected');
      if (await deleteSelected.count()) {
        page.once('dialog', async (d) => d.accept());
        await deleteSelected.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${out}/04-after-delete.png`, fullPage: true });
      }
    }
  }

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${out}/05-after-refresh.png`, fullPage: true });

  const reportDeleteBtn = page.locator('[data-testid^="pilot-desk-actions-"]').getByText('Delete', { exact: true }).first();
  if (await reportDeleteBtn.count()) {
    await page.screenshot({ path: `${out}/06-report-before-delete.png`, fullPage: true });
    page.once('dialog', async (d) => d.accept());
    await reportDeleteBtn.click();
    await page.waitForTimeout(1300);
    await page.screenshot({ path: `${out}/07-report-after-delete.png`, fullPage: true });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `${out}/08-report-after-refresh.png`, fullPage: true });
  }

  writeFileSync(`${out}/api-events.json`, JSON.stringify(apiEvents, null, 2), 'utf8');
  console.log('Screenshots + API log in', out);
} finally {
  await browser.close();
}
