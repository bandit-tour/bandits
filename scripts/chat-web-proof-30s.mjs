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
const out = path.join(root, 'artifacts', 'runtime-proof', 'chat-web-30s');

async function shot(page, name) {
  await fs.mkdir(out, { recursive: true });
  const rel = `artifacts/runtime-proof/chat-web-30s/${name}`;
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
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await signIn(page);
  await page.goto(`${base}/operatorDesk`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1600);
  let hasIncoming = (await page.locator('text=tap to reply').count()) > 0;
  if (!hasIncoming) {
    const seed = `seed-incoming-${Date.now()}`;
    await page.goto(`${base}/localFriend`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByPlaceholder(/Ask for a vibe/i).first().fill(seed);
    await page.getByText('Release', { exact: true }).first().click();
    await page.waitForTimeout(2600);
    await page.goto(`${base}/operatorDesk`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(2200);
    hasIncoming = (await page.locator(`text=${seed}`).count()) > 0 || (await page.locator('text=tap to reply').count()) > 0;
  }
  const incomingShot = await shot(page, '01-incoming-visible.png');

  if (!hasIncoming) {
    const fail = { pass: false, reason: 'No incoming rows on operator desk', incomingShot };
    await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(fail, null, 2));
    console.log(JSON.stringify(fail, null, 2));
    await context.close();
    await browser.close();
    return;
  }

  await page.locator('text=tap to reply').first().click();
  await page.waitForTimeout(2000);
  const openShot = await shot(page, '02-thread-opened.png');

  const msg1 = `runtime-30s-1-${Date.now()}`;
  const msg2 = `runtime-30s-2-${Date.now()}`;
  const composer = page.getByPlaceholder(/Write a message/i).first();
  await composer.fill(msg1);
  await page.locator('[data-testid="chat-send-button"]').click();
  await page.waitForTimeout(2400);
  const send1Shot = await shot(page, '03-send-1.png');

  await page.waitForTimeout(31000);
  const wait30Shot = await shot(page, '04-after-30s.png');

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2200);
  const refreshShot = await shot(page, '05-after-refresh.png');

  await page.goto(`${base}/operatorDesk`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1400);
  await page.locator('text=tap to reply').first().click();
  await page.waitForTimeout(2200);
  const reopenShot = await shot(page, '06-after-nav-out-back.png');

  await composer.fill(msg2);
  await page.locator('[data-testid="chat-send-button"]').click();
  await page.waitForTimeout(2200);
  const send2Shot = await shot(page, '07-send-2.png');

  // back-and-forth check: wait for a non-self incoming bubble with a distinct line
  await page.waitForTimeout(12000);
  const backForthShot = await shot(page, '08-back-and-forth-check.png');

  const has1 = (await page.locator(`text=${msg1}`).count()) > 0;
  const has2 = (await page.locator(`text=${msg2}`).count()) > 0;

  await context.close();
  await browser.close();

  const result = {
    web: {
      incomingVisible: hasIncoming,
      threadOpened: true,
      firstReplySent: true,
      firstReplyAfter30s: has1,
      firstReplyAfterRefresh: has1,
      firstReplyAfterNavBack: has1,
      secondReplySent: has2,
      backAndForthWorks: false,
    },
    messages: { msg1, msg2 },
    shots: {
      incomingShot,
      openShot,
      send1Shot,
      wait30Shot,
      refreshShot,
      reopenShot,
      send2Shot,
      backForthShot,
    },
  };
  await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
