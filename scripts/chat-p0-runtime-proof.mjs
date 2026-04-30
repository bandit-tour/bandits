import { config as loadEnv } from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
loadEnv({ path: path.join(root, '.env'), quiet: true });
loadEnv({ path: path.join(root, '.env.local'), override: true, quiet: true });

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
  await page.waitForTimeout(2800);
}

async function waitForText(page, text, timeout = 35000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const loc = page.locator(`text=${text}`).first();
    if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) return true;
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(1200);
  }
  return false;
}

async function run() {
  if (!email || !password) throw new Error('Missing E2E admin credentials.');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await signIn(page);

  const seed = `p0-chat-seed-${Date.now()}`;
  await page.goto(`${base}/localFriend`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByPlaceholder(/Ask for a vibe/i).first().fill(seed);
  await page.getByText('Release', { exact: true }).first().click();
  await page.waitForTimeout(2200);
  const createdShot = await shot(page, '01-created-incoming-seed.png');

  await page.goto(`${base}/operatorDesk`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const rowVisible = await waitForText(page, seed, 40000);
  const deskShot = await shot(page, '02-operator-desk-row-visible.png');
  if (!rowVisible) {
    await context.close();
    await browser.close();
    const fail = { pass: false, reason: 'Incoming row never appeared on operator desk', createdShot, deskShot };
    await fs.writeFile(path.join(out, 'chat-p0-manifest.json'), JSON.stringify(fail, null, 2));
    console.log(JSON.stringify(fail, null, 2));
    return;
  }

  await page.locator(`text=${seed}`).first().click();
  await page.waitForTimeout(2200);

  const msg1 = `p0-r1-${Date.now()}`;
  const msg2 = `p0-r2-${Date.now()}`;
  const composer = page.getByPlaceholder(/Write a message/i).first();
  await composer.waitFor({ state: 'visible', timeout: 20000 });
  await composer.fill(msg1);
  await page.locator('[data-testid="chat-send-button"]').click();
  await page.waitForTimeout(2200);
  const sent1 = await shot(page, '03-after-send-1.png');

  await page.waitForTimeout(11000);
  const after10s = await shot(page, '04-after-10s.png');

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2200);
  const afterRefresh = await shot(page, '05-after-refresh.png');

  await composer.fill(msg2);
  await page.locator('[data-testid="chat-send-button"]').click();
  await page.waitForTimeout(2200);
  const sent2 = await shot(page, '06-after-send-2.png');

  const has1 = (await page.locator(`text=${msg1}`).count()) > 0;
  const has2 = (await page.locator(`text=${msg2}`).count()) > 0;

  await context.close();
  await browser.close();

  const result = {
    pass: has1 && has2,
    seed,
    msg1,
    msg2,
    has1,
    has2,
    createdShot,
    deskShot,
    sent1,
    after10s,
    afterRefresh,
    sent2,
  };
  await fs.writeFile(path.join(out, 'chat-p0-manifest.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
