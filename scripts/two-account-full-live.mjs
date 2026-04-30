import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const out = path.join(process.cwd(), 'artifacts', 'runtime-proof', 'two-account-full');
fs.mkdirSync(out, { recursive: true });

const base = 'http://localhost:8081';

async function waitText(page, text, ms = 35000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const loc = page.locator(`text=${text}`).first();
    if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) return true;
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(1200);
  }
  return false;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const A = await ctxA.newPage();
  const B = await ctxB.newPage();

  async function loginA() {
    await A.goto(`${base}/login?forceAuth=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await A.locator('input[type="email"]').first().fill('blonje@gmail.com');
    await A.locator('input[type="password"]').first().fill('121275');
    const s = A.getByText('Sign in', { exact: true });
    await s.nth((await s.count()) - 1).click();
    await A.waitForTimeout(2500);
    return !A.url().includes('/login');
  }

  async function signupB() {
    const email = `banditlive${Date.now()}@gmail.com`;
    const pass = 'Bandit!123456';
    await B.goto(`${base}/login?forceAuth=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await B.getByText('Sign up', { exact: true }).first().click();
    await B.locator('input[type="email"]').first().fill(email);
    await B.locator('input[type="password"]').first().fill(pass);
    const up = B.getByText('Sign up', { exact: true });
    await up.nth((await up.count()) - 1).click();
    await B.waitForTimeout(3500);
    return { ok: !B.url().includes('/login'), email };
  }

  const okA = await loginA();
  const bAcc = await signupB();
  if (!okA || !bAcc.ok) {
    await A.screenshot({ path: path.join(out, '00-auth-fail-A.png'), fullPage: true });
    await B.screenshot({ path: path.join(out, '00-auth-fail-B.png'), fullPage: true });
    console.log(
      JSON.stringify({ pass: false, blocker: 'auth_failed', okA, bOk: bAcc.ok, email: bAcc.email }, null, 2),
    );
    await browser.close();
    return;
  }

  const seed = `AtoB-${Date.now()}`;
  await B.goto(`${base}/localFriend`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await B.getByPlaceholder(/Ask for a vibe/i).first().fill(seed);
  await B.getByText('Release', { exact: true }).first().click();
  await B.waitForTimeout(2200);
  await B.screenshot({ path: path.join(out, '01-B-send-seed.png'), fullPage: true });

  await A.goto(`${base}/operatorDesk`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const got = await waitText(A, seed, 40000);
  await A.screenshot({ path: path.join(out, '02-A-receives-on-desk.png'), fullPage: true });
  if (!got) {
    console.log(
      JSON.stringify(
        {
          pass: false,
          blocker: 'A_did_not_receive_seed',
          shots: ['01-B-send-seed.png', '02-A-receives-on-desk.png'],
        },
        null,
        2,
      ),
    );
    await browser.close();
    return;
  }

  await A.locator(`text=${seed}`).first().click();
  await A.waitForTimeout(2200);
  const a1 = `A-reply-1-${Date.now()}`;
  await A.getByPlaceholder(/Write a message/i).first().fill(a1);
  await A.locator('[data-testid="chat-send-button"]').click();
  await A.waitForTimeout(2400);
  await A.screenshot({ path: path.join(out, '03-A-reply-1.png'), fullPage: true });

  await B.goto(`${base}/inbox`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const gotA1 = await waitText(B, a1, 45000);
  await B.screenshot({ path: path.join(out, '04-B-receives-A1-inbox.png'), fullPage: true });
  if (!gotA1) {
    console.log(
      JSON.stringify(
        {
          pass: false,
          blocker: 'B_did_not_receive_A_reply',
          shots: ['03-A-reply-1.png', '04-B-receives-A1-inbox.png'],
        },
        null,
        2,
      ),
    );
    await browser.close();
    return;
  }

  await B.locator('[data-testid^="inbox-open-chat-"]').first().click();
  await B.waitForTimeout(2200);
  const b1 = `B-reply-1-${Date.now()}`;
  await B.getByPlaceholder(/Write a message/i).first().fill(b1);
  await B.locator('[data-testid="chat-send-button"]').click();
  await B.waitForTimeout(2400);
  await B.screenshot({ path: path.join(out, '05-B-reply-1-thread.png'), fullPage: true });

  await A.goto(`${base}/inbox`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const gotB1 = await waitText(A, b1, 45000);
  await A.screenshot({ path: path.join(out, '06-A-receives-B1-inbox.png'), fullPage: true });
  if (!gotB1) {
    console.log(
      JSON.stringify(
        {
          pass: false,
          blocker: 'A_did_not_receive_B_reply',
          shots: ['05-B-reply-1-thread.png', '06-A-receives-B1-inbox.png'],
        },
        null,
        2,
      ),
    );
    await browser.close();
    return;
  }

  await A.locator('[data-testid^="inbox-open-chat-"]').first().click();
  await A.waitForTimeout(2200);
  await A.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await A.waitForTimeout(1200);
  await B.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await B.waitForTimeout(1200);
  await A.screenshot({ path: path.join(out, '07-A-after-refresh.png'), fullPage: true });
  await B.screenshot({ path: path.join(out, '08-B-after-refresh.png'), fullPage: true });

  const hasA1 = (await A.locator(`text=${a1}`).count()) > 0 || (await B.locator(`text=${a1}`).count()) > 0;
  const hasB1 = (await A.locator(`text=${b1}`).count()) > 0 || (await B.locator(`text=${b1}`).count()) > 0;
  const pass = hasA1 && hasB1;
  console.log(
    JSON.stringify(
      {
        pass,
        blocker: pass ? '' : 'thread_not_persisted_after_refresh',
        shots: [
          '01-B-send-seed.png',
          '02-A-receives-on-desk.png',
          '03-A-reply-1.png',
          '04-B-receives-A1-inbox.png',
          '05-B-reply-1-thread.png',
          '06-A-receives-B1-inbox.png',
          '07-A-after-refresh.png',
          '08-B-after-refresh.png',
        ],
        emailB: bAcc.email,
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
