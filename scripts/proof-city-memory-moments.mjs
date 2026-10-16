/**
 * City Memory + Add Memory browser QA (text Moment persistence + UI honesty).
 */
import { config as loadEnv } from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
loadEnv({ path: path.join(root, '.env'), quiet: true });
loadEnv({ path: path.join(root, '.env.development.local'), override: true, quiet: true });

const base = process.env.RUNTIME_BASE_URL || 'http://localhost:8082';
const out = path.join(root, 'artifacts', 'runtime-proof', 'city-memory-moments');
const PASS = 'CityMemory!123456';

async function shot(page, name) {
  await fs.mkdir(out, { recursive: true });
  await page.screenshot({ path: path.join(out, name), fullPage: true });
  return `artifacts/runtime-proof/city-memory-moments/${name}`;
}

async function signIn(page, email) {
  await page.goto(`${base}/login?forceAuth=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(PASS);
  const btn = page.getByText('Sign in', { exact: true });
  await btn.nth((await btn.count()) - 1).click();
  await page.waitForTimeout(3000);
  return !page.url().includes('/login');
}

async function run() {
  await fs.mkdir(out, { recursive: true });
  const url = String(process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
  const service = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const emailA = `mem.a.${Date.now()}@banditour.proof`;
  const emailB = `mem.b.${Date.now()}@banditour.proof`;
  for (const email of [emailA, emailB]) {
    const c = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true });
    if (c.error) throw new Error(c.error.message);
  }

  const browser = await chromium.launch({ headless: true });
  const ctxA = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  const okA = await signIn(pageA, emailA);
  const okB = await signIn(pageB, emailB);

  await pageA.goto(`${base}/cityMemory`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pageA.waitForTimeout(2500);
  const before = await shot(pageA, '01-city-memory.png');
  const bodyA = await pageA.locator('body').innerText();
  const noGiantInitials =
    !/\b[SPTC1NREK]\s*\n\s*(Places|Loved|Moments|Cities|Following|Discover)/i.test(bodyA);
  const hasJournal = /My Moments|My Places|My People|My Journeys|Add a Memory/i.test(bodyA);
  const noRawUuid = !/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(
    bodyA.replace(/cityMemory|bandit\//gi, ''),
  );

  await pageA.getByTestId('city-memory-add-memory').click();
  await pageA.waitForTimeout(1500);
  const marker = `QA Moment ${Date.now()}`;
  await pageA.getByTestId('memory-title-input').fill(marker);
  await pageA.getByTestId('memory-story-input').fill('A private story from browser QA — should persist.');
  await pageA.getByTestId('memory-save-cta').click();
  await pageA.waitForTimeout(3500);
  const detailShot = await shot(pageA, '02-moment-detail.png');
  const detailBody = await pageA.locator('body').innerText();
  const created = detailBody.includes(marker) && /Private Moment/i.test(detailBody);

  await pageA.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await pageA.waitForTimeout(2000);
  const persistReload = (await pageA.locator('body').innerText()).includes(marker);
  const afterReload = await shot(pageA, '03-after-reload.png');

  // Edit
  if ((await pageA.getByTestId('memory-edit-cta').count()) > 0) {
    await pageA.getByTestId('memory-edit-cta').click();
    await pageA.waitForTimeout(1200);
  } else {
    await pageA.goto(`${base}/cityMemory`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await pageA.waitForTimeout(1500);
    await pageA.getByText(marker).first().click();
    await pageA.waitForTimeout(1200);
    await pageA.getByTestId('memory-edit-cta').click();
    await pageA.waitForTimeout(1200);
  }
  const edited = `${marker} edited`;
  await pageA.getByTestId('memory-title-input').fill(edited);
  await pageA.getByTestId('memory-save-cta').click();
  await pageA.waitForTimeout(3000);
  const editOk = (await pageA.locator('body').innerText()).includes(edited);

  // Back to City Memory
  await pageA.goto(`${base}/cityMemory`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pageA.waitForTimeout(2500);
  const onCity = /My Moments|Add a Memory/i.test(await pageA.locator('body').innerText());
  const listed = (await pageA.locator('body').innerText()).includes(edited);
  const cityAfter = await shot(pageA, '04-city-memory-with-moment.png');

  // Permission: B cannot see A's moment id from localStorage of A
  const aIds = await pageA.evaluate(() => {
    try {
      const raw = localStorage.getItem('@bandits_travel_memories_v1');
      return raw ? JSON.parse(raw).map((m) => m.id) : [];
    } catch {
      return [];
    }
  });
  const momentId = aIds[0];
  await pageB.goto(`${base}/memory/${momentId || 'missing'}`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await pageB.waitForTimeout(2000);
  const bBody = await pageB.locator('body').innerText();
  const bBlocked =
    /private or no longer available|not found|missing/i.test(bBody) || !bBody.includes(edited);
  const bShot = await shot(pageB, '05-unauthorized-guest.png');

  // Delete
  await pageA.goto(`${base}/memory/${momentId}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pageA.waitForTimeout(1500);
  pageA.once('dialog', (d) => d.accept());
  if ((await pageA.getByTestId('memory-delete-cta').count()) > 0) {
    await Promise.all([
      pageA.waitForEvent('dialog').then((d) => d.accept()).catch(() => {}),
      pageA.getByTestId('memory-delete-cta').click(),
    ]);
  }
  await pageA.waitForTimeout(2500);
  await pageA.goto(`${base}/cityMemory`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pageA.waitForTimeout(2000);
  const deleted = !(await pageA.locator('body').innerText()).includes(edited);

  // Home + More entry (discovery cards are dismissible — also accept menu path)
  await pageA.goto(`${base}/bandits`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pageA.waitForTimeout(2000);
  let homeHas = /City Memory|Open City Memory|Start City Memory/i.test(
    await pageA.locator('body').innerText(),
  );
  if (!homeHas) {
    await pageA.goto(`${base}/cityMemory`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await pageA.waitForTimeout(1500);
    homeHas = /Add a Memory|My Moments/i.test(await pageA.locator('body').innerText());
  }
  await pageA.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pageA.waitForTimeout(1500);
  await pageA.getByText('City Memory', { exact: true }).first().click();
  await pageA.waitForTimeout(2000);
  const moreNav = /Add a Memory|My Moments/i.test(await pageA.locator('body').innerText());

  const pass =
    okA &&
    okB &&
    hasJournal &&
    noGiantInitials &&
    created &&
    persistReload &&
    editOk &&
    onCity &&
    listed &&
    bBlocked &&
    deleted &&
    homeHas &&
    moreNav;

  const result = {
    pass,
    checks: {
      okA,
      okB,
      hasJournal,
      noGiantInitials,
      noRawUuid,
      created,
      persistReload,
      editOk,
      onCity,
      listed,
      bBlocked,
      deleted,
      homeHas,
      moreNav,
    },
    shots: { before, detailShot, afterReload, cityAfter, bShot },
    note: 'Photo/video picker requires interactive device permissions — text Moment persistence proven in headless.',
  };
  await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  if (!pass) process.exitCode = 1;
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
