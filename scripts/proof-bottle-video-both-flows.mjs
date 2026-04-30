import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = process.env.PROFILE_VERIFY_BASE || 'http://localhost:8081';
const email = process.env.PLAY_OPERATOR_EMAIL || process.env.E2E_ADMIN_EMAIL || 'blonje@gmail.com';
const password = process.env.PLAY_OPERATOR_PASSWORD || process.env.E2E_ADMIN_PASSWORD || '121275';
const outDir = path.join(
  root,
  'artifacts',
  'runtime-proof',
  `bottle-video-both-flows-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const result = {
  outDir,
  filePathConfirmed: '@/assets/images/local-friend-bottle.mov',
  checks: {
    playIntroShowsVideo: false,
    submitReportSuccessShowsVideo: false,
  },
  screenshots: {
    playIntro: path.join(outDir, '1-play-intro-video.png'),
    submitReportSuccess: path.join(outDir, '2-submit-report-success-video.png'),
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

  // PLAY intro proof
  await page.goto(`${base}/hotel/play-athens`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2500);
  result.checks.playIntroShowsVideo = await page.evaluate(() => {
    const v = document.querySelector('video');
    return Boolean(v && !v.paused && !v.ended && v.currentTime > 0);
  });
  await page.screenshot({ path: result.screenshots.playIntro, fullPage: true });

  // Sign in for report submission
  await page.goto(`${base}/login?redirect=/bandiTeam/report`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(900);
  await page.fill('input[placeholder="Enter your email"]', email);
  await page.fill('input[placeholder="Enter your password"]', password);
  await page.getByTestId('email-auth-submit').click({ timeout: 10000 });
  await page.waitForURL('**/bandiTeam/report', { timeout: 30000 });
  await wait(1500);

  // Fill required fields and submit
  await page.getByRole('button', { name: /Select city/i }).click({ timeout: 10000 });
  await page.getByText('Athens', { exact: true }).first().click({ timeout: 10000 });
  await page.fill('input[placeholder="Required if no area is listed above"]', 'Monastiraki');
  await page.fill('input[placeholder="Short warning title"]', 'Runtime proof test');
  await page.fill('textarea[placeholder="Describe what happened"]', 'Runtime proof test description');
  await page.getByTestId('banditeam-report-submit').click({ timeout: 10000 });
  await wait(2200);

  result.checks.submitReportSuccessShowsVideo = await page.evaluate(() => {
    const v = document.querySelector('video');
    return Boolean(v && !v.paused && !v.ended && v.currentTime > 0);
  });
  await page.screenshot({ path: result.screenshots.submitReportSuccess, fullPage: true });

  result.pass = result.checks.playIntroShowsVideo && result.checks.submitReportSuccessShowsVideo ? 'PASS' : 'FAIL';
} catch (e) {
  result.errors.push(e instanceof Error ? e.message : String(e));
  result.pass = 'FAIL';
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify(result));
