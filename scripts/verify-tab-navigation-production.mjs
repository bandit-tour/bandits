/**
 * Production web smoke: tab shell + Home reset (iPhone + Android viewports).
 * RUNTIME_BASE_URL=https://bandits-two.vercel.app node scripts/verify-tab-navigation-production.mjs
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
  `tab-nav-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const result = { base, platforms: {}, pass: false };

async function clickNav(page, label) {
  const btn = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first();
  await btn.waitFor({ state: 'visible', timeout: 20000 });
  await btn.click();
  await page.waitForTimeout(1200);
}

async function runViewport(name, contextOptions) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const checks = {};

  try {
    await page.goto(`${base}/bandits`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(2000);
    checks.coldLaunchHome = page.url().includes('/bandits');

    await clickNav(page, 'Notifications');
    checks.notifications = page.url().includes('/notifications');

    await clickNav(page, 'Home');
    await page.waitForTimeout(800);
    checks.homeFromNotifications =
      page.url().includes('/bandits') &&
      (await page.getByRole('tab', { name: /Local banDits/i }).isVisible().catch(() => false));

    await clickNav(page, 'Menu');
    checks.menu = page.url().includes('/menu');

    await clickNav(page, 'Home');
    checks.homeFromMenu = page.url().includes('/bandits');

    await page.goto(`${base}/bottle`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(3000);
    checks.bottleLoads = ((await page.textContent('body')) || '').length > 80;

    await fs.mkdir(outDir, { recursive: true });
    await page.screenshot({ path: path.join(outDir, `${name}-after-home.png`), fullPage: true });

    checks.pass = Object.values(checks).every(Boolean);
    result.platforms[name] = checks;
  } catch (e) {
    result.platforms[name] = { pass: false, error: String(e?.message || e) };
  } finally {
    await browser.close();
  }
}

async function main() {
  await runViewport('iphone', devices['iPhone 13']);
  await runViewport('android', devices['Pixel 5']);
  result.pass = Object.values(result.platforms).every((p) => p.pass);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.pass ? 0 : 1);
}

void main();
