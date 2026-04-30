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
  `bottle-video-proof-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const result = {
  outDir,
  codePathPlayIntro: "app/hotel/PlayTheatrouHotelIntro.tsx -> require('@/assets/images/local-friend-bottle.mov')",
  codePathSubmitReport: "app/bandiTeam/report.tsx -> LocalFriendBottleHero -> require('@/assets/images/local-friend-bottle.mov')",
  checks: {
    playIntroVideoPlaying: false,
    submitReportVideoPlaying: false,
  },
  screenshots: {
    playIntro: path.join(outDir, '1-play-intro-video.png'),
    submitReport: path.join(outDir, '2-submit-report-video.png'),
  },
  pass: 'FAIL',
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

  await page.goto(`${base}/hotel/play-athens`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2500);
  result.checks.playIntroVideoPlaying = await page.evaluate(() => {
    const v = document.querySelector('video');
    return Boolean(v && !v.paused && !v.ended && v.currentTime > 0);
  });
  await page.screenshot({ path: result.screenshots.playIntro, fullPage: true });

  await page.goto(`${base}/bandiTeam/report`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2500);
  result.checks.submitReportVideoPlaying = await page.evaluate(() => {
    const v = document.querySelector('video');
    return Boolean(v && !v.paused && !v.ended && v.currentTime > 0);
  });
  await page.screenshot({ path: result.screenshots.submitReport, fullPage: true });

  result.pass = result.checks.playIntroVideoPlaying && result.checks.submitReportVideoPlaying ? 'PASS' : 'FAIL';
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify(result));
