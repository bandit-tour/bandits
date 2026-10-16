/**
 * Journey detail — Cape Sea House sample. Hotel vs second stay, no sample sale.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = process.env.RUNTIME_BASE_URL || 'http://localhost:8082';
const out = path.join(root, 'artifacts', 'runtime-proof', 'journey-detail');
const url = `${base}/journey/match_beach?hotelNights=3&hotelSlug=play-theatrou`;

async function shot(page, name) {
  await fs.mkdir(out, { recursive: true });
  await page.screenshot({ path: path.join(out, name), fullPage: true });
}

async function audit(page, label) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByTestId('journey-detail').waitFor({ timeout: 20000 });
  await page.waitForTimeout(2500);
  await shot(page, `${label}-page.png`);
  const body = await page.locator('body').innerText();
  const hotelImgs = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="journey-hotel-gallery"]');
    if (!root) return [];
    return [...root.querySelectorAll('img')].map((el) => el.getAttribute('src') || '');
  });
  const secondImgs = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="journey-second-gallery"]');
    if (!root) return [];
    return [...root.querySelectorAll('img')].map((el) => el.getAttribute('src') || '');
  });
  const checks = {
    twoStays: /One journey. Two ways to stay/i.test(body) && /First hotel/i.test(body) && /Second stay/i.test(body) && /Cape Sea House/i.test(body),
    sampleLocked: /Sample paired journey/i.test(body) && /Booking stays off for sample journeys/i.test(body),
    noSampleBookButton: (await page.getByTestId('journey-book-cta').count()) === 0,
    noOperatorForm: !/Stay type/i.test(body) && !/\bHost\b/.test(body),
    noBottleCopy: !/message in a bottle has arrived/i.test(body),
    hotelOwned:
      hotelImgs.length > 0 &&
      hotelImgs.every((s) => /play-theatrou|play_athens_bg/i.test(s)) &&
      !hotelImgs.some((s) => /unsplash|aluma|nyx/i.test(s)),
    secondSeparate:
      secondImgs.length > 0 &&
      secondImgs.every((s) => /unsplash/i.test(s)) &&
      !secondImgs.some((s) => /play-theatrou|aluma/i.test(s)),
  };
  await page.getByTestId('journey-hotel-gallery-hero').click();
  await page.getByTestId('journey-lightbox').waitFor({ timeout: 8000 });
  await shot(page, `${label}-lightbox.png`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  checks.lightboxCloses = (await page.getByTestId('journey-lightbox').count()) === 0;
  await page.getByTestId('journey-dates-cta').click();
  await page.waitForTimeout(800);
  const after = await page.locator('body').innerText();
  checks.availabilityHonest = /not in live inventory|cannot be reserved|Sample preview/i.test(after);
  return { checks, hotelImgs, secondImgs };
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const m = await audit(mobile, 'mobile');
  const d = await audit(desktop, 'desktop');
  const failed = [];
  for (const [name, pack] of [['mobile', m], ['desktop', d]]) {
    for (const [k, v] of Object.entries(pack.checks)) if (!v) failed.push(`${name}.${k}`);
  }
  const report = { pass: failed.length === 0, failed, mobile: m, desktop: d };
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pass: report.pass, failed, hotel: m.hotelImgs, second: m.secondImgs.length }, null, 2));
  await browser.close();
  if (!report.pass) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
