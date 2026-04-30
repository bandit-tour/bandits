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
const out = path.join(root, 'artifacts', 'runtime-proof', 'backforth-web');

async function shot(page, name) {
  await fs.mkdir(out, { recursive: true });
  const rel = `artifacts/runtime-proof/backforth-web/${name}`;
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

async function doThreadFlow(page, key, openThreadFn) {
  const result = { pass: false, key, reason: '', shots: {} };
  try {
    const opened = await openThreadFn();
    if (!opened) {
      result.reason = 'No source row available';
      return result;
    }
    result.shots.open = await shot(page, `${key}-01-open-thread.png`);
    const m1 = `${key}-m1-${Date.now()}`;
    const m2 = `${key}-m2-${Date.now()}`;
    const composer = page.getByPlaceholder(/Write a message/i).first();
    if ((await composer.count()) === 0) {
      result.reason = 'No composer in opened thread';
      return result;
    }
    await composer.fill(m1);
    await page.locator('[data-testid="chat-send-button"]').click();
    await page.waitForTimeout(2200);
    result.shots.send1 = await shot(page, `${key}-02-send1.png`);

    const senderName = ((await page.locator('[style*="headerName"]').first().textContent().catch(() => '')) || '').trim();
    const beforeSenderLabels = await page.locator('text=/^.+$/').count();
    await page.waitForTimeout(36000);
    result.shots.wait36 = await shot(page, `${key}-03-wait36.png`);
    const afterSenderLabels = await page.locator('text=/^.+$/').count();

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(2200);
    result.shots.refresh = await shot(page, `${key}-04-refresh.png`);

    await composer.fill(m2);
    await page.locator('[data-testid="chat-send-button"]').click();
    await page.waitForTimeout(2200);
    result.shots.send2 = await shot(page, `${key}-05-send2.png`);

    const hasM1 = (await page.locator(`text=${m1}`).count()) > 0;
    const hasM2 = (await page.locator(`text=${m2}`).count()) > 0;
    const incomingLikely = afterSenderLabels > beforeSenderLabels;
    result.pass = hasM1 && hasM2 && incomingLikely;
    result.reason = result.pass ? '' : 'No verified new incoming reply in same thread';
    result.messages = { m1, m2, senderName };
    result.flags = { hasM1, hasM2, incomingLikely };
    return result;
  } catch (e) {
    result.reason = e instanceof Error ? e.message : String(e);
    return result;
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await signIn(page);

  const localFriend = await doThreadFlow(page, 'local-friend', async () => {
    await page.goto(`${base}/operatorDesk`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(1700);
    const row = page.locator('text=Local Friend').first();
    if ((await row.count()) === 0) return false;
    await row.click();
    await page.waitForTimeout(2200);
    return true;
  });

  const askMe = await doThreadFlow(page, 'ask-me', async () => {
    await page.goto(`${base}/operatorDesk`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(1700);
    const row = page.locator('text=Ask Me').first();
    if ((await row.count()) === 0) return false;
    await row.click();
    await page.waitForTimeout(2200);
    return true;
  });

  const bandiTEAM = await doThreadFlow(page, 'banditeam', async () => {
    await page.goto(`${base}/inbox`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(1700);
    const row = page.locator('text=bandiTEAM').first();
    if ((await row.count()) === 0) return false;
    await row.click();
    await page.waitForTimeout(2200);
    return true;
  });

  const randomSocial = await doThreadFlow(page, 'random-social', async () => {
    await page.goto(`${base}/inbox`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(1700);
    const row = page.locator('text=Bottle Signal').first();
    if ((await row.count()) === 0) return false;
    await row.click();
    await page.waitForTimeout(2200);
    return true;
  });

  await context.close();
  await browser.close();

  const result = { localFriend, askMe, bandiTEAM, randomSocial };
  await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
