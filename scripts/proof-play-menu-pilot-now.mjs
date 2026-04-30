import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = process.env.PROFILE_VERIFY_BASE || 'http://localhost:8081';
const email = process.env.PLAY_OPERATOR_EMAIL || 'blonje@gmail.com';
const password = process.env.PLAY_OPERATOR_PASSWORD || process.env.E2E_ADMIN_PASSWORD || '121275';
const outDir = path.join(
  root,
  'artifacts',
  'runtime-proof',
  `play-menu-pilot-now-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
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
    menuWithPilotDesk: path.join(outDir, '1-menu-with-pilot-desk.png'),
    pilotDeskOpened: path.join(outDir, '2-pilot-desk-opened.png'),
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

  await page.goto(`${base}/hotel/play-athens`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2200);
  await page.getByRole('button', { name: /Open your message/i }).click({ timeout: 15000 });
  await page.waitForURL('**/bandits', { timeout: 30000 });
  await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1200);
  await page.getByText('Sign in with email', { exact: false }).click({ timeout: 10000 });

  await page.waitForURL('**/login**', { timeout: 15000 });
  await page.fill('input[placeholder="Enter your email"]', email);
  await page.fill('input[placeholder="Enter your password"]', password);
  await page.getByTestId('email-auth-submit').click({ timeout: 10000 });
  await page.waitForURL('**/menu', { timeout: 30000 });
  await wait(1800);

  const menuText = (await page.textContent('body')) || '';
  report.checks.playContextAfterLogin = page.url().includes('/menu');
  report.checks.playMenuClean = !/ALUMA|Hotelier|Operator session/i.test(menuText);
  report.checks.pilotDeskVisible = /Pilot Desk/i.test(menuText);
  await page.screenshot({ path: report.screenshots.menuWithPilotDesk, fullPage: true });

  if (report.checks.pilotDeskVisible) {
    await page.getByText('Pilot Desk', { exact: false }).first().click({ timeout: 10000 });
    await page.waitForURL('**/operatorDesk', { timeout: 20000 });
    await wait(2000);
    const deskText = (await page.textContent('body')) || '';
    report.checks.pilotDeskOpened =
      page.url().includes('/operatorDesk') && /Live Alerts|Incoming|Delete|Ask Me|Local Friend/i.test(deskText);
    await page.screenshot({ path: report.screenshots.pilotDeskOpened, fullPage: true });
  }

  report.pass = Object.values(report.checks).every(Boolean) ? 'PASS' : 'FAIL';
} catch (e) {
  report.errors.push(e instanceof Error ? e.message : String(e));
  report.pass = 'FAIL';
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report));
