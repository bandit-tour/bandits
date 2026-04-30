import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = process.env.PROFILE_VERIFY_BASE || 'http://localhost:8081';
const outDir = path.join(
  root,
  'artifacts',
  'runtime-proof',
  `returning-reentry-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const result = {
  outDir,
  browser: {
    firstEntryIntroShown: false,
    reopenSkipsIntroToHome: false,
    contextPreserved: false,
  },
  mobile: {
    firstEntryIntroShown: false,
    reopenSkipsIntroToHome: false,
    contextPreserved: false,
  },
  screenshots: {
    browserFirstIntro: path.join(outDir, '1-browser-first-intro.png'),
    browserReopenHome: path.join(outDir, '2-browser-reopen-home.png'),
    mobileFirstIntro: path.join(outDir, '3-mobile-first-intro.png'),
    mobileReopenHome: path.join(outDir, '4-mobile-reopen-home.png'),
  },
  pass: 'FAIL',
  errors: [],
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function hasIntroText(text) {
  return /MESSAGE IN A BOTTLE|Open your message/i.test(text || '');
}

async function dismissOverlayIfPresent(page) {
  const gotIt = page.getByRole('button', { name: /Dismiss add to home screen prompt|Got it/i });
  if (await gotIt.count()) {
    await gotIt.first().click({ timeout: 2000 }).catch(() => null);
  }
}

await mkdir(outDir, { recursive: true });

try {
  // ----- Browser persistent profile -----
  const browserProfile = await mkdtemp(path.join(os.tmpdir(), 'bandits-browser-profile-'));
  let ctx = await chromium.launchPersistentContext(browserProfile, {
    headless: true,
    viewport: { width: 1365, height: 920 },
  });
  let page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(`${base}/hotel/play-athens`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2300);
  await dismissOverlayIfPresent(page);
  const introBody = await page.textContent('body');
  result.browser.firstEntryIntroShown = hasIntroText(introBody) && page.url().includes('/hotel/play-athens');
  await page.screenshot({ path: result.screenshots.browserFirstIntro, fullPage: true });
  if (await page.getByRole('button', { name: /Open your message/i }).count()) {
    await page.getByRole('button', { name: /Open your message/i }).first().click({ timeout: 15000 }).catch(() => null);
    await page.waitForURL('**/bandits', { timeout: 30000 }).catch(() => null);
  }
  await ctx.close(); // simulate close browser

  ctx = await chromium.launchPersistentContext(browserProfile, {
    headless: true,
    viewport: { width: 1365, height: 920 },
  });
  page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(`${base}/hotel/play-athens`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2300);
  result.browser.reopenSkipsIntroToHome = page.url().includes('/bandits');
  const browserBody = await page.textContent('body');
  result.browser.contextPreserved = !/ALUMA|TRAVEL PRIVATELY/i.test(browserBody || '');
  await page.screenshot({ path: result.screenshots.browserReopenHome, fullPage: true });
  await ctx.close();

  // ----- Mobile persistent profile -----
  const mobileProfile = await mkdtemp(path.join(os.tmpdir(), 'bandits-mobile-profile-'));
  let mctx = await chromium.launchPersistentContext(mobileProfile, {
    headless: true,
    ...devices['iPhone 13'],
    viewport: devices['iPhone 13'].viewport,
  });
  let mpage = mctx.pages()[0] ?? (await mctx.newPage());
  await mpage.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await mpage.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await mpage.goto(`${base}/hotel/play-athens`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2600);
  await dismissOverlayIfPresent(mpage);
  const mintroBody = await mpage.textContent('body');
  result.mobile.firstEntryIntroShown = hasIntroText(mintroBody) && mpage.url().includes('/hotel/play-athens');
  await mpage.screenshot({ path: result.screenshots.mobileFirstIntro, fullPage: true });
  if (await mpage.getByRole('button', { name: /Open your message/i }).count()) {
    await mpage.getByRole('button', { name: /Open your message/i }).first().click({ timeout: 15000, force: true }).catch(() => null);
    await mpage.waitForURL('**/bandits', { timeout: 30000 }).catch(() => null);
  }
  await mctx.close(); // simulate close mobile browser

  mctx = await chromium.launchPersistentContext(mobileProfile, {
    headless: true,
    ...devices['iPhone 13'],
    viewport: devices['iPhone 13'].viewport,
  });
  mpage = mctx.pages()[0] ?? (await mctx.newPage());
  await mpage.goto(`${base}/hotel/play-athens`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2600);
  result.mobile.reopenSkipsIntroToHome = mpage.url().includes('/bandits');
  const mobileBody = await mpage.textContent('body');
  result.mobile.contextPreserved = !/ALUMA|TRAVEL PRIVATELY/i.test(mobileBody || '');
  await mpage.screenshot({ path: result.screenshots.mobileReopenHome, fullPage: true });
  await mctx.close();

  result.pass =
    result.browser.firstEntryIntroShown &&
    result.browser.reopenSkipsIntroToHome &&
    result.browser.contextPreserved &&
    result.mobile.firstEntryIntroShown &&
    result.mobile.reopenSkipsIntroToHome &&
    result.mobile.contextPreserved
      ? 'PASS'
      : 'FAIL';
} catch (e) {
  result.errors.push(e instanceof Error ? e.message : String(e));
  result.pass = 'FAIL';
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify(result));
