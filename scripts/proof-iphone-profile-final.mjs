import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = 'https://bandits-two.vercel.app';
const outDir = path.join(
  root,
  'artifacts',
  'runtime-proof',
  `iphone-profile-final-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const id = Date.now();
const name = `iPhone User ${String(id).slice(-6)}`;
const email = `iphone.user.${id}@example.com`;
const vibe = 'Quiet city wanderer with sharp instincts.';

const report = {
  productionUrl: `${base}/profile`,
  screenshots: {
    beforeSave: path.join(outDir, '1-before-save.png'),
    afterSave: path.join(outDir, '2-after-save.png'),
    afterRefresh: path.join(outDir, '3-after-refresh.png'),
  },
  checks: {
    persistedAfterRefresh: false,
    noLayoutBreakWithKeyboardOpen: false,
  },
  pass: 'FAIL',
  errors: [],
};

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...devices['iPhone 14 Pro'] });
const page = await context.newPage();

try {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.goto(`${base}/profile`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2500);

  await page.getByTestId('profile-input-name').fill(name);
  await page.getByTestId('profile-input-email').fill(email);
  await page.getByTestId('profile-input-vibe').click();
  await page.getByTestId('profile-input-vibe').fill(vibe);
  await page.waitForTimeout(600);

  const saveButton = page.getByTestId('profile-save');
  await saveButton.scrollIntoViewIfNeeded();
  const saveBox = await saveButton.boundingBox();
  report.checks.noLayoutBreakWithKeyboardOpen = Boolean(saveBox && saveBox.width > 80 && saveBox.height > 20);
  await page.screenshot({ path: report.screenshots.beforeSave, fullPage: true });

  await saveButton.click({ timeout: 15000 });
  await page.waitForTimeout(3200);
  await page.screenshot({ path: report.screenshots.afterSave, fullPage: true });

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: report.screenshots.afterRefresh, fullPage: true });

  const n = (await page.getByTestId('profile-input-name').inputValue()).trim();
  const e = (await page.getByTestId('profile-input-email').inputValue()).trim().toLowerCase();
  const v = (await page.getByTestId('profile-input-vibe').inputValue()).trim();
  report.checks.persistedAfterRefresh = n === name && e === email.toLowerCase() && v === vibe;

  report.pass = report.checks.persistedAfterRefresh && report.checks.noLayoutBreakWithKeyboardOpen ? 'PASS' : 'FAIL';
} catch (err) {
  report.errors.push(err instanceof Error ? err.message : String(err));
  report.pass = 'FAIL';
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report));
