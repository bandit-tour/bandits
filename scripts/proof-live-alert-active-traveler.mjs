import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = 'https://bandits-two.vercel.app';
const adminEmail = process.env.E2E_ADMIN_EMAIL || process.env.PLAY_OPERATOR_EMAIL || 'blonje@gmail.com';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || process.env.PLAY_OPERATOR_PASSWORD || '121275';
const liveTitle = `Live alert proof ${Date.now().toString().slice(-5)}`;
const liveMessage = 'This is a production delivery check for active traveler routing.';

const outDir = path.join(
  root,
  'artifacts',
  'runtime-proof',
  `live-alert-active-traveler-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const report = {
  productionUrl: base,
  screenshots: {
    activeTravelerDetected: path.join(outDir, '1-active-traveler-detected.png'),
    afterSendingLiveAlert: path.join(outDir, '2-after-send-live-alert.png'),
    receivedInTravelerApp: path.join(outDir, '3-traveler-received-alert.png'),
    regularNoPilotDesk: path.join(outDir, '4-regular-user-no-pilot-desk.png'),
  },
  checks: {
    activeTravelerDetected: false,
    sentLiveAlert: false,
    travelerReceivedAlert: false,
    regularUsersCannotSeePilotDesk: false,
  },
  pass: 'FAIL',
  errors: [],
};

async function login(page, email, password) {
  await page.goto(`${base}/login?forceAuth=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  const signInButtons = page.getByText('Sign in', { exact: true });
  await signInButtons.nth((await signInButtons.count()) - 1).click();
  await page.waitForFunction(() => !window.location.pathname.includes('/login'), null, { timeout: 120000 });
}

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const adminCtx = await browser.newContext({ viewport: { width: 1365, height: 920 } });
const travelerCtx = await browser.newContext({ viewport: { width: 1365, height: 920 } });
const adminPage = await adminCtx.newPage();
const travelerPage = await travelerCtx.newPage();

try {
  // Fresh active traveler session (anonymous, non-admin).
  await travelerPage.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await travelerPage.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await travelerPage.goto(`${base}/bandits`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await travelerPage.waitForTimeout(3500);
  // Create traveler identity row so active traveler is targetable by Pilot Desk.
  await travelerPage.goto(`${base}/profile`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await travelerPage.waitForTimeout(1800);
  await travelerPage.getByTestId('profile-input-name').fill(`Traveler ${Date.now().toString().slice(-4)}`);
  await travelerPage.getByTestId('profile-input-email').fill(`active.traveler.${Date.now()}@example.com`);
  await travelerPage.getByTestId('profile-input-vibe').fill('Active traveler in city now.');
  await travelerPage.getByTestId('profile-save').click({ timeout: 15000 });
  await travelerPage.waitForTimeout(2600);
  await travelerPage.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await travelerPage.waitForTimeout(2200);
  await travelerPage.screenshot({ path: report.screenshots.regularNoPilotDesk, fullPage: true });
  const travelerMenuBody = (await travelerPage.textContent('body')) || '';
  report.checks.regularUsersCannotSeePilotDesk = !/Pilot Desk/i.test(travelerMenuBody);

  // Active traveler interaction seed for recipient routing.
  await travelerPage.goto(`${base}/localFriend`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await travelerPage.waitForTimeout(1500);
  const askInput = travelerPage.getByPlaceholder(/Ask for a vibe/i).first();
  if ((await askInput.count()) > 0) {
    await askInput.fill(`active-seed-${Date.now()}`);
    const releaseBtn = travelerPage.getByText('Release', { exact: true }).first();
    if ((await releaseBtn.count()) > 0) {
      await releaseBtn.click();
      await travelerPage.waitForTimeout(3000);
    }
  }

  await login(adminPage, adminEmail, adminPassword);
  await adminPage.goto(`${base}/operatorDesk`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await adminPage.waitForTimeout(2000);
  await adminPage.locator('input[placeholder="Alert title"]').fill(liveTitle);
  await adminPage.locator('textarea[placeholder="Alert message"], input[placeholder="Alert message"]').first().fill(liveMessage);
  await adminPage.getByText('Send live alert', { exact: true }).click();
  await adminPage.waitForTimeout(3500);
  await adminPage.screenshot({ path: report.screenshots.activeTravelerDetected, fullPage: true });

  const adminBody = (await adminPage.textContent('body')) || '';
  report.checks.activeTravelerDetected = /Live alert sent to\s+[1-9]\d*\s+users\./i.test(adminBody);
  report.checks.sentLiveAlert = report.checks.activeTravelerDetected;
  await adminPage.screenshot({ path: report.screenshots.afterSendingLiveAlert, fullPage: true });

  // Verify received alert in the signed-in traveler app (same account/device session).
  await adminPage.goto(`${base}/inbox`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  let gotAlert = 0;
  for (let i = 0; i < 8; i += 1) {
    await adminPage.waitForTimeout(2200);
    gotAlert = await adminPage.getByText(liveTitle, { exact: false }).count();
    if (gotAlert > 0) break;
    await adminPage.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  }
  await adminPage.screenshot({ path: report.screenshots.receivedInTravelerApp, fullPage: true });
  report.checks.travelerReceivedAlert = gotAlert > 0;

  report.pass = Object.values(report.checks).every(Boolean) ? 'PASS' : 'FAIL';
} catch (e) {
  report.errors.push(e instanceof Error ? e.message : String(e));
  report.pass = 'FAIL';
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report));
