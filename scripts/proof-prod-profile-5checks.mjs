import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = 'https://bandits-two.vercel.app';
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.join(root, 'artifacts', 'runtime-proof', `prod-profile-5checks-${stamp}`);

const v = Date.now();
const testName = `Guest Proof ${String(v).slice(-6)}`;
const testEmail = `guest.proof.${v}@example.com`;
const testVibe = 'Calm explorer with sharp local radar.';

const report = {
  productionUrl: `${base}/profile`,
  screenshots: {
    editableFields: path.join(outDir, '1-editable-fields.png'),
    saveVisible: path.join(outDir, '2-save-profile-visible.png'),
    afterSave: path.join(outDir, '3-after-save.png'),
    afterLeaveReturn: path.join(outDir, '4-after-leave-return.png'),
    afterFullRefresh: path.join(outDir, '5-after-full-refresh.png'),
  },
  checks: {
    editableFieldsVisible: false,
    saveProfileVisible: false,
    savePersistsAfterLeavingAndReturning: false,
    savePersistsAfterFullRefresh: false,
    guestCanCreateProfileIdentity: false,
  },
  pass: 'FAIL',
  errors: [],
};

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

try {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.goto(`${base}/profile`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(3000);

  const hasName = (await page.getByTestId('profile-input-name').count()) > 0;
  const hasEmail = (await page.getByTestId('profile-input-email').count()) > 0;
  const hasVibe = (await page.getByTestId('profile-input-vibe').count()) > 0;
  report.checks.editableFieldsVisible = hasName && hasEmail && hasVibe;
  await page.screenshot({ path: report.screenshots.editableFields, fullPage: true });

  const hasSave = (await page.getByTestId('profile-save').count()) > 0;
  report.checks.saveProfileVisible = hasSave;
  await page.screenshot({ path: report.screenshots.saveVisible, fullPage: true });

  await page.getByTestId('profile-input-name').fill(testName);
  await page.getByTestId('profile-input-email').fill(testEmail);
  await page.getByTestId('profile-input-vibe').fill(testVibe);
  await page.getByTestId('profile-save').click({ timeout: 15000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: report.screenshots.afterSave, fullPage: true });

  const bodyAfterSave = ((await page.textContent('body')) || '').toLowerCase();
  report.checks.guestCanCreateProfileIdentity =
    bodyAfterSave.includes(testName.toLowerCase()) &&
    bodyAfterSave.includes(testEmail.toLowerCase()) &&
    bodyAfterSave.includes('calm explorer');

  await page.goto(`${base}/bandits`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1200);
  await page.goto(`${base}/profile`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: report.screenshots.afterLeaveReturn, fullPage: true });

  const nameLeave = (await page.getByTestId('profile-input-name').inputValue()).trim();
  const emailLeave = (await page.getByTestId('profile-input-email').inputValue()).trim().toLowerCase();
  const vibeLeave = (await page.getByTestId('profile-input-vibe').inputValue()).trim();
  report.checks.savePersistsAfterLeavingAndReturning =
    nameLeave === testName && emailLeave === testEmail.toLowerCase() && vibeLeave === testVibe;

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: report.screenshots.afterFullRefresh, fullPage: true });

  const nameRefresh = (await page.getByTestId('profile-input-name').inputValue()).trim();
  const emailRefresh = (await page.getByTestId('profile-input-email').inputValue()).trim().toLowerCase();
  const vibeRefresh = (await page.getByTestId('profile-input-vibe').inputValue()).trim();
  report.checks.savePersistsAfterFullRefresh =
    nameRefresh === testName && emailRefresh === testEmail.toLowerCase() && vibeRefresh === testVibe;

  report.pass = Object.values(report.checks).every(Boolean) ? 'PASS' : 'FAIL';
} catch (e) {
  report.errors.push(e instanceof Error ? e.message : String(e));
  report.pass = 'FAIL';
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report));
