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
  `play-hotelier-banditeam-menus-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const report = {
  outDir,
  browser: {
    playMenu: false,
    hotelier: false,
    bandiTeam: false,
  },
  mobile: {
    playMenu: false,
    hotelier: false,
    bandiTeam: false,
  },
  screenshots: {
    browserPlayMenu: path.join(outDir, '1-browser-play-menu.png'),
    browserHotelier: path.join(outDir, '2-browser-hotelier.png'),
    browserBandiTeam: path.join(outDir, '3-browser-banditeam.png'),
    mobilePlayMenu: path.join(outDir, '4-mobile-play-menu.png'),
    mobileHotelier: path.join(outDir, '5-mobile-hotelier.png'),
    mobileBandiTeam: path.join(outDir, '6-mobile-banditeam.png'),
  },
  pass: 'FAIL',
  errors: [],
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function loginToPlayMenu(page) {
  await page.goto(`${base}/hotel/play-athens`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1800);
  const cta = page.getByRole('button', { name: /Open your message/i });
  if (await cta.count()) {
    await cta.first().click({ timeout: 15000 }).catch(() => null);
    await page.waitForURL('**/bandits', { timeout: 30000 }).catch(() => null);
  }
  await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1200);
  const signIn = page.getByText('Sign in with email', { exact: false });
  if (await signIn.count()) {
    await signIn.first().click({ timeout: 10000 });
    await page.waitForURL('**/login**', { timeout: 15000 });
    await page.fill('input[placeholder="Enter your email"]', email);
    await page.fill('input[placeholder="Enter your password"]', password);
    await page.getByTestId('email-auth-submit').click({ timeout: 10000 });
    await page.waitForURL('**/menu', { timeout: 30000 }).catch(() => null);
    await wait(1400);
  }
}

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  // Browser regression
  const desktop = await browser.newContext({ viewport: { width: 1365, height: 920 } });
  const dpage = await desktop.newPage();
  await dpage.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await dpage.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await loginToPlayMenu(dpage);
  const menuBody = (await dpage.textContent('body')) || '';
  report.browser.playMenu = dpage.url().includes('/menu') && /Menu|Guest Menu|Pilot Desk/i.test(menuBody);
  await dpage.screenshot({ path: report.screenshots.browserPlayMenu, fullPage: true });

  await dpage.goto(`${base}/hotelier`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1500);
  report.browser.hotelier = dpage.url().includes('/hotelier');
  await dpage.screenshot({ path: report.screenshots.browserHotelier, fullPage: true });

  await dpage.goto(`${base}/bandiTeam`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1500);
  report.browser.bandiTeam = dpage.url().includes('/bandiTeam');
  await dpage.screenshot({ path: report.screenshots.browserBandiTeam, fullPage: true });
  await desktop.close();

  // Mobile regression
  const mobile = await browser.newContext({ ...devices['iPhone 13'], viewport: devices['iPhone 13'].viewport });
  const mpage = await mobile.newPage();
  await mpage.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await mpage.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await loginToPlayMenu(mpage);
  const mobileMenuBody = (await mpage.textContent('body')) || '';
  report.mobile.playMenu = mpage.url().includes('/menu') && /Menu|Guest Menu|Pilot Desk/i.test(mobileMenuBody);
  await mpage.screenshot({ path: report.screenshots.mobilePlayMenu, fullPage: true });

  await mpage.goto(`${base}/hotelier`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1500);
  report.mobile.hotelier = mpage.url().includes('/hotelier');
  await mpage.screenshot({ path: report.screenshots.mobileHotelier, fullPage: true });

  await mpage.goto(`${base}/bandiTeam`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1500);
  report.mobile.bandiTeam = mpage.url().includes('/bandiTeam');
  await mpage.screenshot({ path: report.screenshots.mobileBandiTeam, fullPage: true });
  await mobile.close();

  report.pass =
    report.browser.playMenu &&
    report.browser.hotelier &&
    report.browser.bandiTeam &&
    report.mobile.playMenu &&
    report.mobile.hotelier &&
    report.mobile.bandiTeam
      ? 'PASS'
      : 'FAIL';
} catch (e) {
  report.errors.push(e instanceof Error ? e.message : String(e));
  report.pass = 'FAIL';
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report));
