import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = 'https://bandits-two.vercel.app';
const email = process.env.PLAY_OPERATOR_EMAIL || process.env.E2E_ADMIN_EMAIL || 'blonje@gmail.com';
const password = process.env.PLAY_OPERATOR_PASSWORD || process.env.E2E_ADMIN_PASSWORD || '121275';

const outDir = path.join(
  root,
  'artifacts',
  'runtime-proof',
  `pilotdesk-real-account-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const report = {
  productionUrl: base,
  screenshots: {
    desktopMenu: path.join(outDir, '1-desktop-menu-pilotdesk.png'),
    iphoneMenu: path.join(outDir, '2-iphone-menu-pilotdesk.png'),
  },
  checks: {
    desktopPilotDeskVisible: false,
    iphonePilotDeskVisible: false,
  },
  pass: 'FAIL',
  errors: [],
};

async function loginAndShot(page, shotPath) {
  await page.goto(`${base}/login?redirect=/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1000);
  await page.fill('input[placeholder="Enter your email"]', email);
  await page.fill('input[placeholder="Enter your password"]', password);
  await page.getByTestId('email-auth-submit').click({ timeout: 15000 });
  await page.waitForURL('**/menu', { timeout: 45000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: shotPath, fullPage: true });
  const body = (await page.textContent('body')) || '';
  return /Pilot Desk/i.test(body);
}

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const desktop = await browser.newContext({ viewport: { width: 1365, height: 920 } });
  const dpage = await desktop.newPage();
  report.checks.desktopPilotDeskVisible = await loginAndShot(dpage, report.screenshots.desktopMenu);
  await desktop.close();

  const iphone = await browser.newContext({ ...devices['iPhone 14 Pro'] });
  const ipage = await iphone.newPage();
  report.checks.iphonePilotDeskVisible = await loginAndShot(ipage, report.screenshots.iphoneMenu);
  await iphone.close();

  report.pass = Object.values(report.checks).every(Boolean) ? 'PASS' : 'FAIL';
} catch (e) {
  report.errors.push(e instanceof Error ? e.message : String(e));
  report.pass = 'FAIL';
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report));
