/**
 * Production evidence capture — no code report; images only for operator review.
 * Run: node scripts/prod-evidence-snap.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUT = join(ROOT, 'artifacts', 'prod-evidence', STAMP);
const PROD = 'https://bandits-two.vercel.app';
const GUEST = `${PROD}/hotel/play-theatrou`;

async function clearPwaState(page) {
  await page.goto(`${PROD}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    try {
      localStorage.removeItem('pwa_play_theatrou_done_v1');
      localStorage.removeItem('pwa_play_theatrou_stage_v1');
      sessionStorage.removeItem('pwa_play_theatrou_stage_v1');
      localStorage.removeItem('@bandits_aluma_onboarding_done_v1');
    } catch (e) {
      /* */
    }
  });
}

async function runDesktop() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const shots = [];
  const shot = async (name) => {
    const p = join(OUT, `${name}.png`);
    await page.screenshot({ path: p, fullPage: true });
    shots.push(p);
  };
  try {
    await clearPwaState(page);
    await page.goto(GUEST, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(2000);
    await shot('01-opening-step1');
    const flip = page.getByRole('button', { name: 'Flip' });
    if (await flip.isVisible()) await flip.click();
    await page.waitForTimeout(500);
    await shot('02-opening-step2');
    const explore = page.getByRole('button', { name: /Explore the City|Opening/i });
    if (await explore.isVisible()) await explore.click();
    await page.waitForURL(/bandits|\/$/, { timeout: 120000 });
    await page.waitForTimeout(2000);
    await shot('03-home-bandits');
    await page.goto(`${PROD}/profile`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await shot('04-profile');
    for (const path of ['/inbox', '/alerts', '/scam-alerts']) {
      await page.goto(`${PROD}${path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      const id = path.replace(/^\//, '').replace(/\//g, '-');
      await shot(`05-${id || 'index'}`);
    }
    // Avatar upload: attach tiny PNG to hidden input if present
    await page.goto(`${PROD}/profile`, { waitUntil: 'networkidle' });
    const buf = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const fileInput = page.getByTestId('profile-avatar-file');
    if (await fileInput.count()) {
      await fileInput.setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: buf });
      await page.waitForTimeout(5000);
      await shot('06-avatar-after-upload-attempt');
    } else {
      await shot('06-avatar-file-input-missing');
    }
  } finally {
    await browser.close();
  }
  return OUT;
}

const main = async () => {
  await mkdir(OUT, { recursive: true });
  await runDesktop();
  {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({
      ...devices['iPhone 14 Pro'],
    });
    const p = await ctx.newPage();
    try {
      await p.goto(`${PROD}/`, { waitUntil: 'domcontentloaded' });
      await p.evaluate(() => {
        try {
          localStorage.removeItem('pwa_play_theatrou_done_v1');
          localStorage.removeItem('pwa_play_theatrou_stage_v1');
        } catch (e) {
          /* */
        }
      });
      await p.goto(GUEST, { waitUntil: 'networkidle', timeout: 120000 });
      await p.waitForTimeout(2000);
      await p.screenshot({ path: join(OUT, '07-iphone-14-pro-intro.png'), fullPage: true });
      await p.goto(`${PROD}/bandits`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(1500);
      await p.screenshot({ path: join(OUT, '07-iphone-14-pro-home.png'), fullPage: true });
    } finally {
      await browser.close();
    }
  }
  {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({
      ...devices['Pixel 7'],
    });
    const p = await ctx.newPage();
    try {
      await p.goto(`${PROD}/`, { waitUntil: 'domcontentloaded' });
      await p.evaluate(() => {
        try {
          localStorage.removeItem('pwa_play_theatrou_done_v1');
          localStorage.removeItem('pwa_play_theatrou_stage_v1');
        } catch (e) {
          /* */
        }
      });
      await p.goto(GUEST, { waitUntil: 'networkidle', timeout: 120000 });
      await p.waitForTimeout(2000);
      await p.screenshot({ path: join(OUT, '08-pixel-7-intro.png'), fullPage: true });
      await p.goto(`${PROD}/bandits`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(1500);
      await p.screenshot({ path: join(OUT, '08-pixel-7-home.png'), fullPage: true });
    } finally {
      await browser.close();
    }
  }
  const summary = {
    productionAlias: 'https://bandits-two.vercel.app',
    deployment: 'dpl_A6MpmWmQvnBYY3vpwk4rK86Xa2Hn',
    guestEntry: GUEST,
    evidenceFolder: OUT,
  };
  await writeFile(join(OUT, 'SUMMARY.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
