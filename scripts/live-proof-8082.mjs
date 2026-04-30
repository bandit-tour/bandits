/**
 * Blocker-only real browser proof on http://localhost:8082.
 * Writes artifacts/runtime-proof/live-proof/*.png
 */
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
const out = path.join(root, 'artifacts', 'runtime-proof', 'live-proof');
const email = String(process.env.E2E_ADMIN_EMAIL || '').trim();
const password = String(process.env.E2E_ADMIN_PASSWORD || '').trim();
const userEmail = String(process.env.E2E_USER_EMAIL || '').trim();
const userPassword = String(process.env.E2E_USER_PASSWORD || '').trim();

async function shot(page, name) {
  await fs.mkdir(out, { recursive: true });
  const rel = `artifacts/runtime-proof/live-proof/${name}`;
  await page.screenshot({ path: path.join(out, name), fullPage: true });
  return rel;
}

async function openLogin(page) {
  await page.goto(`${base.replace(/\/$/, '')}/login?forceAuth=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('input[type="email"]').first().waitFor({ state: 'visible', timeout: 60000 });
}

async function switchAuthTab(page, wantSignIn) {
  const target = page.getByText(wantSignIn ? 'Sign in' : 'Sign up', { exact: true }).first();
  await target.click().catch(() => {});
  await page.waitForTimeout(350);
}

async function submitAuth(page, mail, pass, signInMode) {
  await openLogin(page);
  await switchAuthTab(page, signInMode);
  await page.locator('input[type="email"]').first().fill(mail);
  await page.locator('input[type="password"]').first().fill(pass);
  const btns = page.getByText(signInMode ? 'Sign in' : 'Sign up', { exact: true });
  await btns.nth((await btns.count()) - 1).click();
  await page.waitForTimeout(3200);
  const err = page.locator('text=/failed|invalid|error|verify/i').first();
  if ((await err.count()) > 0) {
    const t = (await err.textContent()) || '';
    if (t.trim()) throw new Error(`Auth error: ${t.trim()}`);
  }
  const url = page.url();
  if (url.includes('/login')) {
    throw new Error(signInMode ? 'Sign-in did not leave login page.' : 'Sign-up did not complete session.');
  }
}

async function signIn(page, mail, pass) {
  await submitAuth(page, mail, pass, true);
  await page.waitForTimeout(3500);
  if (page.url().includes('/login')) throw new Error('Sign in failed.');
}

async function signOut(page) {
  await page.goto(`${base.replace(/\/$/, '')}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1200);
  const so = page.getByText('Sign out', { exact: false });
  if ((await so.count()) > 0) {
    await so.first().click();
    await page.waitForTimeout(2000);
  }
}

function stripBust(url) {
  if (!url) return '';
  const [left] = url.split('?');
  return left;
}

async function waitForRowByText(page, text, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = page.locator(`text=${text}`).first();
    if ((await row.count()) > 0 && (await row.isVisible().catch(() => false))) return true;
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(1200);
  }
  return false;
}

async function run() {
  if (!email || !password) {
    console.error('Missing E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD');
    process.exit(1);
  }
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const contextA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const contextB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  // Account setup
  const bMail = userEmail || `banditliveproof${Date.now()}@gmail.com`;
  const bPass = userPassword || `Bandit!${Date.now()}aA9`;
  await signIn(pageA, email, password);
  let bSignedIn = false;
  let bAuthReason = '';
  try {
    await signIn(pageB, bMail, bPass);
    bSignedIn = true;
  } catch (signInErr) {
    try {
      await submitAuth(pageB, bMail, bPass, false);
      bSignedIn = true;
    } catch (signUpErr) {
      bSignedIn = false;
      bAuthReason = signUpErr instanceof Error ? signUpErr.message : String(signUpErr || signInErr || 'Unknown auth error');
    }
  }

  // Create real incoming item on Pilot Desk
  const inboundMessage = `lf-delete-${Date.now()}`;
  const inboundSenderPage = bSignedIn ? pageB : pageA;
  await inboundSenderPage.goto(`${base.replace(/\/$/, '')}/localFriend`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await inboundSenderPage.getByPlaceholder(/Ask for a vibe/i).first().fill(inboundMessage);
  await inboundSenderPage.getByText('Release', { exact: true }).first().click();
  await inboundSenderPage.waitForTimeout(2500);
  const createdInbound = await shot(inboundSenderPage, '10-created-localfriend-message.png');

  await pageA.goto(`${base.replace(/\/$/, '')}/operatorDesk`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const rowVisible = await waitForRowByText(pageA, inboundMessage, 35000);
  const deleteBefore = await shot(pageA, '11-pilot-desk-before-delete.png');
  let deleteAfter = null;
  let pilotDeletePass = false;
  if (rowVisible) {
    pageA.once('dialog', (d) => void d.accept());
    await pageA.getByText('Delete', { exact: true }).first().click();
    await pageA.waitForTimeout(2600);
    deleteAfter = await shot(pageA, '12-pilot-desk-after-delete.png');
    pilotDeletePass = !(await pageA.locator(`text=${inboundMessage}`).first().isVisible().catch(() => false));
  }

  // Profile image upload persist
  await pageA.goto(`${base.replace(/\/$/, '')}/profile`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pageA.waitForTimeout(1200);
  const chooserPromise = pageA.waitForEvent('filechooser', { timeout: 12000 }).catch(() => null);
  await pageA.getByText(/upload from library/i).first().click();
  const chooser = await chooserPromise;
  if (chooser) {
    await chooser.setFiles([path.join(root, 'assets', 'images', 'playstore.png')]);
  } else {
    const input = pageA.locator('input[type="file"]').last();
    await input.setInputFiles([path.join(root, 'assets', 'images', 'playstore.png')]).catch(() => {});
  }
  await pageA.waitForTimeout(4200);
  const profileUploadShot = await shot(pageA, '13-profile-after-upload.png');
  const img1 = await pageA.locator('img').first().getAttribute('src').catch(() => null);
  await signOut(pageA);
  await signIn(pageA, email, password);
  await pageA.goto(`${base.replace(/\/$/, '')}/profile`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pageA.waitForTimeout(2600);
  const img2 = await pageA.locator('img').first().getAttribute('src').catch(() => null);
  const profileReloginShot = await shot(pageA, '14-profile-after-relogin.png');
  const profileImagePass = !!img1 && !!img2 && stripBust(img1) === stripBust(img2);

  // True chat loop with two sessions
  let chatMidShot = null;
  let finalChatShot = null;
  let hasA1 = false;
  let hasB1 = false;
  let hasA2 = false;
  let twoWayPass = false;
  const a1 = `A->B ${Date.now()}`;
  const b1 = `B->A ${Date.now()}`;
  const a2 = `A->B-2 ${Date.now()}`;
  if (bSignedIn) {
    const seedText = `lf-thread-${Date.now()}`;
    await pageB.goto(`${base.replace(/\/$/, '')}/localFriend`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await pageB.getByPlaceholder(/Ask for a vibe/i).first().fill(seedText);
    await pageB.getByText('Release', { exact: true }).first().click();
    await pageB.waitForTimeout(2500);

    await pageA.goto(`${base.replace(/\/$/, '')}/operatorDesk`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const seedVisible = await waitForRowByText(pageA, seedText, 35000);
    if (seedVisible) {
      await pageA.locator(`text=${seedText}`).first().click();
    }
    await pageA.waitForTimeout(2500);

    const composerA = pageA.getByPlaceholder(/Write a message/i).first();
    await composerA.waitFor({ state: 'visible', timeout: 20000 });
    await composerA.fill(a1);
    await pageA.locator('[data-testid="chat-send-button"]').click();
    await pageA.waitForTimeout(2200);

    await pageB.goto(`${base.replace(/\/$/, '')}/inbox`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await waitForRowByText(pageB, a1, 30000);
    await pageB.locator('[data-testid^="inbox-open-chat-"]').first().click();
    await pageB.waitForTimeout(2500);
    const composerB = pageB.getByPlaceholder(/Write a message/i).first();
    await composerB.waitFor({ state: 'visible', timeout: 20000 });
    await composerB.fill(b1);
    await pageB.locator('[data-testid="chat-send-button"]').click();
    await pageB.waitForTimeout(2200);
    chatMidShot = await shot(pageB, '15-chat-b-replied.png');

    await pageA.goto(`${base.replace(/\/$/, '')}/inbox`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await waitForRowByText(pageA, b1, 30000);
    await pageA.locator('[data-testid^="inbox-open-chat-"]').first().click();
    await pageA.waitForTimeout(2500);
    await composerA.fill(a2);
    await pageA.locator('[data-testid="chat-send-button"]').click();
    await pageA.waitForTimeout(2400);

    await pageB.goto(`${base.replace(/\/$/, '')}/inbox`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await waitForRowByText(pageB, a2, 30000);
    await pageB.locator('[data-testid^="inbox-open-chat-"]').first().click();
    await pageB.waitForTimeout(2500);
    finalChatShot = await shot(pageB, '16-chat-two-way-final-thread.png');
    hasA1 = (await pageB.locator(`text=${a1}`).count()) > 0;
    hasB1 = (await pageB.locator(`text=${b1}`).count()) > 0;
    hasA2 = (await pageB.locator(`text=${a2}`).count()) > 0;
    twoWayPass = hasA1 && hasB1 && hasA2;
  }

  await contextA.close();
  await contextB.close();
  await browser.close();

  const results = {
    pilotDeskDelete: {
      pass: pilotDeletePass,
      createdInbound,
      before: deleteBefore,
      after: deleteAfter,
      message: inboundMessage,
    },
    profileImagePersist: {
      pass: profileImagePass,
      upload: profileUploadShot,
      relogin: profileReloginShot,
      beforeSrc: img1,
      afterSrc: img2,
    },
    trueChatLoop: {
      pass: bSignedIn && twoWayPass,
      messages: { a1, b1, a2 },
      mid: chatMidShot,
      final: finalChatShot,
      hasA1,
      hasB1,
      hasA2,
      authReason: bAuthReason,
    },
  };

  await fs.writeFile(path.join(out, 'live-proof-manifest.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
