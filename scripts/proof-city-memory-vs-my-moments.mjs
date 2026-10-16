/**
 * Owner correction — City Memory and My Moments stay separate products.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const base = process.env.RUNTIME_BASE_URL || 'http://localhost:8082';
const out = path.join(root, 'artifacts', 'runtime-proof', 'city-memory-vs-my-moments');

async function shot(page, name) {
  await fs.mkdir(out, { recursive: true });
  await page.screenshot({ path: path.join(out, name), fullPage: true });
  return `artifacts/runtime-proof/city-memory-vs-my-moments/${name}`;
}

async function run() {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const checks = {};

  await page.goto(`${base}/cityMemory`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2500);
  const cityShot = await shot(page, '01-city-memory.png');
  const city = await page.locator('body').innerText();
  checks.cityIsVisualJournal =
    /City Memory|Add a Memory|Memories|My Places|My People|My Journeys/i.test(city) &&
    !/Shuffle inspiration|Eligible for bottle discovery/i.test(city);
  checks.cityNotPhotoScrapbookAsMyMoments = !/My Moments create personal memories/i.test(city);

  await page.goto(`${base}/myMoment`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2500);
  const momentShot = await shot(page, '02-my-moments.png');
  const moment = await page.locator('body').innerText();
  checks.myMomentsIsText =
    (/Write my own|Shuffle inspiration|Change Moment|bottle discovery|Eligible for bottle|Private today/i.test(
      moment,
    ) ||
      /TextInput|Your Moment|Today/i.test(moment)) &&
    !/Add a Memory|Photos, video, story, place and date/i.test(moment);
  checks.myMomentsHasBottleOptIn =
    /bottle discovery|Eligible for bottle|not in Bottle|Private today/i.test(moment);

  await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.getByText('My Moments', { exact: true }).first().click();
  await page.waitForTimeout(2000);
  const menuMomentUrl = page.url();
  checks.menuMyMomentsRoutesToMyMoment = /myMoment/i.test(menuMomentUrl);

  await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1200);
  await page.getByText('City Memory', { exact: true }).first().click();
  await page.waitForTimeout(2000);
  const menuCityUrl = page.url();
  checks.menuCityMemoryRoutesToCityMemory = /cityMemory/i.test(menuCityUrl);

  await page.goto(`${base}/bandits`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2000);
  const home = await page.locator('body').innerText();
  checks.homeKeepsBothPrompts =
    /Open City Memory|Start City Memory/i.test(home) && /Open My Moments|My Moments/i.test(home);

  await page.goto(`${base}/travelBottle`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(1500);
  const bottle = await page.locator('body').innerText();
  checks.travelInABottleSeparate =
    /Travel in a Bottle|Mix|Sleep|hotel/i.test(bottle) &&
    !/Eligible for bottle discovery today/i.test(bottle);

  const failed = Object.entries(checks)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  const report = {
    pass: failed.length === 0,
    failed,
    checks,
    shots: { cityShot, momentShot },
  };
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (!report.pass) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
