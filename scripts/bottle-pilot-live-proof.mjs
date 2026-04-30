/**
 * Live proof (single operator account): bottle → inbox → thread → Local Friend →
 * Pilot Desk reply as locked persona → inbox shows Neo reply.
 *
 *   RUNTIME_BASE_URL=http://localhost:8083 node scripts/bottle-pilot-live-proof.mjs
 */
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
loadEnv({ path: path.join(repoRoot, '.env') });
loadEnv({ path: path.join(repoRoot, '.env.local'), override: true });

const base = (process.env.RUNTIME_BASE_URL || 'http://localhost:8083').replace(/\/$/, '');
const outDir = path.join(repoRoot, 'artifacts', 'bottle-pilot-live');
const adminEmail = String(process.env.E2E_ADMIN_EMAIL || '').trim();
const adminPassword = String(process.env.E2E_ADMIN_PASSWORD || '').trim();

async function shot(page, name) {
  await fs.mkdir(outDir, { recursive: true });
  const p = path.join(outDir, name);
  await page.screenshot({ path: p, fullPage: true });
  console.log('screenshot', p);
  return p;
}

async function signIn(page, email, password) {
  await page.goto(`${base}/login?forceAuth=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('input[type="email"]').first().waitFor({ state: 'visible', timeout: 60000 });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByText('Sign in', { exact: true }).last().click();
  await page.waitForFunction(() => !window.location.pathname.includes('/login'), null, { timeout: 120000 });
}

async function main() {
  if (!adminEmail || !adminPassword) {
    console.error('Missing E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD in .env.local');
    process.exit(1);
  }

  const proofTag = `bottle-proof-${Date.now()}`;
  const replyTag = `neo-reply-${Date.now()}`;

  const browser = await chromium.launch({ headless: true });
  const guestContext = await browser.newContext();
  const adminContext = await browser.newContext();

  const guest = await guestContext.newPage();
  const admin = await adminContext.newPage();

  try {
    await signIn(guest, adminEmail, adminPassword);
    await guest.goto(`${base}/bandits`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await guest.waitForTimeout(2000);

    await guest.goto(`${base}/hotel/play-theatrou/flip`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await guest.getByRole('button', { name: /Open your bottle/i }).waitFor({ state: 'visible', timeout: 120000 });
    await guest.getByRole('button', { name: /Open your bottle/i }).click();
    await guest.waitForTimeout(3500);
    const claim = guest.getByRole('button', { name: /Claim your gift/i });
    if (await claim.count()) {
      await claim.first().click({ timeout: 20000 }).catch(() => {});
      await guest.waitForTimeout(4000);
    }

    await guest.goto(`${base}/inbox`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await guest.waitForTimeout(12000);
    await shot(guest, '01-inbox-notification.png');

    const noMsg = await guest.getByText('No messages yet', { exact: true }).count();
    if (noMsg) {
      await shot(guest, 'z-inbox-empty.png');
      throw new Error('Inbox empty after bottle');
    }

    const bottleRow = guest
      .locator('[data-testid^="inbox-open-chat-"]')
      .filter({ hasNotText: 'Local Friend · sent' })
      .first();
    await bottleRow.waitFor({ state: 'visible', timeout: 60000 });
    await bottleRow.click();
    await guest.waitForTimeout(5000);
    await shot(guest, '02-thread-opened.png');

    await guest.goto(`${base}/localFriend`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await guest.waitForTimeout(2000);
    const lfInput = guest.getByPlaceholder(/Ask for a vibe/i);
    await lfInput.waitFor({ state: 'visible', timeout: 30000 });
    await lfInput.fill(proofTag);
    await guest.getByText('Release', { exact: true }).click();
    await guest.waitForTimeout(8000);
    await shot(guest, '03-local-friend-released.png');

    await signIn(admin, adminEmail, adminPassword);
    await admin.goto(`${base}/operatorDesk`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await admin.waitForTimeout(8000);
    await shot(admin, '04-pilot-desk-incoming.png');

    const deskOpen = admin.locator('[data-testid^="pilot-desk-open-thread-"]').filter({ hasText: proofTag }).first();
    await deskOpen.waitFor({ state: 'visible', timeout: 90000 });
    await deskOpen.click();
    await admin.waitForTimeout(5000);
    await shot(admin, '05-pilot-desk-chat-send-as.png');

    const composer = admin.getByPlaceholder(/Write a message/i);
    await composer.waitFor({ state: 'visible', timeout: 30000 });
    await composer.fill(replyTag);
    const sendBtn = admin.getByTestId('chat-send-button');
    await sendBtn.waitFor({ state: 'visible', timeout: 15000 });
    await sendBtn.click();
    await admin.waitForTimeout(4000);
    await shot(admin, '06-pilot-after-send.png');

    await guest.goto(`${base}/inbox`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await guest.waitForTimeout(10000);
    await shot(guest, '07-guest-inbox-neo-reply.png');

    await guest.getByText(replyTag, { exact: true }).waitFor({ state: 'visible', timeout: 60000 });
    await guest.getByText(replyTag, { exact: true }).click();
    await guest.waitForTimeout(5000);
    await shot(guest, '08-guest-thread-neo-response.png');

    console.log('DONE', outDir);
  } catch (e) {
    console.error(e);
    try {
      await shot(guest, 'z-error-guest.png');
    } catch {
      /* ignore */
    }
    try {
      await shot(admin, 'z-error-admin.png');
    } catch {
      /* ignore */
    }
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
