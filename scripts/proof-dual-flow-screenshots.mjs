import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
config({ path: path.join(root, '.env') });
config({ path: path.join(root, '.env.local') });

const { chromium } = await import('playwright');

const base = (process.env.PROOF_BASE || 'http://localhost:8081').replace(/\/$/, '');
const flowLabel = (process.env.PROOF_FLOW_LABEL || 'local').replace(/[^a-z0-9_-]/gi, '-');
const email = process.env.E2E_ADMIN_EMAIL || '';
const password = process.env.E2E_ADMIN_PASSWORD || '';

const outDir = path.join(
  root,
  'artifacts',
  'runtime-proof',
  `dual-flow-${flowLabel}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const result = {
  flow: flowLabel,
  base,
  checks: {
    introFixed: false,
    noWhitePage: false,
    heroBannerRestored: false,
    profileUpdatedVisible: false,
    alertsMenuCorrected: false,
    navigationWorking: false,
  },
  urls: {},
  screenshots: {},
  pass: 'FAIL',
  error: null,
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1365, height: 920 } });
const page = await context.newPage();

try {
  // 1) External guest link first load
  await page.goto(`${base}/hotel/play-theatrou`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2000);
  result.screenshots.introFirstLoad = path.join(outDir, '1-intro-first-load.png');
  await page.screenshot({ path: result.screenshots.introFirstLoad, fullPage: true });

  const introBody = ((await page.textContent('body')) || '').toLowerCase();
  result.checks.introFixed =
    introBody.includes('message in a bottle') || introBody.includes('open your message') || introBody.includes('preparing your welcome');

  // Continue intro
  const openBtn = page.getByRole('button', { name: /open your message/i });
  if (await openBtn.count()) {
    await openBtn.first().click({ timeout: 10000 });
  }
  await wait(4500);
  result.urls.afterIntro = page.url();
  result.screenshots.afterIntroLand = path.join(outDir, '2-after-intro-land.png');
  await page.screenshot({ path: result.screenshots.afterIntroLand, fullPage: true });

  const bodyTextAfterIntro = ((await page.textContent('body')) || '').trim();
  result.checks.noWhitePage = bodyTextAfterIntro.length > 40;

  // 2) Bandits homepage proof (hero/banner)
  await page.goto(`${base}/bandits`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2800);
  result.screenshots.homeBandits = path.join(outDir, '3-home-bandits.png');
  await page.screenshot({ path: result.screenshots.homeBandits, fullPage: true });
  result.checks.heroBannerRestored = (await page.getByTestId('bandits-home-hero').count()) > 0;

  // 3) Sign-in for profile/menu/navigation checks
  await page.goto(`${base}/login?redirect=/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(900);
  if (email && password) {
    const emailInput = page.getByPlaceholder('Enter your email', { exact: true });
    const pwdInput = page.getByPlaceholder('Enter your password', { exact: true });
    const submit = page.getByTestId('email-auth-submit');
    if ((await emailInput.count()) > 0 && (await pwdInput.count()) > 0 && (await submit.count()) > 0) {
      await emailInput.fill(email);
      await pwdInput.fill(password);
      await submit.click();
      await page.waitForTimeout(4500);
    }
  }

  // Menu check
  await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1400);
  result.screenshots.menu = path.join(outDir, '4-menu.png');
  await page.screenshot({ path: result.screenshots.menu, fullPage: true });
  const menuText = ((await page.textContent('body')) || '').toLowerCase();
  result.checks.alertsMenuCorrected = !menuText.includes('\nalerts\n') && !menuText.includes('>alerts<');

  // Profile check
  await page.goto(`${base}/profile`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1800);
  result.screenshots.profile = path.join(outDir, '5-profile.png');
  await page.screenshot({ path: result.screenshots.profile, fullPage: true });
  const profileText = ((await page.textContent('body')) || '').toLowerCase();
  result.checks.profileUpdatedVisible =
    profileText.includes('account snapshot') && profileText.includes('play guest access');

  // Navigation working check: menu -> following -> back to menu
  await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1000);
  await page.goto(`${base}/following`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1200);
  await page.goBack({ timeout: 15000 });
  await wait(1200);
  result.screenshots.navigation = path.join(outDir, '6-navigation.png');
  await page.screenshot({ path: result.screenshots.navigation, fullPage: true });
  result.checks.navigationWorking = page.url().includes('/menu');

  result.pass = Object.values(result.checks).every(Boolean) ? 'PASS' : 'FAIL';
} catch (e) {
  result.error = e instanceof Error ? e.message : String(e);
  result.pass = 'FAIL';
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify({ pass: result.pass, outDir, flow: flowLabel, error: result.error }));

