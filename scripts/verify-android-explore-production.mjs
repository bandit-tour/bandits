/**
 * Android viewport smoke: Explore tab responsiveness + map toggle + bottom nav.
 * RUNTIME_BASE_URL=https://bandits-two.vercel.app node scripts/verify-android-explore-production.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const base = (process.env.RUNTIME_BASE_URL || 'https://bandits-two.vercel.app').replace(/\/$/, '');
const outDir = path.join(
  __dirname,
  '..',
  'artifacts',
  'runtime-proof',
  `android-explore-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const result = { base, checks: {}, pass: false };

async function clickBtn(page, label) {
  const btn = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first();
  await btn.waitFor({ state: 'visible', timeout: 20000 });
  const t0 = Date.now();
  await btn.click();
  await page.waitForTimeout(600);
  return Date.now() - t0;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(devices['Pixel 5']);
  const page = await context.newPage();

  try {
    await page.goto(`${base}/explore`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(2500);
    result.checks.exploreLoads = page.url().includes('/explore');

    const upperExplore = page.getByRole('tab', { name: /Explore/i });
    result.checks.upperExploreVisible = await upperExplore.isVisible().catch(() => false);

    const homeMs = await clickBtn(page, 'Home');
    result.checks.homeResponsive = page.url().includes('/bandits') && homeMs < 3000;

    await clickBtn(page, 'Home');
    await page.getByRole('tab', { name: /Explore/i }).click();
    await page.waitForTimeout(800);
    result.checks.upperTabExplore = page.url().includes('/explore');

    const mapBtn = page.getByRole('button', { name: /^Map$/i });
    const mapT0 = Date.now();
    await mapBtn.click();
    await page.waitForTimeout(1200);
    result.checks.mapToggleMs = Date.now() - mapT0;
    result.checks.mapToggleUnder2s = result.checks.mapToggleMs < 2000;

    const foodChip = page.getByRole('button', { name: /Filter by Food/i });
    await foodChip.click();
    await page.waitForTimeout(400);
    result.checks.foodChipTapped = true;

    await clickBtn(page, 'Menu');
    result.checks.menuFromExplore = page.url().includes('/menu');

    await fs.mkdir(outDir, { recursive: true });
    await page.screenshot({ path: path.join(outDir, 'android-explore.png'), fullPage: true });

    result.pass =
      result.checks.exploreLoads &&
      result.checks.homeResponsive &&
      result.checks.upperTabExplore &&
      result.checks.mapToggleUnder2s &&
      result.checks.menuFromExplore;
  } catch (e) {
    result.error = String(e?.message || e);
    result.pass = false;
  } finally {
    await browser.close();
  }

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.pass ? 0 : 1);
}

void main();
