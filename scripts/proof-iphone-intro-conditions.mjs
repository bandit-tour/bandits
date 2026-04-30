import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const prod = 'https://bandits-two.vercel.app';
const guest = `${prod}/hotel/play-theatrou`;
const outDir = path.join(
  root,
  'artifacts',
  'runtime-proof',
  `iphone-intro-conditions-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const result = {
  item: 1,
  productionUrl: guest,
  device: 'iPhone 14 Pro',
  screenshots: {
    screen1: path.join(outDir, '1-screen1.png'),
    inlineVisualCta: path.join(outDir, '2-inline-visual-cta.png'),
    autoProgressNoClose: path.join(outDir, '3-auto-progress-no-close.png'),
  },
  checks: {
    noSeparateBottleOnlyScreen: false,
    smoothTransitionScreen1InlineVisualCta: false,
    autoAdvanceWithoutManualClose: false,
  },
  evidence: {},
  pass: 'FAIL',
  errors: [],
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...devices['iPhone 14 Pro'] });
const page = await context.newPage();

try {
  await page.goto(prod, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(() => {
    localStorage.removeItem('pwa_play_theatrou_done_v1');
    localStorage.removeItem('pwa_play_theatrou_stage_v1');
    sessionStorage.removeItem('pwa_play_theatrou_stage_v1');
    localStorage.removeItem('@bandits_aluma_onboarding_done_v1');
  });

  await page.goto(guest, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: result.screenshots.screen1, fullPage: true });

  const s1 = await page.evaluate(() => {
    const body = (document.body?.innerText || '').toLowerCase();
    const flipButton = Array.from(document.querySelectorAll('button,[role="button"]')).find((el) =>
      /flip/i.test((el.textContent || '').trim()),
    );
    const hasMessage = body.includes('message in a bottle');
    const hasExplore = body.includes('explore the city');
    const hasFlip = body.includes('flip');
    return {
      url: location.href,
      hasFlipButton: Boolean(flipButton),
      hasMessage,
      hasExplore,
      hasFlip,
      fullscreen: document.fullscreenElement !== null,
    };
  });

  await page.waitForTimeout(2300);
  await page.screenshot({ path: result.screenshots.inlineVisualCta, fullPage: true });

  const s2 = await page.evaluate(() => {
    const body = (document.body?.innerText || '').toLowerCase();
    const ctaBtn = Array.from(document.querySelectorAll('button,[role="button"]')).find((el) =>
      /explore the city/i.test((el.textContent || '').trim()),
    );
    const closeBtn = Array.from(document.querySelectorAll('button,[role="button"]')).find((el) => {
      const t = (el.textContent || '').trim().toLowerCase();
      return t === 'close' || t === 'dismiss' || t === 'done';
    });
    const video = document.querySelector('video');
    return {
      url: location.href,
      hasExploreButton: Boolean(ctaBtn),
      hasCloseButton: Boolean(closeBtn),
      hasVideo: Boolean(video),
      videoTime: video ? video.currentTime : null,
      videoPaused: video ? video.paused : null,
      fullscreen:
        document.fullscreenElement !== null ||
        // @ts-ignore non-standard Safari web video property
        Boolean(video && typeof video.webkitDisplayingFullscreen === 'boolean' && video.webkitDisplayingFullscreen),
      hasMessageCopy: body.includes('message in a bottle'),
      hasFlipCopy: body.includes('flip'),
    };
  });

  await wait(2500);
  await page.screenshot({ path: result.screenshots.autoProgressNoClose, fullPage: true });

  const s3 = await page.evaluate(() => {
    const ctaBtn = Array.from(document.querySelectorAll('button,[role="button"]')).find((el) =>
      /explore the city/i.test((el.textContent || '').trim()),
    );
    const video = document.querySelector('video');
    return {
      url: location.href,
      hasExploreButton: Boolean(ctaBtn),
      hasVideo: Boolean(video),
      videoTime: video ? video.currentTime : null,
      videoPaused: video ? video.paused : null,
      fullscreen:
        document.fullscreenElement !== null ||
        // @ts-ignore non-standard Safari web video property
        Boolean(video && typeof video.webkitDisplayingFullscreen === 'boolean' && video.webkitDisplayingFullscreen),
    };
  });

  result.checks.noSeparateBottleOnlyScreen =
    !s1.hasFlipButton && !s1.hasFlip && !s2.hasFlipCopy && !s3.fullscreen;
  result.checks.smoothTransitionScreen1InlineVisualCta =
    s1.hasMessage && !s1.hasExplore && s2.hasMessageCopy && s2.hasExploreButton && s1.url === s2.url;
  result.checks.autoAdvanceWithoutManualClose = !s2.hasCloseButton && s3.hasExploreButton && s1.url === s3.url;

  result.evidence = { screen1: s1, inline: s2, progressed: s3 };
  result.pass = Object.values(result.checks).every(Boolean) ? 'PASS' : 'FAIL';
} catch (e) {
  result.errors.push(e instanceof Error ? e.message : String(e));
  result.pass = 'FAIL';
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify(result));
