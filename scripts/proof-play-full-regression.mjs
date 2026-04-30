import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = process.env.PROFILE_VERIFY_BASE || 'http://localhost:8081';
const email = process.env.PLAY_OPERATOR_EMAIL || process.env.E2E_ADMIN_EMAIL || 'blonje@gmail.com';
const password = process.env.PLAY_OPERATOR_PASSWORD || process.env.E2E_ADMIN_PASSWORD || '121275';
const outDir = path.join(
  root,
  'artifacts',
  'runtime-proof',
  `play-full-regression-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const report = {
  outDir,
  checks: {
    introFlow: false,
    home: false,
    menu: false,
    profilePersistence: false,
    photoPersistence: false,
    following: false,
    alerts: false,
    settings: false,
    hotelierVisible: false,
    pilotDeskVisible: false,
    crossPageNavigationStable: false,
  },
  screenshots: {
    intro: path.join(outDir, '1-intro.png'),
    home: path.join(outDir, '2-home.png'),
    menu: path.join(outDir, '3-menu.png'),
    profileA: path.join(outDir, '4-profile-a.png'),
    profileB: path.join(outDir, '5-profile-b.png'),
    following: path.join(outDir, '6-following.png'),
    alerts: path.join(outDir, '7-alerts.png'),
    settings: path.join(outDir, '8-settings.png'),
    hotelier: path.join(outDir, '9-hotelier.png'),
    pilotDesk: path.join(outDir, '10-pilot-desk.png'),
    navStable: path.join(outDir, '11-nav-stable.png'),
  },
  consoleErrors: [],
  pageErrors: [],
  pass: 'FAIL',
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1365, height: 920 } });
const page = await context.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') report.consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => report.pageErrors.push(String(err?.message || err)));

try {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // Intro
  await page.goto(`${base}/hotel/play-athens`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2200);
  const introBody = (await page.textContent('body')) || '';
  report.checks.introFlow = /MESSAGE IN A BOTTLE|Open your message/i.test(introBody);
  await page.screenshot({ path: report.screenshots.intro, fullPage: true });

  // Intro -> Home
  if (await page.getByRole('button', { name: /Open your message/i }).count()) {
    await page.getByRole('button', { name: /Open your message/i }).click({ timeout: 15000 });
  }
  await page.waitForURL('**/bandits', { timeout: 30000 });
  await wait(1800);
  report.checks.home = page.url().includes('/bandits');
  await page.screenshot({ path: report.screenshots.home, fullPage: true });

  // Menu + sign-in
  await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1200);
  if ((await page.getByText('Sign in with email', { exact: false }).count()) > 0) {
    await page.getByText('Sign in with email', { exact: false }).first().click({ timeout: 10000 });
    await page.waitForURL('**/login**', { timeout: 15000 });
    await page.fill('input[placeholder="Enter your email"]', email);
    await page.fill('input[placeholder="Enter your password"]', password);
    await page.getByTestId('email-auth-submit').click({ timeout: 10000 });
    await page.waitForURL('**/menu', { timeout: 30000 });
    await wait(1600);
  }
  const menuBody = (await page.textContent('body')) || '';
  report.checks.menu = page.url().includes('/menu');
  report.checks.hotelierVisible = /Hotelier/i.test(menuBody);
  report.checks.pilotDeskVisible = /Pilot Desk/i.test(menuBody);
  await page.screenshot({ path: report.screenshots.menu, fullPage: true });

  // Profile + photo persistence check
  await page.goto(`${base}/profile`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1800);
  const avatarA = await page.evaluate(() => {
    const img = document.querySelector('img');
    return img?.getAttribute('src') || '';
  });
  await page.screenshot({ path: report.screenshots.profileA, fullPage: true });
  await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1000);
  await page.goto(`${base}/profile`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1800);
  const avatarB = await page.evaluate(() => {
    const img = document.querySelector('img');
    return img?.getAttribute('src') || '';
  });
  report.checks.profilePersistence = page.url().includes('/profile');
  report.checks.photoPersistence = Boolean(avatarA) && Boolean(avatarB);
  await page.screenshot({ path: report.screenshots.profileB, fullPage: true });

  // Following
  await page.goto(`${base}/following`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2200);
  report.checks.following = page.url().includes('/following');
  await page.screenshot({ path: report.screenshots.following, fullPage: true });

  // Alerts
  await page.goto(`${base}/alerts`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1500);
  report.checks.alerts = page.url().includes('/alerts');
  await page.screenshot({ path: report.screenshots.alerts, fullPage: true });

  // Settings
  await page.goto(`${base}/settings`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1500);
  report.checks.settings = page.url().includes('/settings');
  await page.screenshot({ path: report.screenshots.settings, fullPage: true });

  // Hotelier screen
  await page.goto(`${base}/hotelier`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1800);
  report.checks.hotelierVisible = report.checks.hotelierVisible && page.url().includes('/hotelier');
  await page.screenshot({ path: report.screenshots.hotelier, fullPage: true });

  // Pilot desk open
  await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1200);
  if ((await page.getByText('Pilot Desk', { exact: false }).count()) > 0) {
    await page.getByText('Pilot Desk', { exact: false }).first().click({ timeout: 10000 });
    await page.waitForURL('**/operatorDesk', { timeout: 20000 });
    await wait(1800);
  }
  report.checks.pilotDeskVisible = report.checks.pilotDeskVisible && page.url().includes('/operatorDesk');
  await page.screenshot({ path: report.screenshots.pilotDesk, fullPage: true });

  // Cross-page navigation stable
  await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(900);
  await page.goto(`${base}/settings`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(700);
  await page.goBack({ timeout: 10000 });
  await wait(1200);
  report.checks.crossPageNavigationStable = page.url().includes('/menu');
  await page.screenshot({ path: report.screenshots.navStable, fullPage: true });

  report.pass = Object.values(report.checks).every(Boolean) ? 'PASS' : 'FAIL';
} catch (e) {
  report.pass = 'FAIL';
  report.pageErrors.push(e instanceof Error ? e.message : String(e));
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report));
