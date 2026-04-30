import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = process.env.PROFILE_VERIFY_BASE || 'http://localhost:8081';
const outDir = path.join(
  root,
  'artifacts',
  'runtime-proof',
  `play-home-route-now-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const result = {
  routeAfterIntroButton: '',
  routeAfterRefresh: '',
  screenshots: {
    afterIntroButtonHome: path.join(outDir, 'after-intro-button-home.png'),
    refreshReturningHome: path.join(outDir, 'refresh-returning-home.png'),
  },
  pass: 'FAIL',
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

  await page.goto(`${base}/hotel/play-theatrou`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2200);
  await page.getByRole('button', { name: /Open your message/i }).click({ timeout: 10000 });
  await wait(5000);
  result.routeAfterIntroButton = page.url();
  await page.screenshot({ path: result.screenshots.afterIntroButtonHome, fullPage: true });

  await page.goto(`${base}/hotel/play-theatrou`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(4000);
  result.routeAfterRefresh = page.url();
  await page.screenshot({ path: result.screenshots.refreshReturningHome, fullPage: true });

  result.pass =
    result.routeAfterIntroButton.includes('/bandits') && result.routeAfterRefresh.includes('/bandits')
      ? 'PASS'
      : 'FAIL';
} catch {
  result.pass = 'FAIL';
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify(result));
