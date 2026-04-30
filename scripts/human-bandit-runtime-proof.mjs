import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const out = path.join(process.cwd(), 'artifacts', 'runtime-proof', 'human-bandit-arch');
fs.mkdirSync(out, { recursive: true });

const base = 'http://localhost:8081';

async function waitForAny(locator, timeoutMs = 30000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if ((await locator.count()) > 0) return true;
    await new Promise((r) => setTimeout(r, 1200));
  }
  return false;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${base}/login?forceAuth=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('input[type="email"]').first().fill('blonje@gmail.com');
  await page.locator('input[type="password"]').first().fill('121275');
  const signIn = page.getByText('Sign in', { exact: true });
  await signIn.nth((await signIn.count()) - 1).click();
  await page.waitForTimeout(3000);
  const loginPass = !page.url().includes('/login');
  await page.screenshot({ path: path.join(out, '01-login.png'), fullPage: true });

  await page.goto(`${base}/inbox`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(out, '02-inbox.png'), fullPage: true });
  const openRow = page.locator('[data-testid^="inbox-open-chat-"]').first();
  const hasRow = await waitForAny(openRow, 12000);
  if (!loginPass || !hasRow) {
    console.log(JSON.stringify({ pass: false, blocker: !loginPass ? 'login_failed' : 'no_bandit_thread_row' }, null, 2));
    await browser.close();
    return;
  }

  await openRow.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(out, '03-thread-open.png'), fullPage: true });

  const composer = page.getByPlaceholder(/Write a message/i).first();
  const hasComposer = (await composer.count()) > 0;
  if (!hasComposer) {
    console.log(JSON.stringify({ pass: false, blocker: 'thread_not_replyable' }, null, 2));
    await browser.close();
    return;
  }

  const msg = `human-a-${Date.now()}`;
  await composer.fill(msg);
  await page.locator('[data-testid="chat-send-button"]').click();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(out, '04-after-send.png'), fullPage: true });

  await page.waitForTimeout(32000);
  await page.screenshot({ path: path.join(out, '05-after-32s.png'), fullPage: true });

  const msgVisibleAfterWait = (await page.locator(`text=${msg}`).count()) > 0;

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(out, '06-after-refresh.png'), fullPage: true });
  const msgVisibleAfterRefresh = (await page.locator(`text=${msg}`).count()) > 0;

  await page.goto(`${base}/inbox`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(out, '07-inbox-after-send.png'), fullPage: true });

  // "Bandit replies" check: look for a new non-user bubble after send wait window
  const senderLabels = await page.locator('text=/Local Friend|Ask|Smaragda|banDit/i').count();
  const banditReplyObserved = senderLabels > 0;

  const pass = loginPass && hasRow && hasComposer && msgVisibleAfterWait && msgVisibleAfterRefresh && banditReplyObserved;
  console.log(
    JSON.stringify(
      {
        pass,
        blocker: pass ? '' : !banditReplyObserved ? 'no_bandit_reply_observed' : 'message_not_persistent',
      },
      null,
      2,
    ),
  );

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
