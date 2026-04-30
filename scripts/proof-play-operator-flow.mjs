import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = process.env.PROFILE_VERIFY_BASE || 'http://localhost:8081';
const adminEmail = process.env.E2E_ADMIN_EMAIL || '';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || '';
const outDir = path.join(
  root,
  'artifacts',
  'runtime-proof',
  `play-operator-flow-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const report = {
  outDir,
  checks: {
    playContextAfterLogin: false,
    playMenuClean: false,
    pilotDeskVisible: false,
    pilotDeskOpened: false,
  },
  screenshots: {
    intro: path.join(outDir, '1-intro.png'),
    home: path.join(outDir, '2-home.png'),
    profile: path.join(outDir, '3-profile.png'),
    menu: path.join(outDir, '4-menu.png'),
    bottomTabs: path.join(outDir, '5-bottom-tabs.png'),
    pilotDesk: path.join(outDir, '6-pilot-desk.png'),
  },
  pass: 'FAIL',
  errors: [],
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1365, height: 920 } });
const page = await context.newPage();

try {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.goto(`${base}/hotel/play-theatrou`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2200);
  await page.screenshot({ path: report.screenshots.intro, fullPage: true });

  await page.getByRole('button', { name: /Open your message/i }).click({ timeout: 15000 });
  await page.waitForURL('**/bandits', { timeout: 30000 });
  await wait(1800);
  await page.screenshot({ path: report.screenshots.home, fullPage: true });
  await page.screenshot({ path: report.screenshots.bottomTabs, fullPage: true });

  await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1500);
  await page.screenshot({ path: report.screenshots.menu, fullPage: true });

  if (!adminEmail || !adminPassword) {
    report.errors.push('E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD missing');
  } else {
    await page.getByText('Sign in with email', { exact: false }).first().click({ timeout: 10000 });
    await page.waitForURL('**/login**', { timeout: 15000 });
    await wait(800);
    await page.fill('input[placeholder="Enter your email"]', adminEmail);
    await page.fill('input[placeholder="Enter your password"]', adminPassword);
    await page.getByTestId('email-auth-submit').click({ timeout: 10000 });
    await page.waitForURL('**/menu', { timeout: 30000 });
    await wait(2000);
    report.checks.playContextAfterLogin = page.url().includes('/menu');

    await page.getByText('Profile', { exact: false }).first().click({ timeout: 10000 });
    await page.waitForURL('**/profile', { timeout: 15000 });
    await wait(1500);
    await page.screenshot({ path: report.screenshots.profile, fullPage: true });

    await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await wait(1500);
    const menuBody = (await page.textContent('body')) || '';
    report.checks.playMenuClean =
      !/ALUMA|TRAVEL PRIVATELY\. MOVE SMARTLY\./i.test(menuBody);
    report.checks.pilotDeskVisible = menuBody.includes('Pilot Desk');
    if (report.checks.pilotDeskVisible) {
      await page.getByText('Pilot Desk', { exact: false }).first().click({ timeout: 10000 });
      await page.waitForURL('**/operatorDesk', { timeout: 15000 });
      await wait(1500);
      const deskBody = (await page.textContent('body')) || '';
      report.checks.pilotDeskOpened =
        /Incoming|Live alert|Delete|Ask Me|Local Friend/i.test(deskBody) && page.url().includes('/operatorDesk');
      await page.screenshot({ path: report.screenshots.pilotDesk, fullPage: true });
      report.pass = Object.values(report.checks).every(Boolean) ? 'PASS' : 'FAIL';
    } else {
      report.errors.push('Pilot Desk not visible for signed-in operator');
    }
  }
} catch (e) {
  report.errors.push(e instanceof Error ? e.message : String(e));
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report));
