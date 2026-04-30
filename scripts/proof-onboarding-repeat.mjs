import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = process.env.PROFILE_VERIFY_BASE || 'http://localhost:8081';
const outDir = path.join(root, 'artifacts', 'runtime-proof', `onboarding-repeat-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`);

const report = {
  pass: 'FAIL',
  outDir,
  firstVisitShowsOnboarding: false,
  secondVisitSkipsOnboarding: false,
  screenshots: {
    firstVisit: path.join(outDir, '1-first-visit-onboarding.png'),
    secondVisit: path.join(outDir, '2-second-visit-home.png'),
  },
  details: {},
  errors: [],
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

try {
  await mkdir(outDir, { recursive: true });
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // First visit: must show onboarding (not Home yet)
  await page.goto(`${base}/hotel/play-theatrou`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2000);
  const firstUrl = page.url();
  const firstBody = await page.textContent('body');
  const firstLooksLikeOnboarding =
    firstUrl.includes('/hotel/play-theatrou') &&
    /Start|Enter Experience|Tap to continue|No app needed/i.test(String(firstBody || ''));
  report.firstVisitShowsOnboarding = firstLooksLikeOnboarding;
  report.details.firstUrl = firstUrl;
  await page.screenshot({ path: report.screenshots.firstVisit, fullPage: true });

  // Mark onboarding done through the same route tree used by product flow.
  await page.goto(`${base}/hotel/play-theatrou/experience`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2000);

  // Second visit: should skip onboarding and land Home.
  await page.goto(`${base}/hotel/play-theatrou`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2000);
  const secondUrl = page.url();
  report.secondVisitSkipsOnboarding = secondUrl.includes('/bandits');
  report.details.secondUrl = secondUrl;
  report.details.doneStorage = await page.evaluate(() => ({
    sessionStage: sessionStorage.getItem('pwa_play_theatrou_stage_v1'),
    localDone: localStorage.getItem('pwa_play_theatrou_done_v1'),
  }));
  await page.screenshot({ path: report.screenshots.secondVisit, fullPage: true });

  report.pass = report.firstVisitShowsOnboarding && report.secondVisitSkipsOnboarding ? 'PASS' : 'FAIL';
} catch (e) {
  report.errors.push(e instanceof Error ? e.message : String(e));
  report.pass = 'FAIL';
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report));
