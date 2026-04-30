import { config as loadEnv } from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
loadEnv({ path: path.join(root, '.env.local'), quiet: true });

const base = process.env.RUNTIME_BASE_URL || 'http://localhost:8082';
const email = String(process.env.E2E_ADMIN_EMAIL || '').trim();
const password = String(process.env.E2E_ADMIN_PASSWORD || '').trim();
const out = path.join(root, 'artifacts', 'runtime-proof', 'chat-p0');

async function shot(page, name) {
  await fs.mkdir(out, { recursive: true });
  const rel = `artifacts/runtime-proof/chat-p0/${name}`;
  await page.screenshot({ path: path.join(out, name), fullPage: true });
  return rel;
}

async function signIn(page) {
  await page.goto(`${base}/login?forceAuth=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  const btn = page.getByText('Sign in', { exact: true });
  await btn.nth((await btn.count()) - 1).click();
  await page.waitForTimeout(2600);
}

async function run() {
  if (!email || !password) throw new Error('Missing .env.local creds');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await signIn(page);
  await page.goto(`${base}/operatorDesk`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1800);
  const deskBefore = await shot(page, '20-operator-desk-existing-incoming.png');

  const firstRowText = (await page.locator('text=tap to reply').first().textContent().catch(() => '')) || '';
  await page.locator('text=tap to reply').first().click();
  await page.waitForTimeout(2200);
  const opened = await shot(page, '21-chat-opened-from-desk.png');

  const m1 = `web-proof-1-${Date.now()}`;
  const m2 = `web-proof-2-${Date.now()}`;
  const composer = page.getByPlaceholder(/Write a message/i).first();
  await composer.fill(m1);
  await page.locator('[data-testid="chat-send-button"]').click();
  await page.waitForTimeout(2300);
  const afterSend1 = await shot(page, '22-chat-after-send-1.png');

  await page.waitForTimeout(11000);
  const after10s = await shot(page, '23-chat-after-10s.png');

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2200);
  const afterRefresh = await shot(page, '24-chat-after-refresh.png');

  await composer.fill(m2);
  await page.locator('[data-testid="chat-send-button"]').click();
  await page.waitForTimeout(2300);
  const afterSend2 = await shot(page, '25-chat-after-send-2.png');

  await page.goto(`${base}/operatorDesk`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.locator('text=tap to reply').first().click();
  await page.waitForTimeout(2200);
  const reopen = await shot(page, '26-chat-reopened.png');

  const hasM1 = (await page.locator(`text=${m1}`).count()) > 0;
  const hasM2 = (await page.locator(`text=${m2}`).count()) > 0;

  await context.close();
  await browser.close();

  const result = {
    pass: hasM1 && hasM2,
    firstRowText,
    m1,
    m2,
    hasM1,
    hasM2,
    shots: { deskBefore, opened, afterSend1, after10s, afterRefresh, afterSend2, reopen },
  };
  await fs.writeFile(path.join(out, 'chat-operator-row-manifest.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
