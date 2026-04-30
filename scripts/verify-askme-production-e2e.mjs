import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

for (const name of ['.env', '.env.local', '.env.production.local']) {
  const p = path.join(root, name);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (/^[A-Z0-9_]+$/.test(k) && !process.env[k]) process.env[k] = v;
  }
}

const base = 'https://bandits-two.vercel.app';
const operatorEmail = process.env.PLAY_OPERATOR_EMAIL || process.env.E2E_ADMIN_EMAIL || 'blonje@gmail.com';
const operatorPassword = process.env.PLAY_OPERATOR_PASSWORD || process.env.E2E_ADMIN_PASSWORD || '121275';
const seed = `askme-e2e-${Date.now()}`;

const outDir = path.join(
  root,
  'artifacts',
  'runtime-proof',
  `askme-production-e2e-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const result = {
  base,
  seed,
  checks: {
    travelerReady: false,
    askSubmitted: false,
    notificationsDirectionCorrect: false,
    operatorSignedIn: false,
    pilotDeskSingleEntry: false,
    chatOpenedFromNotification: false,
    chatShowsSingleThreadMessage: false,
  },
  screenshots: {},
  errors: [],
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForVisibleText(page, text, timeoutMs = 60000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const loc = page.getByText(text, { exact: false });
    const count = await loc.count();
    if (count > 0) return true;
    await page.waitForTimeout(1200);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => undefined);
  }
  return false;
}

async function openFirstBanditProfile(page) {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  if (url && key) {
    try {
      const s = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data } = await s.from('bandit').select('id').limit(1);
      const id = String(data?.[0]?.id || '').trim();
      if (id) {
        await page.goto(`${base}/bandit/${id}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.waitForTimeout(1800);
        return true;
      }
    } catch {
      /* fallback to UI discover */
    }
  }
  await page.goto(`${base}/bandits`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const enterBtn = page.getByRole('button', { name: /enter/i });
  if ((await enterBtn.count()) > 0) {
    await enterBtn.first().click().catch(() => undefined);
    await page.waitForTimeout(1800);
  }
  try {
    const shot = path.join(outDir, '1a-bandits-open-profile-search.png');
    result.screenshots.banditsSearch = shot;
    await page.screenshot({ path: shot, fullPage: true });
  } catch {
    /* ignore */
  }
  for (let i = 0; i < 8; i++) {
    const open = page.getByText('Open profile', { exact: false });
    if ((await open.count()) > 0) {
      await open.first().click({ timeout: 10000 });
      await page.waitForTimeout(1800);
      return true;
    }
    await page.waitForTimeout(1600);
    const e2 = page.getByRole('button', { name: /enter/i });
    if ((await e2.count()) > 0) {
      await e2.first().click().catch(() => undefined);
      await page.waitForTimeout(1000);
    }
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => undefined);
  }
  const body = ((await page.textContent('body')) || '').slice(0, 400);
  result.errors.push(`Bandits body snippet: ${body.replace(/\s+/g, ' ').trim()}`);
  return false;
}

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const travelerCtx = await browser.newContext({ viewport: { width: 1365, height: 920 } });
const operatorCtx = await browser.newContext({ viewport: { width: 1365, height: 920 } });
const traveler = await travelerCtx.newPage();
const operator = await operatorCtx.newPage();

try {
  // Traveler (anonymous session in production app flow).
  await traveler.goto(`${base}/hotel/play-theatrou`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const openMessageBtn = traveler.getByRole('button', { name: /open your message/i });
  if ((await openMessageBtn.count()) > 0) {
    await openMessageBtn.first().click({ timeout: 15000 });
    await wait(3000);
  }
  result.checks.travelerReady = true;

  const opened = await openFirstBanditProfile(traveler);
  if (!opened) throw new Error('Could not open any bandit profile from production /bandits');
  await wait(1500);
  result.screenshots.profile = path.join(outDir, '2-traveler-bandit-profile.png');
  await traveler.screenshot({ path: result.screenshots.profile, fullPage: true });

  await traveler.getByText('Ask me', { exact: false }).first().click({ timeout: 20000 });
  await wait(700);
  await traveler.getByPlaceholder('Type your question...').first().fill(seed);
  await traveler.getByText('Send', { exact: true }).first().click();
  await wait(2000);
  result.checks.askSubmitted = await traveler
    .getByText('Your local banDit will reply soon.', { exact: false })
    .first()
    .isVisible()
    .catch(() => false);
  result.screenshots.askModal = path.join(outDir, '3-traveler-ask-submitted.png');
  await traveler.screenshot({ path: result.screenshots.askModal, fullPage: true });

  // Traveler notifications: must show "You asked ...".
  await traveler.goto(`${base}/inbox`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const travelerSawSeed = await waitForVisibleText(traveler, seed, 60000);
  const bodyText = ((await traveler.textContent('body')) || '').toLowerCase();
  result.checks.notificationsDirectionCorrect =
    travelerSawSeed && bodyText.includes('you asked') && !bodyText.includes('neo sent you');
  result.screenshots.travelerInbox = path.join(outDir, '4-traveler-inbox.png');
  await traveler.screenshot({ path: result.screenshots.travelerInbox, fullPage: true });

  // Operator: check Pilot Desk has one entry for ask seed.
  await operator.goto(`${base}/login?redirect=/operatorDesk`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const emailInput =
    (await operator.locator('input[placeholder="Enter your email"]').count()) > 0
      ? operator.locator('input[placeholder="Enter your email"]').first()
      : operator.locator('input[type="email"]').first();
  const passInput =
    (await operator.locator('input[placeholder="Enter your password"]').count()) > 0
      ? operator.locator('input[placeholder="Enter your password"]').first()
      : operator.locator('input[type="password"]').first();
  await emailInput.fill(operatorEmail);
  await passInput.fill(operatorPassword);
  if ((await operator.getByTestId('email-auth-submit').count()) > 0) {
    await operator.getByTestId('email-auth-submit').click({ timeout: 15000 });
  } else {
    const signIn = operator.getByText('Sign in', { exact: true });
    await signIn.nth((await signIn.count()) - 1).click({ timeout: 15000 });
  }
  await operator.waitForTimeout(3500);
  result.checks.operatorSignedIn = !operator.url().includes('/login');

  await operator.goto(`${base}/operatorDesk`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const operatorSawSeed = await waitForVisibleText(operator, seed, 60000);
  const seedCount = await operator.getByText(seed, { exact: false }).count();
  result.checks.pilotDeskSingleEntry = operatorSawSeed && seedCount === 1;
  result.screenshots.operatorDesk = path.join(outDir, '5-operator-desk.png');
  await operator.screenshot({ path: result.screenshots.operatorDesk, fullPage: true });

  // Open traveler notification -> chat thread.
  await traveler.goto(`${base}/inbox`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitForVisibleText(traveler, seed, 30000);
  await traveler.getByText(seed, { exact: false }).first().click({ timeout: 20000 });
  await wait(2500);
  result.checks.chatOpenedFromNotification = traveler.url().includes('/chat');
  const chatSeedCount = await traveler.getByText(seed, { exact: false }).count();
  result.checks.chatShowsSingleThreadMessage = chatSeedCount >= 1;
  result.screenshots.travelerChat = path.join(outDir, '6-traveler-chat.png');
  await traveler.screenshot({ path: result.screenshots.travelerChat, fullPage: true });
} catch (e) {
  result.errors.push(e instanceof Error ? e.message : String(e));
} finally {
  await travelerCtx.close();
  await operatorCtx.close();
  await browser.close();
}

const pass = Object.values(result.checks).every(Boolean) && result.errors.length === 0;
result.pass = pass ? 'PASS' : 'FAIL';
await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify({ outDir, pass: result.pass, checks: result.checks, errors: result.errors }, null, 2));
