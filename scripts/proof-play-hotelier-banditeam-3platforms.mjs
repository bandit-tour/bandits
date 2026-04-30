import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = process.env.PROFILE_VERIFY_BASE || 'http://localhost:8081';
const email = process.env.PLAY_OPERATOR_EMAIL || process.env.E2E_ADMIN_EMAIL || 'blonje@gmail.com';
const password = process.env.PLAY_OPERATOR_PASSWORD || process.env.E2E_ADMIN_PASSWORD || '121275';
const outDir = path.join(
  root,
  'artifacts',
  'runtime-proof',
  `play-hotelier-banditeam-3platforms-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const report = {
  outDir,
  browser: { playMenu: false, hotelier: false, bandiTeam: false },
  iPhone: { playMenu: false, hotelier: false, bandiTeam: false },
  android: { playMenu: false, hotelier: false, bandiTeam: false },
  screenshots: {
    browserPlayMenu: path.join(outDir, '1-browser-play-menu.png'),
    browserHotelier: path.join(outDir, '2-browser-hotelier.png'),
    browserBandiTeam: path.join(outDir, '3-browser-banditeam.png'),
    iPhonePlayMenu: path.join(outDir, '4-iphone-play-menu.png'),
    iPhoneHotelier: path.join(outDir, '5-iphone-hotelier.png'),
    iPhoneBandiTeam: path.join(outDir, '6-iphone-banditeam.png'),
    androidPlayMenu: path.join(outDir, '7-android-play-menu.png'),
    androidHotelier: path.join(outDir, '8-android-hotelier.png'),
    androidBandiTeam: path.join(outDir, '9-android-banditeam.png'),
  },
  pass: 'FAIL',
  errors: [],
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function dismissOverlayIfPresent(page) {
  const gotIt = page.getByRole('button', { name: /Dismiss add to home screen prompt|Got it|Continue in browser/i });
  if (await gotIt.count()) {
    await gotIt.first().click({ timeout: 3000 }).catch(() => null);
  }
}

async function loginToPlayMenu(page) {
  await page.goto(`${base}/hotel/play-athens`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1800);
  await dismissOverlayIfPresent(page);
  const cta = page.getByRole('button', { name: /Open your message/i });
  if (await cta.count()) {
    await cta.first().click({ timeout: 15000, force: true }).catch(() => null);
    await page.waitForURL('**/bandits', { timeout: 30000 }).catch(() => null);
  }
  await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1200);
  const signIn = page.getByText('Sign in with email', { exact: false });
  if (await signIn.count()) {
    await signIn.first().click({ timeout: 10000 }).catch(() => null);
    await page.waitForURL('**/login**', { timeout: 15000 }).catch(() => null);
    if (page.url().includes('/login')) {
      await page.fill('input[placeholder="Enter your email"]', email);
      await page.fill('input[placeholder="Enter your password"]', password);
      await page.getByTestId('email-auth-submit').click({ timeout: 10000 });
      await page.waitForURL('**/menu', { timeout: 30000 }).catch(() => null);
      await wait(1400);
    }
  }
}

async function runSet(ctx, tag, s1, s2, s3) {
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await loginToPlayMenu(page);
  const menuBody = (await page.textContent('body')) || '';
  report[tag].playMenu = page.url().includes('/menu') && /Menu|Guest Menu|Pilot Desk/i.test(menuBody);
  await page.screenshot({ path: s1, fullPage: true });

  await page.goto(`${base}/hotelier`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1400);
  report[tag].hotelier = page.url().includes('/hotelier');
  await page.screenshot({ path: s2, fullPage: true });

  await page.goto(`${base}/bandiTeam`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1400);
  report[tag].bandiTeam = page.url().includes('/bandiTeam');
  await page.screenshot({ path: s3, fullPage: true });
  await ctx.close();
}

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  const desktop = await browser.newContext({ viewport: { width: 1365, height: 920 } });
  await runSet(
    desktop,
    'browser',
    report.screenshots.browserPlayMenu,
    report.screenshots.browserHotelier,
    report.screenshots.browserBandiTeam,
  );

  const iphone = await browser.newContext({ ...devices['iPhone 13'], viewport: devices['iPhone 13'].viewport });
  await runSet(
    iphone,
    'iPhone',
    report.screenshots.iPhonePlayMenu,
    report.screenshots.iPhoneHotelier,
    report.screenshots.iPhoneBandiTeam,
  );

  const android = await browser.newContext({ ...devices['Pixel 7'], viewport: devices['Pixel 7'].viewport });
  await runSet(
    android,
    'android',
    report.screenshots.androidPlayMenu,
    report.screenshots.androidHotelier,
    report.screenshots.androidBandiTeam,
  );

  report.pass =
    Object.values(report.browser).every(Boolean) &&
    Object.values(report.iPhone).every(Boolean) &&
    Object.values(report.android).every(Boolean)
      ? 'PASS'
      : 'FAIL';
} catch (e) {
  report.errors.push(e instanceof Error ? e.message : String(e));
  report.pass = 'FAIL';
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report));
