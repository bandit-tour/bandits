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
  `iphone-nav-regression-fix-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const badTexts = ["let's keep going", 'something interrupted this screen', 'continue'];

const report = {
  productionUrl: base,
  screenshots: {
    menu: path.join(outDir, '1-menu-restored.png'),
    profile: path.join(outDir, '2-profile-open-normal.png'),
    home: path.join(outDir, '3-home.png'),
    inbox: path.join(outDir, '4-inbox.png'),
  },
  checks: {
    homeNormal: false,
    menuNormal: false,
    profileNormal: false,
    inboxNormal: false,
    noInterruptionScreenInStandardFlow: false,
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

  const containsInterruption = async () => {
    const body = ((await page.textContent('body')) || '').toLowerCase();
    return badTexts.every((t) => body.includes(t));
  };

  await page.goto(`${base}/bandits`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: report.screenshots.home, fullPage: true });
  report.checks.homeNormal = page.url().includes('/bandits') && !(await containsInterruption());

  await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: report.screenshots.menu, fullPage: true });
  report.checks.menuNormal = page.url().includes('/menu') && !(await containsInterruption());

  await page.goto(`${base}/profile`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: report.screenshots.profile, fullPage: true });
  report.checks.profileNormal = page.url().includes('/profile') && !(await containsInterruption());

  await page.goto(`${base}/inbox`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: report.screenshots.inbox, fullPage: true });
  report.checks.inboxNormal = page.url().includes('/inbox') && !(await containsInterruption());

  report.checks.noInterruptionScreenInStandardFlow =
    report.checks.homeNormal &&
    report.checks.menuNormal &&
    report.checks.profileNormal &&
    report.checks.inboxNormal;

  report.pass = report.checks.noInterruptionScreenInStandardFlow ? 'PASS' : 'FAIL';
} catch (e) {
  report.errors.push(e instanceof Error ? e.message : String(e));
  report.pass = 'FAIL';
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report));
