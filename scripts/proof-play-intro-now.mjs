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
  `play-intro-now-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const result = {
  outDir,
  routeUsed: `${base}/hotel/play-theatrou`,
  screenshots: {
    firstTimeIntro: path.join(outDir, '1-first-time-intro.png'),
    afterButtonHome: path.join(outDir, '2-after-button-home.png'),
    refreshReturningHome: path.join(outDir, '3-refresh-returning-home.png'),
  },
  checks: {
    firstTimeIntroVisible: false,
    bottleVideoPlaying: false,
    firstTimeButtonToHome: false,
    returningSkipToHome: false,
  },
  consoleErrors: [],
  pass: 'FAIL',
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } }); // incognito context
const page = await context.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') {
    result.consoleErrors.push(msg.text());
  }
});
page.on('pageerror', (err) => {
  result.consoleErrors.push(String(err?.message || err));
});

try {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.goto(`${base}/hotel/play-theatrou`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2500);

  const introCheck = await page.evaluate(() => {
    const body = document.body?.innerText || '';
    const hasCopy =
      body.includes('MESSAGE IN A BOTTLE') &&
      body.includes('A message in a bottle has arrived for you.') &&
      body.includes('Open your message');
    const video = document.querySelector('video');
    const playing = Boolean(video && !video.paused && !video.ended && video.currentTime > 0);
    return { hasCopy, playing };
  });
  result.checks.firstTimeIntroVisible = introCheck.hasCopy;
  result.checks.bottleVideoPlaying = introCheck.playing;
  await page.screenshot({ path: result.screenshots.firstTimeIntro, fullPage: true });

  await page.getByRole('button', { name: /Open your message/i }).click({ timeout: 10000 });
  await page.waitForURL('**/bandits', { timeout: 30000 });
  await wait(1200);
  result.checks.firstTimeButtonToHome = page.url().includes('/bandits');
  await page.screenshot({ path: result.screenshots.afterButtonHome, fullPage: true });

  await page.goto(`${base}/hotel/play-theatrou`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2200);
  result.checks.returningSkipToHome = page.url().includes('/bandits');
  await page.screenshot({ path: result.screenshots.refreshReturningHome, fullPage: true });

  result.pass =
    result.checks.firstTimeIntroVisible &&
    result.checks.bottleVideoPlaying &&
    result.checks.firstTimeButtonToHome &&
    result.checks.returningSkipToHome &&
    result.consoleErrors.length === 0
      ? 'PASS'
      : 'FAIL';
} catch (e) {
  result.consoleErrors.push(e instanceof Error ? e.message : String(e));
  result.pass = 'FAIL';
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify(result));
