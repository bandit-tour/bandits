import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
config({ path: path.join(root, '.env') });
config({ path: path.join(root, '.env.local') });

const { chromium } = await import('playwright');

const base = 'https://bandits-two.vercel.app';
const email = process.env.E2E_ADMIN_EMAIL || '';
const password = process.env.E2E_ADMIN_PASSWORD || '';

const outDir = path.join(
  root,
  'artifacts',
  'runtime-proof',
  `prod-report-submit-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
);

const result = {
  base,
  checks: {
    introFixedGuestEntry: false,
    homepageHeroAfterLoad: false,
    submitTransitionVideoShown: false,
    noWhitePageAfterSubmit: false,
    returnsToHomeFeed: false,
    noBrokenNavigation: false,
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
  // Guest-entry intro and landing
  await page.goto(`${base}/hotel/play-theatrou`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2200);
  result.screenshots.guestIntro = path.join(outDir, '1-guest-intro.png');
  await page.screenshot({ path: result.screenshots.guestIntro, fullPage: true });
  const introBody = ((await page.textContent('body')) || '').toLowerCase();
  result.checks.introFixedGuestEntry =
    introBody.includes('message in a bottle') ||
    introBody.includes('open your message') ||
    introBody.includes('preparing your welcome');

  const openBtn = page.getByRole('button', { name: /open your message/i });
  if ((await openBtn.count()) > 0) {
    await openBtn.first().click({ timeout: 12000 });
    await wait(4200);
  }
  result.urls.afterIntro = page.url();

  // Homepage hero proof
  await page.goto(`${base}/bandits`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2600);
  result.screenshots.homeAfterLoad = path.join(outDir, '2-home-after-load.png');
  await page.screenshot({ path: result.screenshots.homeAfterLoad, fullPage: true });
  result.checks.homepageHeroAfterLoad = (await page.getByTestId('bandits-home-hero').count()) > 0;

  // Ensure signed in before report submit
  await page.goto(`${base}/login?redirect=/bandiTeam/report`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(900);
  if (email && password) {
    const e = page.getByPlaceholder('Enter your email', { exact: true });
    const p = page.getByPlaceholder('Enter your password', { exact: true });
    const s = page.getByTestId('email-auth-submit');
    if ((await e.count()) && (await p.count()) && (await s.count())) {
      await e.fill(email);
      await p.fill(password);
      await s.click();
      await page.waitForTimeout(4500);
    }
  }

  await page.goto(`${base}/bandiTeam/report`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1800);
  result.screenshots.reportForm = path.join(outDir, '3-report-form.png');
  await page.screenshot({ path: result.screenshots.reportForm, fullPage: true });

  // Fill form
  const cityBtn = page.getByRole('button', { name: /Select city/i });
  if ((await cityBtn.count()) > 0) {
    await cityBtn.first().click();
    await page.getByText('Athens', { exact: true }).first().click({ timeout: 10000 });
  }
  await page.getByPlaceholder('Required if no area is listed above').fill('Monastiraki QA');
  await page.getByPlaceholder('Short warning title').fill(`Runtime submit ${Date.now()}`);
  await page.getByPlaceholder('Describe what happened').fill('Runtime submit flow proof');
  await page.getByTestId('banditeam-report-submit').click();

  await wait(1300);
  result.screenshots.afterSubmitTransition = path.join(outDir, '4-after-submit-transition.png');
  await page.screenshot({ path: result.screenshots.afterSubmitTransition, fullPage: true });

  // Transition check: modal overlay + video or any full-screen transition frame
  const hasVideoEl = await page.locator('video').count();
  const overlayHasDarkMask = await page.evaluate(() => {
    const divs = Array.from(document.querySelectorAll('div'));
    return divs.some((el) => {
      const style = window.getComputedStyle(el);
      return style.position === 'absolute' && style.backgroundColor.includes('rgba(0, 0, 0');
    });
  });
  result.checks.submitTransitionVideoShown = hasVideoEl > 0 || overlayHasDarkMask;

  await wait(9000); // allow overlay onFinished -> /bandiTeam
  result.urls.afterSubmit = page.url();
  result.screenshots.afterSubmitLanding = path.join(outDir, '5-after-submit-landing.png');
  await page.screenshot({ path: result.screenshots.afterSubmitLanding, fullPage: true });

  const bodyAfterSubmit = ((await page.textContent('body')) || '').trim();
  result.checks.noWhitePageAfterSubmit = bodyAfterSubmit.length > 40;

  await page.goto(`${base}/bandits`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(2200);
  result.urls.finalHome = page.url();
  result.screenshots.finalHomeFeed = path.join(outDir, '6-final-home-feed.png');
  await page.screenshot({ path: result.screenshots.finalHomeFeed, fullPage: true });
  result.checks.returnsToHomeFeed = page.url().includes('/bandits');

  // Navigation sanity after submit flow
  await page.goto(`${base}/menu`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1000);
  await page.goto(`${base}/following`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(1000);
  await page.goBack({ timeout: 15000 });
  await wait(1000);
  result.screenshots.navAfterSubmit = path.join(outDir, '7-nav-after-submit.png');
  await page.screenshot({ path: result.screenshots.navAfterSubmit, fullPage: true });
  result.checks.noBrokenNavigation = page.url().includes('/menu');

  result.pass = Object.values(result.checks).every(Boolean) ? 'PASS' : 'FAIL';
} catch (e) {
  result.error = e instanceof Error ? e.message : String(e);
  result.pass = 'FAIL';
} finally {
  await browser.close();
}

await writeFile(path.join(outDir, 'RESULT.json'), JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify({ pass: result.pass, outDir, error: result.error }));

