import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = process.env.PROFILE_VERIFY_BASE || 'http://localhost:8081';
const operatorEmail = process.env.PLAY_OPERATOR_EMAIL || process.env.E2E_ADMIN_EMAIL || 'blonje@gmail.com';
const operatorPassword = process.env.PLAY_OPERATOR_PASSWORD || process.env.E2E_ADMIN_PASSWORD || '121275';
const outDir = path.join(
  root,
  'artifacts',
  'runtime-proof',
  `onboarding-entry-context-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const report = {
  outDir,
  checks: {
    freshGuestFlow: false,
    returningGuestFlow: false,
    signedInOperatorFlow: false,
    qrLinkDirectEntryFlow: false,
    mobileBrowserBehavior: false,
    browserRefreshKeepsContext: false,
  },
  screenshots: {
    freshIntro: path.join(outDir, '1-fresh-intro.png'),
    freshHome: path.join(outDir, '2-fresh-home.png'),
    returningHome: path.join(outDir, '3-returning-home.png'),
    operatorHome: path.join(outDir, '4-operator-home.png'),
    operatorMenu: path.join(outDir, '5-operator-menu.png'),
    directEntryMenu: path.join(outDir, '6-direct-entry-menu.png'),
    refreshContext: path.join(outDir, '7-refresh-context.png'),
    mobileIntro: path.join(outDir, '8-mobile-intro.png'),
    mobileReturningHome: path.join(outDir, '9-mobile-returning-home.png'),
  },
  errors: [],
  pass: 'FAIL',
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await mkdir(outDir, { recursive: true });

function bodyHasPlayText(text) {
  return /MESSAGE IN A BOTTLE|Open your message|PLAY|Guest Menu|Menu/i.test(text || '');
}

async function dismissPwaOverlayIfPresent(page) {
  const gotIt = page.getByRole('button', { name: /Dismiss add to home screen prompt|Got it/i });
  if (await gotIt.count()) {
    await gotIt.first().click({ timeout: 3000 }).catch(() => null);
  }
}

const browser = await chromium.launch({ headless: true });

try {
  // Desktop flow context
  const context = await browser.newContext({ viewport: { width: 1365, height: 920 } });
  const page = await context.newPage();

  // Fresh guest
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(`${base}/hotel/play-athens`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2500);
  await dismissPwaOverlayIfPresent(page);
  const freshBody = await page.textContent('body');
  report.checks.freshGuestFlow = bodyHasPlayText(freshBody) && page.url().includes('/hotel/play-athens');
  await page.screenshot({ path: report.screenshots.freshIntro, fullPage: true });

  if (await page.getByRole('button', { name: /Open your message/i }).count()) {
    await page.getByRole('button', { name: /Open your message/i }).click({ timeout: 15000 });
  }
  await page.waitForURL('**/bandits', { timeout: 30000 });
  await wait(1500);
  await page.screenshot({ path: report.screenshots.freshHome, fullPage: true });

  // Returning guest
  await page.goto(`${base}/hotel/play-athens`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2200);
  report.checks.returningGuestFlow = page.url().includes('/bandits');
  await page.screenshot({ path: report.screenshots.returningHome, fullPage: true });

  // Signed-in operator flow from direct entry
  await page.goto(`${base}/login?redirect=/hotel/play-athens`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1000);
  await page.fill('input[placeholder="Enter your email"]', operatorEmail);
  await page.fill('input[placeholder="Enter your password"]', operatorPassword);
  await page.getByTestId('email-auth-submit').click({ timeout: 15000 });
  await page.waitForLoadState('domcontentloaded');
  await wait(3000);
  const afterOpLoginUrl = page.url();
  report.checks.signedInOperatorFlow = /\/bandits|\/hotel\/play-athens/.test(afterOpLoginUrl);
  await page.screenshot({ path: report.screenshots.operatorHome, fullPage: true });
  await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1500);
  const operatorMenuBody = await page.textContent('body');
  await page.screenshot({ path: report.screenshots.operatorMenu, fullPage: true });

  // QR/link direct entry + wrong-context guard
  await page.goto(`${base}/hotel/play-theatrou/experience`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2000);
  await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1200);
  const directMenuBody = await page.textContent('body');
  report.checks.qrLinkDirectEntryFlow =
    !/ALUMA|TRAVEL PRIVATELY/i.test(directMenuBody || '') && /Menu|Guest Menu/i.test(directMenuBody || '');
  await page.screenshot({ path: report.screenshots.directEntryMenu, fullPage: true });

  // Refresh keeps context
  await page.goto(`${base}/bandits`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(700);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1200);
  const refreshedBody = await page.textContent('body');
  report.checks.browserRefreshKeepsContext = !/ALUMA|TRAVEL PRIVATELY/i.test(refreshedBody || '');
  await page.screenshot({ path: report.screenshots.refreshContext, fullPage: true });

  // Mobile browser behavior (iPhone profile)
  const mobileContext = await browser.newContext({
    ...devices['iPhone 13'],
    viewport: devices['iPhone 13'].viewport,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await mobilePage.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await mobilePage.goto(`${base}/hotel/play-athens`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2600);
  await dismissPwaOverlayIfPresent(mobilePage);
  const mobileIntroBody = await mobilePage.textContent('body');
  const mobileFreshOk = bodyHasPlayText(mobileIntroBody) && mobilePage.url().includes('/hotel/play-athens');
  await mobilePage.screenshot({ path: report.screenshots.mobileIntro, fullPage: true });
  if (await mobilePage.getByRole('button', { name: /Open your message/i }).count()) {
    await mobilePage.getByRole('button', { name: /Open your message/i }).first().click({ timeout: 15000, force: true });
  }
  await mobilePage.waitForURL('**/bandits', { timeout: 30000 });
  await wait(1500);
  await mobilePage.goto(`${base}/hotel/play-athens`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2200);
  const mobileReturningOk = mobilePage.url().includes('/bandits');
  report.checks.mobileBrowserBehavior = mobileFreshOk && mobileReturningOk;
  await mobilePage.screenshot({ path: report.screenshots.mobileReturningHome, fullPage: true });
  await mobileContext.close();

  // tighten signed-in operator check with menu context
  report.checks.signedInOperatorFlow =
    report.checks.signedInOperatorFlow && /Pilot Desk|Signed in as/i.test(operatorMenuBody || '');

  report.pass = Object.values(report.checks).every(Boolean) ? 'PASS' : 'FAIL';
  await context.close();
} catch (e) {
  report.errors.push(e instanceof Error ? e.message : String(e));
  report.pass = 'FAIL';
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report));
