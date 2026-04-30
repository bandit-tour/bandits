import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = 'https://bandits-two.vercel.app';
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.join(root, 'artifacts', 'runtime-proof', `prod-profile-edit-${stamp}`);

const testName = `Proof User ${Date.now().toString().slice(-6)}`;
const testEmail = `proof.user.${Date.now()}@example.com`;
const testVibe = 'Night walker. Local story collector.';

const report = {
  url: `${base}/profile`,
  screenshots: {
    editFields: path.join(outDir, '1-profile-edit-fields.png'),
    afterSave: path.join(outDir, '2-profile-after-save.png'),
    afterRefresh: path.join(outDir, '3-profile-after-refresh.png'),
    menuRegularUser: path.join(outDir, '4-menu-regular-user.png'),
  },
  checks: {
    savePersistsAfterRefresh: false,
    regularUserCannotSeePilotDesk: false,
    headerUpdatedAfterSave: false,
  },
  values: {
    name: testName,
    email: testEmail,
    vibe: testVibe,
  },
  pass: 'FAIL',
  errors: [],
};

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

page.on('dialog', async (dialog) => {
  await dialog.dismiss().catch(() => null);
});

try {
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.goto(`${base}/profile`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(3500);

  await page.getByTestId('profile-input-name').fill(testName);
  await page.getByTestId('profile-input-email').fill(testEmail);
  await page.getByTestId('profile-input-vibe').fill(testVibe);
  await page.screenshot({ path: report.screenshots.editFields, fullPage: true });

  const saveBtn = page.getByTestId('profile-save');
  await saveBtn.click({ timeout: 15000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: report.screenshots.afterSave, fullPage: true });

  const headerText = ((await page.textContent('body')) || '').toLowerCase();
  report.checks.headerUpdatedAfterSave =
    headerText.includes(testName.toLowerCase()) &&
    headerText.includes(testEmail.toLowerCase()) &&
    headerText.includes('night walker');

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: report.screenshots.afterRefresh, fullPage: true });

  const refreshedName = await page.getByTestId('profile-input-name').inputValue();
  const refreshedEmail = await page.getByTestId('profile-input-email').inputValue();
  const refreshedVibe = await page.getByTestId('profile-input-vibe').inputValue();

  report.checks.savePersistsAfterRefresh =
    refreshedName.trim() === testName &&
    refreshedEmail.trim().toLowerCase() === testEmail.toLowerCase() &&
    refreshedVibe.trim() === testVibe;

  await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: report.screenshots.menuRegularUser, fullPage: true });
  const menuBody = (await page.textContent('body')) || '';
  report.checks.regularUserCannotSeePilotDesk = !/Pilot Desk/i.test(menuBody);

  report.pass = Object.values(report.checks).every(Boolean) ? 'PASS' : 'FAIL';
} catch (e) {
  report.errors.push(e instanceof Error ? e.message : String(e));
  report.pass = 'FAIL';
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report));
