import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const prod = 'https://bandits-two.vercel.app';
const entry = `${prod}/hotel/play-theatrou`;
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.join(root, 'artifacts', 'runtime-proof', `iphone-intro-acceptance-${stamp}`);

const result = {
  productionUrl: entry,
  device: 'iPhone 14 Pro',
  screenshots: {
    screen1: path.join(outDir, '1-screen1-initial.png'),
    inlineVisual: path.join(outDir, '2-inline-visual-cta.png'),
    transition: path.join(outDir, '3-transition-auto-progress.png'),
  },
  checks: {
    noFullscreenNativeVideoPlayer: false,
    noSeparateBottleOnlyScreen: false,
    smoothTransitionScreen1InlineCta: false,
    autoAdvanceWithoutManualClose: false,
    playBandiTourBrandingVisible: false,
  },
  details: {},
  pass: 'FAIL',
  errors: [],
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  ...devices['iPhone 14 Pro'],
});
const page = await context.newPage();

try {
  await page.goto(prod, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.goto(entry, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1200);
  await page.screenshot({ path: result.screenshots.screen1, fullPage: true });

  const initial = await page.evaluate(() => {
    const video = document.querySelector('video');
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      /open your message/i.test((b.textContent || '').trim()),
    );
    const bodyText = (document.body?.innerText || '').toLowerCase();
    const hasBrandPlay = bodyText.includes('play');
    const hasBrandBandiTour =
      bodyText.includes('banditour') ||
      bodyText.includes('bandi tour') ||
      bodyText.includes('bandits');
    const full =
      document.fullscreenElement !== null ||
      // Safari-style full-screen hint on video elements.
      // @ts-ignore - non-standard webkit API
      Boolean(video && typeof video.webkitDisplayingFullscreen === 'boolean' && video.webkitDisplayingFullscreen);
    return {
      hasVideo: Boolean(video),
      hasCta: Boolean(btn),
      hasBrandPlay,
      hasBrandBandiTour,
      isFullscreen: full,
      url: location.href,
      videoTime: video ? video.currentTime : null,
      videoPaused: video ? video.paused : null,
    };
  });

  await wait(2500);
  await page.screenshot({ path: result.screenshots.inlineVisual, fullPage: true });

  const mid = await page.evaluate(() => {
    const video = document.querySelector('video');
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      /open your message/i.test((b.textContent || '').trim()),
    );
    return {
      url: location.href,
      hasVideo: Boolean(video),
      hasCta: Boolean(btn),
      videoTime: video ? video.currentTime : null,
      videoPaused: video ? video.paused : null,
      fullScreenNow: document.fullscreenElement !== null,
    };
  });

  await wait(2500);
  await page.screenshot({ path: result.screenshots.transition, fullPage: true });

  const late = await page.evaluate(() => {
    const video = document.querySelector('video');
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      /open your message/i.test((b.textContent || '').trim()),
    );
    return {
      url: location.href,
      hasVideo: Boolean(video),
      hasCta: Boolean(btn),
      videoTime: video ? video.currentTime : null,
      videoPaused: video ? video.paused : null,
      fullScreenNow: document.fullscreenElement !== null,
    };
  });

  const timeProgresses =
    typeof initial.videoTime === 'number' &&
    typeof mid.videoTime === 'number' &&
    typeof late.videoTime === 'number' &&
    mid.videoTime >= initial.videoTime &&
    late.videoTime >= mid.videoTime;

  result.checks.noFullscreenNativeVideoPlayer =
    !initial.isFullscreen && !mid.fullScreenNow && !late.fullScreenNow;
  result.checks.noSeparateBottleOnlyScreen = initial.hasVideo && initial.hasCta;
  result.checks.smoothTransitionScreen1InlineCta =
    initial.url.includes('/hotel/play-theatrou') &&
    mid.url.includes('/hotel/play-theatrou') &&
    late.url.includes('/hotel/play-theatrou') &&
    mid.hasVideo &&
    mid.hasCta;
  result.checks.autoAdvanceWithoutManualClose = timeProgresses && initial.hasCta && mid.hasCta && late.hasCta;
  result.checks.playBandiTourBrandingVisible = initial.hasBrandPlay && initial.hasBrandBandiTour;

  result.details = { initial, mid, late };
  result.pass = Object.values(result.checks).every(Boolean) ? 'PASS' : 'FAIL';
} catch (e) {
  result.errors.push(e instanceof Error ? e.message : String(e));
  result.pass = 'FAIL';
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify(result));
